import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { orders, orderItems } from "../../drizzle/schema";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";

export const ordersRouter = router({
  mine: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Orders are unavailable." });
    return db.select().from(orders).where(eq(orders.userId, ctx.user.id)).orderBy(desc(orders.createdAt)).limit(50);
  }),

  byId: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Orders are unavailable." });
    const found = await db.select().from(orders).where(and(eq(orders.id, input.id), eq(orders.userId, ctx.user.id))).limit(1);
    if (!found[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, input.id));
    return { ...found[0], items };
  }),
});
