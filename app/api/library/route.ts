import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth/microsoft";
import { getSession } from "@/lib/auth/session";
import { GraphStorageProvider } from "@/lib/storage/graph-storage-provider";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "unauthenticated", message: "Sign in with Microsoft to access OneDrive files." },
        { status: 401 },
      );
    }

    const { accessToken } = await getValidAccessToken(session);
    const path = request.nextUrl.searchParams.get("path") || "library";

    const provider = new GraphStorageProvider(accessToken);
    const items = await provider.listItems(path);

    return NextResponse.json({ items });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load library items";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}