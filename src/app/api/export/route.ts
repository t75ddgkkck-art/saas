import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { db } from "@/db";
import { payments, clients, quotes, appointments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentBusiness, getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// Export comptable CSV (Pro/Premium) : paiements, clients, devis ou RDV
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const business = await getCurrentBusiness();
    if (!user || !business) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (user.subscription === "free") {
      return NextResponse.json({ error: "L'export est réservé aux plans Pro et Premium" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "payments";

    let csv = "";
    let filename = "";

    if (type === "payments") {
      const rows = await db.select().from(payments).where(eq(payments.businessId, business.id));
      csv = "Date;Montant (EUR);Type;Statut;Facture\n" + rows.map(p =>
        `${p.createdAt.toISOString().split("T")[0]};${parseFloat(p.amount).toFixed(2)};${p.type};${p.status};${p.invoiceUrl || ""}`
      ).join("\n");
      filename = "vitrix-paiements.csv";
    } else if (type === "clients") {
      const rows = await db.select().from(clients).where(eq(clients.businessId, business.id));
      csv = "Prénom;Nom;Téléphone;Email;Total dépensé (EUR);RDV;Devis;Source\n" + rows.map(c =>
        `${c.firstName};${c.lastName};${c.phone};${c.email || ""};${parseFloat(c.totalSpent || "0").toFixed(2)};${c.appointmentsCount || 0};${c.quotesCount || 0};${c.source || ""}`
      ).join("\n");
      filename = "vitrix-clients.csv";
    } else if (type === "quotes") {
      const rows = await db.select().from(quotes).where(eq(quotes.businessId, business.id));
      csv = "Numéro;Titre;Total (EUR);Statut;Date;Valide jusqu'au\n" + rows.map(q =>
        `${q.quoteNumber};${q.title};${parseFloat(q.total || "0").toFixed(2)};${q.status};${q.createdAt.toISOString().split("T")[0]};${q.validUntil || ""}`
      ).join("\n");
      filename = "vitrix-devis.csv";
    } else {
      const rows = await db.select().from(appointments).where(eq(appointments.businessId, business.id));
      csv = "Titre;Date;Début;Fin;Statut\n" + rows.map(a =>
        `${a.title};${a.date};${a.startTime};${a.endTime};${a.status}`
      ).join("\n");
      filename = "vitrix-rdv.csv";
    }

    // BOM UTF-8 pour Excel
    return new NextResponse("\uFEFF" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return handleApiError(err, { route: "/api/export" });
  }
}
