import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initializeGhsPayment, verifyGhsPayment, verifyPaystackSignature } from "../server/services/paystack";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Paystack GHS adapter", () => {
  it("initializes a GHS test transaction in pesewas and omits a missing callback", async () => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_unit_only");
    vi.stubEnv("NODE_ENV", "test");
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({ status: true, data: { authorization_url: "https://checkout.paystack.test/example", access_code: "test-access", reference: "camporder-test-ref" } }),
    } as Response));
    vi.stubGlobal("fetch", fetchMock);
    const result = await initializeGhsPayment({ email: "student@example.test", amountPesewas: 12750, reference: "camporder-test-ref", metadata: { orderId: 12 } });
    expect(result.authorization_url).toContain("paystack.test");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.paystack.co/transaction/initialize");
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ email: "student@example.test", amount: "12750", currency: "GHS", reference: "camporder-test-ref" });
    expect(body).not.toHaveProperty("callback_url");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer sk_test_unit_only");
  });

  it("encodes verify references and rejects invalid or tampered webhook signatures", async () => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_unit_only");
    vi.stubEnv("NODE_ENV", "test");
    const fetchMock = vi.fn(async (_url: RequestInfo | URL) => ({ ok: true, json: async () => ({ status: true, data: { status: "success", reference: "camporder/ref", amount: 12750, currency: "GHS" } }) } as Response));
    vi.stubGlobal("fetch", fetchMock);
    await verifyGhsPayment("camporder/ref");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.paystack.co/transaction/verify/camporder%2Fref");

    const rawBody = Buffer.from(JSON.stringify({ event: "charge.success" }));
    const signature = createHmac("sha512", "sk_test_unit_only").update(rawBody).digest("hex");
    expect(verifyPaystackSignature(rawBody, signature)).toBe(true);
    expect(verifyPaystackSignature(rawBody, "f".repeat(128))).toBe(false);
    expect(verifyPaystackSignature(undefined, signature)).toBe(false);
  });

  it("uses sandbox simulation fallback in development when placeholder key is used", async () => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_camporder_test_secret_key_2024");
    vi.stubEnv("NODE_ENV", "development");
    const result = await initializeGhsPayment({
      email: "test@camporder.gh",
      amountPesewas: 5000,
      reference: "camporder-retry-ref-123",
      callbackUrl: "http://localhost:8081/payment",
      metadata: { orderId: 99 },
    });
    expect(result.authorization_url).toContain("http://localhost:8081/paystack-sandbox");
    expect(result.authorization_url).toContain("callback_url=http%3A%2F%2Flocalhost%3A8081%2Fpayment");
    expect(result.reference).toBe("camporder-retry-ref-123");

    const verifyResult = await verifyGhsPayment("camporder-retry-ref-123");
    expect(verifyResult.status).toBe("success");
    expect(verifyResult.reference).toBe("camporder-retry-ref-123");
  });

  it("supports sk_test_ keys in production environments", async () => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_camporder_test_secret_key_2024");
    vi.stubEnv("NODE_ENV", "production");
    const result = await initializeGhsPayment({
      email: "student@knust.edu.gh",
      amountPesewas: 3500,
      reference: "camporder-prod-test-ref",
      callbackUrl: "https://camp-order-app-1.onrender.com/payment",
      metadata: { orderId: 101 },
    });
    expect(result.authorization_url).toContain("/paystack-sandbox");
    expect(result.reference).toBe("camporder-prod-test-ref");
  });
});
