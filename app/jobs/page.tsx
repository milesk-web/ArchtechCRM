import Link from "next/link";
import { getJobs, type Job, type JobStatus } from "@/lib/jobs";

const filters: Array<"All" | JobStatus> = [
  "All",
  "Opportunity",
  "Quoted",
  "Won",
  "Pre-start",
  "Scheduled",
  "On site",
  "Complete",
  "Lost",
];

export default async function JobsPage() {
  const jobs = await getJobs();

  return (
    <div className="min-h-screen bg-[#f4f4f1] text-[#242422]">
      <Sidebar active="Jobs" />

      <main className="md:ml-[220px]">
        <header className="border-b border-black/[0.08] bg-[#fafaf8]">
          <div className="mx-auto max-w-[1200px] px-5 py-6 md:px-9">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.17em] text-black/30">
                  Archtech
                </div>

                <h1 className="mt-1 text-[24px] font-medium tracking-[-0.035em]">
                  Jobs
                </h1>

                <div className="mt-2 text-[11px] text-black/40">
                  {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
                </div>
              </div>

              <Link
                href="/jobs/new"
                className="rounded-md bg-[#242422] px-4 py-2 text-[11px] font-medium text-white transition hover:bg-black"
              >
                + New job
              </Link>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1200px] px-5 py-7 md:px-9">
          <div className="mb-5 flex flex-wrap gap-1.5">
            {filters.map((filter) => (
              <span
                key={filter}
                className={`rounded-full border px-3 py-1.5 text-[10px] ${
                  filter === "All"
                    ? "border-black/[0.12] bg-white text-black/70"
                    : "border-black/[0.07] text-black/35"
                }`}
              >
                {filter}
              </span>
            ))}
          </div>

          {jobs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-black/[0.12] bg-[#fafaf8] px-6 py-16 text-center">
              <div className="text-[13px] font-medium">
                No jobs yet
              </div>

              <div className="mt-2 text-[11px] text-black/40">
                Create your first job to get started.
              </div>

              <Link
                href="/jobs/new"
                className="mt-5 inline-block rounded-md bg-[#242422] px-4 py-2.5 text-[11px] font-medium text-white"
              >
                + New job
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-black/[0.08] bg-[#fafaf8]">
              {jobs.map((job, index) => (
                <JobRow
                  key={job.id}
                  job={job}
                  last={index === jobs.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function JobRow({
  job,
  last,
}: {
  job: Job;
  last: boolean;
}) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      className={`group block px-5 py-4 transition hover:bg-white ${
        !last ? "border-b border-black/[0.06]" : ""
      }`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[9px] tracking-wide text-black/28">
            {job.jobNumber}
          </div>

          <div className="mt-1 text-[14px] font-medium tracking-[-0.01em]">
            {job.name}
          </div>

          <div className="mt-1 text-[11px] text-black/40">
            {job.customer} · {job.address}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-6">
          <div className="hidden text-right sm:block">
            <div className="text-[9px] uppercase tracking-[0.12em] text-black/25">
              Files
            </div>

            <div className="mt-1 flex gap-3 text-[10px] text-black/40">
              {job.folders
                .filter((folder) =>
                  ["Plans", "Photos", "Orders"].includes(folder.name),
                )
                .map((folder) => (
                  <span key={folder.name}>
                    {folder.name}{" "}
                    <span className="font-mono text-black/25">
                      {folder.count}
                    </span>
                  </span>
                ))}
            </div>
          </div>

          {job.dates.start && (
            <div className="hidden text-right md:block">
              <div className="text-[9px] uppercase tracking-[0.12em] text-black/25">
                Start
              </div>

              <div className="mt-1 text-[11px] text-black/50">
                {job.dates.start}
              </div>
            </div>
          )}

          <div className="text-right">
            <div className="text-[9px] uppercase tracking-[0.12em] text-black/25">
              Status
            </div>

            <div className="mt-1 text-[11px] text-black/55">
              {job.status}
            </div>
          </div>

          <div className="text-[14px] text-black/18 transition group-hover:translate-x-0.5 group-hover:text-black/45">
            →
          </div>
        </div>
      </div>

      {job.attention.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-black/[0.06] pt-3">
          {job.attention.map((item) => (
            <span
              key={item}
              className="text-[10px] text-amber-700/75"
            >
              {item}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

function Sidebar({ active }: { active: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-[220px] border-r border-black/[0.08] bg-[#fafaf8] md:flex md:flex-col">
      <div className="px-6 pb-8 pt-7">
        <div className="text-[17px] font-semibold tracking-[-0.025em]">
          Archtech
        </div>

        <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-black/35">
          Job management
        </div>
      </div>

      <nav className="px-3">
        <NavItem
          href="/"
          label="Overview"
          icon="⌂"
          active={active === "Overview"}
        />

        <NavItem
          href="/jobs"
          label="Jobs"
          icon="▣"
          active={active === "Jobs"}
        />

        <NavItem
          href="/customers"
          label="Customers"
          icon="♙"
          active={active === "Customers"}
        />
      </nav>
    </aside>
  );
}

function NavItem({
  href,
  label,
  icon,
  active = false,
}: {
  href: string;
  label: string;
  icon: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`mb-1 flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] ${
        active
          ? "bg-black/[0.055] font-medium text-black"
          : "text-black/48 hover:bg-black/[0.035] hover:text-black/75"
      }`}
    >
      <span className="w-4 text-center text-[13px] opacity-60">
        {icon}
      </span>

      {label}
    </Link>
  );
}