import {
  LibraryFolder,
  LibraryItem,
  normalisePath,
  StorageProvider,
} from "@/lib/library";

type GraphDriveItem = {
  id: string;
  name: string;
  size?: number;
  folder?: Record<string, unknown>;
  file?: {
    mimeType?: string;
  };
  lastModifiedDateTime?: string;
  parentReference?: {
    path?: string;
  };
};

export class GraphStorageProvider implements StorageProvider {
  private accessToken: string;
  private rootPrefix: string;

  constructor(accessToken: string, rootPrefix = "ArchtechCRM") {
    this.accessToken = accessToken;
    this.rootPrefix = rootPrefix.replace(/^\/+|\/+$/g, "");
  }

  private getGraphEndpoint(path: string): string {
    const normalised = normalisePath(path);
    // Remove "library" or "library/" prefix to get relative subpath
    const relative = normalised
      .replace(/^library\/?/, "")
      .replace(/^\/+|\/+$/g, "");

    const fullPath = relative
      ? `${this.rootPrefix}/${relative}`
      : this.rootPrefix;

    return `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(fullPath)}:/children`;
  }

  async listItems(path: string): Promise<LibraryItem[]> {
    const endpoint = this.getGraphEndpoint(path);

    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        // If the ArchtechCRM folder doesn't exist yet, return empty list or handle gracefully
        return [];
      }
      const errorText = await response.text();
      throw new Error(
        `Microsoft Graph list failed (${response.status}): ${errorText}`,
      );
    }

    const data = (await response.json()) as { value?: GraphDriveItem[] };
    const items = data.value || [];
    const normalisedPath = normalisePath(path);

    return items.map((item) => {
      const isFolder = Boolean(item.folder);
      const itemPath =
        normalisedPath === "library"
          ? `library/${item.name}`
          : `${normalisedPath}/${item.name}`;

      return {
        id: item.id,
        name: item.name,
        path: itemPath,
        type: isFolder ? "folder" : "file",
        size: item.size ?? null,
        mimeType: item.file?.mimeType ?? null,
        modifiedAt: item.lastModifiedDateTime
          ? item.lastModifiedDateTime.slice(0, 10)
          : null,
        parentPath: normalisedPath,
      };
    });
  }

  async createFolder(path: string, name: string): Promise<LibraryFolder> {
    const endpoint = this.getGraphEndpoint(path);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name.trim(),
        folder: {},
        "@microsoft.graph.conflictBehavior": "rename",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Microsoft Graph create folder failed (${response.status}): ${errorText}`,
      );
    }

    const created = (await response.json()) as GraphDriveItem;
    const normalisedPath = normalisePath(path);
    const itemPath =
      normalisedPath === "library"
        ? `library/${created.name}`
        : `${normalisedPath}/${created.name}`;

    return {
      name: created.name,
      path: itemPath,
    };
  }
}