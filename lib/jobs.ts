import { supabase } from "./supabase";

export type JobStatus =
  | "Opportunity"
  | "Quoted"
  | "Won"
  | "Pre-start"
  | "Scheduled"
  | "On site"
  | "Complete"
  | "Lost";

export type Job = {
  id: string;
  jobNumber: string;
  name: string;
  customer: string;
  address: string;

  contact: {
    name: string;
    phone: string;
    email: string;
  };

  status: JobStatus;

  dates: {
    quoted?: string;
    awarded?: string;
    start?: string;
    completion?: string;
  };

  quote?: {
    number: string;
    date: string;
    value: string;
    valid: boolean;
  };

  attention: string[];

  folders: {
    name: string;
    count: number;
    description: string;
  }[];

  activity: {
    text: string;
    detail: string;
    time: string;
  }[];

  projectManager?: string;
};

type JobRow = {
  id: string;
  job_number: string;
  name: string;
  customer_name: string;
  site_address: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  status: JobStatus;
  quoted_date: string | null;
  awarded_date: string | null;
  start_date: string | null;
  completion_date: string | null;
};

function mapJob(row: JobRow): Job {
  return {
    id: row.id,
    jobNumber: row.job_number,
    name: row.name,
    customer: row.customer_name,
    address: row.site_address,

    contact: {
      name: row.contact_name ?? "",
      phone: row.contact_phone ?? "",
      email: row.contact_email ?? "",
    },

    status: row.status,

    dates: {
      quoted: row.quoted_date ?? undefined,
      awarded: row.awarded_date ?? undefined,
      start: row.start_date ?? undefined,
      completion: row.completion_date ?? undefined,
    },

    attention: [],
    folders: [],
    activity: [],
  };
}

export async function getJobs(): Promise<Job[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(`Unable to load jobs: ${error.message}`);
  }

  return (data as JobRow[]).map(mapJob);
}

export async function getJob(
  id: string,
): Promise<Job | null> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }

    throw new Error(`Unable to load job: ${error.message}`);
  }

  return mapJob(data as JobRow);
}

export async function updateJob(
  id: string,
  updates: {
    status?: JobStatus;
    quoted_date?: string | null;
    awarded_date?: string | null;
    start_date?: string | null;
    completion_date?: string | null;
  },
): Promise<void> {
  const { error } = await supabase
    .from("jobs")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Unable to update job: ${error.message}`);
  }
}