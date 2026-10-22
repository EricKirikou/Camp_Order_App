import "dotenv/config";
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
  { slug: "umat", name: "University of Mines and Technology", city: "Tarkwa", region: "Western" },
  { slug: "uhas", name: "University of Health and Allied Sciences", city: "Ho", region: "Volta" },
  { slug: "uenr", name: "University of Energy and Natural Resources", city: "Sunyani", region: "Bono" },
  { slug: "gimpa", name: "Ghana Institute of Management and Public Administration", city: "Achimota, Accra", region: "Greater Accra" },
  { slug: "uesd", name: "University of Environment and Sustainable Development", city: "Somanya", region: "Eastern" },
  { slug: "sdd-ubids", name: "S.D. Dombo University of Business and Integrated Development Studies", city: "Wa", region: "Upper West" },
  { slug: "ckt-utas", name: "C.K. Tedam University of Technology and Applied Sciences", city: "Navrongo", region: "Upper East" },
  { slug: "aamusted", name: "Akenten Appiah-Menka University of Skills Training and Entrepreneurial Development", city: "Kumasi and Mampong", region: "Ashanti" },
  { slug: "unimac", name: "University of Media, Arts and Communication", city: "Accra", region: "Greater Accra" },
  { slug: "gctu", name: "Ghana Communication Technology University", city: "Tesano, Accra", region: "Greater Accra" },
  { slug: "atu", name: "Accra Technical University", city: "Accra", region: "Greater Accra" },
  { slug: "kstu", name: "Kumasi Technical University", city: "Kumasi", region: "Ashanti" },
  { slug: "cctu", name: "Cape Coast Technical University", city: "Cape Coast", region: "Central" },
  { slug: "ttu", name: "Takoradi Technical University", city: "Takoradi", region: "Western" },
  { slug: "htu", name: "Ho Technical University", city: "Ho", region: "Volta" },
  { slug: "ktu", name: "Koforidua Technical University", city: "Koforidua", region: "Eastern" },
  { slug: "stu", name: "Sunyani Technical University", city: "Sunyani", region: "Bono" },
  { slug: "tatu", name: "Tamale Technical University", city: "Tamale", region: "Northern" },
  { slug: "btu", name: "Bolgatanga Technical University", city: "Bolgatanga", region: "Upper East" },
  { slug: "dhltu", name: "Dr. Hilla Limann Technical University", city: "Wa", region: "Upper West" },
  { slug: "academic-city", name: "Academic City University", city: "Accra", region: "Greater Accra" },
  { slug: "accra-metropolitan", name: "Accra Metropolitan University", city: "Accra", region: "Greater Accra" },
  { slug: "aucb", name: "African University of Communication and Business", city: "Accra", region: "Greater Accra" },
  { slug: "akrofi-christaller", name: "Akrofi-Christaller Institute of Theology, Mission and Culture", city: "Akropong", region: "Eastern" },
  { slug: "all-nations", name: "All Nations University", city: "Koforidua", region: "Eastern" },
  { slug: "ashesi", name: "Ashesi University", city: "Berekuso", region: "Eastern" },
  { slug: "cug", name: "Catholic University of Ghana", city: "Fiapre, Sunyani", region: "Bono" },
  { slug: "central-university", name: "Central University", city: "Miotso and other campuses", region: "Greater Accra" },
  { slug: "christian-service", name: "Christian Service University", city: "Kumasi", region: "Ashanti" },
  { slug: "ensign-global", name: "Ensign Global University", city: "Kpong", region: "Eastern" },
  { slug: "entrance-uhs", name: "Entrance University of Health Sciences", city: "Accra", region: "Greater Accra" },
  { slug: "family-health", name: "Family Health University", city: "Teshie, Accra", region: "Greater Accra" },
  { slug: "garden-city", name: "Garden City University College", city: "Kumasi", region: "Ashanti" },
  { slug: "heritage-christian", name: "Heritage Christian University", city: "Amasaman", region: "Greater Accra" },
  { slug: "iucg", name: "Islamic University College, Ghana", city: "Accra", region: "Greater Accra" },
  { slug: "kaaf", name: "KAAF University", city: "Central Region", region: "Central" },
  { slug: "knutsford", name: "Knutsford University", city: "Accra", region: "Greater Accra" },
  { slug: "methodist-university", name: "Methodist University Ghana", city: "Accra", region: "Greater Accra" },
  { slug: "nibs", name: "NiBS University", city: "Accra", region: "Greater Accra" },
  { slug: "pentecost", name: "Pentecost University", city: "Sowutuom, Accra", region: "Greater Accra" },
  { slug: "presbyterian-university", name: "Presbyterian University", city: "Abetifi and other campuses", region: "Eastern" },
  { slug: "regent", name: "Regent University College of Science and Technology", city: "Accra", region: "Greater Accra" },
  { slug: "trinity-theological", name: "Trinity Theological Seminary", city: "Legon, Accra", region: "Greater Accra" },
  { slug: "university-gold-coast", name: "University of Gold Coast", city: "Accra", region: "Greater Accra" },
  { slug: "valley-view", name: "Valley View University", city: "Oyibi", region: "Greater Accra" },
  { slug: "wisconsin-international", name: "Wisconsin International University College, Ghana", city: "Accra", region: "Greater Accra" },
  { slug: "west-end", name: "West End University College", city: "Accra", region: "Greater Accra" },
  { slug: "accra-institute-tech", name: "Accra Institute of Technology", city: "Accra", region: "Greater Accra" },
  { slug: "data-link", name: "Data Link University", city: "Tema", region: "Greater Accra" },
  { slug: "dominion", name: "Dominion University College", city: "Accra", region: "Greater Accra" },
  { slug: "ucaes", name: "University College of Agriculture and Environmental Studies", city: "Bunso", region: "Eastern" },
  { slug: "ouwa", name: "Open University of West Africa", city: "Accra", region: "Greater Accra" },
  { slug: "regional-maritime", name: "Regional Maritime University", city: "Accra", region: "Greater Accra" },
  { slug: "ghana-institute-languages", name: "Ghana Institute of Languages", city: "Accra", region: "Greater Accra" },
  { slug: "nafti", name: "National Film and Television Institute (NAFTI)", city: "Accra", region: "Greater Accra" },
  { slug: "university-applied-management", name: "University of Applied Management", city: "Kwabenya", region: "Greater Accra" },
  { slug: "anglican-technology", name: "Anglican University College of Technology", city: "Accra", region: "Greater Accra" },
  { slug: "cibt", name: "Catholic Institute of Business and Technology", city: "Accra", region: "Greater Accra" },
  { slug: "maranatha", name: "Maranatha University College", city: "Accra", region: "Greater Accra" },
  { slug: "marshalls", name: "Marshalls University College", city: "Accra", region: "Greater Accra" },
  { slug: "perez", name: "Perez University College", city: "Winneba", region: "Central" },
  { slug: "spiritan", name: "Spiritan University College", city: "Eastern Region", region: "Eastern" },
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
