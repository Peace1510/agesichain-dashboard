import { NextResponse } from "next/server";
import { getOlaMapsAccessToken, fetchOlaMaps } from "@/lib/olamaps";

export async function GET() {
  const OLA_KEY =
    process.env.OLA_MAPS_API_KEY ??
    process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY ??
    "";

  const keyPreview = OLA_KEY
    ? `${OLA_KEY.slice(0, 6)}...${OLA_KEY.slice(-4)} (len=${OLA_KEY.length})`
    : "NOT SET";

  let tokenObtained = false;
  let tokenPreview = "NONE";
  let olaResponse: unknown = null;
  let olaStatus: number | null = null;
  let olaError: string | null = null;

  try {
    const token = await getOlaMapsAccessToken();
    if (token) {
      tokenObtained = true;
      tokenPreview = `${token.slice(0, 10)}...${token.slice(-6)} (len=${token.length})`;
    }

    const res = await fetchOlaMaps("/places/v1/autocomplete", { input: "pune" });

    olaStatus = res.status;
    const text = await res.text();

    try {
      olaResponse = JSON.parse(text);
    } catch {
      olaResponse = text;
    }
  } catch (err) {
    olaError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    oauth_token_obtained: tokenObtained,
    oauth_token_preview: tokenPreview,
    key_preview: keyPreview,
    ola_http_status: olaStatus,
    ola_response: olaResponse,
    ola_fetch_error: olaError,
    node_env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
}
