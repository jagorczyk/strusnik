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
  const cookieHeader = forwardCookies(request, ["jwtToken", "google_link_pending"]);
  if (!cookieHeader.includes("jwtToken=")) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const response = await fetch(`${BACKEND}/api/auth/google/link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
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
