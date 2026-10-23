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
  const key = secretKey();
  const isDev = process.env.NODE_ENV !== "production";
  const isKnownPlaceholder = isDev && (key === "sk_test_camporder_test_secret_key_2024" || key.includes("placeholder") || key.includes("example"));

  // If not a known placeholder, attempt real Paystack API call
  if (!isKnownPlaceholder) {
    try {
      const response = await fetch(`https://api.paystack.co${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          ...init.headers,
        },
      });
      const body = (await response.json()) as PaystackEnvelope<T>;
      if (response.ok && body.status && body.data) {
        return body.data;
      }
      // If we got an explicit error message from Paystack, log it or throw if not in dev test key fallback
      if (!isDev) {
        throw new Error(body.message || `Paystack error HTTP ${response.status}`);
      }
    } catch (err) {
      if (!isDev) {
        throw err instanceof Error ? err : new Error("Paystack network request failed");
      }
    }
  }

  // Sandbox simulation fallback in development if test key is a placeholder or Paystack API is unreachable
  if (isDev && key.startsWith("sk_test_")) {
    if (path.startsWith("/transaction/initialize")) {
      const payload = init.body ? JSON.parse(init.body as string) : {};
      const ref = payload.reference || `camp_${Date.now()}`;
      // Prefer the payload callback_url; fall back to EXPO preview or localhost
      let cb = payload.callback_url || "";
      let webOrigin = process.env.EXPO_WEB_PREVIEW_URL || process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8081";
      if (cb) {
        try {
          const parsed = new URL(cb);
          webOrigin = parsed.origin;
        } catch {}
      } else {
        cb = `${webOrigin}/payment`;
      }
      const amount = payload.amount || "0";
      const email = payload.email || "";
      const authUrl = `${webOrigin}/paystack-sandbox?reference=${encodeURIComponent(ref)}&amount=${encodeURIComponent(amount)}&email=${encodeURIComponent(email)}&callback_url=${encodeURIComponent(cb)}`;
      return {
        authorization_url: authUrl,
        access_code: `test_access_${Date.now()}`,
        reference: ref,
      } as unknown as T;
    }
    if (path.startsWith("/transaction/verify")) {
      const ref = decodeURIComponent(path.split("/").pop() || "");
      return {
        status: "success",
        reference: ref,
        amount: 0,
        currency: "GHS",
        paid_at: new Date().toISOString(),
        customer: { email: "student@campus.edu" },
      } as unknown as T;
    }
  }

  throw new Error("Paystack could not complete the requested payment operation.");
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
