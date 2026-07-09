import { db } from "@/db";
import { notifications } from "@/db/schema";

interface CreateNotificationParams {
  userId: string;
  businessId?: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export async function createNotification(params: CreateNotificationParams) {
  await db.insert(notifications).values({
    userId: params.userId,
    businessId: params.businessId || null,
    type: params.type,
    title: params.title,
    message: params.message,
    data: params.data || null,
  });
}
