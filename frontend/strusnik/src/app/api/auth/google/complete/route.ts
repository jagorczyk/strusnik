import { NextRequest, NextResponse } from "next/server";
import {
  BACKEND,
  copySetCookies,
  forwardCookies,
  readApiPayload,
} from "../_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = forwardCookies(request, ["google_onboarding"]);
    const response = await fetch(`${BACKEND}/api/auth/google/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: await request.text(),
      cache: "no-store",
    });
    const data = await readApiPayload(response);
    const nextResponse = NextResponse.json(data, { status: response.status });
    copySetCookies(response, nextResponse);
    return nextResponse;
  } catch {
    return NextResponse.json(
      { error: "Unable to reach the authentication service.", code: "NETWORK_ERROR" },
      { status: 502 },
    );
  }
}
