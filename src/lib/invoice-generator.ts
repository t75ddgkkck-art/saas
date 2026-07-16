/**
 * Lot 42 (F9) — Générateur de facture AUTO à partir d'un devis signé.
 *
 * Pipeline :
 *   1. Charge le devis + client + business + items (snapshot)
 *   2. Vérifie qu'aucune facture n'existe déjà pour ce devis (idempotent)
 *   3. Génère numéro atomique via generateInvoiceNumber (transaction FOR UPDATE)
 *   4. INSERT invoice DB (status=draft)
 *   5. Build PDF via generateInvoicePDF (réutilise le générateur existant)
 *   6. Upload PDF Supabase Storage → récupère URL
 *   7. UPDATE invoice.pdfUrl + status=issued + sentAt
 *   8. Envoi email au client avec PDF en pièce jointe
 *   9. Notification pro
 *
 * Design safety :
 *  - Idempotent : si appelé 2x pour le même quoteId, ne crée qu'une facture
 *    (contrainte unique DB + check métier avant INSERT)
 *  - Fail-safe : si le PDF ou l'email échoue, la facture reste en DB
 *    → on peut la re-générer plus tard depuis /dashboard/invoices/[id]
 *  - Fire-and-forget côté /api/quotes/sign : l'échec ne bloque PAS la signature
 *    (l'utilisateur voit "signature OK" immédiatement, la facture arrive < 5 s)
 *
 * Gate : requiert entitlement `invoices.auto_generation` (Pro+).
 * Sur plan Free : la fonction retourne { ok: false, reason: "entitlement" }
 * SANS throw — c'est un no-op silencieux qui n'empêche pas la signature.
 */

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  invoices,
  quotes,
  quoteItems,
  clients,
  businesses,
  users,
} from "@/db/schema";
import { logger } from "@/lib/logger";
import { canUse } from "@/lib/entitlements";
import { generateInvoiceNumber } from "@/lib/invoice-number";
import { generateInvoicePDF, type InvoiceData } from "@/lib/pdf-generator";
import { uploadBuffer } from "@/lib/storage";
import { sendEmailRaw } from "@/lib/email-core";
import { notifyAsync } from "@/lib/notify";

export interface GenerateInvoiceResult {
  ok: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
  reason?: "entitlement" | "already_exists" | "quote_not_found" | "quote_not_signed" | "error";
  error?: string;
}

/**
 * Point d'entrée public. Appelé fire-and-forget depuis POST /api/quotes/sign
 * (donc n'importe quelle exception doit être catchée ici — jamais propager).
 */
export async function generateInvoiceForSignedQuote(
  quoteId: string
): Promise<GenerateInvoiceResult> {
  try {
    // 1) Charge le devis + business + client + owner (pour plan check)
    const [row] = await db
      .select({
        quote: quotes,
        biz: businesses,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        clientEmail: clients.email,
        clientPhone: clients.phone,
        clientAddress: clients.address,
        ownerPlan: users.subscription,
        ownerEmail: users.email,
        ownerId: users.id,
      })
      .from(quotes)
      .innerJoin(businesses, eq(quotes.businessId, businesses.id))
      .leftJoin(clients, eq(quotes.clientId, clients.id))
      .innerJoin(users, eq(businesses.ownerId, users.id))
      .where(and(eq(quotes.id, quoteId), isNull(quotes.deletedAt)))
      .limit(1);

    if (!row) {
      return { ok: false, reason: "quote_not_found" };
    }

    if (!row.quote.signedAt) {
      // Défensif : la fonction est censée être appelée APRÈS signature,
      // mais un caller cassé pourrait skip la vérif.
      return { ok: false, reason: "quote_not_signed" };
    }

    // 2) Gate entitlement — silencieux si plan Free (pas d'erreur, juste no-op)
    if (!canUse(row.ownerPlan, "invoices.auto_generation")) {
      logger.info("invoice.gen.skipped_plan", {
        quoteId,
        plan: row.ownerPlan,
      });
      return { ok: false, reason: "entitlement" };
    }

    // 3) Idempotence — si une facture existe déjà pour ce devis, on ne recrée pas
    const [existing] = await db
      .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(eq(invoices.quoteId, quoteId))
      .limit(1);

    if (existing) {
      logger.info("invoice.gen.already_exists", {
        quoteId,
        invoiceId: existing.id,
      });
      return {
        ok: true,
        invoiceId: existing.id,
        invoiceNumber: existing.invoiceNumber,
        reason: "already_exists",
      };
    }

    // 4) Charge les items du devis
    const items = await db
      .select({
        description: quoteItems.description,
        quantity: quoteItems.quantity,
        unitPrice: quoteItems.unitPrice,
        total: quoteItems.total,
      })
      .from(quoteItems)
      .where(eq(quoteItems.quoteId, quoteId));

    if (items.length === 0) {
      logger.warn("invoice.gen.no_items", { quoteId });
      // On génère quand même — un devis à 0 lignes est un cas dégénéré mais légal
    }

    // 5) Snapshot des données de facturation (immuable)
    const snapshot = buildSnapshot(row, items);

    const issueDate = todayIso();
    const dueDate = daysFromNowIso(30); // 30 jours par défaut (norme FR B2C/B2B)

    // 6) Numéro atomique + INSERT invoice DANS la même transaction
    //    → si l'INSERT rollback, le compteur ne bouge pas (zéro trou)
    const inserted = await db.transaction(async (tx) => {
      const numbering = await generateInvoiceNumber(
        row.biz.id,
        tx as unknown as Parameters<typeof generateInvoiceNumber>[1]
      );

      const [inv] = await (tx as unknown as typeof db)
        .insert(invoices)
        .values({
          businessId: row.biz.id,
          quoteId: row.quote.id,
          clientId: row.quote.clientId,
          invoiceNumber: numbering.invoiceNumber,
          issueDate,
          dueDate,
          subtotal: row.quote.subtotal ?? "0",
          tax: row.quote.tax ?? "0",
          total: row.quote.total ?? "0",
          currency: "EUR",
          status: "draft",
          snapshot,
        })
        .returning({ id: invoices.id, invoiceNumber: invoices.invoiceNumber });

      return inv;
    });

    // 7) Génère le PDF (hors transaction — jspdf est CPU-only, pas de DB)
    const pdfData = buildInvoiceData(row, items, inserted.invoiceNumber, issueDate, dueDate);
    const doc = generateInvoicePDF(pdfData, "standard");
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    // 8) Upload PDF (Supabase, ou null si pas configuré + pas de base64 pour PDF)
    const uploaded = await uploadBuffer(pdfBuffer, {
      folder: `invoices/${row.biz.id}`,
      filename: `${inserted.invoiceNumber}.pdf`,
      contentType: "application/pdf",
      // Fallback base64 autorisé UNIQUEMENT en dev (pas de Supabase local)
      // — en prod on veut l'URL propre pour le lien email
      allowBase64: process.env.NODE_ENV !== "production",
    });

    const pdfUrl = uploaded?.url ?? null;

    // 9) Envoi email au client AVEC le PDF en pièce jointe
    let emailSent = false;
    if (row.clientEmail) {
      const emailRes = await sendEmailRaw({
        to: row.clientEmail,
        subject: `Facture ${inserted.invoiceNumber} — ${row.biz.name}`,
        html: buildInvoiceEmailHtml({
          clientFirstName: row.clientFirstName,
          businessName: row.biz.name,
          invoiceNumber: inserted.invoiceNumber,
          total: row.quote.total ?? "0",
          dueDate,
          pdfUrl,
        }),
        replyTo: row.biz.email
          ? `${row.biz.name} <${row.biz.email}>`
          : `${row.biz.name} <${row.ownerEmail}>`,
        attachments: [
          {
            filename: `${inserted.invoiceNumber}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      });
      emailSent = emailRes.success;
    } else {
      logger.warn("invoice.gen.no_client_email", { quoteId, invoiceId: inserted.id });
    }

    // 10) UPDATE final : pdfUrl + status=issued (si email envoyé) + sentAt
    await db
      .update(invoices)
      .set({
        pdfUrl,
        status: emailSent ? "issued" : "draft",
        sentAt: emailSent ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, inserted.id));

    // 11) Notif au pro
    notifyAsync({
      userId: row.ownerId,
      businessId: row.biz.id,
      type: "invoice.generated",
      title: "Facture générée 🧾",
      message: `${inserted.invoiceNumber} — ${row.quote.total} € — ${
        emailSent ? "envoyée au client" : "à envoyer manuellement (email client manquant)"
      }`,
      data: { invoiceId: inserted.id, quoteId: row.quote.id },
      url: `/dashboard/invoices`,
      priority: "high",
      tag: `invoice-${inserted.id}`,
    });

    logger.info("invoice.gen.success", {
      quoteId,
      invoiceId: inserted.id,
      invoiceNumber: inserted.invoiceNumber,
      emailSent,
      pdfUploaded: uploaded?.backend ?? "none",
    });

    return {
      ok: true,
      invoiceId: inserted.id,
      invoiceNumber: inserted.invoiceNumber,
    };
  } catch (err) {
    logger.error("invoice.gen.failed", {
      quoteId,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.slice(0, 500) : undefined,
    });
    return {
      ok: false,
      reason: "error",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// -----------------------------------------------------------------------------
// Helpers privés
// -----------------------------------------------------------------------------

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysFromNowIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Type helper — on garde volontairement en local pour ne pas polluer l'export
type InvoiceRow = {
  quote: typeof quotes.$inferSelect;
  biz: typeof businesses.$inferSelect;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  clientAddress: string | null;
  ownerPlan: string;
  ownerEmail: string;
  ownerId: string;
};

// quantity est un integer Drizzle → number ; unitPrice/total sont decimal → string
type ItemRow = {
  description: string;
  quantity: number | null;
  unitPrice: string | null;
  total: string | null;
};

/**
 * Snapshot immuable stocké dans invoices.snapshot (jsonb).
 * Permet de reconstruire la facture MÊME si le devis/client/business ont changé
 * après émission (obligation légale FR : une facture émise est figée).
 */
function buildSnapshot(row: InvoiceRow, items: ItemRow[]) {
  return {
    business: {
      name: row.biz.name,
      address: row.biz.address,
      city: row.biz.city,
      postalCode: row.biz.postalCode,
      siret: row.biz.siret,
      phone: row.biz.phone,
      email: row.biz.email,
      iban: row.biz.iban,
      bic: row.biz.bic,
    },
    client: {
      firstName: row.clientFirstName,
      lastName: row.clientLastName,
      email: row.clientEmail,
      phone: row.clientPhone,
      address: row.clientAddress,
    },
    quote: {
      id: row.quote.id,
      number: row.quote.quoteNumber,
      title: row.quote.title,
      subtotal: row.quote.subtotal,
      tax: row.quote.tax,
      total: row.quote.total,
      signedAt: row.quote.signedAt,
      signatureHash: row.quote.signatureHash,
    },
    items: items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      total: i.total,
    })),
  };
}

/**
 * Adapte les colonnes DB au format attendu par generateInvoicePDF.
 * Les decimals Drizzle arrivent en string (précision préservée) → on parse
 * en number pour jsPDF.
 */
function buildInvoiceData(
  row: InvoiceRow,
  items: ItemRow[],
  invoiceNumber: string,
  issueDate: string,
  dueDate: string
): InvoiceData {
  const clientName =
    [row.clientFirstName, row.clientLastName].filter(Boolean).join(" ") || "Client";

  const businessAddress = [row.biz.address, row.biz.postalCode, row.biz.city]
    .filter(Boolean)
    .join(", ");

  return {
    type: "facture",
    number: invoiceNumber,
    date: issueDate,
    dueDate,
    business: {
      name: row.biz.name,
      address: businessAddress,
      siret: row.biz.siret ?? "",
      phone: row.biz.phone ?? "",
      email: row.biz.email ?? "",
      iban: row.biz.iban ?? undefined,
      bic: row.biz.bic ?? undefined,
    },
    client: {
      name: clientName,
      address: row.clientAddress ?? undefined,
      phone: row.clientPhone ?? undefined,
      email: row.clientEmail ?? undefined,
    },
    items: items.map((i) => ({
      description: i.description,
      quantity: Number(i.quantity ?? 1),
      unitPrice: Number(i.unitPrice ?? 0),
      total: Number(i.total ?? 0),
    })),
    totalHT: Number(row.quote.subtotal ?? 0),
    tva: Number(row.quote.tax ?? 0),
    totalTTC: Number(row.quote.total ?? 0),
    notes: buildInvoiceNotes(row, issueDate),
    conditions:
      "Paiement à 30 jours par virement bancaire. Pénalités de retard : taux légal + 3 points (art. L441-10 code de commerce). Indemnité forfaitaire de recouvrement : 40 € (art. D441-5).",
  };
}

/**
 * Lot 43 : notes facture enrichies quand un acompte a été payé à la signature.
 *
 * Le PDF affiche "Acompte de X € déjà versé le YYYY-MM-DD (via Stripe).
 *  Reste à régler : Y €" — indispensable pour éviter que le client paye
 *  2 fois par erreur ou conteste que l'acompte n'est pas décompté.
 */
function buildInvoiceNotes(row: InvoiceRow, issueDate: string): string {
  const base = `Facture émise suite à signature du devis ${row.quote.quoteNumber} le ${
    row.quote.signedAt?.toISOString().slice(0, 10) ?? issueDate
  }.`;

  // Cas acompte payé — on ne l'ajoute que si le devis a un depositPaidAt.
  // Note : à ce stade dans le pipeline, row.quote a été chargé APRÈS l'update
  // signature mais AVANT le webhook Stripe deposit. Donc dans la plupart des
  // cas le depositPaidAt sera null ici (race avec webhook async). On tolère
  // les 2 cas — la mention n'apparaîtra que si le webhook est déjà passé.
  if (row.quote.depositPaidAt && row.quote.depositAmountCents) {
    const depositEur = (row.quote.depositAmountCents / 100).toFixed(2);
    const totalEur = Number(row.quote.total ?? "0").toFixed(2);
    const reste = (Number(totalEur) - Number(depositEur)).toFixed(2);
    const paidDate = new Date(row.quote.depositPaidAt).toISOString().slice(0, 10);
    return `${base}\nAcompte de ${depositEur} € déjà versé le ${paidDate} (paiement Stripe).\nReste à régler : ${reste} €.`;
  }

  return base;
}

/**
 * Email HTML minimal — même look que les autres transactionnels Vitrix.
 * Pas de template CSS lourd, on reste inline et sobre pour la deliverability.
 */
function buildInvoiceEmailHtml(params: {
  clientFirstName: string | null;
  businessName: string;
  invoiceNumber: string;
  total: string;
  dueDate: string;
  pdfUrl: string | null;
}): string {
  const greeting = params.clientFirstName ? `Bonjour ${params.clientFirstName},` : "Bonjour,";
  const downloadBlock = params.pdfUrl
    ? `<p>Vous pouvez également <a href="${params.pdfUrl}" style="color:#2563eb;text-decoration:underline">télécharger votre facture ici</a>.</p>`
    : "";

  return `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;border:1px solid #e2e8f0">
    <h1 style="font-size:20px;margin:0 0 16px">Votre facture ${params.invoiceNumber}</h1>
    <p style="margin:0 0 12px">${greeting}</p>
    <p style="margin:0 0 12px">
      Suite à la signature de votre devis, veuillez trouver ci-joint votre facture
      <strong>${params.invoiceNumber}</strong> d'un montant de <strong>${params.total} €</strong>.
    </p>
    <p style="margin:0 0 12px">
      Échéance : <strong>${params.dueDate}</strong>
    </p>
    ${downloadBlock}
    <p style="margin:24px 0 0;color:#64748b;font-size:13px">
      Cordialement,<br/>${params.businessName}
    </p>
  </div>
  <p style="max-width:560px;margin:16px auto 0;text-align:center;color:#94a3b8;font-size:11px">
    Facture générée automatiquement par Vitrix.
  </p>
</body></html>`;
}
