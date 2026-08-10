import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND = process.env.API_URL || "http://localhost:5000";

async function readResponse(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: "Backend returned an invalid response." };
  }
}

export async function PUT(request: NextRequest) {
  const token = request.cookies.get("jwtToken")?.value;
  const reauth = request.cookies.get("google_reauth")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const response = await fetch(`${BACKEND}/api/auth/password`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(reauth ? { Cookie: `google_reauth=${reauth}` } : {}),
      },
      body: await request.text(),
      cache: "no-store",
    });

    const nextResponse = NextResponse.json(await readResponse(response), { status: response.status });
    if (response.ok) nextResponse.cookies.delete("google_reauth");
    return nextResponse;
  } catch {
    return NextResponse.json(
      { error: "Unable to reach the authentication service.", code: "NETWORK_ERROR" },
      { status: 502 },
    );
  }
}
