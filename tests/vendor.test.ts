import { describe, expect, it } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import type { User } from "../drizzle/schema";

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
});
