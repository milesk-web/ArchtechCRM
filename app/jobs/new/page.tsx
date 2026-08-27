"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function NewJobPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [customer, setCustomer] = useState("");
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim() || !customer.trim() || !address.trim()) {
      setError("Job name, customer and site address are required.");
      return;
    }

    setSaving(true);
    setError("");

    const { data, error: createError } = await supabase.rpc("create_job", {
      p_name: name,
      p_customer_name: customer,
      p_site_address: address,
      p_contact_name: contact || null,
      p_contact_phone: phone || null,
      p_contact_email: email || null,
    });

    if (createError) {
      setError(createError.message);
      setSaving(false);
      return;
    }

    if (!data?.id) {
      setError("The job was created, but no job ID was returned.");
      setSaving(false);
      return;
    }

    router.push(`/jobs/${data.id}`);
  }

  return (
    <div className="min-h-screen bg-[#f4f4f1] text-[#242422]">
      <main className="mx-auto max-w-[760px] px-5 py-8 md:px-9 md:py-12">
        <div className="mb-8">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-[11px] text-black/35 transition hover:text-black/70"
          >
            ← Back
          </button>

          <div className="mt-8">
            <div className="text-[10px] uppercase tracking-[0.17em] text-black/30">
              Archtech
            </div>

            <h1 className="mt-1 text-[25px] font-medium tracking-[-0.035em]">
              New job
            </h1>

            <p className="mt-2 text-[11px] leading-5 text-black/40">
              Create the job now. The rest can be added as the project develops.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-black/[0.08] bg-[#fafaf8]"
        >
          <div className="space-y-7 p-6 md:p-8">
            <Field
              label="Job name"
              required
              value={name}
              onChange={setName}
              placeholder="e.g. Belgium Road"
              autoFocus
            />

            <Field
              label="Customer"
              required
              value={customer}
              onChange={setCustomer}
              placeholder="Customer or company"
            />

            <Field
              label="Site address"
              required
              value={address}
              onChange={setAddress}
              placeholder="Where the work is happening"
            />

            <div className="border-t border-black/[0.07] pt-7">
              <div className="mb-5 text-[10px] uppercase tracking-[0.15em] text-black/30">
                Contact
              </div>

              <div className="space-y-7">
                <Field
                  label="Name"
                  value={contact}
                  onChange={setContact}
                  placeholder="Site or customer contact"
                />

                <Field
                  label="Phone"
                  value={phone}
                  onChange={setPhone}
                  placeholder="021 ..."
                  type="tel"
                />

                <Field
                  label="Email"
                  value={email}
                  onChange={setEmail}
                  placeholder="name@example.com"
                  type="email"
                />
              </div>
            </div>

            {error && (
              <div className="border-l-2 border-red-500/60 bg-red-50 px-3 py-2.5 text-[11px] leading-5 text-red-700">
                {error}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-black/[0.07] px-6 py-5 md:px-8">
            <div className="text-[10px] text-black/30">
              Status: Opportunity
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-[#242422] px-5 py-2.5 text-[11px] font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "Creating…" : "Create job"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  type = "text",
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-[10px] uppercase tracking-[0.13em] text-black/35">
        {label}
        {required && <span className="ml-1 text-black/60">*</span>}
      </div>

      <input
        autoFocus={autoFocus}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full border-b border-black/[0.15] bg-transparent px-0 py-2 text-[13px] outline-none placeholder:text-black/20 focus:border-black/50"
      />
    </label>
  );
}