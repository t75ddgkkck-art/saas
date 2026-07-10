import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { db } from "@/db";
import { quotes, quoteItems, businesses, clients } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const quoteId = searchParams.get("quoteId");

    if (!quoteId) {
      return NextResponse.json({ error: "quoteId requis" }, { status: 400 });
    }

    // Fetch quote data
    const quoteResult = await db.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
    if (quoteResult.length === 0) {
      return NextResponse.json({ error: "Devis non trouve" }, { status: 404 });
    }

    const quoteData = quoteResult[0];

    // Fetch items
    const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, quoteId));

    // Fetch business
    const bizResult = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, quoteData.businessId))
      .limit(1);
    const biz = bizResult[0];

    // Fetch client
    let clientName = "Client";
    if (quoteData.clientId) {
      const clientResult = await db
        .select()
        .from(clients)
        .where(eq(clients.id, quoteData.clientId))
        .limit(1);
      if (clientResult.length > 0) {
        clientName = `${clientResult[0].firstName} ${clientResult[0].lastName}`;
      }
    }

    // Generate HTML for PDF
    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Devis ${quoteData.quoteNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; line-height: 1.5; }
    .container { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
    .logo { font-size: 24px; font-weight: bold; color: #0f172a; }
    .quote-info { text-align: right; }
    .quote-number { font-size: 28px; font-weight: bold; color: #0f172a; }
    .quote-date { font-size: 14px; color: #64748b; }
    .section { margin-bottom: 32px; }
    .section-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 8px; }
    .address { font-size: 14px; color: #334155; }
    .table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .table th { text-align: left; padding: 12px 16px; background: #f8fafc; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 2px solid #e2e8f0; }
    .table td { padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    .text-right { text-align: right; }
    .totals { margin-left: auto; width: 300px; }
    .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
    .totals-row.total { font-size: 18px; font-weight: bold; border-top: 2px solid #0f172a; padding-top: 12px; margin-top: 4px; }
    .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b; }
    .signature { margin-top: 60px; display: flex; justify-content: space-between; }
    .sig-block { text-align: center; width: 200px; }
    .sig-line { border-top: 1px solid #0f172a; margin-top: 60px; padding-top: 8px; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="logo">${biz?.name || "ArtisanPro"}</div>
        ${biz?.address ? `<div class="address">${biz.address}, ${biz.postalCode || ""} ${biz.city || ""}</div>` : ""}
        ${biz?.phone ? `<div class="address">${biz.phone}</div>` : ""}
        ${biz?.siret ? `<div class="address">SIRET: ${biz.siret}</div>` : ""}
      </div>
      <div class="quote-info">
        <div class="quote-number">${quoteData.quoteNumber}</div>
        <div class="quote-date">Date: ${new Date(quoteData.createdAt).toLocaleDateString("fr-FR")}</div>
        ${quoteData.validUntil ? `<div class="quote-date">Valide jusqu'au: ${new Date(quoteData.validUntil).toLocaleDateString("fr-FR")}</div>` : ""}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Client</div>
      <div class="address">${clientName}</div>
    </div>

    <div class="section">
      <div class="section-title">Objet</div>
      <div class="address" style="font-size: 16px; font-weight: 500;">${quoteData.title}</div>
      ${quoteData.description ? `<div class="address" style="margin-top: 8px;">${quoteData.description}</div>` : ""}
    </div>

    <table class="table">
      <thead>
        <tr>
          <th>Description</th>
          <th class="text-right">Qte</th>
          <th class="text-right">Prix unit.</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (item) => `
        <tr>
          <td>${item.description}</td>
          <td class="text-right">${item.quantity}</td>
          <td class="text-right">${parseFloat(item.unitPrice).toFixed(2)} €</td>
          <td class="text-right">${parseFloat(item.total).toFixed(2)} €</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-row">
        <span>Sous-total</span>
        <span>${parseFloat(quoteData.subtotal || "0").toFixed(2)} €</span>
      </div>
      <div class="totals-row">
        <span>TVA (20%)</span>
        <span>${parseFloat(quoteData.tax || "0").toFixed(2)} €</span>
      </div>
      <div class="totals-row total">
        <span>Total TTC</span>
        <span>${parseFloat(quoteData.total || "0").toFixed(2)} €</span>
      </div>
      ${
        quoteData.depositAmount
          ? `
      <div class="totals-row" style="color: #059669;">
        <span>Acompte demandé</span>
        <span>${parseFloat(quoteData.depositAmount).toFixed(2)} €</span>
      </div>`
          : ""
      }
    </div>

    ${
      quoteData.termsAndConditions
        ? `
    <div class="section" style="margin-top: 32px;">
      <div class="section-title">Conditions</div>
      <div class="address">${quoteData.termsAndConditions}</div>
    </div>`
        : ""
    }

    <div class="signature">
      <div class="sig-block">
        <div class="sig-line">Le prestataire</div>
      </div>
      <div class="sig-block">
        <div class="sig-line">Le client (Bon pour accord)</div>
      </div>
    </div>

    <div class="footer">
      ${biz?.name} - ${biz?.address || ""} - SIRET: ${biz?.siret || "N/A"}
      <br>Devis genere le ${new Date().toLocaleDateString("fr-FR")} via ArtisanPro
    </div>
  </div>

  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    return handleApiError(err, { route: "/api/quote-pdf" });
  }
}
