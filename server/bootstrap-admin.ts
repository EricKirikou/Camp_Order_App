import "dotenv/config";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { getDb } from "./db";
import { hashPassword } from "./services/security";

async function bootstrapAdmin() {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "";
  if (!email) throw new Error("ADMIN_EMAIL is required.");
  if (password.length < 16) throw new Error("ADMIN_BOOTSTRAP_PASSWORD must be at least 16 characters.");

  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is required to provision an administrator.");
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const now = new Date();
  const passwordHash = await hashPassword(password);
  if (existing[0]) {
    await db.update(users).set({
      passwordHash,
      role: "admin",
      phoneVerifiedAt: existing[0].phoneVerifiedAt ?? now,
      loginMethod: "email_password_admin",
      failedLoginAttempts: 0,
      loginLockedUntil: null,
    }).where(eq(users.id, existing[0].id));
  } else {
    const openId = `co_admin_${createHash("sha256").update(email).digest("hex").slice(0, 40)}`;
    await db.insert(users).values({
      openId,
      name: "CampOrder Administrator",
      email,
      passwordHash,
      loginMethod: "email_password_admin",
      role: "admin",
      phoneVerifiedAt: now,
    });
  }
  console.log("Administrator account provisioned.");
}

bootstrapAdmin().catch((error) => {
  console.error("Admin provisioning failed:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});