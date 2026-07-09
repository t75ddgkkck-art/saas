// Service SMS/WhatsApp via Twilio
// Configuration : TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
import { logger } from "@/lib/logger";

interface SMSOptions {
  to: string;
  body: string;
}

async function callTwilio(
  channel: "sms" | "whatsapp",
  { to, body }: SMSOptions
): Promise<{ success: true; sid: string } | { success: false; error: string } | { success: true; simulated: true }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    logger.warn(`${channel}.simulated`, {
      to,
      preview: body.substring(0, 50),
      reason: "Twilio not configured",
    });
    return { success: true, simulated: true };
  }

  const fromField = channel === "whatsapp" ? `whatsapp:${from}` : from;
  const toField =
    channel === "whatsapp" ? (to.startsWith("whatsapp:") ? to : `whatsapp:${to}`) : to;

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ From: fromField, To: toField, Body: body }),
      }
    );

    const result = (await response.json()) as { sid?: string; message?: string };
    if (!response.ok) {
      throw new Error(result.message || `Twilio ${channel} error`);
    }
    return { success: true, sid: result.sid! };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`${channel}.send_failed`, { to, message });
    return { success: false, error: message };
  }
}

export function sendSMS(opts: SMSOptions) {
  return callTwilio("sms", opts);
}

export function sendWhatsApp(opts: SMSOptions) {
  return callTwilio("whatsapp", opts);
}

// Templates SMS
export const SMSTemplates = {
  appointmentReminder: (data: {
    clientName: string;
    businessName: string;
    time: string;
    address: string;
  }) =>
    `Bonjour ${data.clientName}, rappel : RDV demain à ${data.time} avec ${data.businessName} (${data.address}). À bientôt !`,

  quoteReminder: (data: {
    clientName: string;
    businessName: string;
    quoteNumber: string;
    link: string;
  }) =>
    `Bonjour ${data.clientName}, votre devis ${data.quoteNumber} de ${data.businessName} attend votre validation : ${data.link}`,
};
