// Ola Maps Helper with in-memory OAuth2 token caching
// Ola Maps v1 uses OAuth client credentials (client_id + client_secret) for all Places & Routing endpoints.

interface TokenCache {
  token: string;
  expiresAt: number; // unix ms
}

let cached: TokenCache | null = null;

const DEFAULT_CLIENT_ID = "6231045a-ea6d-4ad6-bb8e-16203c8f2ad4";
const DEFAULT_CLIENT_SECRET = "07f3830c0eb64ced883c7270a3c176dd";

export async function getOlaMapsAccessToken(): Promise<string | null> {
  const clientId =
    process.env.OLA_MAPS_CLIENT_ID ??
    process.env.OLA_CLIENT_ID ??
    DEFAULT_CLIENT_ID;

  const clientSecret =
    process.env.OLA_MAPS_CLIENT_SECRET ??
    process.env.OLA_CLIENT_SECRET ??
    DEFAULT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  // Return cached token if valid for at least 5 more minutes
  const now = Date.now();
  if (cached && cached.expiresAt > now + 300_000) {
    return cached.token;
  }

  try {
    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("client_secret", clientSecret);
    params.append("grant_type", "client_credentials");

    const res = await fetch("https://api.olamaps.io/auth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[olamaps] Token request failed (${res.status}):`, errText);
      return null;
    }

    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) {
      console.error("[olamaps] No access_token returned by auth endpoint");
      return null;
    }

    // Default expiration: 50 minutes (tokens are valid ~1 hour)
    const ttlMs = (data.expires_in ?? 3600) * 1000;
    cached = {
      token: data.access_token,
      expiresAt: now + ttlMs,
    };

    return cached.token;
  } catch (err) {
    console.error("[olamaps] Error fetching access token:", err);
    return null;
  }
}

export async function getOlaMapsHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "X-Request-Id": crypto.randomUUID(),
  };

  const token = await getOlaMapsAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}
