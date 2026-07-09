import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateSocialPost } from "@/lib/ai-content";
import { requirePermission } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// 20 posts/heure/IP : largement au-dessus d'un usage humain, bloque le scripting.
const RATE = { key: "ai:social-post", limit: 20, windowSec: 3600 } as const;

const Schema = z.object({
  topic: z.string().trim().min(1).max(500),
  platform: z.enum(["facebook", "instagram", "linkedin"]),
});

export async function POST(request: NextRequest) {
  const perm = await requirePermission("canAiPosts");
  if (perm.error) return perm.error;

  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  try {
    const { topic, platform } = await validateBody(request, Schema);
    const result = await generateSocialPost({ topic, platform });
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, { route: "POST /api/ai/social-post" });
  }
}
