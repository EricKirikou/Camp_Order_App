import { afterEach, describe, expect, it, vi } from "vitest";
import { sendOtpSms } from "../server/services/africas-talking";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Africa's Talking OTP adapter", () => {
  it("sends one generic SMS through the configured provider without logging or returning the OTP", async () => {
    vi.stubEnv("AFRICASTALKING_USERNAME", "camporder-test");
    vi.stubEnv("AFRICASTALKING_API_KEY", "test-key-not-real");
    vi.stubEnv("AFRICASTALKING_SENDER_ID", "CAMPORDER");
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({ SMSMessageData: { Recipients: [{ statusCode: 101, messageId: "provider-message-id" }] } }),
    } as Response));
    vi.stubGlobal("fetch", fetchMock);
    const result = await sendOtpSms("+233241234567", "042891");
    expect(result).toEqual({ messageId: "provider-message-id" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.africastalking.com/version1/messaging/bulk");
    expect((init?.headers as Record<string, string>).apiKey).toBe("test-key-not-real");
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ username: "camporder-test", phoneNumbers: ["+233241234567"], senderId: "CAMPORDER", enqueue: 0 });
    expect(body.message).toContain("042891");
  });

  it("rejects setup without contacting a provider", async () => {
    vi.stubEnv("AFRICASTALKING_USERNAME", "");
    vi.stubEnv("AFRICASTALKING_API_KEY", "");
    vi.stubEnv("AFRICASTALKING_SENDER_ID", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendOtpSms("+233241234567", "042891")).rejects.toThrow(/not configured/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
