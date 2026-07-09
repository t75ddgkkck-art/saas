import type { NextRequest } from "next/server";

// Determine if the request is served over HTTPS (handles proxies/load balancers).
export function isSecureRequest(request: NextRequest | Request): boolean {
  const proto = request.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

export function authCookieOptions(request: NextRequest | Request, httpOnly: boolean) {
  return {
    httpOnly,
    secure: isSecureRequest(request),
    sameSite: "lax" as const,
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  };
}
