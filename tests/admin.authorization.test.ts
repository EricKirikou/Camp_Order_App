import { describe, expect, it } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import type { User } from "../drizzle/schema";

function createContext(role: User["role"] | null): TrpcContext {
  const user: User | null = role ? {
    id: 1,
    openId: "authorization-test-user",
    name: "Authorization Test",
    email: "test@example.test",
    loginMethod: "test",
    role,
    phoneNumber: "+233241234567",
    passwordHash: null,
    phoneVerifiedAt: new Date(),
    campusId: null,
    failedLoginAttempts: 0,
    loginLockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } : null;
  return { user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("admin catalog authorization", () => {
  it("denies anonymous catalog management", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(caller.admin.campuses()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("denies users without the admin role", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.admin.campuses()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});