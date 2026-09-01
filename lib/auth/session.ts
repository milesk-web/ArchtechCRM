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

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const single = cookieStore.get(SESSION_COOKIE_PREFIX);

  let raw = "";
  if (single?.value) {
    raw = single.value;
  } else {
    const chunks: string[] = [];
    let i = 0;
    while (true) {
      const chunk = cookieStore.get(`${SESSION_COOKIE_PREFIX}.${i}`);
      if (!chunk?.value) break;
      chunks.push(chunk.value);
      i++;
    }
    if (chunks.length > 0) {
      raw = chunks.join("");
    }
  }

  if (!raw) return null;
  return decryptSession(raw);
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