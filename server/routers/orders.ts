import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { cartItems, carts, orders, orderItems, products, users, vendors } from "../../drizzle/schema";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";

export const ordersRouter = router({
  mine: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Orders are unavailable." });
    return db.select().from(orders).where(and(eq(orders.userId, ctx.user.id), isNull(orders.deletedAt))).orderBy(desc(orders.createdAt)).limit(50);
  }),

  byId: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Orders are unavailable." });
    const isStaffOrCourier = ctx.user.role === "courier" || ctx.user.role === "admin" || ctx.user.role === "moderator" || ctx.user.role === "vendor";
    const found = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.id, input.id),
          isNull(orders.deletedAt),
          isStaffOrCourier ? undefined : eq(orders.userId, ctx.user.id)
        )
      )
      .limit(1);
    if (!found[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, input.id));

    let vendorInfo = null;
    if (items.length > 0) {
      const prodVendor = await db
        .select({
          id: vendors.id,
          name: vendors.name,
          etaMin: vendors.etaMin,
          category: vendors.category,
        })
        .from(orderItems)
        .leftJoin(products, eq(orderItems.productId, products.id))
        .leftJoin(vendors, eq(products.vendorId, vendors.id))
        .where(eq(orderItems.orderId, input.id))
        .limit(1);
      if (prodVendor[0]?.id) {
        vendorInfo = prodVendor[0];
      }
    }

    let courierInfo = null;
    if (found[0].courierId) {
      const cour = await db
        .select({
          id: users.id,
          name: users.name,
          phoneNumber: users.phoneNumber,
        })
        .from(users)
        .where(eq(users.id, found[0].courierId))
        .limit(1);
      if (cour[0]) courierInfo = cour[0];
    }

    // 6-digit confirmation code for the receiver to give to the courier
    const digitsOnly = found[0].orderCode.replace(/\D/g, "");
    const deliveryConfirmationCode = digitsOnly.length >= 6
      ? digitsOnly.slice(-6)
      : String(found[0].id * 831417).padStart(6, "0").slice(-6);

    return { ...found[0], items, vendor: vendorInfo, courier: courierInfo, deliveryConfirmationCode };
  }),

  reorder: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Orders are unavailable." });
    const found = await db.select().from(orders).where(and(eq(orders.id, input.id), eq(orders.userId, ctx.user.id), isNull(orders.deletedAt))).limit(1);
    if (!found[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, input.id));
    if (!items.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No items in this order." });

    // Find or create active cart
    const active = await db.select().from(carts).where(and(eq(carts.userId, ctx.user.id), eq(carts.status, "active"))).limit(1);
    let cartId = active[0]?.id;
    if (!cartId) {
      const inserted = await db.insert(carts).values({ userId: ctx.user.id, campusId: found[0].campusId, status: "active" }).$returningId();
      cartId = inserted[0].id;
    }

    let addedCount = 0;
    for (const item of items) {
      const prod = await db.select().from(products).where(and(eq(products.id, item.productId), eq(products.isAvailable, 1))).limit(1);
      if (!prod[0]) continue;
      const prior = await db.select().from(cartItems).where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, item.productId))).limit(1);
      if (prior[0]) {
        await db.update(cartItems).set({ quantity: Math.min(20, prior[0].quantity + item.quantity) }).where(eq(cartItems.id, prior[0].id));
      } else {
        await db.insert(cartItems).values({ cartId, productId: item.productId, quantity: item.quantity });
      }
      addedCount++;
    }

    return { success: true, addedCount };
  }),

  cancel: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Orders are unavailable." });
    const found = await db.select().from(orders).where(and(eq(orders.id, input.id), eq(orders.userId, ctx.user.id), isNull(orders.deletedAt))).limit(1);
    if (!found[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
    const order = found[0];

    // Only allow cancelling failed or unpaid/pending orders
    if (order.paymentStatus === "paid") {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Paid orders cannot be cancelled directly. Please contact vendor or campus support." });
    }
    if (order.status === "cancelled") {
      return { success: true, orderId: order.id };
    }

    await db.update(orders).set({
      status: "cancelled",
      paymentStatus: "failed",
      updatedAt: new Date(),
    }).where(eq(orders.id, order.id));

    return { success: true, orderId: order.id };
  }),
});
