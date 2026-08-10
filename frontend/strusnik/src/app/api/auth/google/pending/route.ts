import { NextRequest, NextResponse } from "next/server";
import { BACKEND, forwardCookies, readApiPayload } from "../_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = forwardCookies(request, ["google_onboarding"]);
    const response = await fetch(`${BACKEND}/api/auth/google/pending`, {
      method: "GET",
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
      cache: "no-store",
    });
    const data = await readApiPayload(response);
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      { error: "Unable to reach the authentication service.", code: "NETWORK_ERROR" },
      { status: 502 },
    );
  }
}
