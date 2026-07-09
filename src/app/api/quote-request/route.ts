import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clients, quotes, quoteAttachments, businesses, users, notifications, teamMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateQuoteNumber } from "@/lib/utils";
import { sendEmail, EmailTemplates } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const businessId = formData.get("businessId") as string;
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const address = formData.get("address") as string;
    const category = formData.get("category") as string;
    const description = formData.get("description") as string;

    if (!businessId || !firstName || !phone) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
    }

    // Email obligatoire pour recevoir le devis
    if (!email) {
      return NextResponse.json({ error: "L'email est requis pour recevoir votre devis" }, { status: 400 });
    }

    const bizResult = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
    const business = bizResult[0];
    if (!business) {
      return NextResponse.json({ error: "Professionnel introuvable" }, { status: 404 });
    }

    // Créer ou retrouver le client
    let clientResult = await db.select().from(clients)
      .where(and(eq(clients.phone, phone), eq(clients.businessId, businessId)))
      .limit(1);
    let clientId: string;

    if (clientResult.length === 0) {
      const [newClient] = await db.insert(clients).values({
        businessId, firstName, lastName: lastName || "",
        email: email || null, phone, address: address || null,
        source: "website", quotesCount: 1, lastContact: new Date(),
      }).returning();
      clientId = newClient.id;
    } else {
      clientId = clientResult[0].id;
      await db.update(clients).set({
        firstName, lastName: lastName || clientResult[0].lastName,
        email: email || clientResult[0].email,
        address: address || clientResult[0].address,
        quotesCount: (clientResult[0].quotesCount || 0) + 1,
        lastContact: new Date(),
      }).where(eq(clients.id, clientId));
    }

    // Construire la description complète avec tous les champs dynamiques
    const extraFields: string[] = [];
    for (const [key, value] of formData.entries()) {
      if (!["businessId", "firstName", "lastName", "email", "phone", "address", "category", "description"].includes(key)
        && !key.startsWith("attachment_") && typeof value === "string" && value) {
        extraFields.push(`${key}: ${value}`);
      }
    }
    const fullDescription = [description, ...extraFields].filter(Boolean).join("\n");

    // Créer la demande de devis
    const quoteNumber = generateQuoteNumber();
    const [quote] = await db.insert(quotes).values({
      businessId, clientId, quoteNumber,
      title: `Demande de devis${category ? ` — ${category}` : ""}`,
      description: fullDescription || null,
      category: category || null,
      status: "draft",
    }).returning();

    // Pièces jointes
    const attachmentKeys = Array.from(formData.keys()).filter(k => k.startsWith("attachment_"));
    for (const key of attachmentKeys) {
      const file = formData.get(key) as File;
      if (file && file.size > 0 && file.size <= 10 * 1024 * 1024) {
        const bytes = await file.arrayBuffer();
        const base64 = Buffer.from(bytes).toString("base64");
        const fileType = file.type.startsWith("image/") ? "photo" : file.type.startsWith("video/") ? "video" : "document";
        await db.insert(quoteAttachments).values({
          quoteId: quote.id, type: fileType,
          url: `data:${file.type};base64,${base64}`,
          name: file.name,
        });
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr";

    // ===== AUTOMATISATIONS =====
    const automations: Promise<any>[] = [];

    // 1. Confirmation au CLIENT
    const clientTemplate = EmailTemplates.quoteRequestClient({
      clientName: firstName,
      businessName: business.name,
      quoteNumber,
      description: description || undefined,
    });
    automations.push(sendEmail({ to: email, subject: clientTemplate.subject, html: clientTemplate.html }));

    // 2. Alerte au PRO
    const owner = await db.select().from(users).where(eq(users.id, business.ownerId)).limit(1);
    if (owner.length > 0 && owner[0].email) {
      const proTemplate = EmailTemplates.newQuoteRequestPro({
        proName: owner[0].firstName,
        clientName: `${firstName} ${lastName || ""}`.trim(),
        clientPhone: phone,
        clientEmail: email,
        quoteNumber,
        description: description || undefined,
        dashboardLink: `${appUrl}/dashboard`,
      });
      automations.push(sendEmail({ to: owner[0].email, subject: proTemplate.subject, html: proTemplate.html }));

      // 3. Notification interne
      automations.push(
        db.insert(notifications).values({
          userId: business.ownerId,
          businessId,
          type: "new_quote_request",
          title: "Nouvelle demande de devis 📋",
          message: `${firstName} ${lastName || ""} — ${quoteNumber}${category ? ` (${category})` : ""}`,
          data: { quoteId: quote.id },
        }).then(() => {})
      );
    }

    // Notifier les membres d'équipe actifs (Premium)
    try {
      const team = await db.select().from(teamMembers)
        .where(eq(teamMembers.businessId, businessId));
      for (const member of team.filter(m => m.active)) {
        const teamTemplate = EmailTemplates.newQuoteRequestPro({
          proName: member.firstName,
          clientName: `${firstName} ${lastName || ""}`.trim(),
          clientPhone: phone,
          clientEmail: email,
          quoteNumber,
          description: description || undefined,
          dashboardLink: `${appUrl}/dashboard`,
        });
        automations.push(sendEmail({ to: member.email, subject: teamTemplate.subject, html: teamTemplate.html }));
      }
    } catch { /* jamais bloquant */ }

    await Promise.allSettled(automations);

    return NextResponse.json({
      success: true,
      quoteNumber,
      message: "Demande envoyée ! Vous recevrez une confirmation par email.",
    });
  } catch (error: any) {
    console.error("Quote request error:", error);
    return NextResponse.json({ error: error.message || "Erreur serveur" }, { status: 500 });
  }
}
