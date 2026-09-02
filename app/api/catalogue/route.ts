import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
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

async function authorised(request: Request) {
  // 1. Check Microsoft OAuth session (used by OneDrive / Microsoft integration)
  const session = await getSession();
  if (session?.user) {
    return true;
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
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const accessCookieMatch = cookieHeader.match(/sb-[a-zA-Z0-9]+-auth-token=([^;]+)/);
    if (accessCookieMatch) {
      try {
        const rawValue = decodeURIComponent(accessCookieMatch[1]);
        const parsed = JSON.parse(rawValue);
        const token = Array.isArray(parsed) ? parsed[0] : parsed?.access_token || parsed;
        if (typeof token === "string" && token) {
          const { data, error } = await supabaseAdmin.auth.getUser(token);
          if (!error && data?.user) {
            return true;
          }
        }
      } catch {
        // Fall back to checking Bearer token validation
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