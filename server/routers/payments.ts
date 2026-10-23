import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
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
  if (process.env.NODE_ENV === "production") {
    if (!key.startsWith("sk_live_")) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Production checkout requires a Paystack live key through protected setup." });
    }
  } else {
    // In development, accept any sk_test_ key — the sandbox fallback in paystack.ts
    // will simulate the transaction if the key is a placeholder.
    if (!key.startsWith("sk_test_")) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Development checkout only accepts a Paystack test key." });
    }
  }
}

function resolveCallbackUrl(rawCallbackUrl?: string): string | undefined {
  const configuredOrigin = process.env.EXPO_WEB_PREVIEW_URL || process.env.EXPO_PACKAGER_PROXY_URL || process.env.EXPO_PUBLIC_API_BASE_URL || "";
  let callbackUrl: string | undefined;
  if (rawCallbackUrl) {
    try {
      const requested = new URL(rawCallbackUrl);
      const allowHttp = process.env.NODE_ENV !== "production";
      const protocolOk = requested.protocol === "https:" || (allowHttp && requested.protocol === "http:");
      if (protocolOk) {
        if (allowHttp) {
          callbackUrl = requested.toString();
        } else if (configuredOrigin) {
          const allowed = new URL(configuredOrigin);
          if (requested.hostname === allowed.hostname) callbackUrl = requested.toString();
        } else {
          callbackUrl = requested.toString();
        }
      }
    } catch {
      callbackUrl = undefined;
    }
  }
  if (!callbackUrl && configuredOrigin) {
    try {
      const origin = new URL(configuredOrigin);
      callbackUrl = `${origin.origin}/payment`;
    } catch {}
  }
  return callbackUrl;
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
    const callbackUrl = resolveCallbackUrl(input.callbackUrl);

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

  retryPayment: protectedProcedure.input(z.object({
    orderId: z.number().int().positive(),
    callbackUrl: z.string().url().max(2048).optional(),
  })).mutation(async ({ input, ctx }) => {
    ensureTestKey();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Payments are unavailable." });
    const found = await db.select().from(orders).where(and(eq(orders.id, input.orderId), eq(orders.userId, ctx.user.id), isNull(orders.deletedAt))).limit(1);
    if (!found[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
    const order = found[0];
    if (order.paymentStatus === "paid") {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This order has already been paid for." });
    }
    const orderCode = order.orderCode;
    const total = order.totalPesewas;
    const email = order.customerEmail;
    const reference = `camporder-${orderCode.toLowerCase()}-${randomUUID().replace(/-/g, "").slice(0, 8)}`;

    await db.insert(payments).values({ orderId: order.id, reference, amountPesewas: total, currency: "GHS", status: "initialized" });
    await db.update(orders).set({ status: "payment_pending", paymentStatus: "pending", updatedAt: new Date() }).where(eq(orders.id, order.id));

    const callbackUrl = resolveCallbackUrl(input.callbackUrl);

    try {
      const initialized = await initializeGhsPayment({
        email,
        amountPesewas: total,
        reference,
        callbackUrl,
        metadata: { orderId: order.id, orderCode, userId: ctx.user.id },
      });
      await db.update(payments).set({ status: "pending", authorizationUrl: initialized.authorization_url }).where(eq(payments.reference, reference));
      return { orderId: order.id, orderCode, reference, authorizationUrl: initialized.authorization_url, amountPesewas: total, currency: "GHS" as const };
    } catch (error) {
      await db.update(payments).set({ status: "failed" }).where(eq(payments.reference, reference));
      throw new TRPCError({ code: "BAD_GATEWAY", message: error instanceof Error ? error.message : "Could not retry payment." });
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
    if (remote.reference !== payment.reference || remote.currency !== "GHS") {
      throw new TRPCError({ code: "BAD_GATEWAY", message: "Payment details did not match this order." });
    }
    // In production, also verify the amount matches exactly
    if (process.env.NODE_ENV === "production" && remote.amount !== payment.amountPesewas) {
      throw new TRPCError({ code: "BAD_GATEWAY", message: "Payment amount did not match this order." });
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
