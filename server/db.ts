import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import type { InsertUser } from "../drizzle/schema";
import { users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

/** Reuse the managed MySQL connection. Development and published app share this database. */
export async function getDb() {
  const databaseUrl = process.env.DATABASE_URL || ENV.databaseUrl;
  if (!_db && databaseUrl) {
    try {
      const parsedUrl = new URL(databaseUrl);
      const requiresTls = parsedUrl.searchParams.get("ssl-mode")?.toLowerCase() === "required";
      parsedUrl.searchParams.delete("ssl-mode");
      const caFile = process.env.DATABASE_SSL_CA_FILE;
      if (requiresTls && !caFile) throw new Error("DATABASE_SSL_CA_FILE is required for verified TLS.");
      _db = drizzle({
        connection: {
          uri: parsedUrl.toString(),
          ...(requiresTls ? { ssl: { ca: readFileSync(resolve(process.cwd(), caFile!), "utf8") } } : {}),
        },
      });
    } catch (error) {
      console.warn("[Database] Failed to configure connection:", error instanceof Error ? error.message : "unknown error");
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod", "phoneNumber", "passwordHash"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  }
  if (user.phoneVerifiedAt !== undefined) {
    values.phoneVerifiedAt = user.phoneVerifiedAt;
    updateSet.phoneVerifiedAt = user.phoneVerifiedAt;
  }
  if (user.campusId !== undefined) {
    values.campusId = user.campusId;
    updateSet.campusId = user.campusId;
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  } else {
    values.lastSignedIn = new Date();
    updateSet.lastSignedIn = new Date();
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}
