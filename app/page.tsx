import Link from "next/link";
import { getJobs, type Job } from "@/lib/jobs";

export default async function Home() {
  const jobs = await getJobs();
  const attention = jobs.filter((job) => job.attention.length > 0);

  const opportunities = jobs.filter(
    (job) => job.status === "Opportunity" || job.status === "Quoted",
  );

  const preStart = jobs.filter(
    (job) => job.status === "Won" || job.status === "Pre-start",
  );

  const onSite = jobs.filter((job) => job.status === "On site");

  const comingUp = jobs.filter(
    (job) => job.status === "Scheduled",
  );

  const completed = jobs.filter(
    (job) => job.status === "Complete",
  );

  return (
    <div className="min-h-screen bg-[#f4f4f1] text-[#242422]">
      <Sidebar active="Overview" />

      <main className="md:ml-[220px]">
        <header className="border-b border-black/[0.08] bg-[#fafaf8]">
          <div className="mx-auto flex h-[76px] max-w-[1200px] items-center justify-between px-5 md:px-9">
            <div>
              <div className="text-[10px] uppercase tracking-[0.17em] text-black/30">
                Archtech
              </div>

              <h1 className="mt-1 text-[20px] font-medium tracking-[-0.025em]">
                Overview
              </h1>
            </div>

            <Link
              href="/jobs"
              className="rounded-md bg-[#242422] px-4 py-2 text-[11px] font-medium text-white transition hover:bg-black"
            >
              + New job
            </Link>
          </div>
        </header>

        <div className="mx-auto max-w-[1200px] px-5 py-7 md:px-9 md:py-9">
          {attention.length > 0 && (
            <DashboardSection
              title="Needs attention"
              count={attention.length}
              emphasis
            >
              {attention.map((job) => (
                <AttentionRow key={job.id} job={job} />
              ))}
            </DashboardSection>
          )}

          {opportunities.length > 0 && (
            <DashboardSection
              title="Opportunities"
              count={opportunities.length}
            >
              {opportunities.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </DashboardSection>
          )}

          {preStart.length > 0 && (
            <DashboardSection
              title="Pre-start"
              count={preStart.length}
            >
              {preStart.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </DashboardSection>
          )}

          {onSite.length > 0 && (
            <DashboardSection
              title="On site"
              count={onSite.length}
            >
              {onSite.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </DashboardSection>
          )}

          {comingUp.length > 0 && (
            <DashboardSection
              title="Coming up"
              count={comingUp.length}
            >
              {comingUp.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </DashboardSection>
          )}

          {completed.length > 0 && (
            <DashboardSection
              title="Recently completed"
              count={completed.length}
              muted
            >
              {completed.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </DashboardSection>
          )}

          {jobs.length === 0 && (
            <div className="rounded-lg border border-dashed border-black/[0.12] bg-[#fafaf8] px-6 py-16 text-center">
              <div className="text-[13px] font-medium">
                No jobs yet
              </div>

              <div className="mt-2 text-[11px] text-black/40">
                Create a job to get started.
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function DashboardSection({
  title,
  count,
  children,
  emphasis = false,
  muted = false,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  emphasis?: boolean;
  muted?: boolean;
}) {
  return (
    <section className={`mb-8 ${muted ? "opacity-75" : ""}`}>
      <div className="mb-3 flex items-baseline justify-between">
        <h2
          className={`text-[12px] font-medium ${
            emphasis ? "text-black" : "text-black/65"
          }`}
        >
          {title}
        </h2>

        <span className="font-mono text-[9px] text-black/25">
          {count}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-black/[0.08] bg-[#fafaf8]">
        {children}
      </div>
    </section>
  );
}

function AttentionRow({ job }: { job: Job }) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="group block border-l-2 border-amber-600/60 px-5 py-4 transition hover:bg-white"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
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
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-[0.12em] text-black/25">
              Status
            </div>

            <div className="mt-1 text-[11px] text-amber-700">
              {job.status}
            </div>
          </div>

          <Arrow />
        </div>
      </div>

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
    </Link>
  );
}

function JobRow({ job }: { job: Job }) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="group block px-5 py-4 transition hover:bg-white"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
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
          {job.quote?.valid && (
            <div className="hidden text-right sm:block">
              <div className="text-[9px] uppercase tracking-[0.12em] text-black/25">
                Quote
              </div>

              <div className="mt-1 text-[11px] text-black/55">
                {job.quote.number}
              </div>
            </div>
          )}

          {job.dates.start && (
            <div className="hidden text-right sm:block">
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

            <div className="mt-1 text-[11px] text-black/50">
              {job.status}
            </div>
          </div>

          <Arrow />
        </div>
      </div>

      <FileSummary job={job} />
    </Link>
  );
}

function FileSummary({ job }: { job: Job }) {
  const visibleFolders = job.folders.filter((folder) =>
    ["Plans", "Photos", "Orders"].includes(folder.name),
  );

  if (visibleFolders.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex gap-5 border-t border-black/[0.06] pt-3">
      {visibleFolders.map((folder) => (
        <div
          key={folder.name}
          className="flex items-center gap-1.5 text-[9px] text-black/35"
        >
          <span>{folder.name}</span>

          <span className="font-mono text-black/25">
            {folder.count}
          </span>
        </div>
      ))}
    </div>
  );
}

function Arrow() {
  return (
    <div className="text-[14px] text-black/18 transition group-hover:translate-x-0.5 group-hover:text-black/45">
      →
    </div>
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
        />
      </nav>
    </aside>
  );
}

function NavItem({
  href,
  label,
  icon = "·",
  active = false,
}: {
  href: string;
  label: string;
  icon?: string;
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