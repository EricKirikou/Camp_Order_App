import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { cartItems, carts, orderItems, orders, payments, products, users } from "../../drizzle/schema";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { initializeGhsPayment, verifyGhsPayment } from "../services/paystack";

function ensureTestKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new TRPCError({ code: "PRECONDITION_FAILED", message: process.env.NODE_ENV === "production"
    ? "Production checkout is not configured. Add a Paystack live key through protected setup."
    : "Checkout is not configured yet. Add the Paystack test key through protected setup." });
  const expectedPrefix = process.env.NODE_ENV === "production" ? "sk_live_" : "sk_test_";
  if (!key.startsWith(expectedPrefix)) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: process.env.NODE_ENV === "production"
      ? "Production checkout requires a Paystack live key through protected setup."
      : "Development checkout only accepts a Paystack test key." });
  }
}

export const paymentsRouter = router({
  startCheckout: protectedProcedure.input(z.object({
    deliveryAddress: z.string().trim().min(4).max(255),
    email: z.string().trim().email().max(320),
    note: z.string().trim().max(1000).optional(),
    callbackUrl: z.string().url().max(2048).optional(),
  })).mutation(async ({ input, ctx }) => {
    ensureTestKey();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Checkout is unavailable." });
    const cartRows = await db.select({ cart: carts, item: cartItems, product: products })
      .from(carts)
      .innerJoin(cartItems, eq(cartItems.cartId, carts.id))
      .innerJoin(products, eq(products.id, cartItems.productId))
      .where(and(eq(carts.userId, ctx.user.id), eq(carts.status, "active"), eq(products.isAvailable, 1)));
    if (!cartRows.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Your cart is empty." });
    const cartId = cartRows[0].cart.id;
    const items = cartRows.filter((row) => row.cart.id === cartId);
    const subtotal = items.reduce((sum, row) => sum + row.product.pricePesewas * row.item.quantity, 0);
    const deliveryFee = 500;
    const total = subtotal + deliveryFee;
    const orderCode = `CO-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 5).toUpperCase()}`;
    const email = input.email.trim().toLowerCase();

    const orderId = await db.transaction(async (tx) => {
      const inserted = await tx.insert(orders).values({
        orderCode,
        userId: ctx.user.id,
        campusId: cartRows[0].cart.campusId,
        status: "payment_pending",
        paymentStatus: "pending",
        isSample: 0,
        subtotalPesewas: subtotal,
        deliveryFeePesewas: deliveryFee,
        totalPesewas: total,
        deliveryAddress: input.deliveryAddress,
        customerEmail: email,
        note: input.note ?? null,
      }).$returningId();
      const id = inserted[0]?.id;
      if (!id) throw new Error("Order was not created");
      await tx.insert(orderItems).values(items.map(({ item, product }) => ({
        orderId: id,
        productId: product.id,
        productName: product.name,
        unitPricePesewas: product.pricePesewas,
        quantity: item.quantity,
      })));
      await tx.update(carts).set({ status: "checked_out" }).where(eq(carts.id, cartId));
      await tx.update(users).set({ email }).where(eq(users.id, ctx.user.id));
      return id;
    });

    const reference = `camporder-${orderCode.toLowerCase()}-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
    await db.insert(payments).values({ orderId, reference, amountPesewas: total, currency: "GHS", status: "initialized" });
    const configuredOrigin = process.env.EXPO_WEB_PREVIEW_URL || process.env.EXPO_PACKAGER_PROXY_URL || "";
    let callbackUrl: string | undefined;
    if (input.callbackUrl && configuredOrigin) {
      try {
        const requested = new URL(input.callbackUrl);
        const allowed = new URL(configuredOrigin);
        if (requested.protocol === "https:" && requested.origin === allowed.origin) callbackUrl = requested.toString();
      } catch {
        callbackUrl = undefined;
      }
    }

    try {
      const initialized = await initializeGhsPayment({
        email,
        amountPesewas: total,
        reference,
        callbackUrl,
        metadata: { orderId, orderCode, userId: ctx.user.id },
      });
      await db.update(payments).set({ status: "pending", authorizationUrl: initialized.authorization_url }).where(eq(payments.reference, reference));
      return { orderId, orderCode, reference, authorizationUrl: initialized.authorization_url, amountPesewas: total, currency: "GHS" as const };
    } catch (error) {
      await db.update(payments).set({ status: "failed" }).where(eq(payments.reference, reference));
      throw new TRPCError({ code: "BAD_GATEWAY", message: error instanceof Error ? error.message : "Could not start payment." });
    }
  }),

  verify: protectedProcedure.input(z.object({ reference: z.string().trim().min(6).max(100) })).mutation(async ({ input, ctx }) => {
    ensureTestKey();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Payment verification is unavailable." });
    const found = await db.select({ payment: payments, order: orders })
      .from(payments).innerJoin(orders, eq(payments.orderId, orders.id))
      .where(and(eq(payments.reference, input.reference), eq(orders.userId, ctx.user.id))).limit(1);
    if (!found[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Payment reference not found." });
    if (found[0].payment.status === "success") return { status: "success" as const, orderId: found[0].order.id, orderCode: found[0].order.orderCode };
    const remote = await verifyGhsPayment(input.reference);
    const payment = found[0].payment;
    if (remote.reference !== payment.reference || remote.amount !== payment.amountPesewas || remote.currency !== "GHS") {
      throw new TRPCError({ code: "BAD_GATEWAY", message: "Payment details did not match this order." });
    }
    if (remote.status === "success") {
      await db.transaction(async (tx) => {
        await tx.update(payments).set({ status: "success", verifiedAt: new Date() }).where(eq(payments.id, payment.id));
        await tx.update(orders).set({ paymentStatus: "paid", status: "placed", updatedAt: new Date() }).where(eq(orders.id, payment.orderId));
      });
      return { status: "success" as const, orderId: found[0].order.id, orderCode: found[0].order.orderCode };
    }
    if (remote.status === "failed" || remote.status === "abandoned") {
      await db.update(payments).set({ status: "failed" }).where(eq(payments.id, payment.id));
      await db.update(orders).set({ paymentStatus: "failed", updatedAt: new Date() }).where(eq(orders.id, payment.orderId));
    }
    return { status: "pending" as const, orderId: found[0].order.id, orderCode: found[0].order.orderCode };
  }),
});
