type AtRecipient = { statusCode?: number; status?: string; messageId?: string };
type AtResponse = { SMSMessageData?: { Recipients?: AtRecipient[] } };

export async function sendOtpSms(phoneNumber: string, code: string): Promise<{ messageId: string | null }> {
  const username = process.env.AFRICASTALKING_USERNAME;
  const apiKey = process.env.AFRICASTALKING_API_KEY;
  const senderId = process.env.AFRICASTALKING_SENDER_ID;
  if (!username || !apiKey || !senderId) {
    throw new Error("SMS verification is not configured. Add Africa’s Talking credentials and a registered sender ID through protected setup.");
  }
  const message = `Your CampOrder verification code is ${code}. It expires in 5 minutes. Do not share this code.`;
  const endpoint = process.env.AFRICASTALKING_API_URL || "https://api.africastalking.com/version1/messaging/bulk";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      apiKey,
    },
    body: JSON.stringify({ username, phoneNumbers: [phoneNumber], message, senderId, enqueue: 0 }),
  });
  if (!response.ok) {
    // Avoid returning provider response bodies that may include sensitive account details.
    throw new Error("Africa’s Talking could not accept the verification message.");
  }
  const payload = (await response.json()) as AtResponse;
  const recipient = payload.SMSMessageData?.Recipients?.[0];
  if (!recipient || ![100, 101, 102].includes(Number(recipient.statusCode))) {
    throw new Error("Africa’s Talking rejected the verification message. Check sender registration and account balance.");
  }
  // Provider acceptance/queueing is not proof of handset delivery.
  return { messageId: recipient.messageId ?? null };
}
