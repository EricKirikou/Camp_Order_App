
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { createCorsMiddleware } from "./cors";
import { clearLegacySessionCookie } from "./cookies";
import { registerCampOrderAuthRoutes } from "./camporder-auth-routes";
import { registerPaystackWebhook } from "./paystack-webhook";

import path from "node:path";
import fs from "node:fs";

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Allow the deployed frontend to access the backend.
  const allowedOrigins = new Set([
    "https://camp-order-app-1.onrender.com",
  ]);

  // CORS must run before API routes so OPTIONS requests are handled.
  app.use(createCorsMiddleware(allowedOrigins));

  app.use(clearLegacySessionCookie());

  // Ensure the uploads directory exists.
  const uploadsDir = path.join(process.cwd(), "public", "uploads");

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  app.use("/uploads", express.static(uploadsDir));

  // Parse JSON and preserve the raw body for webhook verification.
  app.use(
    express.json({
      limit: "15mb",
      verify: (req, _res, buffer) => {
        (req as typeof req & { rawBody?: Buffer }).rawBody =
          Buffer.from(buffer);
      },
    }),
  );

  app.use(express.urlencoded({ limit: "15mb", extended: true }));

  // Register existing application routes.
  registerStorageProxy(app);
  registerCampOrderAuthRoutes(app);
  registerPaystackWebhook(app);

  // Health check.
  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      timestamp: Date.now(),
    });
  });

  // tRPC API.
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const port = parseInt(process.env.PORT || "3000", 10);

  server.listen(port, "0.0.0.0", () => {
    console.log(`[api] server listening on ${port}`);
  });
}

startServer().catch((error) => {
  console.error("[api] server failed to start:", error);
  process.exitCode = 1;
});

