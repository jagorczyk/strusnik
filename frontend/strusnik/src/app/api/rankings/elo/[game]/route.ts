import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.API_URL || "http://localhost:5000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ game: string }> }
) {
  const { game } = await params;

  try {
    const response = await fetch(`${BACKEND}/api/rankings/elo/${encodeURIComponent(game)}`, {
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch ELO ranking" }, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("ELO ranking fetch error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
