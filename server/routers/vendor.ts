import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { campuses, orderAuditLogs, orderItems, orders, products, users, vendors } from "../../drizzle/schema";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";

function ensureVendorAccess(role?: string) {
  // Allow vendor, admin, moderator, or normal user (who can become a vendor)
  // so any user can setup and manage their kitchen
}

export const vendorRouter = router({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database unavailable." });

    // Look for existing vendor owned by this user
    let userVendor = await db
      .select()
      .from(vendors)
      .where(and(eq(vendors.userId, ctx.user.id), isNull(vendors.deletedAt)))
      .limit(1);

    // If none found by userId, check if user is marked as vendor and maybe first vendor matches or create one
    if (!userVendor[0]) {
      // Find campus to attach to
      const campusList = await db.select().from(campuses).where(eq(campuses.isActive, 1)).limit(1);
      const campusId = ctx.user.campusId || campusList[0]?.id || 1;
      const vendorName = ctx.user.name ? `${ctx.user.name}'s Kitchen` : "My Campus Kitchen";
      const slug = `kitchen-${ctx.user.id}-${Date.now().toString(36)}`;

      await db.insert(vendors).values({
        userId: ctx.user.id,
        campusId,
        name: vendorName,
        slug,
        category: "Food & Drinks",
        description: "Fresh campus meals and bites prepared to order.",
        etaMin: 20,
        deliveryFeePesewas: 500,
        isOpen: 1,
      });

      // Update user role to vendor if currently "user"
      if (ctx.user.role === "user") {
        await db.update(users).set({ role: "vendor" }).where(eq(users.id, ctx.user.id));
      }

      userVendor = await db
        .select()
        .from(vendors)
        .where(eq(vendors.userId, ctx.user.id))
        .limit(1);
    }

    const shop = userVendor[0];
    if (!shop) throw new TRPCError({ code: "NOT_FOUND", message: "Vendor profile could not be created." });

    // Fetch this vendor's products
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

  updateProfile: protectedProcedure
    .input(
      z.object({
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

      const found = await db
        .select()
        .from(vendors)
        .where(and(eq(vendors.userId, ctx.user.id), isNull(vendors.deletedAt)))
        .limit(1);

      if (!found[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Vendor profile not found." });

      await db
        .update(vendors)
        .set({
          name: input.name,
          category: input.category,
          description: input.description ?? found[0].description,
          etaMin: input.etaMin,
          isOpen: input.isOpen,
          deliveryFeePesewas: input.deliveryFeePesewas ?? found[0].deliveryFeePesewas,
          updatedAt: new Date(),
        })
        .where(eq(vendors.id, found[0].id));

      return { success: true };
    }),

  createProduct: protectedProcedure
    .input(
      z.object({
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

      const found = await db
        .select()
        .from(vendors)
        .where(and(eq(vendors.userId, ctx.user.id), isNull(vendors.deletedAt)))
        .limit(1);

      if (!found[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Vendor profile not found." });

      const slug = `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50)}-${Date.now().toString(36)}`;

      await db.insert(products).values({
        vendorId: found[0].id,
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

      const found = await db
        .select()
        .from(vendors)
        .where(and(eq(vendors.userId, ctx.user.id), isNull(vendors.deletedAt)))
        .limit(1);

      if (!found[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Vendor profile not found." });

      const prod = await db
        .select()
        .from(products)
        .where(and(eq(products.id, input.productId), eq(products.vendorId, found[0].id)))
        .limit(1);

      if (!prod[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found or not owned by your shop." });

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
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database unavailable." });

      const found = await db
        .select()
        .from(vendors)
        .where(and(eq(vendors.userId, ctx.user.id), isNull(vendors.deletedAt)))
        .limit(1);

      if (!found[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Vendor profile not found." });

      await db
        .update(products)
        .set({ isAvailable: input.isAvailable })
        .where(and(eq(products.id, input.productId), eq(products.vendorId, found[0].id)));

      return { success: true };
    }),

  deleteProduct: protectedProcedure
    .input(z.object({ productId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database unavailable." });

      const found = await db
        .select()
        .from(vendors)
        .where(and(eq(vendors.userId, ctx.user.id), isNull(vendors.deletedAt)))
        .limit(1);

      if (!found[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Vendor profile not found." });

      await db
        .update(products)
        .set({ isAvailable: 0 })
        .where(and(eq(products.id, input.productId), eq(products.vendorId, found[0].id)));

      return { success: true };
    }),

  getKitchenOrders: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database unavailable." });

    const found = await db
      .select()
      .from(vendors)
      .where(and(eq(vendors.userId, ctx.user.id), isNull(vendors.deletedAt)))
      .limit(1);

    if (!found[0]) {
      return { shop: null, orders: [] };
    }

    const shop = found[0];

    // Find all products owned by this vendor
    const vendorProds = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.vendorId, shop.id));

    const prodIds = vendorProds.map((p) => p.id);
    if (prodIds.length === 0) {
      return { shop, orders: [] };
    }

    // Find orderItems with these product IDs
    const matchedItems = await db
      .select()
      .from(orderItems)
      .where(inArray(orderItems.productId, prodIds));

    const orderIdSet = Array.from(new Set(matchedItems.map((i) => i.orderId)));
    if (orderIdSet.length === 0) {
      return { shop, orders: [] };
    }

    // Fetch the orders
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

    // Group items per order
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

      const foundOrder = await db
        .select()
        .from(orders)
        .where(and(eq(orders.id, input.orderId), isNull(orders.deletedAt)))
        .limit(1);

      if (!foundOrder[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });

      const now = new Date();
      await db
        .update(orders)
        .set({
          status: "preparing",
          updatedAt: now,
        })
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

      const foundOrder = await db
        .select()
        .from(orders)
        .where(and(eq(orders.id, input.orderId), isNull(orders.deletedAt)))
        .limit(1);

      if (!foundOrder[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });

      const now = new Date();
      // Auto skip to 'on_the_way' as requested by user!
      await db
        .update(orders)
        .set({
          status: "on_the_way",
          updatedAt: now,
        })
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
