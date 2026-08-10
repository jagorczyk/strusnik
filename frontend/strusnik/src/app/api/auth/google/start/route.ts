import { NextRequest, NextResponse } from "next/server";
import {
  BACKEND,
  copySetCookies,
  forwardCookies,
  readApiPayload,
  safeReturnTo,
} from "../_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAMES = ["jwtToken"];

function errorRedirect(request: NextRequest, returnTo: string, code: string) {
  const target = new URL(safeReturnTo(returnTo, "/auth"), request.url);
  target.searchParams.set("google_error", code || "GOOGLE_AUTH_FAILED");
  return NextResponse.redirect(target);
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("mode") || "login";
  const returnTo = safeReturnTo(
    request.nextUrl.searchParams.get("return_to"),
    mode === "login" ? "/" : "/settings",
  );

  try {
    const query = new URLSearchParams({ mode, return_to: returnTo });
    const cookieHeader = forwardCookies(request, COOKIE_NAMES);
    const response = await fetch(`${BACKEND}/api/auth/google/start?${query.toString()}`, {
      method: "GET",
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
      cache: "no-store",
    });
    const data = await readApiPayload(response);

    if (!response.ok || !data.authorization_url || !data.authorization_url.startsWith("https://accounts.google.com/")) {
      return errorRedirect(request, mode === "login" ? "/auth" : returnTo, data.code || "GOOGLE_AUTH_FAILED");
    }

    const redirect = NextResponse.redirect(data.authorization_url);
    copySetCookies(response, redirect);
    return redirect;
  } catch {
    return errorRedirect(request, mode === "login" ? "/auth" : returnTo, "GOOGLE_AUTH_FAILED");
  }
}
