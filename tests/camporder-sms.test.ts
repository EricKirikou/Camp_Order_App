import { afterEach, describe, expect, it, vi } from "vitest";
import { isArkeselSandbox, sendOtpSms } from "../server/services/arkesel";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Arkesel SMS OTP adapter", () => {
  it("sends one generic OTP SMS through Arkesel v2 API without logging or returning the OTP in live mode", async () => {
    vi.stubEnv("ARKESEL_API_KEY", "test-arkesel-api-key");
    vi.stubEnv("ARKESEL_SENDER_ID", "CampOrder");
    vi.stubEnv("ARKESEL_SANDBOX", "false");

    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({
        status: "success",
        data: { id: "arkesel-msg-id-12345", credits_used: 1 },
      }),
    } as Response));

    vi.stubGlobal("fetch", fetchMock);

    const result = await sendOtpSms("+233241234567", "042891");
    expect(result).toEqual({ messageId: "arkesel-msg-id-12345" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://sms.arkesel.com/api/v2/sms/send");

    const headers = init?.headers as Record<string, string>;
    expect(headers["api-key"]).toBe("test-arkesel-api-key");
    expect(headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      sender: "CampOrder",
      recipients: ["233241234567"],
    });
    expect(body.message).toContain("042891");
  });

  it("handles array payload data response from Arkesel v2", async () => {
    vi.stubEnv("ARKESEL_API_KEY", "test-arkesel-api-key");
    vi.stubEnv("ARKESEL_SENDER_ID", "CampOrder");
    vi.stubEnv("ARKESEL_SANDBOX", "false");

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: "success",
        data: [{ id: "arkesel-array-msg-999", recipient: "233241234567", status: "successful" }],
      }),
    } as unknown as Response));

    vi.stubGlobal("fetch", fetchMock);

    const result = await sendOtpSms("+233241234567", "654321");
    expect(result).toEqual({ messageId: "arkesel-array-msg-999" });
  });

  it("operates in default sandbox mode when ARKESEL_SANDBOX=true without failing on missing key", async () => {
    vi.stubEnv("ARKESEL_API_KEY", "");
    vi.stubEnv("ARKESEL_SANDBOX", "true");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendOtpSms("+233241234567", "042891");
    expect(result.messageId).toContain("sandbox-msg-");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(isArkeselSandbox()).toBe(true);
  });

  it("gracefully falls back to default sandbox OTP when Arkesel rejects key in sandbox mode", async () => {
    vi.stubEnv("ARKESEL_API_KEY", "invalid-key-testing");
    vi.stubEnv("ARKESEL_SANDBOX", "true");

    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({
        status: "error",
        message: "Invalid key",
      }),
    } as unknown as Response));

    vi.stubGlobal("fetch", fetchMock);

    const result = await sendOtpSms("+233241234567", "849201");
    expect(result.messageId).toContain("sandbox-fallback-");
  });

  it("rejects setup when API key is missing and sandbox is disabled", async () => {
    vi.stubEnv("ARKESEL_API_KEY", "");
    vi.stubEnv("ARKESEL_SANDBOX", "false");
    vi.stubEnv("NODE_ENV", "production");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendOtpSms("+233241234567", "042891")).rejects.toThrow(/not configured/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
