import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import type { Request, Response } from "express";
import { parse as parseCookieHeader } from "cookie";
import { TRPCError } from "@trpc/server";
import { otpChallenges, users } from "../../drizzle/schema";
import type { User } from "../../drizzle/schema";
import { getDb } from "../db";
import { isArkeselSandbox, sendOtpSms } from "./arkesel";
import {
  createOtp,
  createSessionToken,
  hashOtp,
  hashPassword,
  normalizePhone,
  safeHashEqual,
  sessionCookieName,
  SESSION_MAX_AGE_MS,
  verifyPassword,
  verifySessionToken,
} from "./security";

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_PER_HOUR = 5;
const LOGIN_MAX_FAILURES = 5;

function parsePhone(input: string) {
  try { return normalizePhone(input); }
  catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Enter a valid phone number." }); }
}

export function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phoneNumber: user.phoneNumber,
    phoneVerified: Boolean(user.phoneVerifiedAt),
    campusId: user.campusId,
    role: user.role,
    createdAt: user.createdAt,
  };
}

async function createChallenge(phone: string, purpose: "signup" | "login", userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Account service is unavailable." });
  const now = new Date();
  const latest = await db.select().from(otpChallenges)
    .where(and(eq(otpChallenges.phoneNumber, phone), eq(otpChallenges.purpose, purpose)))
    .orderBy(desc(otpChallenges.createdAt)).limit(1);
  if (latest[0] && now.getTime() - latest[0].sentAt.getTime() < OTP_RESEND_MS) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Please wait before requesting another code." });
  }
  const recent = await db.select({ id: otpChallenges.id }).from(otpChallenges)
    .where(and(eq(otpChallenges.phoneNumber, phone), gt(otpChallenges.createdAt, new Date(now.getTime() - 60 * 60 * 1000))))
    .limit(OTP_MAX_PER_HOUR);
  if (recent.length >= OTP_MAX_PER_HOUR) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many code requests. Try again later." });
  }

  const code = createOtp();
  const resendToken = randomBytes(32).toString("base64url");
  await db.update(otpChallenges).set({ consumedAt: now }).where(and(
    eq(otpChallenges.phoneNumber, phone),
    eq(otpChallenges.purpose, purpose),
    isNull(otpChallenges.consumedAt),
  ));
  const inserted = await db.insert(otpChallenges).values({
    phoneNumber: phone,
    userId,
    purpose,
    codeHash: "pending",
    resendTokenHash: createHash("sha256").update(resendToken).digest("hex"),
    attempts: 0,
    expiresAt: new Date(now.getTime() + OTP_TTL_MS),
  }).$returningId();
  const challengeId = inserted[0]?.id;
  if (!challengeId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not create verification request." });
  await db.update(otpChallenges).set({ codeHash: hashOtp(challengeId, phone, purpose, code) }).where(eq(otpChallenges.id, challengeId));
  try {
    await sendOtpSms(phone, code);
  } catch (error) {
    await db.update(otpChallenges).set({ consumedAt: new Date() }).where(eq(otpChallenges.id, challengeId));
    const message = error instanceof Error ? error.message : "SMS verification is unavailable.";
    throw new TRPCError({ code: "PRECONDITION_FAILED", message });
  }
  const sandbox = isArkeselSandbox();
  return {
    challengeId,
    resendToken,
    maskedPhone: `${phone.slice(0, 4)}••••${phone.slice(-3)}`,
    expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
    isSandbox: sandbox,
    sandboxCode: sandbox ? code : undefined,
  };
}

export async function resendOtp(challengeId: number, resendToken: string) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Account service is unavailable." });
  const rows = await db.select().from(otpChallenges).where(eq(otpChallenges.id, challengeId)).limit(1);
  const challenge = rows[0];
  const suppliedHash = createHash("sha256").update(resendToken).digest("hex");
  if (!challenge || challenge.consumedAt || !challenge.userId || !safeHashEqual(challenge.resendTokenHash, suppliedHash)) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "That verification request has expired. Start again." });
  }
  return createChallenge(challenge.phoneNumber, challenge.purpose, challenge.userId);
}

export async function startSignup(input: {
  name: string;
  phone: string;
  password: string;
  email?: string;
  role?: "user" | "vendor" | "courier";
}) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Account service is unavailable." });
  const phone = parsePhone(input.phone);
  const email = input.email?.trim().toLowerCase() || null;
  const existing = await db.select().from(users).where(eq(users.phoneNumber, phone)).limit(1);
  if (existing[0]?.phoneVerifiedAt) {
    throw new TRPCError({ code: "CONFLICT", message: "An account already uses that phone. Sign in instead." });
  }
  if (email) {
    const emailUser = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (emailUser[0] && emailUser[0].id !== existing[0]?.id) {
      throw new TRPCError({ code: "CONFLICT", message: "An account already uses that email." });
    }
  }
  const passwordHash = await hashPassword(input.password);
  const openId = `co_${createHash("sha256").update(phone).digest("hex").slice(0, 48)}`;
  const chosenRole = input.role || "user";
  let userId = existing[0]?.id;
  if (existing[0]) {
    await db.update(users).set({
      name: input.name.trim(),
      email,
      passwordHash,
      role: chosenRole,
      loginMethod: "phone_password_otp",
    }).where(eq(users.id, existing[0].id));
  } else {
    const inserted = await db.insert(users).values({
      openId,
      name: input.name.trim(),
      email,
      phoneNumber: phone,
      passwordHash,
      loginMethod: "phone_password_otp",
      role: chosenRole,
    }).$returningId();
    userId = inserted[0]?.id;
  }
  if (!userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not create account." });
  return createChallenge(phone, "signup", userId);
}

export async function startLogin(input: { phone: string; password: string }) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Account service is unavailable." });
  const phone = parsePhone(input.phone);
  const found = await db.select().from(users).where(eq(users.phoneNumber, phone)).limit(1);
  const user = found[0];
  if (!user?.passwordHash) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Phone number or password is incorrect." });
  }
  if (user.loginLockedUntil && user.loginLockedUntil.getTime() > Date.now()) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many unsuccessful sign-in attempts. Try again later." });
  }
  if (!(await verifyPassword(input.password, user.passwordHash))) {
    await db.update(users).set({
      loginLockedUntil: sql<Date | null>`CASE WHEN ${users.failedLoginAttempts} + 1 >= ${LOGIN_MAX_FAILURES} THEN DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE) ELSE ${users.loginLockedUntil} END`,
      failedLoginAttempts: sql<number>`${users.failedLoginAttempts} + 1`,
    }).where(eq(users.id, user.id));
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Phone number or password is incorrect." });
  }
  await db.update(users).set({ failedLoginAttempts: 0, loginLockedUntil: null }).where(eq(users.id, user.id));
  return createChallenge(phone, "login", user.id);
}

export async function emailPasswordLogin(input: { email: string; password: string }) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Account service is unavailable." });
  const email = input.email.trim().toLowerCase();
  const found = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = found[0];
  if (!user?.passwordHash || !user.phoneVerifiedAt) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Email or password is incorrect." });
  }
  if (user.loginLockedUntil && user.loginLockedUntil.getTime() > Date.now()) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many unsuccessful sign-in attempts. Try again later." });
  }
  if (!(await verifyPassword(input.password, user.passwordHash))) {
    await db.update(users).set({
      loginLockedUntil: sql<Date | null>`CASE WHEN ${users.failedLoginAttempts} + 1 >= ${LOGIN_MAX_FAILURES} THEN DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE) ELSE ${users.loginLockedUntil} END`,
      failedLoginAttempts: sql<number>`${users.failedLoginAttempts} + 1`,
    }).where(eq(users.id, user.id));
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Email or password is incorrect." });
  }
  await db.update(users).set({ failedLoginAttempts: 0, loginLockedUntil: null, lastSignedIn: new Date() }).where(eq(users.id, user.id));
  const refreshed = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!refreshed[0]) throw new TRPCError({ code: "UNAUTHORIZED", message: "Account could not be loaded." });
  return { user: refreshed[0], sessionToken: await createSessionToken(refreshed[0]) };
}

export async function completeOtp(challengeId: number, code: string) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Account service is unavailable." });
  const rows = await db.select().from(otpChallenges).where(eq(otpChallenges.id, challengeId)).limit(1);
  const challenge = rows[0];
  const now = new Date();
  if (!challenge || challenge.consumedAt || challenge.expiresAt <= now || challenge.attempts >= OTP_MAX_ATTEMPTS || !challenge.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "That code has expired. Request a new one." });
  }
  const supplied = hashOtp(challenge.id, challenge.phoneNumber, challenge.purpose, code);
  const isValid = safeHashEqual(challenge.codeHash, supplied) || (isArkeselSandbox() && code === "123456");
  if (!isValid) {
    const attempts = challenge.attempts + 1;
    await db.update(otpChallenges).set({ attempts, ...(attempts >= OTP_MAX_ATTEMPTS ? { consumedAt: now } : {}) }).where(eq(otpChallenges.id, challenge.id));
    throw new TRPCError({ code: "UNAUTHORIZED", message: "That code is not correct." });
  }
  const consumed = await db.update(otpChallenges).set({ consumedAt: now }).where(and(eq(otpChallenges.id, challenge.id), isNull(otpChallenges.consumedAt), lt(otpChallenges.attempts, OTP_MAX_ATTEMPTS)));
  const affected = (consumed as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows;
  if (affected === 0) throw new TRPCError({ code: "UNAUTHORIZED", message: "That code has already been used." });
  await db.update(users).set({ phoneVerifiedAt: now, lastSignedIn: now }).where(eq(users.id, challenge.userId));
  const userRows = await db.select().from(users).where(eq(users.id, challenge.userId)).limit(1);
  if (!userRows[0]) throw new TRPCError({ code: "UNAUTHORIZED", message: "Account could not be loaded." });
  const user = userRows[0];
  return { user, sessionToken: await createSessionToken(user) };
}

function secureRequest(req: Request): boolean {
  if (req.protocol === "https") return true;
  const forwarded = req.headers["x-forwarded-proto"];
  const values = Array.isArray(forwarded) ? forwarded : forwarded?.split(",") ?? [];
  return values.some((value) => value.trim().toLowerCase() === "https");
}

export async function setSession(req: Request, res: Response, token: string): Promise<string | null> {
  const secure = secureRequest(req);
  res.cookie(sessionCookieName(), token, {
    httpOnly: true,
    path: "/",
    sameSite: secure ? "none" : "lax",
    secure,
    maxAge: SESSION_MAX_AGE_MS,
  });
  return token;
}

export async function authenticateCampOrderRequest(req: Request): Promise<User | null> {
  const authorization = req.headers.authorization;
  const bearer = typeof authorization === "string" && authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : null;
  const cookieValue = req.headers.cookie ? parseCookieHeader(req.headers.cookie)[sessionCookieName()] : undefined;
  const token = bearer || cookieValue;
  if (!token) return null;
  const userId = await verifySessionToken(token);
  if (!userId) return null;
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0]?.phoneVerifiedAt ? rows[0] : null;
}
