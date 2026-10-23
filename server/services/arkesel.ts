import dotenv from "dotenv";

type ArkeselSuccessResponse = {
  status?: string;
  data?:
    | { id?: string | number; credits_used?: number }
    | Array<{ id?: string | number; recipient?: string; status?: string }>;
  message?: string;
};

export function isArkeselSandbox(): boolean {
  dotenv.config();
  return (
    process.env.ARKESEL_SANDBOX === "true" ||
    process.env.ARKESEL_SANDBOX === "1" ||
    (!process.env.ARKESEL_API_KEY && process.env.NODE_ENV !== "production")
  );
}

export async function sendOtpSms(phoneNumber: string, code: string): Promise<{ messageId: string | null }> {
  // Always read latest .env in development so changes don't require server restarts
  dotenv.config();

  const apiKey = (process.env.ARKESEL_API_KEY || "").trim();
  const senderId = (process.env.ARKESEL_SENDER_ID || "CampOrder").trim();
  const sandbox = isArkeselSandbox();

  // If in sandbox mode without an API key, simulate immediate successful sandbox delivery
  if (!apiKey && sandbox) {
    console.log("=========================================================");
    console.log(`[Arkesel Sandbox OTP] 📲 Phone: ${phoneNumber}`);
    console.log(`[Arkesel Sandbox OTP] 🔑 Verification Code: ${code} (or default sandbox: 123456)`);
    console.log("=========================================================");
    return { messageId: `sandbox-msg-${Date.now()}` };
  }

  if (!apiKey) {
    throw new Error(
      "SMS verification is not configured. Add Arkesel credentials (ARKESEL_API_KEY) or set ARKESEL_SANDBOX=true for default sandbox OTP testing."
    );
  }

  // Format destination phone number to international digits without '+' (e.g. 233241234567)
  const recipient = phoneNumber.replace(/^\+/, "").replace(/\s+/g, "").trim();
  const message = `Your CampOrder verification code is ${code}. It expires in 5 minutes. Do not share this code.`;
  const endpoint = process.env.ARKESEL_API_URL || "https://sms.arkesel.com/api/v2/sms/send";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: senderId,
        message,
        recipients: [recipient],
        ...(sandbox ? { sandbox: true } : {}),
      }),
    });

    if (!response.ok) {
      let errorDetail = "Arkesel could not accept the verification message.";
      try {
        const errPayload = (await response.json()) as ArkeselSuccessResponse;
        if (errPayload?.message) {
          errorDetail = `Arkesel: ${errPayload.message}`;
        }
      } catch {}

      // If in sandbox mode, fallback gracefully to mock sandbox OTP so testing is not blocked
      if (sandbox) {
        console.warn(`[Arkesel Sandbox Fallback] Provider returned: ${errorDetail}. Falling back to default sandbox OTP.`);
        console.log("=========================================================");
        console.log(`[Arkesel Sandbox OTP] 📲 Phone: ${phoneNumber}`);
        console.log(`[Arkesel Sandbox OTP] 🔑 Verification Code: ${code} (or default sandbox: 123456)`);
        console.log("=========================================================");
        return { messageId: `sandbox-fallback-${Date.now()}` };
      }

      throw new Error(errorDetail);
    }

    const payload = (await response.json()) as ArkeselSuccessResponse;

    if (payload.status !== "success") {
      const errorDetail = payload.message
        ? `Arkesel: ${payload.message}`
        : "Arkesel rejected the verification message. Check sender registration and account balance.";

      if (sandbox) {
        console.warn(`[Arkesel Sandbox Fallback] Provider returned: ${errorDetail}. Falling back to default sandbox OTP.`);
        console.log("=========================================================");
        console.log(`[Arkesel Sandbox OTP] 📲 Phone: ${phoneNumber}`);
        console.log(`[Arkesel Sandbox OTP] 🔑 Verification Code: ${code} (or default sandbox: 123456)`);
        console.log("=========================================================");
        return { messageId: `sandbox-fallback-${Date.now()}` };
      }

      throw new Error(errorDetail);
    }

    let messageId: string | null = null;
    if (payload.data) {
      if (Array.isArray(payload.data) && payload.data[0]?.id) {
        messageId = String(payload.data[0].id);
      } else if (typeof payload.data === "object" && "id" in payload.data && payload.data.id) {
        messageId = String(payload.data.id);
      }
    }

    if (sandbox) {
      console.log(`[Arkesel Sandbox OTP] Delivered to sandbox for ${phoneNumber}: code ${code}`);
    }

    return { messageId };
  } catch (err: unknown) {
    if (sandbox) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[Arkesel Sandbox Fallback] Network/API error: ${errorMsg}. Falling back to default sandbox OTP.`);
      console.log("=========================================================");
      console.log(`[Arkesel Sandbox OTP] 📲 Phone: ${phoneNumber}`);
      console.log(`[Arkesel Sandbox OTP] 🔑 Verification Code: ${code} (or default sandbox: 123456)`);
      console.log("=========================================================");
      return { messageId: `sandbox-fallback-${Date.now()}` };
    }
    throw err;
  }
}
