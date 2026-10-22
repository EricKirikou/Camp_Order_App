import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { campusServices, campuses, products, vendors } from "../../drizzle/schema";
import { adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";

function requireDb(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Admin data is unavailable." });
  return db;
}

function rethrowDeleteConflict(error: unknown): never {
  if (error instanceof TRPCError) throw error;
  throw new TRPCError({ code: "CONFLICT", message: "This record is still referenced by other data and cannot be deleted." });
}

const campusFields = z.object({
  slug: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(180),
  city: z.string().trim().min(2).max(100),
  region: z.string().trim().min(2).max(100),
  description: z.string().max(2000).nullable().optional(),
  isActive: z.number().int().min(0).max(1).optional(),
});

const vendorFields = z.object({
  slug: z.string().trim().min(2).max(80),
  campusId: z.number().int().positive(),
  name: z.string().trim().min(2).max(180),
  category: z.string().trim().min(2).max(80),
  description: z.string().max(2000).nullable().optional(),
  etaMin: z.number().int().min(1).max(1440).optional(),
  deliveryFeePesewas: z.number().int().min(0).max(10_000_000).optional(),
  isOpen: z.number().int().min(0).max(1).optional(),
});

const productFields = z.object({
  slug: z.string().trim().min(2).max(100),
  vendorId: z.number().int().positive().nullable().optional(),
  category: z.string().trim().min(2).max(100),
  name: z.string().trim().min(2).max(180),
  description: z.string().max(2000).nullable().optional(),
  pricePesewas: z.number().int().min(0).max(100_000_000),
  imageUrl: z.string().trim().max(512).nullable().optional(),
  badge: z.string().trim().max(80).nullable().optional(),
  isAvailable: z.number().int().min(0).max(1).optional(),
});

const serviceFields = z.object({
  slug: z.string().trim().min(2).max(100),
  name: z.string().trim().min(2).max(180),
  category: z.string().trim().min(2).max(80),
  description: z.string().max(2000).nullable().optional(),
  startingPricePesewas: z.number().int().min(0).max(100_000_000),
  isActive: z.number().int().min(0).max(1).optional(),
});

export const adminRouter = router({
  campuses: adminProcedure.query(async () => requireDb(await getDb()).select().from(campuses).orderBy(campuses.name)),
  createCampus: adminProcedure.input(campusFields).mutation(async ({ input }) => {
    const db = requireDb(await getDb());
    const inserted = await db.insert(campuses).values({ ...input, description: input.description ?? null, isSample: 0, isActive: input.isActive ?? 1 }).$returningId();
    return { id: inserted[0]?.id };
  }),
  updateCampus: adminProcedure.input(z.object({ id: z.number().int().positive(), data: campusFields.partial().refine((data) => Object.keys(data).length > 0) })).mutation(async ({ input }) => {
    const db = requireDb(await getDb());
    await db.update(campuses).set(input.data).where(eq(campuses.id, input.id));
    return { success: true } as const;
  }),
  deleteCampus: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    try { await requireDb(await getDb()).delete(campuses).where(eq(campuses.id, input.id)); return { success: true } as const; }
    catch (error) { return rethrowDeleteConflict(error); }
  }),

  vendors: adminProcedure.query(async () => requireDb(await getDb()).select().from(vendors).orderBy(vendors.name)),
  createVendor: adminProcedure.input(vendorFields).mutation(async ({ input }) => {
    const db = requireDb(await getDb());
    const [campus] = await db.select({ id: campuses.id }).from(campuses).where(eq(campuses.id, input.campusId)).limit(1);
    if (!campus) throw new TRPCError({ code: "NOT_FOUND", message: "Campus not found." });
    const inserted = await db.insert(vendors).values({ ...input, description: input.description ?? null, etaMin: input.etaMin ?? 25, deliveryFeePesewas: input.deliveryFeePesewas ?? 0, isOpen: input.isOpen ?? 1, ratingHundredths: 0, isSample: 0 }).$returningId();
    return { id: inserted[0]?.id };
  }),
  updateVendor: adminProcedure.input(z.object({ id: z.number().int().positive(), data: vendorFields.partial().refine((data) => Object.keys(data).length > 0) })).mutation(async ({ input }) => {
    const db = requireDb(await getDb());
    if (input.data.campusId) {
      const [campus] = await db.select({ id: campuses.id }).from(campuses).where(eq(campuses.id, input.data.campusId)).limit(1);
      if (!campus) throw new TRPCError({ code: "NOT_FOUND", message: "Campus not found." });
    }
    await db.update(vendors).set(input.data).where(eq(vendors.id, input.id));
    return { success: true } as const;
  }),
  deleteVendor: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    try { await requireDb(await getDb()).delete(vendors).where(eq(vendors.id, input.id)); return { success: true } as const; }
    catch (error) { return rethrowDeleteConflict(error); }
  }),

  products: adminProcedure.query(async () => requireDb(await getDb()).select().from(products).orderBy(products.name)),
  createProduct: adminProcedure.input(productFields).mutation(async ({ input }) => {
    const db = requireDb(await getDb());
    if (input.vendorId) {
      const [vendor] = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.id, input.vendorId)).limit(1);
      if (!vendor) throw new TRPCError({ code: "NOT_FOUND", message: "Vendor not found." });
    }
    const inserted = await db.insert(products).values({ ...input, vendorId: input.vendorId ?? null, description: input.description ?? null, imageUrl: input.imageUrl ?? null, badge: input.badge ?? null, isAvailable: input.isAvailable ?? 1, isSample: 0 }).$returningId();
    return { id: inserted[0]?.id };
  }),
  updateProduct: adminProcedure.input(z.object({ id: z.number().int().positive(), data: productFields.partial().refine((data) => Object.keys(data).length > 0) })).mutation(async ({ input }) => {
    const db = requireDb(await getDb());
    if (input.data.vendorId) {
      const [vendor] = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.id, input.data.vendorId)).limit(1);
      if (!vendor) throw new TRPCError({ code: "NOT_FOUND", message: "Vendor not found." });
    }
    await db.update(products).set(input.data).where(eq(products.id, input.id));
    return { success: true } as const;
  }),
  clearProductImage: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    await requireDb(await getDb()).update(products).set({ imageUrl: null }).where(eq(products.id, input.id));
    return { success: true, fileDeleted: false } as const;
  }),
  deleteProduct: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    try { await requireDb(await getDb()).delete(products).where(eq(products.id, input.id)); return { success: true } as const; }
    catch (error) { return rethrowDeleteConflict(error); }
  }),

  services: adminProcedure.query(async () => requireDb(await getDb()).select().from(campusServices).orderBy(campusServices.name)),
  createService: adminProcedure.input(serviceFields).mutation(async ({ input }) => {
    const inserted = await requireDb(await getDb()).insert(campusServices).values({ ...input, description: input.description ?? null, isActive: input.isActive ?? 1, isSample: 0 }).$returningId();
    return { id: inserted[0]?.id };
  }),
  updateService: adminProcedure.input(z.object({ id: z.number().int().positive(), data: serviceFields.partial().refine((data) => Object.keys(data).length > 0) })).mutation(async ({ input }) => {
    await requireDb(await getDb()).update(campusServices).set(input.data).where(eq(campusServices.id, input.id));
    return { success: true } as const;
  }),
  deleteService: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    try { await requireDb(await getDb()).delete(campusServices).where(eq(campusServices.id, input.id)); return { success: true } as const; }
    catch (error) { return rethrowDeleteConflict(error); }
  }),
});