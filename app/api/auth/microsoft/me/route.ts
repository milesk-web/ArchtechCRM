import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  try {
    const session = await getSession();

    if (!session || !session.user) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to check session";
    return NextResponse.json({ error: message, authenticated: false }, { status: 500 });
  }
}