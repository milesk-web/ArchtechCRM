"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  createLibraryFolder,
  formatFileSize,
  getFileExtension,
  getParentPath,
  isImageFile,
  isPdfFile,
  LIBRARY_ROOT,
  listLibraryItems,
  normalisePath,
  type LibraryItem,
} from "@/lib/library";

type AuthState =
  | { status: "loading" }
  | { status: "authenticated"; name: string; email: string }
  | { status: "unauthenticated" };

export default function LibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f4f4f1] px-6 py-10 text-[11px] text-black/40">
          Loading library...
        </div>
      }
    >
      <LibraryExplorer />
    </Suspense>
  );
}

function LibraryExplorer() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawPath = searchParams.get("path");
  const currentPath = rawPath ? normalisePath(rawPath) : LIBRARY_ROOT;
  const authErrorParam = searchParams.get("auth_error");

  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(authErrorParam || "");
  const [authState, setAuthState] = useState<AuthState>({ status: "loading" });

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderError, setFolderError] = useState("");
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch("/api/auth/microsoft/me");
        const data = (await response.json()) as {
          authenticated?: boolean;
          user?: { name: string; email: string };
        };

        if (data.authenticated && data.user) {
          setAuthState({
            status: "authenticated",
            name: data.user.name,
            email: data.user.email,
          });
        } else {
          setAuthState({ status: "unauthenticated" });
        }
      } catch {
        setAuthState({ status: "unauthenticated" });
      }
    }

    checkAuth();
  }, []);

  useEffect(() => {
    if (showNewFolder && folderInputRef.current) {
      folderInputRef.current.focus();
    }
  }, [showNewFolder]);

  useEffect(() => {
    if (authState.status === "loading") return;

    let isCurrent = true;

    async function fetchItems() {
      try {
        const data = await listLibraryItems(currentPath);
        if (isCurrent) {
          setItems(data);
          setError("");
          setLoading(false);
        }
      } catch (err) {
        if (isCurrent) {
          const e = err as Error & { code?: string };
          if (e.code === "unauthenticated") {
            setAuthState({ status: "unauthenticated" });
            setLoading(false);
            setError("");
          } else {
            setError(e.message || "Unable to load library items.");
            setLoading(false);
          }
        }
      }
    }

    fetchItems();

    return () => {
      isCurrent = false;
    };
  }, [currentPath, authState.status]);

  const breadcrumbs = currentPath.split("/").filter(Boolean);

  function navigateTo(path: string) {
    const normalised = normalisePath(path);
    setLoading(true);
    if (normalised === LIBRARY_ROOT) {
      router.push("/library");
    } else {
      router.push(`/library?path=${encodeURIComponent(normalised)}`);
    }
  }

  function openItem(item: LibraryItem) {
    if (item.type === "folder") {
      navigateTo(item.path);
    }
  }

  function goUp() {
    const parent = getParentPath(currentPath);
    if (parent) {
      navigateTo(parent);
    } else {
      navigateTo(LIBRARY_ROOT);
    }
  }

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;

    setCreatingFolder(true);
    setFolderError("");

    try {
      await createLibraryFolder(currentPath, name);
      setNewFolderName("");
      setShowNewFolder(false);
      setLoading(true);
      const data = await listLibraryItems(currentPath);
      setItems(data);
      setLoading(false);
    } catch (err) {
      setFolderError(
        err instanceof Error ? err.message : "Failed to create folder.",
      );
    } finally {
      setCreatingFolder(false);
    }
  }

  const currentFolderTitle =
    currentPath === LIBRARY_ROOT
      ? "Library"
      : breadcrumbs[breadcrumbs.length - 1] ?? "Library";

  const isAuthenticated = authState.status === "authenticated";

  return (
    <div className="min-h-screen bg-[#f4f4f1] text-[#242422]">
      <header className="border-b border-black/[0.08] bg-[#fafaf8]">
        <div className="mx-auto max-w-[1200px] px-5 py-5 md:px-9">
          <div className="flex items-center justify-between gap-6">
            <div>
              <Link
                href="/"
                className="text-[10px] uppercase tracking-[0.12em] text-black/30 hover:text-black/60"
              >
                Archtech CRM
              </Link>

              <h1 className="mt-3 text-[25px] font-medium tracking-[-0.035em]">
                Library
              </h1>

              <p className="mt-1 text-[11px] text-black/40">
                Files and documents
              </p>
            </div>

            <div className="shrink-0 text-right">
              {authState.status === "loading" && (
                <div className="text-[10px] text-black/25">Checking session…</div>
              )}
              {authState.status === "authenticated" && (
                <div className="flex flex-col items-end gap-1.5">
                  <div className="text-[10px] text-black/50">{authState.name}</div>
                  <div className="text-[9px] text-black/30">{authState.email}</div>
                  <a
                    href="/api/auth/microsoft/logout"
                    className="text-[9px] text-black/30 underline hover:text-black/60"
                  >
                    Sign out
                  </a>
                </div>
              )}
              {authState.status === "unauthenticated" && (
                <a
                  href="/api/auth/microsoft/login"
                  className="inline-block rounded-md border border-black/[0.12] bg-white px-4 py-2.5 text-[11px] text-black/70 transition hover:border-black/25 hover:bg-black/[0.02]"
                >
                  Sign in with Microsoft
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-5 py-7 md:px-9">
        {authErrorParam && (
          <div className="mb-5 border-l-2 border-amber-500/60 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-800">
            Sign-in error: {authErrorParam}
          </div>
        )}

        {authState.status === "unauthenticated" && !authErrorParam && (
          <div className="mb-5 rounded-lg border border-black/[0.08] bg-[#fafaf8] px-6 py-10 text-center">
            <div className="text-[13px] font-medium text-black/50">
              Sign in to access the Library
            </div>
            <div className="mt-2 text-[11px] text-black/30">
              Connect your KS Holdings Microsoft account to browse OneDrive files.
            </div>
            <a
              href="/api/auth/microsoft/login"
              className="mt-5 inline-block rounded-md border border-black/[0.12] bg-white px-5 py-3 text-[11px] text-black/70 transition hover:border-black/25 hover:bg-black/[0.02]"
            >
              Sign in with Microsoft →
            </a>
          </div>
        )}

        <div className="mb-5 flex flex-wrap items-center gap-2 text-[10px] text-black/40">
          {breadcrumbs.map((part, index) => {
            const path = breadcrumbs.slice(0, index + 1).join("/");
            const isLast = index === breadcrumbs.length - 1;

            return (
              <div key={path} className="flex items-center gap-2">
                {index > 0 && <span className="text-black/20">/</span>}

                <button
                  type="button"
                  onClick={() => navigateTo(path)}
                  className={`capitalize transition ${
                    isLast
                      ? "font-medium text-black/70"
                      : "hover:text-black/70"
                  }`}
                >
                  {part}
                </button>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mb-5 border-l-2 border-red-500/60 bg-red-50 px-3 py-2.5 text-[11px] text-red-700">
            {error}
          </div>
        )}

        <section className="rounded-lg border border-black/[0.08] bg-[#fafaf8]">
          <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-3">
            <div className="flex items-center gap-3">
              {currentPath !== LIBRARY_ROOT && (
                <button
                  type="button"
                  onClick={goUp}
                  className="text-[10px] text-black/40 transition hover:text-black/70"
                >
                  ← Back
                </button>
              )}

              <h2 className="text-[10px] uppercase tracking-[0.15em] text-black/30">
                {currentFolderTitle}
              </h2>
            </div>

            {isAuthenticated && (
              <button
                type="button"
                onClick={() => {
                  setShowNewFolder(true);
                  setFolderError("");
                  setNewFolderName("");
                }}
                className="rounded-md border border-black/[0.08] bg-white px-3 py-2 text-[10px] text-black/50 transition hover:border-black/20 hover:text-black/80"
              >
                + New Folder
              </button>
            )}
          </div>

          {showNewFolder && (
            <form
              onSubmit={handleCreateFolder}
              className="border-b border-black/[0.05] px-5 py-4"
            >
              <div className="flex items-center gap-3">
                <input
                  ref={folderInputRef}
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name"
                  maxLength={128}
                  className="flex-1 rounded border border-black/[0.12] bg-white px-3 py-2 text-[11px] text-black/70 placeholder:text-black/25 focus:border-black/25 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={creatingFolder || !newFolderName.trim()}
                  className="rounded border border-black/[0.12] bg-white px-3 py-2 text-[10px] text-black/60 transition hover:border-black/25 disabled:opacity-40"
                >
                  {creatingFolder ? "Creating…" : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewFolder(false);
                    setFolderError("");
                  }}
                  className="text-[10px] text-black/30 hover:text-black/60"
                >
                  Cancel
                </button>
              </div>
              {folderError && (
                <div className="mt-2 text-[10px] text-red-600">{folderError}</div>
              )}
            </form>
          )}

          {loading ? (
            <div className="px-5 py-14 text-center">
              <div className="text-[11px] text-black/35">Loading items…</div>
            </div>
          ) : !isAuthenticated && authState.status !== "loading" ? (
            <div className="px-5 py-10 text-center">
              <div className="text-[11px] text-black/30">
                Sign in above to browse files.
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="text-[11px] text-black/35">
                This folder is empty.
              </div>

              <div className="mt-2 text-[10px] text-black/20">
                Files and folders will appear here.
              </div>
            </div>
          ) : (
            <div>
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openItem(item)}
                  className="flex w-full items-center gap-4 border-b border-black/[0.05] px-5 py-4 text-left last:border-b-0 transition hover:bg-black/[0.015]"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-black/[0.035] text-[11px] text-black/35">
                    {item.type === "folder"
                      ? "DIR"
                      : isPdfFile(item.name)
                        ? "PDF"
                        : isImageFile(item.name)
                          ? "IMG"
                          : getFileExtension(item.name).toUpperCase() || "FILE"}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] text-black/65">
                      {item.name}
                    </div>

                    <div className="mt-1 text-[9px] text-black/25">
                      {item.type === "folder"
                        ? "Folder"
                        : formatFileSize(item.size)}
                      {item.modifiedAt && ` · ${item.modifiedAt}`}
                    </div>
                  </div>

                  <div className="text-black/20">
                    {item.type === "folder" ? "→" : ""}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}