import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { products, promotions, vendors } from "../../drizzle/schema";
import { getDb } from "../db";

export interface EnrichedProductPromo {
  id: number;
  type: "product_promo";
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaTarget: string | null;
  imageUrl: string | null;
  badgeText: string | null;
  productId: number;
  priority: number;
  originalPricePesewas: number;
  discountedPricePesewas: number;
  discountPercent: number;
  product: {
    id: number;
    name: string;
    description: string | null;
    category: string;
    pricePesewas: number;
    imageUrl: string | null;
    badge: string | null;
    vendorId: number | null;
    isAvailable: number;
  };
}

export interface EnrichedFeaturedVendor {
  id: number;
  type: "featured_vendor";
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaTarget: string | null;
  imageUrl: string | null;
  badgeText: string | null;
  vendorId: number;
  priority: number;
  vendor: {
    id: number;
    name: string;
    category: string;
    description: string | null;
    etaMin: number;
    deliveryFeePesewas: number;
    isOpen: number;
    imageUrl?: string | null;
  };
}

export interface EnrichedBannerAd {
  id: number;
  type: "banner_ad";
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaTarget: string | null;
  imageUrl: string | null;
  badgeText: string | null;
  productId: number | null;
  vendorId: number | null;
  priority: number;
}

export interface ActivePromotionsResult {
  bannerAds: EnrichedBannerAd[];
  productPromos: EnrichedProductPromo[];
  featuredVendors: EnrichedFeaturedVendor[];
}

/**
 * Calculates discount percentage from badge text or title/subtitle.
 * E.g. "50% OFF", "20% discount", "50% off This Week"
 */
function extractDiscountPercent(text: string | null | undefined): number {
  if (!text) return 0;
  const match = text.match(/(\d{1,2})\s*%/);
  if (match && match[1]) {
    const val = parseInt(match[1], 10);
    if (val > 0 && val <= 90) return val;
  }
  return 0;
}

/**
 * Retrieves all currently active and date-valid promotions, enriched with
 * product/vendor information and discount calculations.
 */
export async function getActivePromotions(campusId?: number): Promise<ActivePromotionsResult> {
  const db = await getDb();
  if (!db) {
    return { bannerAds: [], productPromos: [], featuredVendors: [] };
  }

  const now = new Date();

  // 1. Fetch active campaigns from promotions table
  // Filter by isActive = 1, startsAt <= now (or null), endsAt >= now (or null)
  const rows = await db
    .select()
    .from(promotions)
    .where(
      and(
        eq(promotions.isActive, 1),
        or(isNull(promotions.startsAt), lte(promotions.startsAt, now)),
        or(isNull(promotions.endsAt), gte(promotions.endsAt, now))
      )
    )
    .orderBy(desc(promotions.priority), desc(promotions.createdAt));

  // Additional JavaScript safety check for timestamps/timezones
  const currentTime = now.getTime();
  const validRows = rows.filter((promo) => {
    if (promo.startsAt && new Date(promo.startsAt).getTime() > currentTime) return false;
    if (promo.endsAt && new Date(promo.endsAt).getTime() < currentTime) return false;
    return true;
  });

  const bannerAds: EnrichedBannerAd[] = [];
  const productPromos: EnrichedProductPromo[] = [];
  const featuredVendors: EnrichedFeaturedVendor[] = [];

  for (const promo of validRows) {
    if (promo.type === "banner_ad") {
      bannerAds.push({
        id: promo.id,
        type: "banner_ad",
        title: promo.title,
        subtitle: promo.subtitle,
        ctaLabel: promo.ctaLabel,
        ctaTarget: promo.ctaTarget,
        imageUrl: promo.imageUrl,
        badgeText: promo.badgeText,
        productId: promo.productId,
        vendorId: promo.vendorId,
        priority: promo.priority,
      });
    } else if (promo.type === "product_promo" && promo.productId) {
      // Look up product
      const productRows = await db
        .select()
        .from(products)
        .where(and(eq(products.id, promo.productId), eq(products.isAvailable, 1)))
        .limit(1);

      const prod = productRows[0];
      if (!prod) continue;

      // Ensure vendor is valid if product is linked to a vendor
      if (prod.vendorId) {
        const vendorRows = await db
          .select({ id: vendors.id, name: vendors.name, isOpen: vendors.isOpen })
          .from(vendors)
          .where(eq(vendors.id, prod.vendorId))
          .limit(1);

        const seller = vendorRows[0];
        if (!seller || seller.name === "[Pending Profile Setup]" || !seller.isOpen) {
          continue;
        }
      }

      // Calculate discount
      let discountPercent = extractDiscountPercent(promo.badgeText);
      if (!discountPercent) discountPercent = extractDiscountPercent(promo.title);
      if (!discountPercent) discountPercent = extractDiscountPercent(promo.subtitle);

      const originalPrice = prod.pricePesewas;
      const discountedPrice = discountPercent > 0
        ? Math.round(originalPrice * (100 - discountPercent) / 100)
        : originalPrice;

      productPromos.push({
        id: promo.id,
        type: "product_promo",
        title: promo.title,
        subtitle: promo.subtitle,
        ctaLabel: promo.ctaLabel,
        ctaTarget: promo.ctaTarget,
        imageUrl: promo.imageUrl || prod.imageUrl,
        badgeText: promo.badgeText || (discountPercent > 0 ? `${discountPercent}% OFF` : "Special Offer"),
        productId: prod.id,
        priority: promo.priority,
        originalPricePesewas: originalPrice,
        discountedPricePesewas: discountedPrice,
        discountPercent,
        product: {
          id: prod.id,
          name: prod.name,
          description: prod.description,
          category: prod.category,
          pricePesewas: prod.pricePesewas,
          imageUrl: prod.imageUrl,
          badge: prod.badge,
          vendorId: prod.vendorId,
          isAvailable: prod.isAvailable,
        },
      });
    } else if (promo.type === "featured_vendor" && promo.vendorId) {
      // Look up vendor
      const vendorRows = await db
        .select()
        .from(vendors)
        .where(and(eq(vendors.id, promo.vendorId), eq(vendors.isOpen, 1)))
        .limit(1);

      const v = vendorRows[0];
      if (!v || v.name === "[Pending Profile Setup]") continue;

      // Filter by campus if campusId is passed
      if (campusId && v.campusId !== campusId) {
        // If campusId was requested and vendor belongs to another campus, skip
        continue;
      }

      featuredVendors.push({
        id: promo.id,
        type: "featured_vendor",
        title: promo.title,
        subtitle: promo.subtitle,
        ctaLabel: promo.ctaLabel,
        ctaTarget: promo.ctaTarget,
        imageUrl: promo.imageUrl,
        badgeText: promo.badgeText || "Featured",
        vendorId: v.id,
        priority: promo.priority,
        vendor: {
          id: v.id,
          name: v.name,
          category: v.category,
          description: v.description,
          etaMin: v.etaMin,
          deliveryFeePesewas: v.deliveryFeePesewas,
          isOpen: v.isOpen,
        },
      });
    }
  }

  return { bannerAds, productPromos, featuredVendors };
}

