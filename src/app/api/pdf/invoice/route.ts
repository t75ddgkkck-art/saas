import { NextRequest, NextResponse } from "next/server";
import { generateInvoicePDF, PdfTemplate } from "@/lib/pdf-generator";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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
    } = body;

    if (!type || !number || !business || !client || !items) {
      return NextResponse.json({ error: "Données requises manquantes" }, { status: 400 });
    }

    if (!["devis", "facture"].includes(type)) {
      return NextResponse.json({ error: "Type invalide" }, { status: 400 });
    }

    if (!["standard", "moderne", "minimaliste"].includes(template)) {
      return NextResponse.json({ error: "Template invalide" }, { status: 400 });
    }

    const doc = generateInvoicePDF(
      {
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
  } catch (error: any) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur lors de la génération du PDF" },
      { status: 500 }
    );
  }
}
