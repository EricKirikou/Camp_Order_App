import { describe, expect, it } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import type { User } from "../drizzle/schema";

function createContext(role: User["role"] | null): TrpcContext {
  const user: User | null = role
    ? {
        id: 999,
        openId: "rider-test-courier",
        name: "Campus Courier",
        email: "courier@example.test",
        loginMethod: "test",
        role,
        phoneNumber: "+233249876543",
        passwordHash: null,
        phoneVerifiedAt: new Date(),
        campusId: 1,
        failedLoginAttempts: 0,
        loginLockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      }
    : null;
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Rider router", () => {
  it("denies unauthenticated access to pending orders", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(caller.rider.pendingOrders()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("denies non-courier users from accessing pending orders", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.rider.pendingOrders()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("denies non-courier users from accepting an order", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.rider.acceptOrder({ orderId: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
