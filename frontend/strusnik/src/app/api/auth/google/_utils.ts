import { NextRequest, NextResponse } from "next/server";

export const BACKEND = process.env.API_URL || "http://localhost:5000";

export type GoogleApiPayload = {
  code?: string;
  error?: string;
  status?: string;
  mode?: string;
  return_to?: string;
  authorization_url?: string;
  suggested_username?: string;
  user?: unknown;
};

export async function readApiPayload(response: Response): Promise<GoogleApiPayload> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: "Invalid authentication response." };
  }
}

export function forwardCookies(request: NextRequest, names: string[]) {
  const values = names
    .map((name) => {
      const value = request.cookies.get(name)?.value;
      return value ? `${name}=${value}` : null;
    })
    .filter((value): value is string => Boolean(value));
  return values.join("; ");
}

export function copySetCookies(source: Response, target: NextResponse) {
  const headers = source.headers as Headers & { getSetCookie?: () => string[] };
  const cookies = headers.getSetCookie?.() ?? [];
  if (cookies.length) {
    cookies.forEach((cookie) => target.headers.append("set-cookie", cookie));
    return;
  }

  const cookie = source.headers.get("set-cookie");
  if (cookie) target.headers.append("set-cookie", cookie);
}

export function safeReturnTo(value: string | null | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const parsed = new URL(value, "http://strusnik.local");
    if (parsed.origin !== "http://strusnik.local") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function redirectToPath(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(safeReturnTo(path), request.url));
}
