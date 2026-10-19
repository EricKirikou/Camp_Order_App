import { randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual, createHmac } from "node:crypto";
import { promisify } from "node:util";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: string,
  keylen: number,
  options?: { N?: number; r?: number; p?: number },
) => Promise<Buffer>;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const SESSION_COOKIE = "camporder_session";

export function normalizePhone(input: string): string {
  const raw = input.trim().replace(/[()\s.-]/g, "");
  let value = raw;
  if (/^0\d{9}$/.test(value)) value = `+233${value.slice(1)}`;
  else if (/^233\d{9}$/.test(value)) value = `+${value}`;
  else if (/^\d{9}$/.test(value)) value = `+233${value}`;
  if (!/^\+[1-9]\d{7,14}$/.test(value)) throw new Error("Enter a valid phone number, including its country code.");
  return value;
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 8 || password.length > 128) throw new Error("Password must be at least 8 characters.");
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [, cost, salt, keyHex] = encoded.split("$");
  if (cost !== "16384" || !salt || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(password, salt, expected.length, { N: 16384, r: 8, p: 1 });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function signingSecret(): Uint8Array {
  const secret = process.env.CAMPORDER_SESSION_SECRET || process.env.MANUS_JWT_SECRET || process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("CampOrder server session secret is not configured.");
  return new TextEncoder().encode(secret);
}

export function hashOtp(challengeId: number, phone: string, purpose: string, code: string): string {
  return createHmac("sha256", signingSecret()).update(`${challengeId}:${phone}:${purpose}:${code}`).digest("hex");
}

export function safeHashEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

export async function createSessionToken(user: User): Promise<string> {
  return new SignJWT({
    typ: "camporder-session",
    uid: user.id,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("camporder")
    .setAudience("camporder-app")
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(signingSecret());
}

export async function verifySessionToken(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, signingSecret(), {
      issuer: "camporder",
      audience: "camporder-app",
      algorithms: ["HS256"],
    });
    if (payload.typ !== "camporder-session" || typeof payload.uid !== "number") return null;
    return payload.uid;
  } catch {
    return null;
  }
}

export function sessionCookieName() {
  return SESSION_COOKIE;
}

export const SESSION_MAX_AGE_MS = SESSION_TTL_SECONDS * 1000;
