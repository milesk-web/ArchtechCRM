import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/auth/microsoft";
import { setSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const baseUrl = request.nextUrl.origin;

  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/library?auth_error=${encodeURIComponent(errorDescription || error)}`,
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${baseUrl}/library?auth_error=${encodeURIComponent("Missing authorization code or state")}`,
    );
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("microsoft_oauth_state")?.value;
  cookieStore.delete("microsoft_oauth_state");

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(
      `${baseUrl}/library?auth_error=${encodeURIComponent("Invalid OAuth state. Please try signing in again.")}`,
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    await setSession({
      user: tokens.user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    });

    return NextResponse.redirect(`${baseUrl}/library`);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to exchange authorization code";
    return NextResponse.redirect(
      `${baseUrl}/library?auth_error=${encodeURIComponent(message)}`,
    );
  }
}