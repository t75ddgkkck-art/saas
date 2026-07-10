import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { notifications, businesses } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { handleApiError, unauthorized, forbidden, badRequest } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  businessId: z.string().uuid().optional().nullable(),
  type: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  data: z.record(z.string(), z.unknown()).optional().nullable(),
});

const PatchSchema = z.object({
  id: z.string().uuid().optional(),
  markAllRead: z.boolean().optional(),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ notifications: [] });

    const notifs = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(20);

    return NextResponse.json({ notifications: notifs });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/notifications" });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();

    const data = await validateBody(request, CreateSchema);

    // Fix IDOR : si un businessId est fourni, il doit appartenir à l'utilisateur courant
    if (data.businessId) {
      const [biz] = await db
        .select({ id: businesses.id })
        .from(businesses)
        .where(and(eq(businesses.id, data.businessId), eq(businesses.ownerId, user.id)))
        .limit(1);
      if (!biz) throw forbidden("Business non autorisé");
    }

    await db.insert(notifications).values({
      userId: user.id,
      businessId: data.businessId ?? null,
      type: data.type,
      title: data.title,
      message: data.message,
      data: data.data ?? null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/notifications" });
  }
}

// Marque comme lu (une ou toutes)
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();

    const data = await validateBody(request, PatchSchema);

    if (data.markAllRead) {
      await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, user.id));
      return NextResponse.json({ success: true });
    }

    if (!data.id) throw badRequest("id ou markAllRead requis");

    // Fix IDOR : uniquement les notifs de l'utilisateur courant
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, data.id), eq(notifications.userId, user.id)));

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, { route: "PATCH /api/notifications" });
  }
}
