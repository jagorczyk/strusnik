import { NextRequest, NextResponse } from "next/server";
import { publicUrl } from "./app/api/auth/google/_utils";

async function isTokenValid(token: string, request: NextRequest) {
    try {
        const url = new URL("/api/auth/validate", request.url);
        const response = await fetch(url.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
            cache: "no-store",
        });
        if (!response.ok) return false;
        const data = await response.json();
        return Boolean(data.valid);
    } catch {
        return false;
    }
}

export async function proxy(request: NextRequest) {
    if (
        request.nextUrl.pathname.startsWith("/api") ||
        request.nextUrl.pathname.startsWith("/_next") ||
        request.nextUrl.pathname === "/favicon.ico" ||
        request.nextUrl.pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|css|js)$/) ||
        request.method === "POST"
    ) {
        return NextResponse.next();
    }

    const jwtToken = request.cookies.get("jwtToken")?.value;
    if (request.nextUrl.pathname === "/auth" && jwtToken && await isTokenValid(jwtToken, request)) {
        return NextResponse.redirect(publicUrl(request, "/"));
    }

    // Gameplay and shared UI are intentionally public. Account-only screens
    // render their own sign-in state instead of forcing guests through auth.
    return NextResponse.next();
}

export const config = {
    matcher: "/:path*",
};
