import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAuthorizationUrl } from "@/lib/auth/microsoft";

export async function GET() {
  try {
    const state = crypto.randomUUID();
    const cookieStore = await cookies();

    cookieStore.set("microsoft_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10, // 10 minutes
    });

    const authUrl = getAuthorizationUrl(state);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to initiate login";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}