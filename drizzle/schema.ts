import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/** Existing starter identity columns are retained; CampOrder phone accounts use a pseudonymous openId. */
export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
    phoneNumber: varchar("phoneNumber", { length: 20 }).unique(),
    passwordHash: varchar("passwordHash", { length: 255 }),
    phoneVerifiedAt: timestamp("phoneVerifiedAt"),
    campusId: int("campusId"),
    failedLoginAttempts: int("failedLoginAttempts").default(0).notNull(),
    loginLockedUntil: timestamp("loginLockedUntil"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
);

export const otpChallenges = mysqlTable("otp_challenges", {
  id: int("id").autoincrement().primaryKey(),
  phoneNumber: varchar("phoneNumber", { length: 20 }).notNull(),
  userId: int("userId").references(() => users.id),
  purpose: mysqlEnum("purpose", ["signup", "login"]).notNull(),
  codeHash: varchar("codeHash", { length: 128 }).notNull(),
  resendTokenHash: varchar("resendTokenHash", { length: 64 }).default("").notNull(),
  attempts: int("attempts").default(0).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  consumedAt: timestamp("consumedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const campuses = mysqlTable("campuses", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 180 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  region: varchar("region", { length: 100 }).notNull(),
  description: text("description"),
  isSample: int("isSample").default(1).notNull(),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const vendors = mysqlTable(
  "vendors",
  {
    id: int("id").autoincrement().primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull().unique(),
    campusId: int("campusId").notNull().references(() => campuses.id),
    name: varchar("name", { length: 180 }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    description: text("description"),
    ratingHundredths: int("ratingHundredths").default(0).notNull(),
    etaMin: int("etaMin").default(25).notNull(),
    deliveryFeePesewas: int("deliveryFeePesewas").default(0).notNull(),
    isOpen: int("isOpen").default(1).notNull(),
    isSample: int("isSample").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
);

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  vendorId: int("vendorId").references(() => vendors.id),
  category: varchar("category", { length: 100 }).notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  description: text("description"),
  pricePesewas: int("pricePesewas").notNull(),
  imageUrl: varchar("imageUrl", { length: 512 }),
  badge: varchar("badge", { length: 80 }),
  isAvailable: int("isAvailable").default(1).notNull(),
  isSample: int("isSample").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const carts = mysqlTable("carts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  campusId: int("campusId").notNull().references(() => campuses.id),
  status: mysqlEnum("status", ["active", "checked_out", "abandoned"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const cartItems = mysqlTable(
  "cart_items",
  {
    id: int("id").autoincrement().primaryKey(),
    cartId: int("cartId").notNull().references(() => carts.id),
    productId: int("productId").notNull().references(() => products.id),
    quantity: int("quantity").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("cart_product_unique").on(table.cartId, table.productId)],
);

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  orderCode: varchar("orderCode", { length: 32 }).notNull().unique(),
  userId: int("userId").notNull().references(() => users.id),
  campusId: int("campusId").notNull().references(() => campuses.id),
  status: mysqlEnum("status", ["payment_pending", "placed", "accepted", "preparing", "on_the_way", "completed", "cancelled"]).default("payment_pending").notNull(),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "paid", "failed", "refunded"]).default("pending").notNull(),
  isSample: int("isSample").default(0).notNull(),
  subtotalPesewas: int("subtotalPesewas").notNull(),
  deliveryFeePesewas: int("deliveryFeePesewas").notNull(),
  totalPesewas: int("totalPesewas").notNull(),
  deliveryAddress: text("deliveryAddress").notNull(),
  customerEmail: varchar("customerEmail", { length: 320 }).notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().references(() => orders.id),
  productId: int("productId").notNull().references(() => products.id),
  productName: varchar("productName", { length: 180 }).notNull(),
  unitPricePesewas: int("unitPricePesewas").notNull(),
  quantity: int("quantity").notNull(),
});

export const campusServices = mysqlTable("campus_services", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 180 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  description: text("description"),
  startingPricePesewas: int("startingPricePesewas").default(0).notNull(),
  isActive: int("isActive").default(1).notNull(),
  isSample: int("isSample").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const errands = mysqlTable("errands", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  campusId: int("campusId").notNull().references(() => campuses.id),
  title: varchar("title", { length: 180 }).notNull(),
  details: text("details").notNull(),
  pickupLocation: varchar("pickupLocation", { length: 255 }),
  dropoffLocation: varchar("dropoffLocation", { length: 255 }),
  quotedPricePesewas: int("quotedPricePesewas"),
  status: mysqlEnum("status", ["submitted", "quoted", "accepted", "in_progress", "completed", "cancelled"]).default("submitted").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const serviceBookings = mysqlTable("service_bookings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  campusId: int("campusId").notNull().references(() => campuses.id),
  serviceId: int("serviceId").notNull().references(() => campusServices.id),
  requestedAt: timestamp("requestedAt").notNull(),
  details: text("details"),
  quotedPricePesewas: int("quotedPricePesewas"),
  status: mysqlEnum("status", ["pending_confirmation", "confirmed", "in_progress", "completed", "cancelled"]).default("pending_confirmation").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().references(() => orders.id),
  reference: varchar("reference", { length: 100 }).notNull().unique(),
  amountPesewas: int("amountPesewas").notNull(),
  currency: varchar("currency", { length: 3 }).default("GHS").notNull(),
  status: mysqlEnum("status", ["initialized", "pending", "success", "failed", "reversed"]).default("initialized").notNull(),
  authorizationUrl: varchar("authorizationUrl", { length: 512 }),
  verifiedAt: timestamp("verifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const paymentWebhookEvents = mysqlTable("payment_webhook_events", {
  id: int("id").autoincrement().primaryKey(),
  providerEventId: varchar("providerEventId", { length: 150 }).notNull().unique(),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  processedAt: timestamp("processedAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Campus = typeof campuses.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
