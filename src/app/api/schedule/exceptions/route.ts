import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { scheduleExceptions } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";
import { handleApiError, unauthorized, badRequest } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

const TIME_RE = /^\d{2}:\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const UpsertSchema = z.object({
  date: z.string().regex(DATE_RE, "Date YYYY-MM-DD attendue"),
  type: z.enum(["closed", "custom_hours", "holiday", "vacation", "other"]),
  isClosed: z.boolean().optional().default(true),
  customStartTime: z.string().regex(TIME_RE).optional().nullable(),
  customEndTime: z.string().regex(TIME_RE).optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) return NextResponse.json({ exceptions: [] });

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const exceptions =
      startDate && endDate
        ? await db
            .select()
            .from(scheduleExceptions)
            .where(
              and(
                eq(scheduleExceptions.businessId, business.id),
                gte(scheduleExceptions.date, startDate),
                lte(scheduleExceptions.date, endDate)
              )
            )
        : await db
            .select()
            .from(scheduleExceptions)
            .where(eq(scheduleExceptions.businessId, business.id));

    return NextResponse.json({ exceptions });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/schedule/exceptions" });
  }
}

export async function POST(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    const data = await validateBody(request, UpsertSchema);

    const [existing] = await db
      .select({ id: scheduleExceptions.id })
      .from(scheduleExceptions)
      .where(
        and(eq(scheduleExceptions.businessId, business.id), eq(scheduleExceptions.date, data.date))
      )
      .limit(1);

    const payload = {
      type: data.type,
      isClosed: data.isClosed ?? true,
      customStartTime: data.customStartTime || null,
      customEndTime: data.customEndTime || null,
      reason: data.reason || null,
    };

    if (existing) {
      await db
        .update(scheduleExceptions)
        .set(payload)
        .where(eq(scheduleExceptions.id, existing.id));
    } else {
      await db.insert(scheduleExceptions).values({
        businessId: business.id,
        date: data.date,
        ...payload,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/schedule/exceptions" });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    const { searchParams } = new URL(request.url);
    const exceptionId = searchParams.get("id");
    if (!exceptionId) throw badRequest("ID requis");

    // Le double filtre id + businessId sert de fix IDOR.
    await db
      .delete(scheduleExceptions)
      .where(
        and(eq(scheduleExceptions.id, exceptionId), eq(scheduleExceptions.businessId, business.id))
      );

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, { route: "DELETE /api/schedule/exceptions" });
  }
}
