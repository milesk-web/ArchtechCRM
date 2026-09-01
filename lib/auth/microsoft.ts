import { SessionData, setSession } from "./session";

const DEFAULT_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "Files.ReadWrite",
].join(" ");

export function getMicrosoftConfig() {
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri =
    process.env.MICROSOFT_REDIRECT_URI ||
    "http://localhost:3000/api/auth/microsoft/callback";

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "Missing Microsoft OAuth environment variables (MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET)",
    );
  }

  return {
    tenantId,
    clientId,
    clientSecret,
    redirectUri,
  };
}

export function getAuthorizationUrl(state: string): string {
  const { tenantId, clientId, redirectUri } = getMicrosoftConfig();

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: DEFAULT_SCOPES,
    state,
    prompt: "select_account",
  });

  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
}

function parseJwt(token: string): Record<string, unknown> {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return {};
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: { id: string; name: string; email: string };
}> {
  const { tenantId, clientId, clientSecret, redirectUri } =
    getMicrosoftConfig();

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    scope: DEFAULT_SCOPES,
  });

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${errorText}`);
  }

  const json = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    id_token?: string;
    expires_in: number;
  };

  const idClaims = json.id_token ? parseJwt(json.id_token) : {};
  const accessClaims = json.access_token ? parseJwt(json.access_token) : {};

  const name =
    (idClaims.name as string) ||
    (accessClaims.name as string) ||
    "Microsoft User";
  const email =
    (idClaims.preferred_username as string) ||
    (idClaims.email as string) ||
    (accessClaims.upn as string) ||
    "";
  const id =
    (idClaims.oid as string) ||
    (idClaims.sub as string) ||
    (accessClaims.oid as string) ||
    "user";

  const expiresAt = Date.now() + (json.expires_in - 120) * 1000; // 2 min buffer

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token || "",
    expiresAt,
    user: { id, name, email },
  };
}

export async function refreshTokens(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}> {
  const { tenantId, clientId, clientSecret, redirectUri } =
    getMicrosoftConfig();

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    redirect_uri: redirectUri,
    scope: DEFAULT_SCOPES,
  });

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${errorText}`);
  }

  const json = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token || refreshToken,
    expiresAt: Date.now() + (json.expires_in - 120) * 1000,
  };
}

export async function getValidAccessToken(
  session: SessionData,
): Promise<{ accessToken: string; session: SessionData }> {
  // If token is still valid (with buffer), return it
  if (session.expiresAt > Date.now() && session.accessToken) {
    return { accessToken: session.accessToken, session };
  }

  // Token is expired, use refresh token
  if (!session.refreshToken) {
    throw new Error("Session expired and no refresh token available.");
  }

  const refreshed = await refreshTokens(session.refreshToken);
  const updatedSession: SessionData = {
    ...session,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    expiresAt: refreshed.expiresAt,
  };

  // Update session cookie
  await setSession(updatedSession);

  return { accessToken: refreshed.accessToken, session: updatedSession };
}