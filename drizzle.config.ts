import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

const databaseUrl = new URL(connectionString);
const requiresTls = databaseUrl.searchParams.get("ssl-mode")?.toLowerCase() === "required";
databaseUrl.searchParams.delete("ssl-mode");
const caFile = process.env.DATABASE_SSL_CA_FILE;
if (requiresTls && !caFile) {
  throw new Error("DATABASE_SSL_CA_FILE must point to the Aiven CA certificate when ssl-mode=REQUIRED.");
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: requiresTls
    ? {
        host: databaseUrl.hostname,
        port: Number(databaseUrl.port),
        user: decodeURIComponent(databaseUrl.username),
        password: decodeURIComponent(databaseUrl.password),
        database: decodeURIComponent(databaseUrl.pathname.slice(1)),
        ssl: { ca: readFileSync(resolve(process.cwd(), caFile!), "utf8") },
      }
    : { url: databaseUrl.toString() },
});
