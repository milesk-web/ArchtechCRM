import { cookies } from "next/headers";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
};

export type SessionData = {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

const SESSION_COOKIE_PREFIX = "archtech_session";
const CHUNK_SIZE = 3800;

async function getEncryptionKey(): Promise<CryptoKey> {
  const secret =
    process.env.AUTH_SECRET ||
    "archtech-crm-dev-fallback-secret-minimum-32-chars!";
  const keyBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  return crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptSession(data: SessionData): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    payload,
  );

  const b64Iv = Buffer.from(iv).toString("base64url");
  const b64Cipher = Buffer.from(encrypted).toString("base64url");
  return `${b64Iv}.${b64Cipher}`;
}

export async function decryptSession(
  encryptedToken: string,
): Promise<SessionData | null> {
  try {
    const parts = encryptedToken.split(".");
    if (parts.length !== 2) return null;

    const [b64Iv, b64Cipher] = parts;
    const iv = Buffer.from(b64Iv, "base64url");
    const cipher = Buffer.from(b64Cipher, "base64url");

    const key = await getEncryptionKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      cipher,
    );

    const json = new TextDecoder().decode(decrypted);
    return JSON.parse(json) as SessionData;
  } catch {
    return null;
  }
}

export async function getSession(
  requestOrCookieHeader?: Request | string | null,
): Promise<SessionData | null> {
  try {
    const cookieStore = await cookies();
    const single = cookieStore.get(SESSION_COOKIE_PREFIX);

    if (single?.value) {
      const decrypted = await decryptSession(single.value);
      if (decrypted) return decrypted;
    }

    const chunks: string[] = [];
    let i = 0;
    while (true) {
      const chunk = cookieStore.get(`${SESSION_COOKIE_PREFIX}.${i}`);
      if (!chunk?.value) break;
      chunks.push(chunk.value);
      i++;
    }
    if (chunks.length > 0) {
      const decrypted = await decryptSession(chunks.join(""));
      if (decrypted) return decrypted;
    }
  } catch {
    // ignore cookies() store failure if outside context
  }

  if (requestOrCookieHeader) {
    const header =
      typeof requestOrCookieHeader === "string"
        ? requestOrCookieHeader
        : requestOrCookieHeader.headers?.get("cookie") ?? "";

    if (header) {
      const cookieMap: Record<string, string> = {};
      header.split(";").forEach((part) => {
        const eqIdx = part.indexOf("=");
        if (eqIdx !== -1) {
          const key = part.slice(0, eqIdx).trim();
          const val = part.slice(eqIdx + 1).trim();
          try {
            cookieMap[key] = decodeURIComponent(val);
          } catch {
            cookieMap[key] = val;
          }
        }
      });

      if (cookieMap[SESSION_COOKIE_PREFIX]) {
        const decrypted = await decryptSession(cookieMap[SESSION_COOKIE_PREFIX]);
        if (decrypted) return decrypted;
      }

      const chunks: string[] = [];
      let i = 0;
      while (cookieMap[`${SESSION_COOKIE_PREFIX}.${i}`]) {
        chunks.push(cookieMap[`${SESSION_COOKIE_PREFIX}.${i}`]);
        i++;
      }
      if (chunks.length > 0) {
        const decrypted = await decryptSession(chunks.join(""));
        if (decrypted) return decrypted;
      }
    }
  }

  return null;
}

export async function setSession(data: SessionData): Promise<void> {
  const cookieStore = await cookies();
  const encrypted = await encryptSession(data);

  await clearSession();

  const isProduction = process.env.NODE_ENV === "production";
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  };

  if (encrypted.length <= CHUNK_SIZE) {
    cookieStore.set(SESSION_COOKIE_PREFIX, encrypted, cookieOptions);
  } else {
    let index = 0;
    for (let i = 0; i < encrypted.length; i += CHUNK_SIZE) {
      const chunk = encrypted.slice(i, i + CHUNK_SIZE);
      cookieStore.set(
        `${SESSION_COOKIE_PREFIX}.${index}`,
        chunk,
        cookieOptions,
      );
      index++;
    }
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_PREFIX);

  for (let i = 0; i < 10; i++) {
    const chunkName = `${SESSION_COOKIE_PREFIX}.${i}`;
    if (cookieStore.has(chunkName)) {
      cookieStore.delete(chunkName);
    }
  }
}