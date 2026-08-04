import { NextResponse } from "next/server";

const BACKEND = process.env.API_URL || "http://localhost:5000";

export async function GET() {
  try {
    const response = await fetch(`${BACKEND}/api/changelog`, { cache: "no-store" });
    const data = await response.json();
    return NextResponse.json(data, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Backend connection failed" }, { status: 500 });
  }
}
