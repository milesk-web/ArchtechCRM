import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth/microsoft";
import { getSession } from "@/lib/auth/session";
import { GraphStorageProvider } from "@/lib/storage/graph-storage-provider";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || !session.user) {
      return NextResponse.json(
        {
          error: "unauthenticated",
          message: "Sign in with Microsoft to manage OneDrive files.",
        },
        { status: 401 },
      );
    }

    const { accessToken } = await getValidAccessToken(session);

    const body = (await request.json()) as { path?: string; name?: string };
    const { path = "library", name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Folder name is required." },
        { status: 400 },
      );
    }

    // Basic path traversal guard
    if (name.includes("..") || name.includes("/") || name.includes("\\")) {
      return NextResponse.json(
        { error: "Folder name contains invalid characters." },
        { status: 400 },
      );
    }

    const provider = new GraphStorageProvider(accessToken);
    const folder = await provider.createFolder(path, name.trim());

    return NextResponse.json({ folder });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create folder";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
