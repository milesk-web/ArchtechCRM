import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = { params: Promise<{ id: string }> };

type IssueLine = {
  id: string;
  section: string;
  category: string;
  description: string | null;
  quantity: number | string | null;
  unit_cost: number | string | null;
  sell_price: number | string | null;
};

function validateLines(lines: IssueLine[]): string[] {
  const errors: string[] = [];
  if (lines.length === 0) {
    return ["Add and save at least one quote line before issuing."];
  }

  const sections = new Set(lines.map((line) => line.section).filter((section) => section === "Roofing" || section === "Wall Cladding"));
  for (const section of sections) {
    const sectionLines = lines.filter((line) => line.section === section);
    const hasMaterial = sectionLines.some((line) => line.category === "Material");
    const hasLabour = sectionLines.some((line) => line.category === "Labour");
    if (!hasMaterial) errors.push(`${section}: a priced profile/material line is required.`);
    if (!hasLabour) errors.push(`${section}: a priced labour line is required.`);
  }

  for (const line of lines) {
    const quantity = Number(line.quantity);
    const unitCost = line.unit_cost == null ? NaN : Number(line.unit_cost);
    const sellPrice = line.sell_price == null ? NaN : Number(line.sell_price);
    const label = line.description?.trim() || line.id;

    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.push(`Line "${label}" must have a quantity greater than zero.`);
    }
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      errors.push(`Line "${label}" is missing a valid unit cost.`);
    }
    if (!Number.isFinite(sellPrice) || sellPrice < 0) {
      errors.push(`Line "${label}" is missing a valid sell price.`);
    }
    if (!line.description?.trim()) {
      errors.push(`Line "${line.id}" needs a description.`);
    }
  }

  return errors;
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession(request);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Quote ID is required." }, { status: 400 });
    }

    const { data: quote, error: quoteError } = await supabaseAdmin
      .from("quotes")
      .select("id, job_id, status")
      .eq("id", id)
      .maybeSingle();

    if (quoteError) {
      throw new Error(`Unable to load quote: ${quoteError.message}`);
    }
    if (!quote) {
      return NextResponse.json({ error: "Quote not found." }, { status: 404 });
    }
    if (quote.status !== "Draft") {
      return NextResponse.json(
        { error: `Only draft quotes can be issued (current status: ${quote.status}).` },
        { status: 409 },
      );
    }

    const { data: lines, error: linesError } = await supabaseAdmin
      .from("quote_lines")
      .select("id, section, category, description, quantity, unit_cost, sell_price")
      .eq("quote_id", id);

    if (linesError) {
      throw new Error(`Unable to validate quote lines: ${linesError.message}`);
    }

    const validationErrors = validateLines((lines ?? []) as IssueLine[]);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: "This quote cannot be issued until all lines are fully priced.",
          details: validationErrors,
        },
        { status: 422 },
      );
    }

    // Conditional update prevents two concurrent requests from issuing the same draft.
    const { data: issued, error: issueError } = await supabaseAdmin
      .from("quotes")
      .update({ status: "Issued" })
      .eq("id", id)
      .eq("status", "Draft")
      .select("id")
      .maybeSingle();

    if (issueError) {
      throw new Error(`Unable to issue quote: ${issueError.message}`);
    }
    if (!issued) {
      return NextResponse.json(
        { error: "The quote changed while it was being issued. Reload and try again." },
        { status: 409 },
      );
    }

    const { data: job, error: jobReadError } = await supabaseAdmin
      .from("jobs")
      .select("id, status")
      .eq("id", quote.job_id)
      .maybeSingle();

    if (jobReadError || !job) {
      await supabaseAdmin.from("quotes").update({ status: "Draft" }).eq("id", id).eq("status", "Issued");
      throw new Error(
        jobReadError
          ? `Unable to load associated job: ${jobReadError.message}`
          : "The quote's associated job could not be found.",
      );
    }

    let jobStatus = job.status as string;
    if (job.status === "Opportunity") {
      const today = new Date().toISOString().slice(0, 10);
      const { error: jobUpdateError } = await supabaseAdmin
        .from("jobs")
        .update({ status: "Quoted", quoted_date: today })
        .eq("id", job.id);

      if (jobUpdateError) {
        await supabaseAdmin.from("quotes").update({ status: "Draft" }).eq("id", id).eq("status", "Issued");
        throw new Error(`Quote was not issued because the job could not be updated: ${jobUpdateError.message}`);
      }
      jobStatus = "Quoted";
    }

    return NextResponse.json({ success: true, quoteId: id, status: "Issued", jobStatus });
  } catch (error) {
    console.error("quotes/issue error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to issue quote." },
      { status: 500 },
    );
  }
}
