import type { Express, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { orders, paymentWebhookEvents, payments } from "../../drizzle/schema";
import { verifyPaystackSignature } from "../services/paystack";

export function registerPaystackWebhook(app: Express) {
  app.post("/api/payments/paystack/webhook", async (req: Request & { rawBody?: Buffer }, res: Response) => {
    const signature = req.header("x-paystack-signature");
    if (!verifyPaystackSignature(req.rawBody, signature)) {
      res.status(401).json({ error: "Invalid webhook signature" });
      return;
    }
    const event = req.body as { event?: string; data?: { reference?: string; amount?: number; currency?: string; status?: string; id?: number | string } };
    if (event.event !== "charge.success" || !event.data?.reference) {
      res.sendStatus(200);
      return;
    }
    const db = await getDb();
    if (!db) {
      res.sendStatus(503);
      return;
    }
    const reference = event.data.reference;
    const eventId = String(event.data.id ?? `charge.success:${reference}`);
    try {
      await db.transaction(async (tx) => {
        const seen = await tx.select({ id: paymentWebhookEvents.id }).from(paymentWebhookEvents)
          .where(eq(paymentWebhookEvents.providerEventId, eventId)).limit(1);
        if (seen[0]) return;
        const matches = await tx.select().from(payments).where(eq(payments.reference, reference)).limit(1);
        const payment = matches[0];
        if (!payment || payment.amountPesewas !== Number(event.data?.amount) || payment.currency !== event.data?.currency || event.data?.status !== "success") {
          // Record a signed but unrelated/mismatched event to avoid endless retries; do not mark paid.
          await tx.insert(paymentWebhookEvents).values({ providerEventId: eventId, eventType: event.event ?? "unknown" });
          return;
        }
        await tx.insert(paymentWebhookEvents).values({ providerEventId: eventId, eventType: "charge.success" });
        await tx.update(payments).set({ status: "success", verifiedAt: new Date() }).where(and(eq(payments.id, payment.id), eq(payments.status, "pending")));
        await tx.update(orders).set({ paymentStatus: "paid", status: "placed", updatedAt: new Date() }).where(and(eq(orders.id, payment.orderId), eq(orders.paymentStatus, "pending")));
      });
      res.sendStatus(200);
    } catch {
      res.sendStatus(500);
    }
  });
}
