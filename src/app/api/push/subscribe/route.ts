import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, keys } = body;

    // Store subscription in DB (simplified - would need auth middleware)
    // In production, associate with user ID from auth token

    console.log("Push subscription received:", { endpoint, hasKeys: !!keys });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
