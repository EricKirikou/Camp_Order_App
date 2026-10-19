import { afterEach, describe, expect, it, vi } from "vitest";
import type { User } from "../drizzle/schema";
import {
  createOtp,
  createSessionToken,
  hashOtp,
  hashPassword,
  normalizePhone,
  safeHashEqual,
  verifyPassword,
  verifySessionToken,
} from "../server/services/security";

const testUser = {
  id: 741,
  openId: "co_test_user",
  name: "Sample Student",
  email: "student@example.test",
  loginMethod: "phone_password_otp",
  role: "user",
  phoneNumber: "+233241234567",
  passwordHash: null,
  phoneVerifiedAt: new Date(),
  campusId: null,
  failedLoginAttempts: 0,
  loginLockedUntil: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
} satisfies User;

afterEach(() => vi.unstubAllEnvs());

describe("CampOrder security utilities", () => {
  it("normalizes common Ghana local and international formats", () => {
    expect(normalizePhone("024 123 4567")).toBe("+233241234567");
    expect(normalizePhone("233 24 123 4567")).toBe("+233241234567");
    expect(normalizePhone("+233 24-123-4567")).toBe("+233241234567");
    expect(() => normalizePhone("555")).toThrow(/valid phone/i);
  });

  it("uses random salts and verifies passwords without storing plaintext", async () => {
    const first = await hashPassword("campus-secret-123");
    const second = await hashPassword("campus-secret-123");
    expect(first).toMatch(/^scrypt\$16384\$/);
    expect(first).not.toBe(second);
    expect(first).not.toContain("campus-secret-123");
    await expect(verifyPassword("campus-secret-123", first)).resolves.toBe(true);
    await expect(verifyPassword("not-the-password", first)).resolves.toBe(false);
  });

  it("creates six-digit OTP strings and constant-time scoped OTP hashes", () => {
    for (let i = 0; i < 20; i += 1) expect(createOtp()).toMatch(/^\d{6}$/);
    vi.stubEnv("CAMPORDER_SESSION_SECRET", "unit-test-session-secret-that-is-longer-than-32-chars");
    const digest = hashOtp(12, "+233241234567", "signup", "042891");
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toContain("042891");
    expect(safeHashEqual(digest, hashOtp(12, "+233241234567", "signup", "042891"))).toBe(true);
    expect(safeHashEqual(digest, hashOtp(12, "+233241234567", "login", "042891"))).toBe(false);
  });

  it("signs expiring app sessions with the configured project secret", async () => {
    vi.stubEnv("CAMPORDER_SESSION_SECRET", "unit-test-session-secret-that-is-longer-than-32-chars");
    const token = await createSessionToken(testUser);
    await expect(verifySessionToken(token)).resolves.toBe(testUser.id);
    await expect(verifySessionToken(`${token}x`)).resolves.toBeNull();
  });
});
