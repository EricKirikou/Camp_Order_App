import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { cartItems, carts, campuses, products } from "../../drizzle/schema";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";

async function getActiveCart(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, userId: number, campusId?: number) {
  const active = await db.select().from(carts).where(and(eq(carts.userId, userId), eq(carts.status, "active"))).limit(1);
  if (active[0]) return active[0];
  const available = campusId
    ? await db.select().from(campuses).where(eq(campuses.id, campusId)).limit(1)
    : await db.select().from(campuses).where(eq(campuses.isActive, 1)).limit(1);
  if (!available[0]) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Choose your campus before shopping." });
  const inserted = await db.insert(carts).values({ userId, campusId: available[0].id, status: "active" }).$returningId();
  const rows = await db.select().from(carts).where(eq(carts.id, inserted[0].id)).limit(1);
  return rows[0];
}

async function cartView(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, cartId: number) {
  const rows = await db.select({ item: cartItems, product: products })
    .from(cartItems).innerJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.cartId, cartId)).orderBy(cartItems.id);
  const items = rows.map(({ item, product }) => ({ ...item, product, lineTotalPesewas: product.pricePesewas * item.quantity }));
  return { id: cartId, items, itemCount: items.reduce((total, item) => total + item.quantity, 0), subtotalPesewas: items.reduce((total, item) => total + item.lineTotalPesewas, 0) };
}

export const cartRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Cart is unavailable." });
    const cart = await getActiveCart(db, ctx.user.id, ctx.user.campusId ?? undefined);
    return cartView(db, cart.id);
  }),

  add: protectedProcedure.input(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(20).default(1), campusId: z.number().int().positive().optional() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Cart is unavailable." });
    const productRows = await db.select().from(products).where(and(eq(products.id, input.productId), eq(products.isAvailable, 1))).limit(1);
    if (!productRows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "This item is unavailable." });
    const cart = await getActiveCart(db, ctx.user.id, input.campusId ?? ctx.user.campusId ?? undefined);
    const prior = await db.select().from(cartItems).where(and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, input.productId))).limit(1);
    if (prior[0]) await db.update(cartItems).set({ quantity: Math.min(20, prior[0].quantity + input.quantity) }).where(eq(cartItems.id, prior[0].id));
    else await db.insert(cartItems).values({ cartId: cart.id, productId: input.productId, quantity: input.quantity });
    return cartView(db, cart.id);
  }),

  setQuantity: protectedProcedure.input(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(0).max(20) })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Cart is unavailable." });
    const cart = await getActiveCart(db, ctx.user.id, ctx.user.campusId ?? undefined);
    const current = await db.select().from(cartItems).where(and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, input.productId))).limit(1);
    if (current[0]) {
      if (input.quantity === 0) await db.delete(cartItems).where(eq(cartItems.id, current[0].id));
      else await db.update(cartItems).set({ quantity: input.quantity }).where(eq(cartItems.id, current[0].id));
    }
    return cartView(db, cart.id);
  }),

  remove: protectedProcedure.input(z.object({ productId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Cart is unavailable." });
    const cart = await getActiveCart(db, ctx.user.id, ctx.user.campusId ?? undefined);
    await db.delete(cartItems).where(and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, input.productId)));
    return cartView(db, cart.id);
  }),
});
