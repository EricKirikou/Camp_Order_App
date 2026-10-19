import type { Express, Request, Response } from "express";
import { getSessionCookieOptions } from "./cookies";
import { authenticateCampOrderRequest, publicUser } from "../services/authentication";
import { sessionCookieName } from "../services/security";

export function registerCampOrderAuthRoutes(app: Express) {
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    const user = await authenticateCampOrderRequest(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated", user: null });
      return;
    }
    res.json({ user: publicUser(user) });
  });

  app.post("/api/auth/logout", (_req: Request, res: Response) => {
    res.clearCookie(sessionCookieName(), {
      ...getSessionCookieOptions(_req),
      maxAge: -1,
    });
    res.json({ success: true });
  });
}
