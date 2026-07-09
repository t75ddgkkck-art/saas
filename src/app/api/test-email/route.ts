import { NextResponse } from "next/server";
import { sendEmail, EmailTemplates } from "@/lib/email";

export async function GET() {
  const template = EmailTemplates.quoteReminder({
    clientName: "Ambiance Signature",
    businessName: "Vitrix",
    quoteNumber: "DEV-2025-TEST",
    total: "890,00 €",
    daysAgo: 8,
    link: "https://vitrix.fr/vitrix-plomberie",
  });

  const result = await sendEmail({
    to: "ambiancesignature.contact@gmail.com",
    subject: template.subject,
    html: template.html,
  });

  // Envoi d'une facture test
  const invoiceTemplate = EmailTemplates.paymentConfirmation({
    clientName: "Ambiance Signature",
    businessName: "Vitrix",
    amount: "890,00 €",
    invoiceNumber: "FAC-2025-001",
    link: "https://vitrix.fr",
  });

  const invoiceResult = await sendEmail({
    to: "ambiancesignature.contact@gmail.com",
    subject: invoiceTemplate.subject,
    html: invoiceTemplate.html,
  });

  return NextResponse.json({
    relance: result,
    facture: invoiceResult,
  });
}
