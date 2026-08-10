import { NextRequest, NextResponse } from "next/server";
import {
  BACKEND,
  copySetCookies,
  forwardCookies,
  publicUrl,
  readApiPayload,
  safeReturnTo,
} from "../_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAMES = [
  "jwtToken",
  "google_oauth_state",
];

function redirectWithError(request: NextRequest, code: string, returnTo = "/auth") {
  const target = publicUrl(request, safeReturnTo(returnTo, "/auth"));
  target.searchParams.set("google_error", code || "GOOGLE_AUTH_FAILED");
  const response = NextResponse.redirect(target);
  response.cookies.delete("google_oauth_state");
  return response;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString();
  const cookieHeader = forwardCookies(request, COOKIE_NAMES);

  try {
    const response = await fetch(`${BACKEND}/api/auth/google/callback?${query}`, {
      method: "GET",
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
      cache: "no-store",
    });
    const data = await readApiPayload(response);

    if (!response.ok) {
      const errorPath = data.mode === "login" ? "/auth" : data.return_to || "/auth";
      return redirectWithError(request, data.code || "GOOGLE_AUTH_FAILED", errorPath);
    }

    const returnTo = safeReturnTo(data.return_to, "/");
    let target: URL;

    if (data.status === "onboarding") {
      target = publicUrl(request, "/auth/google/complete");
    } else if (data.status === "link_confirmation") {
      target = publicUrl(request, returnTo);
      target.searchParams.set("google_link", "1");
    } else if (data.status === "reauthenticated") {
      target = publicUrl(request, returnTo);
      target.searchParams.set("google_reauth", "1");
      target.searchParams.set("reauth_mode", data.mode || "");
    } else if (data.status === "authenticated" || data.status === "linked") {
      target = publicUrl(request, returnTo);
      if (data.status === "linked") target.searchParams.set("google_linked", "1");
    } else {
      return redirectWithError(request, "GOOGLE_AUTH_FAILED");
    }

    const redirect = NextResponse.redirect(target);
    redirect.cookies.delete("google_oauth_state");
    copySetCookies(response, redirect);
    return redirect;
  } catch {
    return redirectWithError(request, "GOOGLE_AUTH_FAILED");
  }
}
