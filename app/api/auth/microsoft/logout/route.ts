import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  await clearSession();
  const baseUrl = request.nextUrl.origin;
  return NextResponse.redirect(`${baseUrl}/library`);
}