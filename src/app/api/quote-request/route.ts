import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { clients, quotes, quoteAttachments, businesses, users, teamMembers } from "@/db/schema";
// F6 (Lot 34, B25) : notifs unifiées
import { notify } from "@/lib/notify";
import { eq, and } from "drizzle-orm";
import { generateQuoteNumber } from "@/lib/utils";
import { sendEmail, EmailTemplates } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { badRequest, handleApiError, notFound } from "@/lib/api-error";
import { uploadFile } from "@/lib/storage";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Schema d'entrée (formData). Les fichiers sont traités séparément.
const QuoteRequestSchema = z.object({
  businessId: z.string().uuid("businessId invalide"),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100).optional().default(""),
  email: z.string().trim().toLowerCase().email("Email invalide"),
  phone: z.string().trim().min(6).max(30),
  address: z.string().trim().max(500).optional().default(""),
  category: z.string().trim().max(100).optional().default(""),
  description: z.string().trim().max(5000).optional().default(""),
});

const MAX_ATTACHMENTS = 6;
const RESERVED_FIELDS = new Set([
  "businessId",
  "firstName",
  "lastName",
  "email",
  "phone",
  "address",
  "category",
  "description",
]);

export async function POST(request: NextRequest) {
  // Anti-spam : 5 demandes / 10 min / IP
  const rl = checkRateLimit(request, {
    key: "quote-request",
    limit: 5,
    windowSec: 600,
  });
  if (!rl.ok) return rl.response;

  try {
    const formData = await request.formData();

    // Extraction champs texte
    const raw: Record<string, string> = {};
    for (const [k, v] of formData.entries()) {
      if (typeof v === "string") raw[k] = v;
    }

    const parsed = QuoteRequestSchema.safeParse(raw);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues[0]?.message ?? "Données de demande invalides");
    }
    const data = parsed.data;

    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, data.businessId))
      .limit(1);
    if (!business) throw notFound("Professionnel introuvable");

    // Client : upsert par (phone, businessId)
    const [existingClient] = await db
      .select()
      .from(clients)
      .where(and(eq(clients.phone, data.phone), eq(clients.businessId, data.businessId)))
      .limit(1);

    let clientId: string;
    if (!existingClient) {
      const [newClient] = await db
        .insert(clients)
        .values({
          businessId: data.businessId,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email || null,
          phone: data.phone,
          address: data.address || null,
          source: "website",
          quotesCount: 1,
          lastContact: new Date(),
        })
        .returning();
      clientId = newClient.id;
    } else {
      clientId = existingClient.id;
      await db
        .update(clients)
        .set({
          firstName: data.firstName,
          lastName: data.lastName || existingClient.lastName,
          email: data.email || existingClient.email,
          address: data.address || existingClient.address,
          quotesCount: (existingClient.quotesCount || 0) + 1,
          lastContact: new Date(),
        })
        .where(eq(clients.id, clientId));
    }

    // Description enrichie avec les champs dynamiques
    const extraFields: string[] = [];
    for (const [k, v] of Object.entries(raw)) {
      if (!RESERVED_FIELDS.has(k) && !k.startsWith("attachment_") && v) {
        extraFields.push(`${k}: ${v}`);
      }
    }
    const fullDescription = [data.description, ...extraFields].filter(Boolean).join("\n");

    // Création du devis
    const quoteNumber = generateQuoteNumber();
    const [quote] = await db
      .insert(quotes)
      .values({
        businessId: data.businessId,
        clientId,
        quoteNumber,
        title: `Demande de devis${data.category ? ` — ${data.category}` : ""}`,
        description: fullDescription || null,
        category: data.category || null,
        status: "draft",
      })
      .returning();

    // Pièces jointes (via storage abstrait : Supabase si configuré, sinon base64)
    const attachmentKeys = Array.from(formData.keys())
      .filter((k) => k.startsWith("attachment_"))
      .slice(0, MAX_ATTACHMENTS); // Cap dur pour éviter les floods

    for (const key of attachmentKeys) {
      const file = formData.get(key);
      if (!(file instanceof File)) continue;

      const uploaded = await uploadFile(file, { folder: `quotes/${data.businessId}` });
      if (!uploaded) continue;

      const fileType = uploaded.contentType.startsWith("image/")
        ? "photo"
        : uploaded.contentType.startsWith("video/")
          ? "video"
          : "document";

      await db.insert(quoteAttachments).values({
        quoteId: quote.id,
        type: fileType,
        url: uploaded.url,
        name: uploaded.name,
      });
    }

    // ==== Automatisations (email client + pro + team + notification) ====
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr";
    const jobs: Promise<unknown>[] = [];

    const clientTemplate = EmailTemplates.quoteRequestClient({
      clientName: data.firstName,
      businessName: business.name,
      quoteNumber,
      description: data.description || undefined,
    });
    jobs.push(
      sendEmail({
        to: data.email,
        subject: clientTemplate.subject,
        html: clientTemplate.html,
      })
    );

    const [owner] = await db.select().from(users).where(eq(users.id, business.ownerId)).limit(1);

    if (owner?.email) {
      const proTemplate = EmailTemplates.newQuoteRequestPro({
        proName: owner.firstName,
        clientName: `${data.firstName} ${data.lastName}`.trim(),
        clientPhone: data.phone,
        clientEmail: data.email,
        quoteNumber,
        description: data.description || undefined,
        dashboardLink: `${appUrl}/dashboard`,
      });
      jobs.push(
        sendEmail({ to: owner.email, subject: proTemplate.subject, html: proTemplate.html })
      );

      // F6 (Lot 34, B25) : notify unifié (in-app + push OS + respect prefs)
      jobs.push(
        notify({
          userId: business.ownerId,
          businessId: data.businessId,
          type: "quote.received",
          title: "Nouvelle demande de devis 📋",
          message: `${data.firstName} ${data.lastName} — ${quoteNumber}${data.category ? ` (${data.category})` : ""}`,
          data: { quoteId: quote.id },
          url: `/dashboard/quotes/${quote.id}`,
          tag: `quote-${quote.id}`,
        })
      );
    }

    // Notif à l'équipe (Premium)
    const team = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.businessId, data.businessId));
    for (const member of team.filter((m) => m.active)) {
      const t = EmailTemplates.newQuoteRequestPro({
        proName: member.firstName,
        clientName: `${data.firstName} ${data.lastName}`.trim(),
        clientPhone: data.phone,
        clientEmail: data.email,
        quoteNumber,
        description: data.description || undefined,
        dashboardLink: `${appUrl}/dashboard`,
      });
      jobs.push(sendEmail({ to: member.email, subject: t.subject, html: t.html }));
    }

    await Promise.allSettled(jobs);

    logger.info("quote.request.created", {
      quoteId: quote.id,
      businessId: data.businessId,
      attachments: attachmentKeys.length,
    });

    return NextResponse.json({
      success: true,
      quoteNumber,
      message: "Demande envoyée ! Vous recevrez une confirmation par email.",
    });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/quote-request" });
  }
}
