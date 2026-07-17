import { NextRequest, NextResponse } from "next/server";
import { generateInvoicePDF, type PdfTemplate } from "@/lib/pdf-generator";
import { handleApiError, badRequest } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const VALID_TYPES = new Set(["devis", "facture"]);
const VALID_TEMPLATES = new Set<PdfTemplate>(["standard", "moderne", "minimaliste"]);

export async function POST(request: NextRequest) {
  // Lot 64 : 30 PDFs/h — génération PDF coûteuse (jsPDF côté serveur, RAM/CPU).
  // 30/h couvre l'usage normal (un pro génère 5-10 PDF/jour typiquement).
  const rl = checkRateLimit(request, { key: "pdf-invoice", limit: 30, windowSec: 3600 });
  if (!rl.ok) return rl.response;

  try {
    const body = await request.json().catch(() => null);
    if (!body) throw badRequest("JSON invalide");

    const {
      type,
      number,
      date,
      dueDate,
      business,
      client,
      items,
      totalHT,
      tva,
      totalTTC,
      notes,
      conditions,
      template = "standard",
    } = body as Record<string, unknown>;

    if (!type || !number || !business || !client || !items) {
      throw badRequest("Données requises manquantes");
    }
    if (typeof type !== "string" || !VALID_TYPES.has(type)) {
      throw badRequest("Type invalide (devis|facture)");
    }
    if (typeof template !== "string" || !VALID_TEMPLATES.has(template as PdfTemplate)) {
      throw badRequest("Template invalide (standard|moderne|minimaliste)");
    }

    const doc = generateInvoicePDF(
      {
        type: type as "devis" | "facture",
        number: number as string,
        date: date as string,
        dueDate: dueDate as string | undefined,
        business: business as never,
        client: client as never,
        items: items as never,
        totalHT: totalHT as number,
        tva: tva as number,
        totalTTC: totalTTC as number,
        notes: notes as string | undefined,
        conditions: conditions as string | undefined,
      },
      template as PdfTemplate
    );

    const buffer = Buffer.from(doc.output("arraybuffer"));

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${type}_${number}.pdf"`,
      },
    });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/pdf/invoice" });
  }
}
