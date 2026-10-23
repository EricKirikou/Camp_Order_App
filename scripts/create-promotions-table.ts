import "dotenv/config";
import { getDb } from "../server/db";

async function main() {
  const db = await getDb();
  if (!db) { console.log("NO DB"); return; }
  await db.execute(`
    CREATE TABLE IF NOT EXISTS promotions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type ENUM('product_promo','banner_ad','featured_vendor') NOT NULL DEFAULT 'banner_ad',
      title VARCHAR(200) NOT NULL,
      subtitle TEXT,
      ctaLabel VARCHAR(80),
      ctaTarget VARCHAR(255),
      imageUrl VARCHAR(512),
      badgeText VARCHAR(60),
      productId INT,
      vendorId INT,
      isActive INT NOT NULL DEFAULT 1,
      startsAt TIMESTAMP NULL,
      endsAt TIMESTAMP NULL,
      priority INT NOT NULL DEFAULT 0,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log("PROMOTIONS TABLE CREATED");
}

main().catch(console.error);
