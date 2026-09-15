export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f4f1] px-5 text-[#242422]">
      <div className="w-full max-w-sm rounded-lg border border-black/[0.08] bg-[#fafaf8] p-8">
        <div className="text-[17px] font-semibold tracking-[-0.025em]">
          Archtech
        </div>

        <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-black/35">
          Job management
        </div>

        <h1 className="mt-10 text-[20px] font-medium">
          Sign in
        </h1>

        <p className="mt-2 text-[12px] leading-5 text-black/45">
          Sign in with your Microsoft account to continue.
        </p>

        <a
          href="/api/auth/microsoft/login"
          className="mt-7 block rounded-md bg-[#242422] px-4 py-3 text-center text-[12px] font-medium text-white transition hover:bg-black"
        >
          Continue with Microsoft
        </a>
      </div>
    </main>
  );
}
