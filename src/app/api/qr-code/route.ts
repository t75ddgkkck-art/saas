import { NextRequest, NextResponse } from "next/server";
import { generateQRCode } from "@/lib/siret";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: "URL requise" }, { status: 400 });
    }

    const qrDataUrl = await generateQRCode(url);
    return NextResponse.json({ qrCode: qrDataUrl });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur lors de la génération du QR code" },
      { status: 500 }
    );
  }
}
