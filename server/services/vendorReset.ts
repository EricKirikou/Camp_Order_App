import fs from "node:fs";
import path from "node:path";
import { and, eq, inArray, ne } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  cartItems,
  orderAuditLogs,
  orderItems,
  products,
  promotions,
  users,
  vendors,
} from "../../drizzle/schema";
import { getDb } from "../db";

export interface ResetVendorActor {
  id: number;
  name?: string | null;
  email?: string | null;
  role?: string | null;
}

export interface ResetVendorResult {
  success: true;
  vendorId: number;
  vendorName: string;
  vendorUserId: number | null;
  productsDeletedCount: number;
  productsArchivedCount: number;
  totalProductsAffected: number;
}

/**
 * Reset a vendor's business profile and catalog while strictly preserving:
 * 1. The vendor's authentication user account in `users` (credentials, role, status intact)
 * 2. All historical `orders`, `order_items`, `payments`, and financial transaction records
 * 3. Database foreign-key referential integrity (handles cart_items, promotions, and order_items)
 */
export async function resetVendorBusiness(
  vendorId: number,
  actor: ResetVendorActor
): Promise<ResetVendorResult> {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database unavailable." });
  }

  // 1. Role verification: only administrators can reset a vendor business
  if (actor.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only administrators have permission to reset vendor business accounts.",
    });
  }

  // 2. Fetch the vendor record to ensure it exists
  const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  if (!vendor) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Vendor record not found." });
  }

  // 3. Fetch all products owned by this vendor
  const vendorProducts = await db.select().from(products).where(eq(products.vendorId, vendor.id));
  const productIds = vendorProducts.map((p) => p.id);

  // 4. Identify uploaded images that are candidates for safe deletion
  // (only delete files that are not referenced by any other product in the system)
  const imagesToCheck = vendorProducts
    .map((p) => p.imageUrl)
    .filter((url): url is string => Boolean(url && url.startsWith("/uploads/")));

  const imagesToUnlink: string[] = [];
  for (const imgUrl of imagesToCheck) {
    const otherRefs = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.imageUrl, imgUrl), ne(products.vendorId, vendor.id)))
      .limit(1);
    if (otherRefs.length === 0) {
      imagesToUnlink.push(imgUrl);
    }
  }

  // 5. Partition products into:
  //    a) unreferencedProducts: safe to permanently delete from `products` table
  //    b) orderedProducts: referenced by historical `order_items`, so they must be
  //       disassociated from the vendor (`vendorId = NULL`, `isAvailable = 0`)
  //       to preserve completed order history and avoid breaking foreign keys.
  let orderedProductIds = new Set<number>();
  if (productIds.length > 0) {
    const orderedRows = await db
      .select({ productId: orderItems.productId })
      .from(orderItems)
      .where(inArray(orderItems.productId, productIds));
    orderedProductIds = new Set(orderedRows.map((r) => r.productId));
  }

  const unreferencedProductIds = productIds.filter((id) => !orderedProductIds.has(id));
  const orderedProductIdsList = productIds.filter((id) => orderedProductIds.has(id));

  // 6. Execute safe database operations inside a transaction
  await db.transaction(async (tx) => {
    // 6a. Delete active cart items referencing the vendor's products
    if (productIds.length > 0) {
      await tx.delete(cartItems).where(inArray(cartItems.productId, productIds));
    }

    // 6b. Delete promotions linked to this vendor or its products
    if (productIds.length > 0) {
      await tx.delete(promotions).where(inArray(promotions.productId, productIds));
    }
    await tx.delete(promotions).where(eq(promotions.vendorId, vendor.id));

    // 6c. Delete unreferenced products completely
    if (unreferencedProductIds.length > 0) {
      await tx.delete(products).where(inArray(products.id, unreferencedProductIds));
    }

    // 6d. Disassociate ordered products so they are completely removed from the vendor's catalog,
    // while keeping historical order item integrity intact
    if (orderedProductIdsList.length > 0) {
      await tx
        .update(products)
        .set({
          vendorId: null,
          isAvailable: 0,
        })
        .where(inArray(products.id, orderedProductIdsList));
    }

    // 6e. Reset the vendor profile details to an unconfigured / empty state
    // Note: We retain the vendor row with its userId link so the vendor user
    // can seamlessly re-enter their business information on their next login.
    const resetSlug = `reset-${vendor.id}-${Date.now().toString(36)}`;
    await tx
      .update(vendors)
      .set({
        name: "[Pending Profile Setup]",
        slug: resetSlug,
        category: "Pending Setup",
        description: null,
        etaMin: 20,
        deliveryFeePesewas: 0,
        isOpen: 0,
        ratingHundredths: 0,
      })
      .where(eq(vendors.id, vendor.id));

    // 6f. Record the reset action in the administrative audit log
    try {
      await tx.insert(orderAuditLogs).values({
        orderId: 0,
        orderCode: `VENDOR_RESET_${vendor.id}`,
        action: "admin_reset_vendor",
        actorUserId: actor.id,
        actorName: actor.name ?? "Admin",
        actorEmail: actor.email ?? null,
        reason: `Administrator reset vendor business profile for "${vendor.name}" (ID ${vendor.id})`,
        snapshot: JSON.stringify({
          vendorId: vendor.id,
          vendorUserId: vendor.userId,
          originalName: vendor.name,
          originalCategory: vendor.category,
          originalDescription: vendor.description,
          productsPermanentlyDeleted: unreferencedProductIds.length,
          productsArchivedForHistoricalOrders: orderedProductIdsList.length,
          totalProducts: productIds.length,
          resetAt: new Date().toISOString(),
          adminActor: {
            id: actor.id,
            name: actor.name,
            email: actor.email,
          },
        }),
      });
    } catch {
      // Audit log failures should not block the primary reset
    }
  });

  // 7. Clean up unreferenced image files from disk safely
  for (const imgUrl of imagesToUnlink) {
    try {
      const filename = path.basename(imgUrl);
      const filePath = path.join(process.cwd(), "public", "uploads", filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {}
  }

  return {
    success: true,
    vendorId: vendor.id,
    vendorName: vendor.name,
    vendorUserId: vendor.userId,
    productsDeletedCount: unreferencedProductIds.length,
    productsArchivedCount: orderedProductIdsList.length,
    totalProductsAffected: productIds.length,
  };
}

