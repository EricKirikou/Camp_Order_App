import { desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import path from "node:path";
import fs from "node:fs";
import crypto, { randomUUID } from "node:crypto";
import { campusServices, campuses, orders, products, promotions, users, vendors } from "../../drizzle/schema";
import { adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { hashPassword, normalizePhone } from "../services/security";

function requireDb(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Admin data is unavailable." });
  return db;
}

function rethrowDeleteConflict(error: unknown): never {
  if (error instanceof TRPCError) throw error;
  throw new TRPCError({ code: "CONFLICT", message: "This record is still referenced by other data and cannot be deleted." });
}

const campusFields = z.object({
  slug: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(180),
  city: z.string().trim().min(2).max(100),
  region: z.string().trim().min(2).max(100),
  description: z.string().max(2000).nullable().optional(),
  isActive: z.number().int().min(0).max(1).optional(),
});

const vendorFields = z.object({
  slug: z.string().trim().min(2).max(80),
  campusId: z.number().int().positive(),
  name: z.string().trim().min(2).max(180),
  category: z.string().trim().min(2).max(80),
  description: z.string().max(2000).nullable().optional(),
  etaMin: z.number().int().min(1).max(1440).optional(),
  deliveryFeePesewas: z.number().int().min(0).max(10_000_000).optional(),
  isOpen: z.number().int().min(0).max(1).optional(),
});

const productFields = z.object({
  slug: z.string().trim().min(2).max(100),
  vendorId: z.number().int().positive().nullable().optional(),
  category: z.string().trim().min(2).max(100),
  name: z.string().trim().min(2).max(180),
  description: z.string().max(2000).nullable().optional(),
  pricePesewas: z.number().int().min(0).max(100_000_000),
  imageUrl: z.string().trim().max(512).nullable().optional(),
  badge: z.string().trim().max(80).nullable().optional(),
  isAvailable: z.number().int().min(0).max(1).optional(),
});

const serviceFields = z.object({
  slug: z.string().trim().min(2).max(100),
  name: z.string().trim().min(2).max(180),
  category: z.string().trim().min(2).max(80),
  description: z.string().max(2000).nullable().optional(),
  startingPricePesewas: z.number().int().min(0).max(100_000_000),
  isActive: z.number().int().min(0).max(1).optional(),
});

export const adminRouter = router({
  // Analytics & Insights Table
  analytics: adminProcedure.query(async () => {
    const db = requireDb(await getDb());
    const [orderRows, productRows, vendorRows, campusRows, serviceRows] = await Promise.all([
      db.select().from(orders).orderBy(desc(orders.createdAt)),
      db.select().from(products).orderBy(products.name),
      db.select().from(vendors).orderBy(vendors.name),
      db.select().from(campuses).orderBy(campuses.name),
      db.select().from(campusServices).orderBy(campusServices.name),
    ]);

    let totalGmvPesewas = 0;
    const statusCounts: Record<string, number> = {
      payment_pending: 0,
      placed: 0,
      accepted: 0,
      preparing: 0,
      on_the_way: 0,
      completed: 0,
      cancelled: 0,
    };

    for (const ord of orderRows) {
      if (ord.status) {
        statusCounts[ord.status] = (statusCounts[ord.status] ?? 0) + 1;
      }
      if (ord.paymentStatus === "paid" || ord.status === "completed") {
        totalGmvPesewas += ord.totalPesewas ?? 0;
      }
    }

    const availableProducts = productRows.filter((p) => p.isAvailable === 1).length;
    const openVendors = vendorRows.filter((v) => v.isOpen === 1).length;

    return {
      totalGmvPesewas,
      totalOrders: orderRows.length,
      statusCounts,
      totalProducts: productRows.length,
      availableProducts,
      totalVendors: vendorRows.length,
      openVendors,
      totalCampuses: campusRows.length,
      totalServices: serviceRows.length,
      recentOrders: orderRows.slice(0, 25),
    };
  }),

  // Orders Management (Bolt Food style)
  orders: adminProcedure.query(async () => {
    const db = requireDb(await getDb());
    return db.select().from(orders).orderBy(desc(orders.createdAt)).limit(100);
  }),
  updateOrderStatus: adminProcedure.input(z.object({
    id: z.number().int().positive(),
    status: z.enum(["payment_pending", "placed", "accepted", "preparing", "on_the_way", "completed", "cancelled"]),
    paymentStatus: z.enum(["pending", "paid", "failed", "refunded"]).optional(),
  })).mutation(async ({ input }) => {
    const db = requireDb(await getDb());
    const updateData: Record<string, unknown> = { status: input.status };
    if (input.paymentStatus) updateData.paymentStatus = input.paymentStatus;
    await db.update(orders).set(updateData).where(eq(orders.id, input.id));
    return { success: true } as const;
  }),

  // Image Upload & Removal (Jiji & Bolt Marketplace style)
  uploadImage: adminProcedure.input(z.object({
    filename: z.string().trim().min(1).max(200),
    base64: z.string().min(1),
  })).mutation(async ({ input }) => {
    try {
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const cleanBase64 = input.base64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");
      const buffer = Buffer.from(cleanBase64, "base64");

      const rawExt = path.extname(input.filename).toLowerCase() || ".jpg";
      const ext = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(rawExt) ? rawExt : ".jpg";
      const uniqueName = `camp_${Date.now()}_${crypto.randomBytes(4).toString("hex")}${ext}`;
      const filePath = path.join(uploadsDir, uniqueName);

      fs.writeFileSync(filePath, buffer);
      return { url: `/uploads/${uniqueName}` };
    } catch {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to upload image. Please try again.",
      });
    }
  }),
  clearProductImage: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const db = requireDb(await getDb());
    const [prod] = await db.select({ imageUrl: products.imageUrl }).from(products).where(eq(products.id, input.id)).limit(1);
    if (prod?.imageUrl?.startsWith("/uploads/")) {
      const filename = path.basename(prod.imageUrl);
      const filePath = path.join(process.cwd(), "public", "uploads", filename);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch {}
      }
    }
    await db.update(products).set({ imageUrl: null }).where(eq(products.id, input.id));
    return { success: true, fileDeleted: true } as const;
  }),

  // Campuses
  campuses: adminProcedure.query(async () => requireDb(await getDb()).select().from(campuses).orderBy(campuses.name)),
  createCampus: adminProcedure.input(campusFields).mutation(async ({ input }) => {
    const db = requireDb(await getDb());
    const inserted = await db.insert(campuses).values({ ...input, description: input.description ?? null, isSample: 0, isActive: input.isActive ?? 1 }).$returningId();
    return { id: inserted[0]?.id };
  }),
  updateCampus: adminProcedure.input(z.object({ id: z.number().int().positive(), data: campusFields.partial().refine((data) => Object.keys(data).length > 0) })).mutation(async ({ input }) => {
    const db = requireDb(await getDb());
    await db.update(campuses).set(input.data).where(eq(campuses.id, input.id));
    return { success: true } as const;
  }),
  deleteCampus: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    try { await requireDb(await getDb()).delete(campuses).where(eq(campuses.id, input.id)); return { success: true } as const; }
    catch (error) { return rethrowDeleteConflict(error); }
  }),

  // Vendors
  vendors: adminProcedure.query(async () => requireDb(await getDb()).select().from(vendors).orderBy(vendors.name)),
  createVendor: adminProcedure.input(vendorFields).mutation(async ({ input }) => {
    const db = requireDb(await getDb());
    const [campus] = await db.select({ id: campuses.id }).from(campuses).where(eq(campuses.id, input.campusId)).limit(1);
    if (!campus) throw new TRPCError({ code: "NOT_FOUND", message: "Campus not found." });
    const inserted = await db.insert(vendors).values({ ...input, description: input.description ?? null, etaMin: input.etaMin ?? 25, deliveryFeePesewas: input.deliveryFeePesewas ?? 0, isOpen: input.isOpen ?? 1, ratingHundredths: 0, isSample: 0 }).$returningId();
    return { id: inserted[0]?.id };
  }),
  updateVendor: adminProcedure.input(z.object({ id: z.number().int().positive(), data: vendorFields.partial().refine((data) => Object.keys(data).length > 0) })).mutation(async ({ input }) => {
    const db = requireDb(await getDb());
    if (input.data.campusId) {
      const [campus] = await db.select({ id: campuses.id }).from(campuses).where(eq(campuses.id, input.data.campusId)).limit(1);
      if (!campus) throw new TRPCError({ code: "NOT_FOUND", message: "Campus not found." });
    }
    await db.update(vendors).set(input.data).where(eq(vendors.id, input.id));
    return { success: true } as const;
  }),
  toggleVendorStatus: adminProcedure.input(z.object({
    id: z.number().int().positive(),
    isOpen: z.number().int().min(0).max(1),
  })).mutation(async ({ input }) => {
    const db = requireDb(await getDb());
    await db.update(vendors).set({ isOpen: input.isOpen }).where(eq(vendors.id, input.id));
    return { success: true } as const;
  }),
  deleteVendor: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    try { await requireDb(await getDb()).delete(vendors).where(eq(vendors.id, input.id)); return { success: true } as const; }
    catch (error) { return rethrowDeleteConflict(error); }
  }),

  // Products
  products: adminProcedure.query(async () => requireDb(await getDb()).select().from(products).orderBy(products.name)),
  createProduct: adminProcedure.input(productFields).mutation(async ({ input }) => {
    const db = requireDb(await getDb());
    if (input.vendorId) {
      const [vendor] = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.id, input.vendorId)).limit(1);
      if (!vendor) throw new TRPCError({ code: "NOT_FOUND", message: "Vendor not found." });
    }
    const inserted = await db.insert(products).values({ ...input, vendorId: input.vendorId ?? null, description: input.description ?? null, imageUrl: input.imageUrl ?? null, badge: input.badge ?? null, isAvailable: input.isAvailable ?? 1, isSample: 0 }).$returningId();
    return { id: inserted[0]?.id };
  }),
  updateProduct: adminProcedure.input(z.object({ id: z.number().int().positive(), data: productFields.partial().refine((data) => Object.keys(data).length > 0) })).mutation(async ({ input }) => {
    const db = requireDb(await getDb());
    if (input.data.vendorId) {
      const [vendor] = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.id, input.data.vendorId)).limit(1);
      if (!vendor) throw new TRPCError({ code: "NOT_FOUND", message: "Vendor not found." });
    }
    await db.update(products).set(input.data).where(eq(products.id, input.id));
    return { success: true } as const;
  }),
  toggleProductAvailability: adminProcedure.input(z.object({
    id: z.number().int().positive(),
    isAvailable: z.number().int().min(0).max(1),
  })).mutation(async ({ input }) => {
    const db = requireDb(await getDb());
    await db.update(products).set({ isAvailable: input.isAvailable }).where(eq(products.id, input.id));
    return { success: true } as const;
  }),
  deleteProduct: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    try { await requireDb(await getDb()).delete(products).where(eq(products.id, input.id)); return { success: true } as const; }
    catch (error) { return rethrowDeleteConflict(error); }
  }),

  // Services
  services: adminProcedure.query(async () => requireDb(await getDb()).select().from(campusServices).orderBy(campusServices.name)),
  createService: adminProcedure.input(serviceFields).mutation(async ({ input }) => {
    const inserted = await requireDb(await getDb()).insert(campusServices).values({ ...input, description: input.description ?? null, isActive: input.isActive ?? 1, isSample: 0 }).$returningId();
    return { id: inserted[0]?.id };
  }),
  updateService: adminProcedure.input(z.object({ id: z.number().int().positive(), data: serviceFields.partial().refine((data) => Object.keys(data).length > 0) })).mutation(async ({ input }) => {
    await requireDb(await getDb()).update(campusServices).set(input.data).where(eq(campusServices.id, input.id));
    return { success: true } as const;
  }),
  deleteService: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    try { await requireDb(await getDb()).delete(campusServices).where(eq(campusServices.id, input.id)); return { success: true } as const; }
    catch (error) { return rethrowDeleteConflict(error); }
  }),

  // Moderators Management
  moderators: adminProcedure.query(async () => {
    const db = requireDb(await getDb());
    return db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phoneNumber: users.phoneNumber,
        role: users.role,
        createdAt: users.createdAt,
        lastSignedIn: users.lastSignedIn,
      })
      .from(users)
      .where(eq(users.role, "moderator"))
      .orderBy(desc(users.createdAt));
  }),
  createModerator: adminProcedure.input(z.object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().min(8).max(32),
    email: z.string().trim().email().max(320).optional().or(z.literal("")),
    password: z.string().min(8).max(128),
  })).mutation(async ({ input }) => {
    const db = requireDb(await getDb());
    const phone = normalizePhone(input.phone);
    const passwordHash = await hashPassword(input.password);

    const existing = await db.select().from(users).where(eq(users.phoneNumber, phone)).limit(1);
    if (existing[0]) {
      await db.update(users).set({
        role: "moderator",
        name: input.name,
        email: input.email || existing[0].email,
        passwordHash,
        phoneVerifiedAt: existing[0].phoneVerifiedAt || new Date(),
      }).where(eq(users.id, existing[0].id));
      return { success: true, id: existing[0].id } as const;
    }

    const openId = `mod_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
    const inserted = await db.insert(users).values({
      openId,
      name: input.name,
      phoneNumber: phone,
      email: input.email || null,
      passwordHash,
      role: "moderator",
      phoneVerifiedAt: new Date(),
      loginMethod: "password",
    }).$returningId();

    return { success: true, id: inserted[0]?.id } as const;
  }),
  deleteModerator: adminProcedure.input(z.object({
    id: z.number().int().positive(),
  })).mutation(async ({ input }) => {
    const db = requireDb(await getDb());
    // Demote role back to user
    await db.update(users).set({ role: "user" }).where(eq(users.id, input.id));
    return { success: true } as const;
  }),

  // Protected Paystack Key Setup
  getPaystackConfig: adminProcedure.query(() => {
    const key = process.env.PAYSTACK_SECRET_KEY || "";
    const configured = Boolean(key && (key.startsWith("sk_test_") || key.startsWith("sk_live_")));
    const maskedKey = key ? `${key.slice(0, 8)}••••••••${key.slice(-4)}` : "Not configured";
    return {
      configured,
      maskedKey,
      isLive: key.startsWith("sk_live_"),
    };
  }),
  updatePaystackKey: adminProcedure.input(z.object({
    secretKey: z.string().trim().min(10).max(200),
  })).mutation(({ input }) => {
    const key = input.secretKey.trim();
    if (!key.startsWith("sk_test_") && !key.startsWith("sk_live_")) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Paystack secret key must start with 'sk_test_' or 'sk_live_'.",
      });
    }
    process.env.PAYSTACK_SECRET_KEY = key;

    try {
      const envPath = path.join(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        let content = fs.readFileSync(envPath, "utf-8");
        if (content.includes("PAYSTACK_SECRET_KEY=")) {
          content = content.replace(/PAYSTACK_SECRET_KEY=.*/, `PAYSTACK_SECRET_KEY=${key}`);
        } else {
          content += `\nPAYSTACK_SECRET_KEY=${key}\n`;
        }
        fs.writeFileSync(envPath, content);
      }
    } catch {}

    return { success: true } as const;
  }),

  // Promotions & Ads
  promotions: adminProcedure.query(async () => {
    const db = requireDb(await getDb());
    return db.select().from(promotions).orderBy(desc(promotions.priority), desc(promotions.createdAt));
  }),
  createPromotion: adminProcedure.input(z.object({
    type: z.enum(["product_promo", "banner_ad", "featured_vendor"]),
    title: z.string().trim().min(1).max(200),
    subtitle: z.string().trim().max(1000).optional().or(z.literal("")),
    ctaLabel: z.string().trim().max(80).optional().or(z.literal("")),
    ctaTarget: z.string().trim().max(255).optional().or(z.literal("")),
    imageUrl: z.string().trim().max(512).optional().or(z.literal("")),
    badgeText: z.string().trim().max(60).optional().or(z.literal("")),
    productId: z.number().int().positive().optional().nullable(),
    vendorId: z.number().int().positive().optional().nullable(),
    priority: z.number().int().min(0).max(100).optional(),
  })).mutation(async ({ input }) => {
    const db = requireDb(await getDb());
    const inserted = await db.insert(promotions).values({
      type: input.type,
      title: input.title,
      subtitle: input.subtitle || null,
      ctaLabel: input.ctaLabel || null,
      ctaTarget: input.ctaTarget || null,
      imageUrl: input.imageUrl || null,
      badgeText: input.badgeText || null,
      productId: input.productId ?? null,
      vendorId: input.vendorId ?? null,
      priority: input.priority ?? 0,
      isActive: 1,
    }).$returningId();
    return { success: true, id: inserted[0]?.id } as const;
  }),
  updatePromotion: adminProcedure.input(z.object({
    id: z.number().int().positive(),
    data: z.object({
      type: z.enum(["product_promo", "banner_ad", "featured_vendor"]).optional(),
      title: z.string().trim().min(1).max(200).optional(),
      subtitle: z.string().trim().max(1000).nullable().optional(),
      ctaLabel: z.string().trim().max(80).nullable().optional(),
      ctaTarget: z.string().trim().max(255).nullable().optional(),
      imageUrl: z.string().trim().max(512).nullable().optional(),
      badgeText: z.string().trim().max(60).nullable().optional(),
      productId: z.number().int().positive().nullable().optional(),
      vendorId: z.number().int().positive().nullable().optional(),
      priority: z.number().int().min(0).max(100).optional(),
      isActive: z.number().int().min(0).max(1).optional(),
    }),
  })).mutation(async ({ input }) => {
    const db = requireDb(await getDb());
    await db.update(promotions).set(input.data).where(eq(promotions.id, input.id));
    return { success: true } as const;
  }),
  deletePromotion: adminProcedure.input(z.object({
    id: z.number().int().positive(),
  })).mutation(async ({ input }) => {
    const db = requireDb(await getDb());
    await db.delete(promotions).where(eq(promotions.id, input.id));
    return { success: true } as const;
  }),
  togglePromotion: adminProcedure.input(z.object({
    id: z.number().int().positive(),
    isActive: z.number().int().min(0).max(1),
  })).mutation(async ({ input }) => {
    const db = requireDb(await getDb());
    await db.update(promotions).set({ isActive: input.isActive }).where(eq(promotions.id, input.id));
    return { success: true } as const;
  }),
});