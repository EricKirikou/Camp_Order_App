import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

async function run() {
  const db = await getDb();
  if (!db) {
    console.error("Database connection failed");
    process.exit(1);
  }

  console.log("Connected to database. Applying courier & vendor schema updates...");

  // 1. Add courierId to orders
  try {
    const [cols] = await db.execute(sql`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'orders' 
        AND COLUMN_NAME = 'courierId'
    `) as any;

    if (!cols || cols.length === 0) {
      await db.execute(sql`
        ALTER TABLE orders 
        ADD COLUMN courierId INT NULL DEFAULT NULL,
        ADD INDEX idx_courierId (courierId)
      `);
      console.log("✓ Added courierId column to orders table");
    } else {
      console.log("✓ orders.courierId column already exists");
    }
  } catch (err) {
    console.warn("Notice on orders.courierId:", err instanceof Error ? err.message : err);
  }

  // 2. Add courierAcceptedAt to orders
  try {
    const [cols] = await db.execute(sql`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'orders' 
        AND COLUMN_NAME = 'courierAcceptedAt'
    `) as any;

    if (!cols || cols.length === 0) {
      await db.execute(sql`
        ALTER TABLE orders 
        ADD COLUMN courierAcceptedAt TIMESTAMP NULL DEFAULT NULL
      `);
      console.log("✓ Added courierAcceptedAt column to orders table");
    } else {
      console.log("✓ orders.courierAcceptedAt column already exists");
    }
  } catch (err) {
    console.warn("Notice on orders.courierAcceptedAt:", err instanceof Error ? err.message : err);
  }

  // 3. Add userId to vendors
  try {
    const [cols] = await db.execute(sql`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'vendors' 
        AND COLUMN_NAME = 'userId'
    `) as any;

    if (!cols || cols.length === 0) {
      await db.execute(sql`
        ALTER TABLE vendors 
        ADD COLUMN userId INT NULL DEFAULT NULL,
        ADD INDEX idx_vendor_userId (userId)
      `);
      console.log("✓ Added userId column to vendors table");
    } else {
      console.log("✓ vendors.userId column already exists");
    }
  } catch (err) {
    console.warn("Notice on vendors.userId:", err instanceof Error ? err.message : err);
  }

  console.log("All courier and vendor database updates completed successfully.");
  process.exit(0);
}

run().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
