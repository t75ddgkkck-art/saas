import { NextRequest, NextResponse } from "next/server";
import { verifySiret } from "@/lib/siret";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { siret } = body;

    if (!siret) {
      return NextResponse.json({ error: "SIRET requis" }, { status: 400 });
    }

    const result = await verifySiret(siret);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { valid: false, error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
