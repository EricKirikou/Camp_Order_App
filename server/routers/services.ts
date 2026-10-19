import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { campusServices, campuses, errands, serviceBookings } from "../../drizzle/schema";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";

function mustDb(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Campus services are unavailable." });
  return db;
}

export const servicesRouter = router({
  list: publicProcedure.query(async () => {
    const db = mustDb(await getDb());
    return db.select().from(campusServices).where(eq(campusServices.isActive, 1)).orderBy(campusServices.name);
  }),

  createErrand: protectedProcedure.input(z.object({
    campusId: z.number().int().positive(),
    title: z.string().trim().min(3).max(180),
    details: z.string().trim().min(8).max(2000),
    pickupLocation: z.string().trim().max(255).optional(),
    dropoffLocation: z.string().trim().max(255).optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = mustDb(await getDb());
    const campus = await db.select({ id: campuses.id }).from(campuses).where(eq(campuses.id, input.campusId)).limit(1);
    if (!campus[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Choose an available campus." });
    const inserted = await db.insert(errands).values({ userId: ctx.user.id, ...input, status: "submitted" }).$returningId();
    return { id: inserted[0].id, status: "submitted" as const, message: "Your request is saved. A campus partner has not accepted it yet." };
  }),

  errandById: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input, ctx }) => {
    const db = mustDb(await getDb());
    const rows = await db.select().from(errands).where(and(eq(errands.id, input.id), eq(errands.userId, ctx.user.id))).limit(1);
    if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Errand request not found." });
    return rows[0];
  }),

  book: protectedProcedure.input(z.object({
    serviceId: z.number().int().positive(),
    campusId: z.number().int().positive(),
    requestedAt: z.string().datetime(),
    details: z.string().trim().max(2000).optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = mustDb(await getDb());
    const campus = await db.select({ id: campuses.id }).from(campuses).where(eq(campuses.id, input.campusId)).limit(1);
    if (!campus[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Choose an available campus." });
    const service = await db.select().from(campusServices).where(and(eq(campusServices.id, input.serviceId), eq(campusServices.isActive, 1))).limit(1);
    if (!service[0]) throw new TRPCError({ code: "NOT_FOUND", message: "This service is unavailable." });
    const inserted = await db.insert(serviceBookings).values({
      userId: ctx.user.id,
      campusId: input.campusId,
      serviceId: input.serviceId,
      requestedAt: new Date(input.requestedAt),
      details: input.details ?? null,
      quotedPricePesewas: service[0].startingPricePesewas,
      status: "pending_confirmation",
    }).$returningId();
    return { id: inserted[0].id, status: "pending_confirmation" as const, message: "Request saved; it is waiting for a campus provider to confirm." };
  }),

  bookingById: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input, ctx }) => {
    const db = mustDb(await getDb());
    const rows = await db.select({ booking: serviceBookings, service: campusServices })
      .from(serviceBookings).innerJoin(campusServices, eq(serviceBookings.serviceId, campusServices.id))
      .where(and(eq(serviceBookings.id, input.id), eq(serviceBookings.userId, ctx.user.id))).limit(1);
    if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Service request not found." });
    return rows[0];
  }),

  myRequests: protectedProcedure.query(async ({ ctx }) => {
    const db = mustDb(await getDb());
    const myErrands = await db.select().from(errands).where(eq(errands.userId, ctx.user.id)).orderBy(desc(errands.createdAt)).limit(50);
    const myBookings = await db.select({ booking: serviceBookings, service: campusServices })
      .from(serviceBookings).innerJoin(campusServices, eq(serviceBookings.serviceId, campusServices.id))
      .where(eq(serviceBookings.userId, ctx.user.id)).orderBy(desc(serviceBookings.createdAt)).limit(50);
    return { errands: myErrands, bookings: myBookings };
  }),
});
