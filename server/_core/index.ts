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

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use(createCorsMiddleware());
  app.use(clearLegacySessionCookie());
  app.use(express.json({
    limit: "2mb",
    verify: (req, _res, buffer) => {
      (req as typeof req & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
    },
  }));
  app.use(express.urlencoded({ limit: "2mb", extended: true }));
  registerStorageProxy(app);
  registerCampOrderAuthRoutes(app);
  registerPaystackWebhook(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

  const port = parseInt(process.env.PORT || "3000", 10);
  server.listen(port, "0.0.0.0", () => console.log(`[api] server listening on ${port}`));
}

startServer().catch(() => {
  console.error("[api] server failed to start");
});
