import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const BACKEND = process.env.API_URL || "http://localhost:5000";

export async function POST() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("jwtToken")?.value;


        const response = await fetch(`${BACKEND}/api/auth/logout`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token && { Cookie: `jwtToken=${token}` }),
            },
        });


        const nextResponse = NextResponse.json(
            { message: "Logged out successfully." },
            { status: 200 }
        );

        nextResponse.cookies.delete("jwtToken");
        nextResponse.cookies.delete("google_oauth_state");
        nextResponse.cookies.delete("google_onboarding");
        nextResponse.cookies.delete("google_link_pending");
        nextResponse.cookies.delete("google_reauth");

        return nextResponse;
    } catch {

        const nextResponse = NextResponse.json(
            { message: "Logged out." },
            { status: 200 }
        );
        nextResponse.cookies.delete("jwtToken");
        nextResponse.cookies.delete("google_oauth_state");
        nextResponse.cookies.delete("google_onboarding");
        nextResponse.cookies.delete("google_link_pending");
        nextResponse.cookies.delete("google_reauth");
        return nextResponse;
    }
}
