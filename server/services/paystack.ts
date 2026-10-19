import { createHmac, timingSafeEqual } from "node:crypto";

type PaystackEnvelope<T> = { status: boolean; message?: string; data?: T };
export type PaystackInitializeResult = { authorization_url: string; access_code: string; reference: string };
export type PaystackVerifyResult = {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  paid_at?: string | null;
  customer?: { email?: string };
};

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error(process.env.NODE_ENV === "production"
    ? "Production checkout is not configured. Add a Paystack live key through protected setup."
    : "Paystack is not configured. Add a protected test key before checkout.");
  const expectedPrefix = process.env.NODE_ENV === "production" ? "sk_live_" : "sk_test_";
  if (!key.startsWith(expectedPrefix)) {
    throw new Error(process.env.NODE_ENV === "production"
      ? "Production checkout requires a Paystack live secret configured through protected setup."
      : "Development checkout only accepts a Paystack test secret key.");
  }
  return key;
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const body = (await response.json()) as PaystackEnvelope<T>;
  if (!response.ok || !body.status || !body.data) {
    throw new Error("Paystack could not complete the requested payment operation.");
  }
  return body.data;
}

export function initializeGhsPayment(input: {
  email: string;
  amountPesewas: number;
  reference: string;
  callbackUrl?: string;
  metadata: Record<string, string | number>;
}) {
  return request<PaystackInitializeResult>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: String(input.amountPesewas),
      currency: "GHS",
      reference: input.reference,
      ...(input.callbackUrl ? { callback_url: input.callbackUrl } : {}),
      metadata: input.metadata,
    }),
  });
}

export function verifyGhsPayment(reference: string) {
  return request<PaystackVerifyResult>(`/transaction/verify/${encodeURIComponent(reference)}`, { method: "GET" });
}

export function verifyPaystackSignature(rawBody: Buffer | undefined, received: string | undefined): boolean {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key || !rawBody || !received || !/^[a-f0-9]{128}$/i.test(received)) return false;
  const expected = createHmac("sha512", key).update(rawBody).digest();
  const provided = Buffer.from(received, "hex");
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
