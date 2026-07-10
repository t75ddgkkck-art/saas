import { Resend } from "resend";
import { logger } from "@/lib/logger";
import { e, type EmailStringKey } from "@/lib/email-i18n";
import type { Lang } from "@/lib/i18n";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Fallback historique. À terme, remplacer par noreply@<votre-domaine> configuré dans Resend.
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@vitrix.fr";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailOptions) {
  if (!resend) {
    logger.warn("email.simulated", { to, subject, reason: "RESEND_API_KEY missing" });
    return { success: true, simulated: true } as const;
  }

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
    return { success: true, id: result.data?.id } as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("email.send_failed", { to, subject, message });
    return { success: false, error: message } as const;
  }
}

// ==================== TEMPLATES ====================

const baseWrapper = (content: string, businessName: string) => `
  <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 24px;">
    <div style="background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
      ${content}
    </div>
    <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">
      Envoyé via <a href="https://www.vitrix.fr" style="color: #64748b;">Vitrix</a> pour ${businessName}
    </p>
  </div>
`;

export const EmailTemplates = {
  // ========== CLIENT : confirmation de réservation ==========
  bookingConfirmationClient: (data: {
    clientName: string;
    businessName: string;
    date: string;
    time: string;
    service?: string;
    address?: string;
    phone?: string;
    loyaltyInfo?: string;
    lang?: Lang;
  }) => {
    const S = (k: EmailStringKey) => e(data.lang, k);
    return {
      subject: (S("subjectBookingConfirmed") as (b: string) => string)(data.businessName),
      html: baseWrapper(
        `
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; background: #dcfce7; border-radius: 50%; width: 64px; height: 64px; line-height: 64px; font-size: 28px;">✅</div>
      </div>
      <h1 style="color: #0f172a; font-size: 22px; text-align: center; margin: 0 0 8px;">${S("bookingConfirmed")}</h1>
      <p style="color: #64748b; text-align: center; margin: 0 0 24px;">${S("hello")} ${data.clientName}, ${S("yourBookingIsValid")}.</p>
      <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <table style="width: 100%; font-size: 14px; color: #334155;">
          <tr><td style="padding: 6px 0; color: #94a3b8;">📅 ${S("date")}</td><td style="text-align: right; font-weight: 600;">${data.date}</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">🕐 ${S("time")}</td><td style="text-align: right; font-weight: 600;">${data.time}</td></tr>
          ${data.service ? `<tr><td style="padding: 6px 0; color: #94a3b8;">🔧 ${S("service")}</td><td style="text-align: right; font-weight: 600;">${data.service}</td></tr>` : ""}
          ${data.address ? `<tr><td style="padding: 6px 0; color: #94a3b8;">📍 ${S("address")}</td><td style="text-align: right; font-weight: 600;">${data.address}</td></tr>` : ""}
        </table>
      </div>
      ${data.loyaltyInfo ? `<div style="background: #fef3c7; border-radius: 12px; padding: 14px; text-align: center; font-size: 13px; color: #92400e; margin-bottom: 20px;">🎁 ${data.loyaltyInfo}</div>` : ""}
      ${data.phone ? `<p style="text-align: center; font-size: 13px; color: #64748b;">${S("ifIssue")} ${S("callAt")} <a href="tel:${data.phone}" style="color: #0f172a; font-weight: 600;">${data.phone}</a></p>` : ""}
    `,
        data.businessName
      ),
    };
  },

  // ========== PRO : nouveau RDV reçu ==========
  newBookingPro: (data: {
    proName: string;
    clientName: string;
    clientPhone: string;
    clientEmail?: string;
    date: string;
    time: string;
    service?: string;
    dashboardLink: string;
  }) => ({
    subject: `🔔 Nouveau rendez-vous — ${data.clientName} le ${data.date}`,
    html: baseWrapper(`
      <h1 style="color: #0f172a; font-size: 20px; margin: 0 0 8px;">Nouveau rendez-vous !</h1>
      <p style="color: #64748b; margin: 0 0 20px;">Bonjour ${data.proName}, un client vient de réserver.</p>
      <div style="background: #f0f9ff; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <table style="width: 100%; font-size: 14px; color: #334155;">
          <tr><td style="padding: 6px 0; color: #94a3b8;">👤 Client</td><td style="text-align: right; font-weight: 600;">${data.clientName}</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">📞 Téléphone</td><td style="text-align: right; font-weight: 600;">${data.clientPhone}</td></tr>
          ${data.clientEmail ? `<tr><td style="padding: 6px 0; color: #94a3b8;">✉️ Email</td><td style="text-align: right; font-weight: 600;">${data.clientEmail}</td></tr>` : ""}
          <tr><td style="padding: 6px 0; color: #94a3b8;">📅 Date</td><td style="text-align: right; font-weight: 600;">${data.date} à ${data.time}</td></tr>
          ${data.service ? `<tr><td style="padding: 6px 0; color: #94a3b8;">🔧 Demande</td><td style="text-align: right; font-weight: 600;">${data.service}</td></tr>` : ""}
        </table>
      </div>
      <div style="text-align: center;">
        <a href="${data.dashboardLink}" style="display: inline-block; background: #0f172a; color: white; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">Voir dans mon tableau de bord</a>
      </div>
    `, "Vitrix"),
  }),

  // ========== CLIENT : demande de devis bien reçue ==========
  quoteRequestClient: (data: {
    clientName: string;
    businessName: string;
    quoteNumber: string;
    description?: string;
  }) => ({
    subject: `📋 Demande de devis reçue — ${data.businessName}`,
    html: baseWrapper(`
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; background: #ede9fe; border-radius: 50%; width: 64px; height: 64px; line-height: 64px; font-size: 28px;">📋</div>
      </div>
      <h1 style="color: #0f172a; font-size: 22px; text-align: center; margin: 0 0 8px;">Demande bien reçue !</h1>
      <p style="color: #64748b; text-align: center; margin: 0 0 24px;">
        Bonjour ${data.clientName}, ${data.businessName} a bien reçu votre demande de devis
        <strong>${data.quoteNumber}</strong> et vous répondra sous 24 à 48h.
      </p>
      ${data.description ? `<div style="background: #f8fafc; border-radius: 12px; padding: 16px; font-size: 13px; color: #475569; margin-bottom: 20px;"><strong>Votre demande :</strong><br/>${data.description.substring(0, 300)}</div>` : ""}
      <p style="text-align: center; font-size: 13px; color: #94a3b8;">Vous recevrez le devis détaillé par email dès qu'il sera prêt.</p>
    `, data.businessName),
  }),

  // ========== PRO : nouvelle demande de devis ==========
  newQuoteRequestPro: (data: {
    proName: string;
    clientName: string;
    clientPhone: string;
    clientEmail?: string;
    quoteNumber: string;
    description?: string;
    dashboardLink: string;
  }) => ({
    subject: `📋 Nouvelle demande de devis — ${data.clientName}`,
    html: baseWrapper(`
      <h1 style="color: #0f172a; font-size: 20px; margin: 0 0 8px;">Nouvelle demande de devis !</h1>
      <p style="color: #64748b; margin: 0 0 20px;">Bonjour ${data.proName}, répondez vite : les clients qui reçoivent un devis sous 24h signent 3x plus.</p>
      <div style="background: #faf5ff; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <table style="width: 100%; font-size: 14px; color: #334155;">
          <tr><td style="padding: 6px 0; color: #94a3b8;">📄 Référence</td><td style="text-align: right; font-weight: 600;">${data.quoteNumber}</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">👤 Client</td><td style="text-align: right; font-weight: 600;">${data.clientName}</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">📞 Téléphone</td><td style="text-align: right; font-weight: 600;">${data.clientPhone}</td></tr>
          ${data.clientEmail ? `<tr><td style="padding: 6px 0; color: #94a3b8;">✉️ Email</td><td style="text-align: right; font-weight: 600;">${data.clientEmail}</td></tr>` : ""}
        </table>
        ${data.description ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e9d5ff; font-size: 13px; color: #475569;">${data.description.substring(0, 300)}</div>` : ""}
      </div>
      <div style="text-align: center;">
        <a href="${data.dashboardLink}" style="display: inline-block; background: #0f172a; color: white; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">Répondre à la demande</a>
      </div>
    `, "Vitrix"),
  }),

  appointmentConfirmation: (data: {
    clientName: string;
    businessName: string;
    date: string;
    time: string;
    address: string;
    phone: string;
  }) => ({
    subject: `Confirmation de rendez-vous - ${data.businessName}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #0f172a;">Confirmation de rendez-vous</h1>
        <p>Bonjour ${data.clientName},</p>
        <p>Votre rendez-vous avec <strong>${data.businessName}</strong> est confirmé.</p>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 12px; margin: 20px 0;">
          <p><strong>📅 Date :</strong> ${data.date}</p>
          <p><strong>🕐 Heure :</strong> ${data.time}</p>
          <p><strong>📍 Adresse :</strong> ${data.address}</p>
          <p><strong>📞 Contact :</strong> ${data.phone}</p>
        </div>
        
        <p>À bientôt !</p>
        <p style="color: #64748b; font-size: 14px;">— L'équipe ${data.businessName}</p>
      </div>
    `,
  }),

  quoteSent: (data: {
    clientName: string;
    businessName: string;
    quoteNumber: string;
    total: string;
    validUntil: string;
    link: string;
  }) => ({
    subject: `Votre devis ${data.quoteNumber} - ${data.businessName}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #0f172a;">Votre devis est prêt</h1>
        <p>Bonjour ${data.clientName},</p>
        <p>Nous avons le plaisir de vous envoyer votre devis personnalisé.</p>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 12px; margin: 20px 0;">
          <p><strong>📄 Numéro de devis :</strong> ${data.quoteNumber}</p>
          <p><strong>💰 Montant total :</strong> ${data.total}</p>
          <p><strong>📅 Valable jusqu'au :</strong> ${data.validUntil}</p>
        </div>
        
        <a href="${data.link}" style="display: inline-block; background: #0f172a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 20px 0;">
          Consulter mon devis
        </a>
        
        <p style="color: #64748b; font-size: 14px;">L'équipe ${data.businessName}</p>
      </div>
    `,
  }),

  quoteReminder: (data: {
    clientName: string;
    businessName: string;
    quoteNumber: string;
    total: string;
    daysAgo: number;
    link: string;
  }) => ({
    subject: `Rappel : Votre devis ${data.quoteNumber}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #0f172a;">Rappel de devis</h1>
        <p>Bonjour ${data.clientName},</p>
        <p>Il y a ${data.daysAgo} jours, nous vous avons envoyé un devis. Celui-ci est toujours en attente de votre validation.</p>
        
        <div style="background: #fefce8; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #eab308;">
          <p><strong>📄 Devis :</strong> ${data.quoteNumber}</p>
          <p><strong>💰 Montant :</strong> ${data.total}</p>
        </div>
        
        <a href="${data.link}" style="display: inline-block; background: #0f172a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 20px 0;">
          Consulter et signer mon devis
        </a>
        
        <p style="color: #64748b; font-size: 14px;">L'équipe ${data.businessName}</p>
      </div>
    `,
  }),

  paymentConfirmation: (data: {
    clientName: string;
    businessName: string;
    amount: string;
    invoiceNumber: string;
    link: string;
  }) => ({
    subject: `Paiement confirmé - Facture ${data.invoiceNumber}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #0f172a;">Merci pour votre paiement !</h1>
        <p>Bonjour ${data.clientName},</p>
        <p>Votre paiement de <strong>${data.amount}</strong> a été confirmé.</p>
        
        <a href="${data.link}" style="display: inline-block; background: #0f172a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 20px 0;">
          Télécharger ma facture
        </a>
        
        <p style="color: #64748b; font-size: 14px;">L'équipe ${data.businessName}</p>
      </div>
    `,
  }),
};
