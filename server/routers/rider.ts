import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { orderAuditLogs, orderItems, orders, products, vendors } from "../../drizzle/schema";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";

function ensureCourier(role?: string) {
  if (role !== "courier" && role !== "admin" && role !== "moderator") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only riders or administrators can access courier dispatches." });
  }
}

export const riderRouter = router({
  pendingOrders: protectedProcedure.query(async ({ ctx }) => {
    ensureCourier(ctx.user.role);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database unavailable." });

    // Fetch unassigned orders waiting for a rider (status 'placed', or paid orders in placed/accepted)
    const pending = await db
      .select()
      .from(orders)
      .where(
        and(
          isNull(orders.deletedAt),
          or(
            eq(orders.status, "placed"),
            and(inArray(orders.status, ["placed", "accepted"]), eq(orders.paymentStatus, "paid"))
          )
        )
      )
      .orderBy(desc(orders.createdAt))
      .limit(50);

    // Resolve restaurant/vendor name for each order
    const result = await Promise.all(
      pending.map(async (order) => {
        const items = await db
          .select({
            vendorName: vendors.name,
          })
          .from(orderItems)
          .leftJoin(products, eq(orderItems.productId, products.id))
          .leftJoin(vendors, eq(products.vendorId, vendors.id))
          .where(eq(orderItems.orderId, order.id))
          .limit(1);

        const restaurantName = items[0]?.vendorName || "Campus Kitchen";

        return {
          id: order.id,
          orderCode: order.orderCode,
          restaurantName,
          dropoffAddress: order.deliveryAddress,
          payout: order.deliveryFeePesewas || 500,
          createdAt: order.createdAt.toISOString(),
          status: order.status,
        };
      })
    );

    return result;
  }),

  acceptOrder: protectedProcedure
    .input(z.object({ orderId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      ensureCourier(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database unavailable." });

      const found = await db
        .select()
        .from(orders)
        .where(and(eq(orders.id, input.orderId), isNull(orders.deletedAt)))
        .limit(1);

      if (!found[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
      const order = found[0];

      if (order.status === "cancelled") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This order was cancelled." });
      }

      // Transition order status to 'accepted'
      await db
        .update(orders)
        .set({
          status: "accepted",
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id));

      // Record in audit logs
      try {
        await db.insert(orderAuditLogs).values({
          orderId: order.id,
          orderCode: order.orderCode,
          action: "rider_accepted",
          actorUserId: ctx.user.id,
          actorName: ctx.user.name ?? "Courier",
          actorEmail: ctx.user.email ?? null,
          snapshot: JSON.stringify({
            previousStatus: order.status,
            newStatus: "accepted",
            courierUserId: ctx.user.id,
          }),
        });
      } catch {}

      return { id: order.id, status: "accepted" as const };
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        orderId: z.number().int().positive(),
        status: z.enum(["preparing", "on_the_way", "completed"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      ensureCourier(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database unavailable." });

      const found = await db
        .select()
        .from(orders)
        .where(and(eq(orders.id, input.orderId), isNull(orders.deletedAt)))
        .limit(1);

      if (!found[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
      const order = found[0];

      await db
        .update(orders)
        .set({
          status: input.status,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id));

      try {
        await db.insert(orderAuditLogs).values({
          orderId: order.id,
          orderCode: order.orderCode,
          action: `rider_status_${input.status}`,
          actorUserId: ctx.user.id,
          actorName: ctx.user.name ?? "Courier",
          actorEmail: ctx.user.email ?? null,
          snapshot: JSON.stringify({
            previousStatus: order.status,
            newStatus: input.status,
            courierUserId: ctx.user.id,
          }),
        });
      } catch {}

      return { id: order.id, status: input.status };
    }),
});
