export type LibraryItem = {
  id: string;
  name: string;
  path: string;
  type: "folder" | "file";
  size?: number | null;
  mimeType?: string | null;
  modifiedAt?: string | null;
  parentPath?: string | null;
};

export type LibraryFolder = {
  name: string;
  path: string;
};

export const LIBRARY_ROOT = "library";

export function normalisePath(path: string): string {
  return path
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/+/g, "/");
}

export function getLibraryPath(...parts: string[]): string {
  return normalisePath([LIBRARY_ROOT, ...parts].join("/"));
}

export function getParentPath(path: string): string {
  const normalised = normalisePath(path);
  const parts = normalised.split("/");

  if (parts.length <= 1) {
    return "";
  }

  parts.pop();
  return parts.join("/");
}

export function getFileName(path: string): string {
  const normalised = normalisePath(path);
  return normalised.split("/").pop() ?? normalised;
}

export function getFileExtension(name: string): string {
  const dot = name.lastIndexOf(".");

  if (dot <= 0 || dot === name.length - 1) {
    return "";
  }

  return name.slice(dot + 1).toLowerCase();
}

export function isImageFile(name: string): boolean {
  return [
    "jpg",
    "jpeg",
    "png",
    "gif",
    "webp",
    "bmp",
    "tif",
    "tiff",
    "svg",
  ].includes(getFileExtension(name));
}

export function isPdfFile(name: string): boolean {
  return getFileExtension(name) === "pdf";
}

export function formatFileSize(bytes?: number | null): string {
  if (bytes == null || bytes < 0) {
    return "—";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Storage Provider Abstraction.
 *
 * Decouples the Library UI from the underlying storage mechanism.
 * createFolder is optional so the in-memory DefaultStorageProvider
 * still satisfies the interface without modification.
 */
export interface StorageProvider {
  listItems(path: string): Promise<LibraryItem[]>;
  createFolder?(path: string, name: string): Promise<LibraryFolder>;
}

/**
 * HTTP Storage Provider (client-side browser adapter).
 *
 * Delegates all read and write operations to the server-side
 * Next.js API route handlers (/api/library, /api/library/folder).
 * The browser never receives Microsoft access tokens — it only
 * receives plain LibraryItem domain objects from the API.
 */
class HttpStorageProvider implements StorageProvider {
  async listItems(path: string): Promise<LibraryItem[]> {
    const url = `/api/library?path=${encodeURIComponent(path)}`;
    const response = await fetch(url);

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
        code?: string;
      };
      if (response.status === 401) {
        // Return a sentinel value the UI can detect
        throw Object.assign(
          new Error(data.message || "Sign in with Microsoft to view files."),
          { code: "unauthenticated" },
        );
      }
      throw new Error(data.message || data.error || "Failed to load library items.");
    }

    const data = (await response.json()) as { items?: LibraryItem[] };
    return data.items ?? [];
  }

  async createFolder(path: string, name: string): Promise<LibraryFolder> {
    const response = await fetch("/api/library/folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, name }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      throw new Error(data.message || data.error || "Failed to create folder.");
    }

    const data = (await response.json()) as { folder?: LibraryFolder };
    if (!data.folder) throw new Error("Server returned no folder data.");
    return data.folder;
  }
}

/**
 * Default starter storage adapter.
 * Provides root-level structure so navigation is functional before
 * Microsoft authentication is configured.
 */
class DefaultStorageProvider implements StorageProvider {
  private items: LibraryItem[] = [
    {
      id: "folder-jobs",
      name: "Jobs",
      path: getLibraryPath("Jobs"),
      type: "folder",
      modifiedAt: "2026-09-01",
    },
    {
      id: "folder-company",
      name: "Company",
      path: getLibraryPath("Company"),
      type: "folder",
      modifiedAt: "2026-09-01",
    },
  ];

  async listItems(path: string): Promise<LibraryItem[]> {
    const normalised = normalisePath(path);
    return this.items.filter((item) => {
      const parent = getParentPath(item.path);
      return parent === normalised;
    });
  }
}

/**
 * Active provider singleton.
 *
 * In the browser we always use HttpStorageProvider so that
 * the UI routes through secure server-side API handlers.
 * On the server (in API routes) a GraphStorageProvider is
 * instantiated directly per-request with the user's access token.
 */
const isBrowser = typeof window !== "undefined";
let activeStorageProvider: StorageProvider = isBrowser
  ? new HttpStorageProvider()
  : new DefaultStorageProvider();

export function setStorageProvider(provider: StorageProvider): void {
  activeStorageProvider = provider;
}

export async function listLibraryItems(
  path = LIBRARY_ROOT,
): Promise<LibraryItem[]> {
  return activeStorageProvider.listItems(path);
}

export async function createLibraryFolder(
  path: string,
  name: string,
): Promise<LibraryFolder> {
  if (!activeStorageProvider.createFolder) {
    throw new Error("Current storage provider does not support folder creation.");
  }
  return activeStorageProvider.createFolder(path, name);
}

export async function listLibraryFolders(
  path = LIBRARY_ROOT,
): Promise<LibraryFolder[]> {
  const items = await listLibraryItems(path);

  return items
    .filter((item) => item.type === "folder")
    .map((item) => ({
      name: item.name,
      path: item.path,
    }));
}