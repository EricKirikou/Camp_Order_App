import type { Express, Request, Response } from "express";
import { getSessionCookieOptions } from "./cookies";
import { authenticateCampOrderRequest, publicUser, setSession } from "../services/authentication";
import { sessionCookieName, verifySessionToken } from "../services/security";

export function registerCampOrderAuthRoutes(app: Express) {
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    const user = await authenticateCampOrderRequest(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated", user: null });
      return;
    }
    res.json({ user: publicUser(user) });
  });

  // Called by web clients after receiving a Bearer token (e.g. post-OAuth)
  // to exchange it for a session cookie on the API domain.
  app.post("/api/auth/session", async (req: Request, res: Response) => {
    const authorization = req.headers.authorization;
    const token =
      typeof authorization === "string" && authorization.startsWith("Bearer ")
        ? authorization.slice(7).trim()
        : null;
    if (!token) {
      res.status(400).json({ error: "Missing Bearer token" });
      return;
    }
    const userId = await verifySessionToken(token);
    if (!userId) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }
    await setSession(req, res, token);
    res.json({ success: true });
  });

  app.post("/api/auth/logout", (_req: Request, res: Response) => {
    res.clearCookie(sessionCookieName(), {
      ...getSessionCookieOptions(_req),
      maxAge: -1,
    });
    res.json({ success: true });
  });
}
