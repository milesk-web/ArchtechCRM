import { supabase } from "./supabase";

export type QuoteStatus =
  | "Draft"
  | "Issued"
  | "Accepted"
  | "Declined"
  | "Superseded";

export type Quote = {
  id: string;
  jobId: string;
  quoteNumber: string;
  revision: number;
  status: QuoteStatus;
  quoteDate: string;
  createdAt: string;
  updatedAt: string;
};

type QuoteRow = {
  id: string;
  job_id: string;
  quote_number: string;
  revision: number;
  status: QuoteStatus;
  quote_date: string;
  created_at: string;
  updated_at: string;
};

function mapQuote(row: QuoteRow): Quote {
  return {
    id: row.id,
    jobId: row.job_id,
    quoteNumber: row.quote_number,
    revision: row.revision,
    status: row.status,
    quoteDate: row.quote_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getQuoteForJob(
  jobId: string,
): Promise<Quote | null> {
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("job_id", jobId)
    .order("revision", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load quote: ${error.message}`);
  }

  return data ? mapQuote(data as QuoteRow) : null;
}

export async function getQuote(
  quoteId: string,
): Promise<Quote | null> {
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", quoteId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load quote: ${error.message}`);
  }

  return data ? mapQuote(data as QuoteRow) : null;
}

export async function createQuote(
  jobId: string,
  jobNumber: string,
): Promise<Quote> {
  const existing = await getQuoteForJob(jobId);

  if (existing) {
    return existing;
  }

  const quoteNumber = `QT-${jobNumber}-01`;

  const { data, error } = await supabase
    .from("quotes")
    .insert({
      job_id: jobId,
      quote_number: quoteNumber,
      revision: 1,
      status: "Draft",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Unable to create quote: ${error.message}`);
  }

  return mapQuote(data as QuoteRow);
}

export type QuoteLine = {
  id: string;
  quoteId: string;
  section: string;
  category: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number | null;
  sellPrice: number | null;
  sortOrder: number;
  metadata: Record<string, unknown>;
};

type QuoteLineRow = {
  id: string;
  quote_id: string;
  section: string;
  category: string;
  description: string;
  quantity: number;
  unit: string;
  unit_cost: number | null;
  sell_price: number | null;
  sort_order: number;
  metadata: Record<string, unknown>;
};

function mapQuoteLine(row: QuoteLineRow): QuoteLine {
  return {
    id: row.id,
    quoteId: row.quote_id,
    section: row.section,
    category: row.category,
    description: row.description,
    quantity: row.quantity,
    unit: row.unit,
    unitCost: row.unit_cost,
    sellPrice: row.sell_price,
    sortOrder: row.sort_order,
    metadata: row.metadata ?? {},
  };
}

export async function getQuoteLines(
  quoteId: string,
): Promise<QuoteLine[]> {
  const { data, error } = await supabase
    .from("quote_lines")
    .select("*")
    .eq("quote_id", quoteId)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`Unable to load quote lines: ${error.message}`);
  }

  return (data ?? []).map((row) => mapQuoteLine(row as QuoteLineRow));
}

/**
 * Persists the full set of quote lines for a quote in one call: upserts
 * everything provided (each line must already have an id -- generate one
 * client-side with crypto.randomUUID() for new lines), and deletes any
 * existing DB rows for this quote that aren't present in `lines`. This
 * matches an explicit "Save quote" action editing local state, not
 * per-keystroke saving.
 */
export async function saveQuoteLines(
  quoteId: string,
  lines: QuoteLine[],
): Promise<QuoteLine[]> {
  const { data: existing, error: existingError } = await supabase
    .from("quote_lines")
    .select("id")
    .eq("quote_id", quoteId);

  if (existingError) {
    throw new Error(
      `Unable to check existing quote lines: ${existingError.message}`,
    );
  }

  const existingIds = new Set<string>(
    (existing ?? []).map((r: { id: string }) => r.id),
  );
  const keepIds = new Set(lines.map((l) => l.id));
  const toDelete = [...existingIds].filter((id) => !keepIds.has(id));

  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("quote_lines")
      .delete()
      .in("id", toDelete);

    if (deleteError) {
      throw new Error(
        `Unable to delete removed quote lines: ${deleteError.message}`,
      );
    }
  }

  if (lines.length === 0) {
    return [];
  }

  const rows = lines.map((l) => ({
    id: l.id,
    quote_id: quoteId,
    section: l.section,
    category: l.category,
    description: l.description,
    quantity: l.quantity,
    unit: l.unit,
    unit_cost: l.unitCost,
    sell_price: l.sellPrice,
    sort_order: l.sortOrder,
    metadata: l.metadata,
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from("quote_lines")
    .upsert(rows, { onConflict: "id" })
    .select();

  if (error) {
    throw new Error(`Unable to save quote lines: ${error.message}`);
  }

  return (data ?? []).map((row) => mapQuoteLine(row as QuoteLineRow));
}