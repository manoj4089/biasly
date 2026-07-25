const OXYLABS_ENDPOINT = "https://realtime.oxylabs.io/v1/queries";

export interface OxylabsQuery {
  source?: string;
  url?: string;
  query?: string;
  parse?: boolean;
  render?: "html" | "png" | "";
  geo_location?: string;
  user_agent_type?: string;
  [key: string]: unknown;
}

export interface OxylabsResult {
  content: string;
  status_code: number;
  url: string;
}

export interface OxylabsResponse {
  results: OxylabsResult[];
}

export function isOxylabsConfigured() {
  return Boolean(process.env.OXY_WSA_USERNAME && process.env.OXY_WSA_PASSWORD);
}

export async function oxylabsQuery(payload: OxylabsQuery): Promise<OxylabsResponse> {
  const username = process.env.OXY_WSA_USERNAME;
  const password = process.env.OXY_WSA_PASSWORD;
  if (!username || !password) {
    throw new Error("Missing OXY_WSA_USERNAME or OXY_WSA_PASSWORD");
  }

  const auth = Buffer.from(`${username}:${password}`).toString("base64");
  const response = await fetch(OXYLABS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({ source: "universal", render: "html", ...payload }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Oxylabs request failed (${response.status}): ${text.slice(0, 500)}`);
  }

  return response.json();
}

export async function scrapePage(url: string, opts: Partial<OxylabsQuery> = {}): Promise<string> {
  const response = await oxylabsQuery({ url, ...opts });
  const [result] = response.results ?? [];
  if (!result) throw new Error(`No results returned for ${url}`);
  if (result.status_code >= 400) throw new Error(`Upstream status ${result.status_code} for ${url}`);
  return result.content;
}
