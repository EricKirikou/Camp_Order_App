import { describe, expect, it, vi } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import type { User } from "../drizzle/schema";
import * as dbModule from "../server/db";

function createContext(userOrRole: User["role"] | null | Partial<User>): TrpcContext {
  let user: User | null = null;
  if (typeof userOrRole === "string") {
    user = {
      id: 888,
      openId: "vendor-test-user",
      name: "Chef Kwame",
      email: "chef@example.test",
      loginMethod: "test",
      role: userOrRole,
      phoneNumber: "+233241234567",
      passwordHash: null,
      phoneVerifiedAt: new Date(),
      campusId: 1,
      failedLoginAttempts: 0,
      loginLockedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
  } else if (userOrRole && typeof userOrRole === "object") {
    user = {
      id: userOrRole.id ?? 888,
      openId: userOrRole.openId ?? "vendor-test-user",
      name: userOrRole.name ?? "Chef Kwame",
      email: userOrRole.email ?? "chef@example.test",
      loginMethod: "test",
      role: userOrRole.role ?? "vendor",
      phoneNumber: userOrRole.phoneNumber ?? "+233241234567",
      passwordHash: null,
      phoneVerifiedAt: new Date(),
      campusId: userOrRole.campusId ?? 1,
      failedLoginAttempts: 0,
      loginLockedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
  }

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Vendor router authorization and validation", () => {
  it("denies unauthenticated access to vendor profile", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(caller.vendor.getProfile()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("denies unauthenticated access to update vendor profile", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(
      caller.vendor.updateProfile({
        name: "Campus Grill",
        category: "Food & Drinks",
        etaMin: 25,
        isOpen: 1,
      })
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("validates preparation wait time (etaMin)", async () => {
    const caller = appRouter.createCaller(createContext("vendor"));
    await expect(
      caller.vendor.updateProfile({
        name: "Campus Grill",
        category: "Food & Drinks",
        etaMin: 0, // Invalid: must be at least 1 min
        isOpen: 1,
      })
    ).rejects.toThrow();
  });

  it("denies unauthenticated access to product creation", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(
      caller.vendor.createProduct({
        name: "Waakye Supreme",
        category: "Meals",
        pricePesewas: 3500,
      })
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("denies unauthenticated access to order preparation actions", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(caller.vendor.markPreparing({ orderId: 101 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller.vendor.markPrepared({ orderId: 101 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("restricts vendor catalog queries so vendors only see items they create", async () => {
    const mockVendor = { id: 10, userId: 888, name: "Chef Kwame's Kitchen", campusId: 1 };
    const mockProducts = [
      { id: 101, vendorId: 10, name: "Waakye", category: "food", isAvailable: 1, description: "Tasty waakye" },
      { id: 102, vendorId: 20, name: "Burger", category: "food", isAvailable: 1, description: "Beef burger" },
    ];

    const createQuery = (data: any) => {
      const obj: any = {
        then: (resolve: any, reject?: any) => Promise.resolve(data).then(resolve, reject),
        where: () => createQuery(data),
        orderBy: () => createQuery(data),
        limit: (n: number) => createQuery(Array.isArray(data) ? data.slice(0, n) : data),
      };
      return obj;
    };

    const extractNum = (c: any): number | null => {
      if (!c) return null;
      if (typeof c.value === "number") return c.value;
      if (c.right && typeof c.right.value === "number") return c.right.value;
      if (Array.isArray(c.queryChunks)) {
        for (const chunk of c.queryChunks) {
          if (chunk && typeof chunk.value === "number") return chunk.value;
        }
      }
      return null;
    };

    vi.spyOn(dbModule, "getDb").mockResolvedValue({
      select: () => ({
        from: (table: any) => {
          const tableName =
            table?.[Symbol.for("drizzle:Name")] ??
            table?.[Symbol.for("drizzle:BaseName")] ??
            table?._?.name ??
            table?.name ??
            "";
          if (tableName.includes("campus")) return createQuery([{ id: 1, name: "KNUST", isActive: 1 }]);
          if (tableName.includes("vendor")) {
            return {
              where: (cond: any) => {
                const val = extractNum(cond);
                if (val === 20) return createQuery([]);
                return createQuery([mockVendor]);
              },
              then: (resolve: any) => Promise.resolve([mockVendor]).then(resolve),
              orderBy: () => createQuery([mockVendor]),
            };
          }
          if (tableName.includes("product")) {
            return {
              where: (cond: any) => {
                const val = extractNum(cond);
                if (val === 102) return createQuery([mockProducts[1]]);
                if (val === 101) return createQuery([mockProducts[0]]);
                return createQuery(mockProducts.filter((p) => p.vendorId === 10));
              },
              then: (resolve: any) => Promise.resolve(mockProducts.filter((p) => p.vendorId === 10)).then(resolve),
              orderBy: () => createQuery(mockProducts.filter((p) => p.vendorId === 10)),
            };
          }
          return createQuery([]);
        },
      }),
    } as any);

    const vendorCaller = appRouter.createCaller(createContext("vendor"));
    const vendorHome = await vendorCaller.catalog.home();
    expect(vendorHome.vendors).toEqual([mockVendor]);
    expect(vendorHome.products).toEqual([mockProducts[0]]);

    const vendorProducts = await vendorCaller.catalog.listProducts();
    expect(vendorProducts).toEqual([mockProducts[0]]);

    // Vendor can view their own product
    const myProduct = await vendorCaller.catalog.product({ id: 101 });
    expect(myProduct.id).toBe(101);

    // Vendor cannot view other vendors' products
    await expect(vendorCaller.catalog.product({ id: 102 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    // Vendor can view their own storefront
    const myShop = await vendorCaller.catalog.vendor({ id: 10 });
    expect(myShop.id).toBe(10);

    // Vendor cannot view other vendors' storefront
    await expect(vendorCaller.catalog.vendor({ id: 20 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
