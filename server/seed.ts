import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { campusServices, campuses, products, vendors } from "../drizzle/schema";

const campusSeed = [
  { slug: "knust", name: "Kwame Nkrumah University of Science and Technology", city: "Kumasi", region: "Ashanti" },
  { slug: "ug-legon", name: "University of Ghana · Legon", city: "Accra", region: "Greater Accra" },
  { slug: "upsa", name: "University of Professional Studies, Accra", city: "Accra", region: "Greater Accra" },
  { slug: "ucc", name: "University of Cape Coast", city: "Cape Coast", region: "Central" },
  { slug: "uew", name: "University of Education, Winneba", city: "Winneba", region: "Central" },
  { slug: "uds-tamale", name: "University for Development Studies · Tamale", city: "Tamale", region: "Northern" },
];

const serviceSeed = [
  ["printing-binding", "Printing & Binding", "Study support", 500],
  ["laundry", "Laundry & Wash", "Room care", 2500],
  ["parcel-pickup", "Parcel Pickup & Delivery", "Errands", 1500],
  ["room-cleaning", "Room Cleaning", "Room care", 3500],
  ["repairs-tech", "Repairs & Tech Help", "Repairs", 2000],
  ["barber-beauty", "Barber & Beauty", "Personal care", 3000],
] as const;

async function insertIfMissing<T extends { slug: string }>(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  table: any,
  values: T,
) {
  const found = await db.select({ id: table.id }).from(table).where(eq(table.slug, values.slug)).limit(1);
  if (!found[0]) await db.insert(table).values(values);
}

async function seed() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is required to seed CampOrder sample content.");
  for (const campus of campusSeed) {
    await insertIfMissing(db, campuses, { ...campus, description: "Sample campus listing for the CampOrder preview.", isSample: 1, isActive: 1 });
  }
  const allCampuses = await db.select().from(campuses);
  const knust = allCampuses.find((item) => item.slug === "knust");
  if (!knust) throw new Error("Sample campus seed failed.");
  await insertIfMissing(db, vendors, { slug: "sample-jollof-kitchen", campusId: knust.id, name: "Sample Jollof Kitchen", category: "food", description: "Demo vendor listing; not an operating or verified campus seller.", ratingHundredths: 490, etaMin: 25, deliveryFeePesewas: 500, isOpen: 1, isSample: 1 });
  await insertIfMissing(db, vendors, { slug: "sample-campus-mart", campusId: knust.id, name: "Sample Campus Mart", category: "groceries", description: "Demo vendor listing; not an operating or verified campus seller.", ratingHundredths: 470, etaMin: 20, deliveryFeePesewas: 500, isOpen: 1, isSample: 1 });
  const vendorRows = await db.select().from(vendors);
  const foodVendor = vendorRows.find((item) => item.slug === "sample-jollof-kitchen");
  const mart = vendorRows.find((item) => item.slug === "sample-campus-mart");
  const productSeed = [
    { slug: "loaded-jollof-bowl", vendorId: foodVendor?.id ?? null, category: "food", name: "Loaded Jollof Bowl", description: "Tomato-rich jollof, grilled chicken and ripe plantain.", pricePesewas: 3800, imageUrl: "/manus-storage/async-images/p1ku05FZk2C3CZ929wSiYe/image-3.webp", badge: "Sample pick", isAvailable: 1, isSample: 1 },
    { slug: "iced-sobolo", vendorId: foodVendor?.id ?? null, category: "drinks", name: "Chilled Sobolo", description: "A refreshing hibiscus drink, served cold.", pricePesewas: 1200, imageUrl: "/manus-storage/async-images/p1ku05FZk2C3CZ929wSiYe/image-4.webp", badge: "Sample pick", isAvailable: 1, isSample: 1 },
    { slug: "exam-essentials", vendorId: mart?.id ?? null, category: "stationery", name: "Exam Essentials Set", description: "A notebook, calculator and study-day basics.", pricePesewas: 4500, imageUrl: "/manus-storage/async-images/p1ku05FZk2C3CZ929wSiYe/image-5.webp", badge: "Sample listing", isAvailable: 1, isSample: 1 },
    { slug: "plantain-chips", vendorId: mart?.id ?? null, category: "groceries", name: "Plantain Chips", description: "A crunchy snack for the study break.", pricePesewas: 1000, imageUrl: null, badge: null, isAvailable: 1, isSample: 1 },
    { slug: "cook-a-meal-bundle", vendorId: mart?.id ?? null, category: "ingredients", name: "Cook-a-Meal Bundle", description: "A sample pantry bundle for a student meal.", pricePesewas: 5200, imageUrl: null, badge: "Bundle", isAvailable: 1, isSample: 1 },
    { slug: "personal-care-kit", vendorId: mart?.id ?? null, category: "health", name: "Personal Care Kit", description: "A sample everyday care bundle.", pricePesewas: 2800, imageUrl: null, badge: null, isAvailable: 1, isSample: 1 },
    { slug: "campus-cap", vendorId: mart?.id ?? null, category: "fashion", name: "Campus Cap", description: "Unbranded sample campus wear.", pricePesewas: 3500, imageUrl: null, badge: null, isAvailable: 1, isSample: 1 },
    { slug: "earbuds", vendorId: mart?.id ?? null, category: "electronics", name: "Wired Earphones", description: "A sample accessory listing.", pricePesewas: 2500, imageUrl: null, badge: null, isAvailable: 1, isSample: 1 },
  ];
  for (const item of productSeed) await insertIfMissing(db, products, item);
  for (const [slug, name, category, startingPricePesewas] of serviceSeed) {
    await insertIfMissing(db, campusServices, { slug, name, category, description: `Sample ${name.toLowerCase()} request type; provider availability is not verified.`, startingPricePesewas, isActive: 1, isSample: 1 });
  }
  console.log("CampOrder sample records are present; existing records were left unchanged.");
}

seed().then(() => process.exit(0)).catch((error) => {
  console.error("CampOrder sample seeding failed:", error instanceof Error ? error.message : "unknown error");
  process.exit(1);
});
