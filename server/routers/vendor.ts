import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { campuses, orderAuditLogs, orderItems, orders, products, users, vendors } from "../../drizzle/schema";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";

/** Roles that are allowed to access the vendor kitchen portal */
const VENDOR_ROLES = ["vendor", "admin", "moderator"] as const;

function requireVendorAccess(role?: string) {
  if (!role || !(VENDOR_ROLES as readonly string[]).includes(role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only vendors, admins, and moderators can access the kitchen portal.",
    });
  }
}

/** Helper to strictly find the vendor belonging to a user (never loads or leaks others' data) */
async function resolveVendorForUser(db: any, userId: number) {
  const linked = await db
    .select()
    .from(vendors)
    .where(eq(vendors.userId, userId))
    .limit(1);

  return linked[0] ?? null;
}

export const vendorRouter = router({
  /**
   * List all vendors — accessible by admin & moderator only.
   * Returns vendors with basic revenue data.
   */
  listAll: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database unavailable." });

    if (ctx.user.role !== "admin" && ctx.user.role !== "moderator") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only admins and moderators can list all vendors." });
    }

    const allVendors = await db.select().from(vendors).orderBy(vendors.name);

    // Compute revenue per vendor from paid/completed orders
    const allOrders = await db
      .select({
        id: orders.id,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        totalPesewas: orders.totalPesewas,
      })
      .from(orders)
      .where(inArray(orders.status, ["placed", "accepted", "preparing", "on_the_way", "completed"]));

    // Get order items to map orders → vendors
    const allItems = await db.select({ orderId: orderItems.orderId, productId: orderItems.productId }).from(orderItems);
    const allProducts = await db.select({ id: products.id, vendorId: products.vendorId }).from(products);

    const productVendorMap = new Map<number, number>();
    for (const p of allProducts) {
      if (p.vendorId) productVendorMap.set(p.id, p.vendorId);
    }

    const orderVendorRevenue = new Map<number, number>();
    const orderVendorCount = new Map<number, number>();
    for (const item of allItems) {
      const vendorId = productVendorMap.get(item.productId);
      if (!vendorId) continue;
      const order = allOrders.find((o) => o.id === item.orderId);
      if (!order) continue;
      orderVendorCount.set(vendorId, (orderVendorCount.get(vendorId) ?? 0) + 1);
      if (order.paymentStatus === "paid" || order.status === "completed") {
        orderVendorRevenue.set(vendorId, (orderVendorRevenue.get(vendorId) ?? 0) + (order.totalPesewas ?? 0));
      }
    }

    return allVendors.map((v) => ({
      ...v,
      totalOrders: orderVendorCount.get(v.id) ?? 0,
      totalRevenuePesewas: orderVendorRevenue.get(v.id) ?? 0,
    }));
  }),

  /**
   * Get vendor profile for the current user.
   * Admin/Moderator can optionally pass vendorId to view any vendor.
   * Vendors only see their own profile.
   */
  getProfile: protectedProcedure
    .input(z.object({ vendorId: z.number().int().positive().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database unavailable." });

      const isAdminOrMod = ctx.user.role === "admin" || ctx.user.role === "moderator";

      // Admin/moderator viewing a specific vendor
      if (isAdminOrMod && input?.vendorId) {
        const vendorRows = await db.select().from(vendors).where(eq(vendors.id, input.vendorId)).limit(1);
        const shop = vendorRows[0];
        if (!shop) throw new TRPCError({ code: "NOT_FOUND", message: "Vendor not found." });
        const vendorProducts = await db
          .select()
          .from(products)
          .where(eq(products.vendorId, shop.id))
          .orderBy(desc(products.id));
        return { shop, products: vendorProducts };
      }

      // Regular vendor — strictly their own vendor profile
      requireVendorAccess(ctx.user.role);

      const shop = await resolveVendorForUser(db, ctx.user.id);
      if (!shop) {
        return { shop: null, products: [] };
      }

      const vendorProducts = await db
        .select()
        .from(products)
        .where(eq(products.vendorId, shop.id))
        .orderBy(desc(products.id));

      return {
        shop,
        products: vendorProducts,
      };
    }),

  /**
   * Register a new vendor profile for the logged-in vendor.
   * If they haven't inserted their kitchen/shop yet, they insert and save here before uploading items.
   */
  registerProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(180),
        category: z.string().min(2).max(80).default("Food & Drinks"),
        description: z.string().max(1000).optional(),
        etaMin: z.number().int().min(1).max(180).default(20),
        deliveryFeePesewas: z.number().int().min(0).default(500),
        campusId: z.number().int().positive().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      requireVendorAccess(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database unavailable." });

      const existing = await db
        .select()
        .from(vendors)
        .where(eq(vendors.userId, ctx.user.id))
        .limit(1);

      if (existing[0]) {
        return { shop: existing[0], isNew: false };
      }

      const campusList = await db.select().from(campuses).where(eq(campuses.isActive, 1)).limit(1);
      const campusId = input.campusId || ctx.user.campusId || campusList[0]?.id || 1;
      const slug = `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${ctx.user.id}-${Date.now().toString(36)}`;

      const inserted = await db.insert(vendors).values({
        userId: ctx.user.id,
        campusId,
        name: input.name,
        slug,
        category: input.category,
        description: input.description ?? "Fresh campus meals and bites prepared to order.",
        etaMin: input.etaMin,
        deliveryFeePesewas: input.deliveryFeePesewas,
        isOpen: 1,
      }).$returningId();

      const created = await db
        .select()
        .from(vendors)
        .where(eq(vendors.id, inserted[0].id))
        .limit(1);

      return { shop: created[0], isNew: true };
    }),

  /**
   * Get revenue summary for a vendor.
   * Vendors see their own revenue; admin/moderator can pass vendorId.
   */
  getRevenue: protectedProcedure
    .input(z.object({ vendorId: z.number().int().positive().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database unavailable." });

      const isAdminOrMod = ctx.user.role === "admin" || ctx.user.role === "moderator";
      requireVendorAccess(ctx.user.role);

      let targetVendorId: number | undefined;

      if (isAdminOrMod && input?.vendorId) {
        targetVendorId = input.vendorId;
      } else {
        const found = await resolveVendorForUser(db, ctx.user.id);
        targetVendorId = found?.id;
      }

      if (!targetVendorId) return { totalRevenuePesewas: 0, totalOrders: 0, pendingOrders: 0, completedOrders: 0 };

      // Products owned by this vendor
      const vendorProds = await db.select({ id: products.id }).from(products).where(eq(products.vendorId, targetVendorId));
      const prodIds = vendorProds.map((p) => p.id);
      if (prodIds.length === 0) return { totalRevenuePesewas: 0, totalOrders: 0, pendingOrders: 0, completedOrders: 0 };

      const matchedItems = await db
        .select({ orderId: orderItems.orderId })
        .from(orderItems)
        .where(inArray(orderItems.productId, prodIds));

      const orderIdSet = Array.from(new Set(matchedItems.map((i) => i.orderId)));
      if (orderIdSet.length === 0) return { totalRevenuePesewas: 0, totalOrders: 0, pendingOrders: 0, completedOrders: 0 };

      const relatedOrders = await db
        .select({
          id: orders.id,
          status: orders.status,
          paymentStatus: orders.paymentStatus,
          totalPesewas: orders.totalPesewas,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .where(inArray(orders.id, orderIdSet));

      let totalRevenuePesewas = 0;
      let completedOrders = 0;
      let pendingOrders = 0;
      for (const o of relatedOrders) {
        if (o.paymentStatus === "paid" || o.status === "completed") {
          totalRevenuePesewas += o.totalPesewas ?? 0;
          completedOrders++;
        } else {
          pendingOrders++;
        }
      }

      return {
        totalRevenuePesewas,
        totalOrders: relatedOrders.length,
        pendingOrders,
        completedOrders,
      };
    }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        vendorId: z.number().int().positive().optional(),
        name: z.string().min(2).max(180),
        category: z.string().min(2).max(80),
        description: z.string().max(1000).optional(),
        etaMin: z.number().int().min(1).max(180),
        isOpen: z.number().int().min(0).max(1),
        deliveryFeePesewas: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database unavailable." });

      requireVendorAccess(ctx.user.role);

      const isAdminOrMod = ctx.user.role === "admin" || ctx.user.role === "moderator";
      let found;

      if (isAdminOrMod && input.vendorId) {
        const rows = await db.select().from(vendors).where(eq(vendors.id, input.vendorId)).limit(1);
        found = rows[0];
      } else {
        found = await resolveVendorForUser(db, ctx.user.id);
      }

      if (!found) throw new TRPCError({ code: "NOT_FOUND", message: "Vendor profile not found. Please insert and save your vendor profile first." });

      // For regular vendors, double-lock the WHERE to both id AND userId so the
      // update can never touch another user's record even under unexpected state.
      const updateWhere = isAdminOrMod
        ? eq(vendors.id, found.id)
        : and(eq(vendors.id, found.id), eq(vendors.userId, ctx.user.id));

      await db
        .update(vendors)
        .set({
          name: input.name,
          category: input.category,
          description: input.description ?? found.description,
          etaMin: input.etaMin,
          isOpen: input.isOpen,
          deliveryFeePesewas: input.deliveryFeePesewas ?? found.deliveryFeePesewas,
        })
        .where(updateWhere);

      return { success: true };
    }),

  deleteVendor: protectedProcedure
    .input(z.object({ vendorId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database unavailable." });

      if (ctx.user.role !== "admin" && ctx.user.role !== "moderator") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins and moderators can delete vendors." });
      }

      await db.delete(vendors).where(eq(vendors.id, input.vendorId));
      return { success: true };
    }),

  createProduct: protectedProcedure
    .input(
      z.object({
        vendorId: z.number().int().positive().optional(),
        name: z.string().min(2).max(180),
        category: z.string().min(2).max(100),
        pricePesewas: z.number().int().positive(),
        description: z.string().max(1000).optional(),
        imageUrl: z.string().max(512).optional(),
        badge: z.string().max(80).optional(),
        isAvailable: z.number().int().min(0).max(1).default(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database unavailable." });

      requireVendorAccess(ctx.user.role);

      const isAdminOrMod = ctx.user.role === "admin" || ctx.user.role === "moderator";
      let targetVendorId: number | undefined;

      if (isAdminOrMod && input.vendorId) {
        targetVendorId = input.vendorId;
      } else {
        const found = await resolveVendorForUser(db, ctx.user.id);
        targetVendorId = found?.id;
      }

      if (!targetVendorId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Please insert and save your vendor profile first before uploading items." });

      const slug = `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50)}-${Date.now().toString(36)}`;

      await db.insert(products).values({
        vendorId: targetVendorId,
        slug,
        name: input.name,
        category: input.category,
        pricePesewas: input.pricePesewas,
        description: input.description ?? "",
        imageUrl: input.imageUrl ?? "",
        badge: input.badge ?? null,
        isAvailable: input.isAvailable,
        isSample: 0,
      });

      return { success: true };
    }),

  updateProduct: protectedProcedure
    .input(
      z.object({
        productId: z.number().int().positive(),
        vendorId: z.number().int().positive().optional(),
        name: z.string().min(2).max(180),
        category: z.string().min(2).max(100),
        pricePesewas: z.number().int().positive(),
        description: z.string().max(1000).optional(),
        imageUrl: z.string().max(512).optional(),
        badge: z.string().max(80).optional(),
        isAvailable: z.number().int().min(0).max(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database unavailable." });

      requireVendorAccess(ctx.user.role);

      const isAdminOrMod = ctx.user.role === "admin" || ctx.user.role === "moderator";
      let targetVendorId: number | undefined;

      if (isAdminOrMod && input.vendorId) {
        targetVendorId = input.vendorId;
      } else {
        const found = await resolveVendorForUser(db, ctx.user.id);
        targetVendorId = found?.id;
      }

      if (!targetVendorId) throw new TRPCError({ code: "NOT_FOUND", message: "Vendor profile not found." });

      const prod = await db
        .select()
        .from(products)
        .where(and(eq(products.id, input.productId), eq(products.vendorId, targetVendorId)))
        .limit(1);

      if (!prod[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found or not owned by this vendor." });

      await db
        .update(products)
        .set({
          name: input.name,
          category: input.category,
          pricePesewas: input.pricePesewas,
          description: input.description ?? prod[0].description,
          imageUrl: input.imageUrl ?? prod[0].imageUrl,
          badge: input.badge ?? prod[0].badge,
          isAvailable: input.isAvailable,
        })
        .where(eq(products.id, prod[0].id));

      return { success: true };
    }),

  toggleProductAvailability: protectedProcedure
    .input(
      z.object({
        productId: z.number().int().positive(),
        isAvailable: z.number().int().min(0).max(1),
        vendorId: z.number().int().positive().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database unavailable." });

      requireVendorAccess(ctx.user.role);

      const isAdminOrMod = ctx.user.role === "admin" || ctx.user.role === "moderator";
      let targetVendorId: number | undefined;

      if (isAdminOrMod && input.vendorId) {
        targetVendorId = input.vendorId;
      } else {
        const found = await resolveVendorForUser(db, ctx.user.id);
        targetVendorId = found?.id;
      }

      if (!targetVendorId) throw new TRPCError({ code: "NOT_FOUND", message: "Vendor profile not found." });

      await db
        .update(products)
        .set({ isAvailable: input.isAvailable })
        .where(and(eq(products.id, input.productId), eq(products.vendorId, targetVendorId)));

      return { success: true };
    }),

  deleteProduct: protectedProcedure
    .input(z.object({
      productId: z.number().int().positive(),
      vendorId: z.number().int().positive().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database unavailable." });

      requireVendorAccess(ctx.user.role);

      const isAdminOrMod = ctx.user.role === "admin" || ctx.user.role === "moderator";
      let targetVendorId: number | undefined;

      if (isAdminOrMod && input.vendorId) {
        targetVendorId = input.vendorId;
      } else {
        const found = await resolveVendorForUser(db, ctx.user.id);
        targetVendorId = found?.id;
      }

      if (!targetVendorId) throw new TRPCError({ code: "NOT_FOUND", message: "Vendor profile not found." });

      // Hard-delete the product so it no longer appears on the catalog
      await db
        .delete(products)
        .where(and(eq(products.id, input.productId), eq(products.vendorId, targetVendorId)));

      return { success: true };
    }),

  getKitchenOrders: protectedProcedure
    .input(z.object({ vendorId: z.number().int().positive().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database unavailable." });

      requireVendorAccess(ctx.user.role);

      const isAdminOrMod = ctx.user.role === "admin" || ctx.user.role === "moderator";
      let shop;

      if (isAdminOrMod && input?.vendorId) {
        const rows = await db.select().from(vendors).where(eq(vendors.id, input.vendorId)).limit(1);
        shop = rows[0];
      } else {
        shop = await resolveVendorForUser(db, ctx.user.id);
      }

      if (!shop) return { shop: null, orders: [] };

      const vendorProds = await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.vendorId, shop.id));

      const prodIds = vendorProds.map((p) => p.id);
      if (prodIds.length === 0) return { shop, orders: [] };

      const matchedItems = await db
        .select()
        .from(orderItems)
        .where(inArray(orderItems.productId, prodIds));

      const orderIdSet = Array.from(new Set(matchedItems.map((i) => i.orderId)));
      if (orderIdSet.length === 0) return { shop, orders: [] };

      const rawOrders = await db
        .select()
        .from(orders)
        .where(
          and(
            inArray(orders.id, orderIdSet),
            isNull(orders.deletedAt),
            inArray(orders.status, ["placed", "accepted", "preparing", "on_the_way", "completed"])
          )
        )
        .orderBy(desc(orders.createdAt))
        .limit(40);

      const ordersWithDetails = rawOrders.map((o) => {
        const items = matchedItems.filter((i) => i.orderId === o.id);
        return {
          id: o.id,
          orderCode: o.orderCode,
          status: o.status,
          paymentStatus: o.paymentStatus,
          deliveryAddress: o.deliveryAddress,
          customerEmail: o.customerEmail,
          createdAt: o.createdAt.toISOString(),
          updatedAt: o.updatedAt.toISOString(),
          items,
          etaMin: shop.etaMin,
        };
      });

      return { shop, orders: ordersWithDetails };
    }),

  markPreparing: protectedProcedure
    .input(z.object({ orderId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database unavailable." });

      requireVendorAccess(ctx.user.role);

      const foundOrder = await db
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);

      if (!foundOrder[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });

      const now = new Date();
      await db
        .update(orders)
        .set({ status: "preparing", updatedAt: now })
        .where(eq(orders.id, input.orderId));

      try {
        await db.insert(orderAuditLogs).values({
          orderId: foundOrder[0].id,
          orderCode: foundOrder[0].orderCode,
          action: "vendor_marked_preparing",
          actorUserId: ctx.user.id,
          actorName: ctx.user.name ?? "Vendor Kitchen",
          actorEmail: ctx.user.email ?? null,
          snapshot: JSON.stringify({
            previousStatus: foundOrder[0].status,
            newStatus: "preparing",
            startedPreparingAt: now.toISOString(),
          }),
        });
      } catch {}

      return { success: true, status: "preparing" as const, updatedAt: now.toISOString() };
    }),

  markPrepared: protectedProcedure
    .input(z.object({ orderId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database unavailable." });

      requireVendorAccess(ctx.user.role);

      const foundOrder = await db
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);

      if (!foundOrder[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });

      const now = new Date();
      // Auto skip to 'on_the_way'
      await db
        .update(orders)
        .set({ status: "on_the_way", updatedAt: now })
        .where(eq(orders.id, input.orderId));

      try {
        await db.insert(orderAuditLogs).values({
          orderId: foundOrder[0].id,
          orderCode: foundOrder[0].orderCode,
          action: "vendor_marked_prepared_auto_on_the_way",
          actorUserId: ctx.user.id,
          actorName: ctx.user.name ?? "Vendor Kitchen",
          actorEmail: ctx.user.email ?? null,
          snapshot: JSON.stringify({
            previousStatus: foundOrder[0].status,
            newStatus: "on_the_way",
            preparedAt: now.toISOString(),
          }),
        });
      } catch {}

      return { success: true, status: "on_the_way" as const, updatedAt: now.toISOString() };
    }),
});
