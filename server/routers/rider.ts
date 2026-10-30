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

    // Fetch orders:
    // 1) Unaccepted / unassigned orders waiting for a courier (status 'placed', courierId is null)
    // 2) Active orders already accepted by THIS courier (accepted, preparing, on_the_way)
    const pending = await db
      .select()
      .from(orders)
      .where(
        and(
          isNull(orders.deletedAt),
          or(
            // Available unassigned orders
            and(
              eq(orders.status, "placed"),
              isNull(orders.courierId)
            ),
            // Orders accepted by this rider in progress
            and(
              eq(orders.courierId, ctx.user.id),
              inArray(orders.status, ["accepted", "preparing", "on_the_way"])
            )
          )
        )
      )
      .orderBy(desc(orders.createdAt))
      .limit(50);

    // Resolve restaurant/vendor name and ordered items for each order
    const result = await Promise.all(
      pending.map(async (order) => {
        const orderItemsWithProducts = await db
          .select({
            id: orderItems.id,
            productName: orderItems.productName,
            quantity: orderItems.quantity,
            vendorName: vendors.name,
            vendorEtaMin: vendors.etaMin,
          })
          .from(orderItems)
          .leftJoin(products, eq(orderItems.productId, products.id))
          .leftJoin(vendors, eq(products.vendorId, vendors.id))
          .where(eq(orderItems.orderId, order.id));

        const restaurantName = orderItemsWithProducts[0]?.vendorName || "Campus Kitchen";
        const isMine = order.courierId === ctx.user.id;
        // When vendor marks prepared, status transitions to "on_the_way" (or "prepared" if stored)
        const isFoodPrepared = order.status === "on_the_way" || order.status === "completed";

        return {
          id: order.id,
          orderCode: order.orderCode,
          restaurantName,
          dropoffAddress: order.deliveryAddress,
          payout: order.deliveryFeePesewas || 500,
          createdAt: order.createdAt.toISOString(),
          updatedAt: order.updatedAt?.toISOString(),
          status: order.status,
          courierId: order.courierId,
          isMine,
          isFoodPrepared,
          items: orderItemsWithProducts.map((i) => ({
            id: i.id,
            productName: i.productName,
            quantity: i.quantity,
          })),
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

      // Transition order status to 'accepted' and assign courier
      await db
        .update(orders)
        .set({
          status: "accepted",
          courierId: ctx.user.id,
          courierAcceptedAt: new Date(),
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
