import { eq } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { campuses, products, vendors, users } from "../../drizzle/schema";
import { getDb } from "../db";

export const CATEGORY_LIST = [
  { slug: "food", name: "Food", icon: "fast-food-outline" },
  { slug: "drinks", name: "Drinks", icon: "cafe-outline" },
  { slug: "groceries", name: "Groceries", icon: "basket-outline" },
  { slug: "ingredients", name: "Food Ingredients", icon: "leaf-outline" },
  { slug: "health", name: "Health & Personal Care", icon: "medkit-outline" },
  { slug: "stationery", name: "Stationery", icon: "pencil-outline" },
  { slug: "fashion", name: "Fashion", icon: "shirt-outline" },
  { slug: "electronics", name: "Electronics", icon: "headset-outline" },
  { slug: "all", name: "More · All Campus Needs", icon: "grid-outline" },
] as const;

function requireDb(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Campus marketplace is unavailable." });
  return db;
}

export const catalogRouter = router({
  campuses: publicProcedure.query(async () => {
    const db = requireDb(await getDb());
    return db.select().from(campuses).where(eq(campuses.isActive, 1)).orderBy(campuses.name);
  }),

  categories: publicProcedure.query(() => CATEGORY_LIST),

  home: publicProcedure.input(z.object({ campusId: z.number().int().positive().optional() }).optional()).query(async ({ input }) => {
    const db = requireDb(await getDb());
    const availableCampuses = await db.select().from(campuses).where(eq(campuses.isActive, 1)).orderBy(campuses.name);
    const campus = availableCampuses.find((item) => item.id === input?.campusId) ?? availableCampuses[0] ?? null;
    if (!campus) return { campus: null, categories: CATEGORY_LIST, vendors: [], products: [] };
    const campusVendors = await db.select().from(vendors).where(eq(vendors.campusId, campus.id)).orderBy(vendors.name).limit(8);
    const featuredProducts = await db.select().from(products).where(eq(products.isAvailable, 1)).orderBy(products.id).limit(12);
    return { campus, categories: CATEGORY_LIST, vendors: campusVendors, products: featuredProducts };
  }),

  listProducts: publicProcedure.input(z.object({
    query: z.string().trim().max(100).optional(),
    category: z.string().max(100).optional(),
    vendorId: z.number().int().positive().optional(),
  }).optional()).query(async ({ input }) => {
    const db = requireDb(await getDb());
    let rows = await db.select().from(products).where(eq(products.isAvailable, 1)).orderBy(products.name).limit(100);
    if (input?.category && input.category !== "all") rows = rows.filter((item) => item.category === input.category);
    if (input?.vendorId) rows = rows.filter((item) => item.vendorId === input.vendorId);
    if (input?.query) {
      const query = input.query.toLowerCase();
      rows = rows.filter((item) => `${item.name} ${item.category} ${item.description ?? ""}`.toLowerCase().includes(query));
    }
    return rows;
  }),

  product: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
    const db = requireDb(await getDb());
    const rows = await db.select().from(products).where(eq(products.id, input.id)).limit(1);
    if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "This item is no longer available." });
    const seller = rows[0].vendorId ? await db.select().from(vendors).where(eq(vendors.id, rows[0].vendorId)).limit(1) : [];
    return { ...rows[0], vendor: seller[0] ?? null };
  }),

  vendor: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
    const db = requireDb(await getDb());
    const vendorRows = await db.select().from(vendors).where(eq(vendors.id, input.id)).limit(1);
    if (!vendorRows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Campus seller not found." });
    const items = await db.select().from(products).where(eq(products.vendorId, input.id)).limit(80);
    return { ...vendorRows[0], products: items };
  }),

  setCampus: protectedProcedure.input(z.object({ campusId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const db = requireDb(await getDb());
    const found = await db.select({ id: campuses.id }).from(campuses).where(eq(campuses.id, input.campusId)).limit(1);
    if (!found[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Select an available campus." });
    await db.update(users).set({ campusId: input.campusId }).where(eq(users.id, ctx.user.id));
    return { campusId: input.campusId };
  }),
});
