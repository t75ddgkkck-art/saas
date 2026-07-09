// Service SMS/WhatsApp via Twilio
// Configuration : TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER

interface SMSOptions {
  to: string;
  body: string;
}

export async function sendSMS({ to, body }: SMSOptions) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    console.log("[SMS] Twilio non configuré, simulation:", { to, body: body.substring(0, 50) + "..." });
    return { success: true, simulated: true };
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: from,
          To: to,
          Body: body,
        }),
      }
    );

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || "Erreur Twilio");
    }
    return { success: true, sid: result.sid };
  } catch (error: any) {
    console.error("[SMS] Erreur:", error);
    return { success: false, error: error.message };
  }
}

export async function sendWhatsApp({ to, body }: SMSOptions) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    console.log("[WhatsApp] Twilio non configuré, simulation:", { to, body: body.substring(0, 50) + "..." });
    return { success: true, simulated: true };
  }

  try {
    const whatsappFrom = `whatsapp:${from}`;
    const whatsappTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: whatsappFrom,
          To: whatsappTo,
          Body: body,
        }),
      }
    );

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || "Erreur WhatsApp");
    }
    return { success: true, sid: result.sid };
  } catch (error: any) {
    console.error("[WhatsApp] Erreur:", error);
    return { success: false, error: error.message };
  }
}

// Templates SMS
export const SMSTemplates = {
  appointmentReminder: (data: { clientName: string; businessName: string; time: string; address: string }) =>
    `Bonjour ${data.clientName}, rappel : RDV demain à ${data.time} avec ${data.businessName} (${data.address}). À bientôt !`,

  quoteReminder: (data: { clientName: string; businessName: string; quoteNumber: string; link: string }) =>
    `Bonjour ${data.clientName}, votre devis ${data.quoteNumber} de ${data.businessName} attend votre validation : ${data.link}`,
};
