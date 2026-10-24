import { NextResponse } from "next/server";

export async function GET() {
  const OLA_KEY =
    process.env.OLA_MAPS_API_KEY ??
    process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY ??
    "";

  const keyPreview = OLA_KEY
    ? `${OLA_KEY.slice(0, 6)}...${OLA_KEY.slice(-4)} (len=${OLA_KEY.length})`
    : "NOT SET";

  let olaResponse: unknown = null;
  let olaStatus: number | null = null;
  let olaError: string | null = null;

  try {
    const url = new URL("https://api.olamaps.io/places/v1/autocomplete");
    url.searchParams.set("input", "pune");
    url.searchParams.set("api_key", OLA_KEY);

    const res = await fetch(url.toString(), {
      headers: {
        "X-Request-Id": "debug-test-001",
        "Origin": "https://ageischain.kirmadaa.tech",
        "Referer": "https://ageischain.kirmadaa.tech/",
      },
    });

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
    key_preview: keyPreview,
    ola_http_status: olaStatus,
    ola_response: olaResponse,
    ola_fetch_error: olaError,
    node_env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
}
