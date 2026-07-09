import { NextRequest, NextResponse } from "next/server";
import { generateSocialPost } from "@/lib/ai-content";
import { requirePermission } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { error } = await requirePermission("canAiPosts");
  if (error) return error;

  try {
    const body = await request.json();
    const { topic, platform } = body;

    if (!topic || !platform) {
      return NextResponse.json(
        { error: "Sujet et plateforme requis" },
        { status: 400 }
      );
    }

    if (!["facebook", "instagram", "linkedin"].includes(platform)) {
      return NextResponse.json(
        { error: "Plateforme invalide" },
        { status: 400 }
      );
    }

    const result = await generateSocialPost({ topic, platform });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("AI social post error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
