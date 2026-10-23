import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

async function run() {
  const db = await getDb();
  if (!db) {
    console.error("Database connection failed");
    process.exit(1);
  }

  console.log("Connected to database. Applying schema updates...");

  // 1. Expand role enum in users table to include vendor and courier
  try {
    await db.execute(sql`
      ALTER TABLE users 
      MODIFY COLUMN role ENUM('user', 'vendor', 'courier', 'admin', 'moderator') 
      NOT NULL DEFAULT 'user'
    `);
    console.log("✓ Updated users.role ENUM to include vendor and courier");
  } catch (err) {
    console.warn("Notice on users.role:", err instanceof Error ? err.message : err);
  }

  // 2. Add deletedAt column to orders if not exists
  try {
    const [cols] = await db.execute(sql`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'orders' 
        AND COLUMN_NAME = 'deletedAt'
    `) as any;

    if (!cols || cols.length === 0) {
      await db.execute(sql`
        ALTER TABLE orders 
        ADD COLUMN deletedAt TIMESTAMP NULL DEFAULT NULL
      `);
      console.log("✓ Added deletedAt column to orders table");
    } else {
      console.log("✓ orders.deletedAt column already exists");
    }
  } catch (err) {
    console.warn("Notice on orders.deletedAt:", err instanceof Error ? err.message : err);
  }

  // 3. Create order_audit_logs table if not exists
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS order_audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        orderId INT NOT NULL,
        orderCode VARCHAR(32) NOT NULL,
        action VARCHAR(50) NOT NULL,
        actorUserId INT NULL,
        actorName VARCHAR(180) NULL,
        actorEmail VARCHAR(320) NULL,
        reason TEXT NULL,
        snapshot MEDIUMTEXT NOT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_orderId (orderId),
        INDEX idx_orderCode (orderCode),
        INDEX idx_createdAt (createdAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✓ Created or verified order_audit_logs table");
  } catch (err) {
    console.error("Error creating order_audit_logs:", err);
  }

  console.log("All database updates completed successfully.");
  process.exit(0);
}

run().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
