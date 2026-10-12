import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCostingAdmin } from "@/lib/auth/costing-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { validateWorkflowDefinition, type WorkflowDefinition } from "@/lib/workflows/engine";

function workflowKeyFrom(value: unknown): string | null {
  return typeof value === "string" && /^[a-z0-9-]+$/.test(value) ? value : null;
}

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const workflowKey = workflowKeyFrom(url.searchParams.get("key") ?? "roofing-cladding");
  if (!workflowKey) {
    return NextResponse.json({ error: "Workflow key must use lowercase letters, numbers, and hyphens." }, { status: 400 });
  }

  const canEdit = isCostingAdmin(session.user.email);
  try {
    const [publishedResult, draftResult] = await Promise.all([
      supabaseAdmin
        .from("quote_workflow_versions")
        .select("id, workflow_key, name, version, status, definition, published_at, created_at")
        .eq("workflow_key", workflowKey)
        .eq("status", "published")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      canEdit
        ? supabaseAdmin
            .from("quote_workflow_versions")
            .select("id, workflow_key, name, version, status, definition, published_at, created_at")
            .eq("workflow_key", workflowKey)
            .eq("status", "draft")
            .order("version", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (publishedResult.error || draftResult.error) {
      throw new Error(
        publishedResult.error?.message ?? draftResult.error?.message ?? "Unable to load workflow versions.",
      );
    }

    return NextResponse.json({
      workflowKey,
      published: publishedResult.data,
      draft: draftResult.data,
      canEdit,
    });
  } catch (error) {
    console.error("workflows GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load workflow." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isCostingAdmin(session.user.email)) {
    return NextResponse.json(
      { error: "Workflow changes require an authorised email in COSTING_ADMIN_EMAILS." },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Request body must be an object." }, { status: 400 });
    }

    if (body.action === "saveDraft") {
      const workflowKey = workflowKeyFrom(body.workflowKey);
      if (!workflowKey) {
        return NextResponse.json({ error: "A valid workflowKey is required." }, { status: 400 });
      }
      const validationErrors = validateWorkflowDefinition(body.definition);
      if (validationErrors.length > 0) {
        return NextResponse.json(
          { error: "Workflow definition is invalid.", details: validationErrors },
          { status: 422 },
        );
      }

      const definition = body.definition as WorkflowDefinition;
      if (definition.key !== workflowKey) {
        return NextResponse.json(
          { error: "Workflow key in the definition must match workflowKey." },
          { status: 422 },
        );
      }

      const { data: draft, error: draftError } = await supabaseAdmin
        .from("quote_workflow_versions")
        .select("id, version")
        .eq("workflow_key", workflowKey)
        .eq("status", "draft")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (draftError) throw new Error(`Unable to find workflow draft: ${draftError.message}`);

      if (draft) {
        const versionedDefinition = { ...definition, version: draft.version };
        const { data, error } = await supabaseAdmin
          .from("quote_workflow_versions")
          .update({
            name: definition.name,
            definition: versionedDefinition,
            created_by: session.user.id,
          })
          .eq("id", draft.id)
          .eq("status", "draft")
          .select("id, workflow_key, name, version, status, definition, published_at, created_at")
          .single();
        if (error) throw new Error(`Unable to save workflow draft: ${error.message}`);
        return NextResponse.json({ draft: data });
      }

      const { data: latest, error: latestError } = await supabaseAdmin
        .from("quote_workflow_versions")
        .select("version")
        .eq("workflow_key", workflowKey)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestError) throw new Error(`Unable to determine next workflow version: ${latestError.message}`);

      const version = (latest?.version ?? 0) + 1;
      const versionedDefinition = { ...definition, version };
      const { data, error } = await supabaseAdmin
        .from("quote_workflow_versions")
        .insert({
          workflow_key: workflowKey,
          name: definition.name,
          version,
          status: "draft",
          definition: versionedDefinition,
          created_by: session.user.id,
        })
        .select("id, workflow_key, name, version, status, definition, published_at, created_at")
        .single();
      if (error) throw new Error(`Unable to create workflow draft: ${error.message}`);
      return NextResponse.json({ draft: data }, { status: 201 });
    }

    if (body.action === "publish") {
      if (typeof body.draftId !== "string" || !body.draftId.trim()) {
        return NextResponse.json({ error: "draftId is required to publish." }, { status: 400 });
      }
      const { data: draft, error: draftError } = await supabaseAdmin
        .from("quote_workflow_versions")
        .select("id, workflow_key, status")
        .eq("id", body.draftId)
        .maybeSingle();
      if (draftError) throw new Error(`Unable to load workflow draft: ${draftError.message}`);
      if (!draft || draft.status !== "draft") {
        return NextResponse.json({ error: "Only an existing workflow draft can be published." }, { status: 409 });
      }

      const { data: publishedId, error: publishError } = await supabaseAdmin
        .rpc("publish_quote_workflow", { p_draft_id: body.draftId });
      if (publishError || !publishedId) {
        throw new Error(publishError?.message ?? "Workflow draft could not be published.");
      }

      const { data, error } = await supabaseAdmin
        .from("quote_workflow_versions")
        .select("id, workflow_key, name, version, status, definition, published_at, created_at")
        .eq("id", publishedId)
        .single();
      if (error) throw new Error(`Published workflow, but unable to reload it: ${error.message}`);
      return NextResponse.json({ published: data });
    }

    return NextResponse.json({ error: "Unsupported action. Use saveDraft or publish." }, { status: 400 });
  } catch (error) {
    console.error("workflows POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save workflow." },
      { status: 500 },
    );
  }
}
