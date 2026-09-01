"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  getJob,
  updateJob,
  type Job,
  type JobStatus,
} from "@/lib/jobs";
import {
  createQuote,
  getQuoteForJob,
  type Quote,
} from "@/lib/quotes";

const statuses: JobStatus[] = [
  "Opportunity",
  "Quoted",
  "Won",
  "Pre-start",
  "Scheduled",
  "On site",
  "Complete",
  "Lost",
];

export default function JobPage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [jobResult, quoteResult] = await Promise.all([
          getJob(id),
          getQuoteForJob(id),
        ]);

        if (!jobResult) {
          router.replace("/jobs");
          return;
        }

        setJob(jobResult);
        setQuote(quoteResult);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load job.",
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, router]);

  async function handleCreateQuote() {
    if (!job || creatingQuote) {
      return;
    }

    setCreatingQuote(true);
    setError("");

    try {
      const createdQuote = await createQuote(
        job.id,
        job.jobNumber,
      );

      setQuote(createdQuote);
      router.push(`/jobs/${job.id}/quote`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create quote.",
      );
    } finally {
      setCreatingQuote(false);
    }
  }

  async function changeStatus(status: JobStatus) {
    if (!job) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await updateJob(id, {
        status,
      });

      setJob({
        ...job,
        status,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update status.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeDate(
    field:
      | "quoted_date"
      | "awarded_date"
      | "start_date"
      | "completion_date",
    value: string,
  ) {
    if (!job) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await updateJob(id, {
        [field]: value || null,
      });

      const dateKey =
        field === "quoted_date"
          ? "quoted"
          : field === "awarded_date"
            ? "awarded"
            : field === "start_date"
              ? "start"
              : "completion";

      setJob({
        ...job,
        dates: {
          ...job.dates,
          [dateKey]: value || undefined,
        },
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update date.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f4f1] px-6 py-10 text-[11px] text-black/40">
        Loading job...
      </div>
    );
  }

  if (!job) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f4f4f1] text-[#242422]">
      <header className="border-b border-black/[0.08] bg-[#fafaf8]">
        <div className="mx-auto max-w-[1100px] px-5 py-5 md:px-9">
          <Link
            href="/jobs"
            className="text-[10px] text-black/35 hover:text-black/70"
          >
            ← Jobs
          </Link>

          <div className="mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="font-mono text-[10px] tracking-wide text-black/30">
                {job.jobNumber}
              </div>

              <h1 className="mt-1 text-[25px] font-medium tracking-[-0.035em]">
                {job.name}
              </h1>

              <div className="mt-1 text-[11px] text-black/40">
                {job.customer} · {job.address}
              </div>
            </div>

            <div className="relative">
              <select
                value={job.status}
                disabled={saving}
                onChange={(event) =>
                  changeStatus(
                    event.target.value as JobStatus,
                  )
                }
                className="appearance-none rounded-full border border-black/[0.1] bg-white px-4 py-2 pr-8 text-[10px] text-black/60 outline-none"
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-black/30">
                ▾
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-5 py-7 md:px-9">
        {error && (
          <div className="mb-5 border-l-2 border-red-500/60 bg-red-50 px-3 py-2.5 text-[11px] text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <section className="space-y-5">
            <Card title="Dates">
              <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                <DateField
                  label="Quoted"
                  value={job.dates.quoted}
                  onChange={(value) =>
                    changeDate("quoted_date", value)
                  }
                />

                <DateField
                  label="Awarded"
                  value={job.dates.awarded}
                  onChange={(value) =>
                    changeDate("awarded_date", value)
                  }
                />

                <DateField
                  label="Start"
                  value={job.dates.start}
                  onChange={(value) =>
                    changeDate("start_date", value)
                  }
                />

                <DateField
                  label="Completion"
                  value={job.dates.completion}
                  onChange={(value) =>
                    changeDate("completion_date", value)
                  }
                />
              </div>
            </Card>

            <Card title="Quote">
              {quote ? (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-mono text-[11px] text-black/55">
                      {quote.quoteNumber}
                    </div>

                    <div className="mt-1 text-[10px] text-black/35">
                      Revision {quote.revision} · {quote.status}
                    </div>
                  </div>

                  <Link
                    href={`/jobs/${job.id}/quote`}
                    className="rounded-md border border-black/[0.1] bg-white px-3 py-2 text-[10px] text-black/55 hover:bg-black/[0.025]"
                  >
                    Open quote →
                  </Link>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[12px] text-black/45">
                      No quote attached
                    </div>

                    <div className="mt-1 text-[10px] text-black/25">
                      Create a quote from this Jobcard.
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={creatingQuote}
                    onClick={handleCreateQuote}
                    className="rounded-md border border-black/[0.1] bg-white px-3 py-2 text-[10px] text-black/55 hover:bg-black/[0.025] disabled:cursor-wait disabled:opacity-50"
                  >
                    {creatingQuote
                      ? "Creating..."
                      : "+ Create quote"}
                  </button>
                </div>
              )}
            </Card>

            <Card title="Files">
              <div className="grid gap-2 sm:grid-cols-3">
                {["Plans", "Photos", "Orders"].map((folder) => (
                  <button
                    key={folder}
                    type="button"
                    className="flex items-center justify-between rounded-md border border-black/[0.07] bg-white px-3 py-3 text-left hover:bg-black/[0.02]"
                  >
                    <span className="text-[11px] text-black/55">
                      {folder}
                    </span>

                    <span className="text-[12px] text-black/25">
                      →
                    </span>
                  </button>
                ))}
              </div>
            </Card>

            <Card title="Notes">
              <button
                type="button"
                className="text-[11px] text-black/35 hover:text-black/65"
              >
                + Add note
              </button>
            </Card>

            <Card title="Activity">
              <div className="text-[11px] text-black/30">
                No activity recorded yet.
              </div>
            </Card>
          </section>

          <aside className="space-y-5">
            <Card title="Contact">
              {job.contact.name ? (
                <>
                  <div className="text-[13px] text-black/65">
                    {job.contact.name}
                  </div>

                  {job.contact.phone && (
                    <div className="mt-2 text-[11px] text-black/40">
                      {job.contact.phone}
                    </div>
                  )}

                  {job.contact.email && (
                    <div className="mt-1 text-[11px] text-black/40">
                      {job.contact.email}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[11px] text-black/30">
                  No contact added.
                </div>
              )}
            </Card>

            <Card title="Job details">
              <div className="space-y-4">
                <Detail
                  label="Customer"
                  value={job.customer}
                />

                <Detail
                  label="Site"
                  value={job.address}
                />

                <Detail
                  label="Status"
                  value={job.status}
                />

                <Detail
                  label="Job number"
                  value={job.jobNumber}
                  mono
                />
              </div>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-black/[0.08] bg-[#fafaf8]">
      <div className="border-b border-black/[0.06] px-5 py-3">
        <h2 className="text-[10px] uppercase tracking-[0.15em] text-black/30">
          {title}
        </h2>
      </div>

      <div className="p-5">
        {children}
      </div>
    </section>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-[9px] uppercase tracking-[0.12em] text-black/25">
        {label}
      </div>

      <input
        type="date"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border-b border-black/[0.12] bg-transparent py-2 text-[11px] text-black/55 outline-none focus:border-black/40"
      />
    </label>
  );
}

function Detail({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.12em] text-black/25">
        {label}
      </div>

      <div
        className={`mt-1 text-[11px] text-black/55 ${
          mono ? "font-mono" : ""
        }`}
      >
        {value || "—"}
      </div>
    </div>
  );
}