import { NextResponse } from "next/server";
import { decryptSession, getSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase-admin";

const TABLES = new Set([
  "profiles",
  "profile_options",
  "materials",
  "material_colours",
  "underlays",
  "flashing_types",
  "labour_types",
  "accessories",
  "material_prices",
]);

function parseCookies(cookieHeader: string): Record<string, string> {
  const map: Record<string, string> = {};
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) continue;
    const name = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();
    if (name) map[name] = value;
  }
  return map;
}

function extractSupabaseTokensFromCookieHeader(cookieHeader: string): string[] {
  const tokens: string[] = [];
  const cookiesMap = parseCookies(cookieHeader);

  const assembled: Record<string, string> = {};
  const chunkGroups: Record<string, Map<number, string>> = {};

  for (const [name, val] of Object.entries(cookiesMap)) {
    const chunkMatch = name.match(/^(sb-[a-zA-Z0-9_-]+-auth-token|supabase-auth-token)\.(\d+)$/);
    if (chunkMatch) {
      const baseName = chunkMatch[1];
      const index = parseInt(chunkMatch[2], 10);
      if (!chunkGroups[baseName]) {
        chunkGroups[baseName] = new Map();
      }
      chunkGroups[baseName].set(index, val);
    } else if (name.startsWith("sb-") || name === "supabase-auth-token") {
      assembled[name] = val;
    }
  }

  for (const [baseName, map] of Object.entries(chunkGroups)) {
    const sortedIndices = Array.from(map.keys()).sort((a, b) => a - b);
    const combined = sortedIndices.map((i) => map.get(i)!).join("");
    assembled[baseName] = combined;
  }

  for (const rawVal of Object.values(assembled)) {
    try {
      let value = decodeURIComponent(rawVal);
      if (value.startsWith("base64-")) {
        const b64 = value.slice(7);
        value = Buffer.from(b64, "base64").toString("utf-8");
      }

      const parsed = JSON.parse(value);
      let token: string | null = null;
      if (Array.isArray(parsed)) {
        token = typeof parsed[0] === "string" ? parsed[0] : null;
      } else if (typeof parsed === "object" && parsed !== null) {
        token =
          parsed.access_token ||
          parsed.currentSession?.access_token ||
          parsed.session?.access_token ||
          null;
      } else if (typeof parsed === "string") {
        token = parsed;
      }

      if (token && typeof token === "string") {
        tokens.push(token);
      }
    } catch {
      if (rawVal && !rawVal.startsWith("base64-")) {
        tokens.push(rawVal);
      }
    }
  }

  return tokens;
}

async function authorised(request: Request) {
  // 1. Check Microsoft OAuth session (used by OneDrive / Microsoft integration)
  try {
    const session = await getSession();
    if (session?.user) {
      return true;
    }
  } catch {
    // Continue to next check if getSession throws
  }

  const cookieHeader = request.headers.get("cookie");

  if (cookieHeader) {
    const cookiesMap = parseCookies(cookieHeader);
    let rawArchtech = cookiesMap["archtech_session"];
    if (!rawArchtech) {
      const chunks: string[] = [];
      let i = 0;
      while (cookiesMap[`archtech_session.${i}`]) {
        chunks.push(cookiesMap[`archtech_session.${i}`]);
        i++;
      }
      if (chunks.length > 0) {
        rawArchtech = chunks.join("");
      }
    }

    if (rawArchtech) {
      const session = await decryptSession(rawArchtech);
      if (session?.user) {
        return true;
      }
    }
  }

  // 2. Validate Supabase Auth token if present in Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    if (token) {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data?.user) {
        return true;
      }
    }
  }

  // 3. Check for active Supabase Auth session via cookies
  if (cookieHeader) {
    const tokens = extractSupabaseTokensFromCookieHeader(cookieHeader);
    for (const token of tokens) {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data?.user) {
        return true;
      }
    }
  }

  return false;
}

export async function GET(request: Request) {
  const isAllowed = await authorised(request);

  if (!isAllowed) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  try {
    const url = new URL(request.url);
    const table = url.searchParams.get("table");

    if (!table || !TABLES.has(table)) {
      return NextResponse.json(
        { error: "Invalid catalogue table." },
        { status: 400 },
      );
    }

    let query = supabaseAdmin.from(table).select("*");

    if (table === "material_prices") {
      query = query
        .eq("active", true)
        .order("material_id", { ascending: true })
        .order("profile_id", { ascending: true });
    } else {
      query = query
        .eq("active", true)
        .order("sort_order", { ascending: true });
    }

    const profileId = url.searchParams.get("profile_id");

    if (table === "profile_options" && profileId) {
      query = query.eq("profile_id", profileId);
    }

    const materialId = url.searchParams.get("material_id");

    if (table === "material_colours" && materialId) {
      query = query.eq("material_id", materialId);
    }

    if (table === "material_prices") {
      if (materialId) {
        query = query.eq("material_id", materialId);
      }

      if (profileId) {
        query = query.eq("profile_id", profileId);
      }

      const profileOptionId = url.searchParams.get("profile_option_id");

      if (profileOptionId) {
        query = query.eq("profile_option_id", profileOptionId);
      }

      const colourId = url.searchParams.get("colour_id");

      if (colourId) {
        query = query.eq("colour_id", colourId);
      }
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load catalogue.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const isAllowed = await authorised(request);

  if (!isAllowed) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const table = body.table;

    if (typeof table !== "string" || !TABLES.has(table)) {
      return NextResponse.json(
        { error: "Invalid catalogue table." },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from(table)
      .insert(body.data)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create catalogue item.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const isAllowed = await authorised(request);

  if (!isAllowed) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();

    const table = body.table;
    const id = body.id;

    if (typeof table !== "string" || !TABLES.has(table)) {
      return NextResponse.json(
        { error: "Invalid catalogue table." },
        { status: 400 },
      );
    }

    if (typeof id !== "string" || !id) {
      return NextResponse.json(
        { error: "Catalogue item ID is required." },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from(table)
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete catalogue item.",
      },
      { status: 500 },
    );
  }
}