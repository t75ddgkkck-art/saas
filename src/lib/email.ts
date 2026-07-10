import { e, type EmailStringKey } from "@/lib/email-i18n";
import type { Lang } from "@/lib/i18n";
import { enqueueEmail } from "@/lib/email-queue";
import { sendEmailRaw, type EmailOptions, type EmailResult } from "@/lib/email-core";
import type { EmailCategory } from "@/lib/unsubscribe";
import { buildUnsubscribeUrl } from "@/lib/unsubscribe";

/**
 * API principale d'envoi (compat ascendante avec l'ancienne signature).
 *
 * Historiquement `sendEmail` était synchrone bloquant. On garde la signature mais :
 *  - En arrière-plan on utilise la queue non-bloquante avec retry exponentiel
 *  - Le retour "success" indique juste que l'email a été mis en file
 *  - Pour un vrai retour synchrone : utiliser `sendEmailRaw` de email-core
 *
 * Ajouts opt-in via 2ᵉ arg :
 *   sendEmail({ to, subject, html }, { category: "marketing", replyTo, lang })
 */
export async function sendEmail(
  opts: EmailOptions,
  meta?: { category?: EmailCategory; sync?: boolean }
): Promise<EmailResult> {
  // Mode sync explicite (pour les tests, ou cas où on veut savoir immédiatement)
  if (meta?.sync) {
    return sendEmailRaw(opts);
  }

  enqueueEmail({ ...opts, category: meta?.category ?? "transactional" });
  return { success: true } as const;
}

// ==================== TEMPLATES ====================

/**
 * Wrapper HTML commun à tous les templates.
 * - Layout responsive (max-width 600px, table-friendly pour Outlook)
 * - Footer légal : mentions Vitrix + lien unsubscribe (obligatoire RGPD art. 21
 *   pour marketing, bonne pratique pour tout le reste)
 * - Fournir `unsubscribeEmail` pour afficher le lien.
 */
const baseWrapper = (
  content: string,
  businessName: string,
  opts?: { unsubscribeEmail?: string; unsubscribeCategory?: EmailCategory; lang?: Lang }
) => {
  const unsub =
    opts?.unsubscribeEmail && opts.unsubscribeCategory
      ? `<a href="${buildUnsubscribeUrl(opts.unsubscribeEmail, opts.unsubscribeCategory)}" style="color: #64748b; text-decoration: underline;">${e(opts.lang, "unsubscribe")}</a>`
      : "";

  return `
  <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 24px;">
    <div style="background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
      ${content}
    </div>
    <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px; line-height: 1.6;">
      ${e(opts?.lang, "sentBy")} <a href="https://www.vitrix.fr" style="color: #64748b;">Vitrix</a> ${e(opts?.lang, "sentFor")} ${businessName}
      ${unsub ? `<br/>${unsub}` : ""}
    </p>
  </div>
`;
};

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
    html: baseWrapper(
      `
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
    `,
      "Vitrix"
    ),
  }),

  // ========== CLIENT : demande de devis bien reçue ==========
  quoteRequestClient: (data: {
    clientName: string;
    businessName: string;
    quoteNumber: string;
    description?: string;
  }) => ({
    subject: `📋 Demande de devis reçue — ${data.businessName}`,
    html: baseWrapper(
      `
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
    `,
      data.businessName
    ),
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
    html: baseWrapper(
      `
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
    `,
      "Vitrix"
    ),
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

  // ========== AUTH : réinitialisation mot de passe (Lot 19) ==========
  passwordReset: (data: {
    firstName: string;
    resetUrl: string;
    ip?: string | null;
    expiryMinutes: number;
  }) => ({
    subject: "Réinitialisation de votre mot de passe Vitrix",
    html: baseWrapper(
      `
      <h1 style="color: #0f172a; font-size: 22px; margin: 0 0 16px;">Réinitialisation de mot de passe</h1>
      <p style="color: #334155; margin: 0 0 16px;">Bonjour ${data.firstName},</p>
      <p style="color: #334155; margin: 0 0 24px;">
        Vous avez demandé à réinitialiser le mot de passe de votre compte Vitrix.
        Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.resetUrl}" style="display: inline-block; background: #0f172a; color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600;">
          Réinitialiser mon mot de passe
        </a>
      </div>
      <p style="color: #64748b; font-size: 13px; margin: 0 0 8px;">
        Ce lien expire dans ${data.expiryMinutes} minutes et ne peut être utilisé qu'une seule fois.
      </p>
      <p style="color: #64748b; font-size: 13px; margin: 0 0 16px;">
        Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — votre mot de passe restera inchangé.
        ${data.ip ? `<br/>Demande envoyée depuis l'IP <code style="font-family: monospace;">${data.ip}</code>.` : ""}
      </p>
      <p style="color: #94a3b8; font-size: 12px; margin: 24px 0 0; word-break: break-all;">
        Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br/>
        <a href="${data.resetUrl}" style="color: #64748b;">${data.resetUrl}</a>
      </p>
    `,
      "Vitrix"
    ),
  }),

  // ========== AUTH : vérification email (Lot 19) ==========
  emailVerify: (data: { firstName: string; verifyUrl: string; expiryHours: number }) => ({
    subject: "Confirmez votre adresse email Vitrix",
    html: baseWrapper(
      `
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; background: #dbeafe; border-radius: 50%; width: 64px; height: 64px; line-height: 64px; font-size: 28px;">✉️</div>
      </div>
      <h1 style="color: #0f172a; font-size: 22px; text-align: center; margin: 0 0 12px;">Bienvenue chez Vitrix !</h1>
      <p style="color: #334155; text-align: center; margin: 0 0 24px;">
        Bonjour ${data.firstName}, il ne reste qu'une étape pour activer votre compte : confirmer votre adresse email.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.verifyUrl}" style="display: inline-block; background: #0f172a; color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600;">
          Confirmer mon email
        </a>
      </div>
      <p style="color: #64748b; font-size: 13px; text-align: center; margin: 0 0 16px;">
        Ce lien expire dans ${data.expiryHours} heures.
      </p>
      <p style="color: #94a3b8; font-size: 12px; margin: 24px 0 0; word-break: break-all;">
        Lien de secours :<br/>
        <a href="${data.verifyUrl}" style="color: #64748b;">${data.verifyUrl}</a>
      </p>
    `,
      "Vitrix"
    ),
  }),
};
