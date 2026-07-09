import { NextRequest, NextResponse } from "next/server";
import { generateMonthlyReport } from "@/lib/ai-content";
import { requirePermission } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { error } = await requirePermission("canAiReports");
  if (error) return error;

  try {
    const result = await generateMonthlyReport();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("AI report error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
