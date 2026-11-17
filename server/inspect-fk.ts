import "dotenv/config";
import { sql } from "drizzle-orm";
import { getDb } from "./db";

async function inspect() {
  const db = await getDb();
  if (!db) process.exit(1);
  const [cols] = await db.execute(sql`DESCRIBE order_items`);
  console.log("order_items schema:", cols);
  const [prodCols] = await db.execute(sql`DESCRIBE products`);
  console.log("products schema:", prodCols);
  const [vendorCols] = await db.execute(sql`DESCRIBE vendors`);
  console.log("vendors schema:", vendorCols);
}

inspect().catch(console.error);
