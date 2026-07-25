import { NextResponse } from "next/server";
import { scrapeActiveSources } from "@/lib/pipeline/scrape";
import { getPostHogClient } from "@/lib/posthog-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const expected = process.env["SKEW-admin-secret"];
  if (!expected) return false;
  return request.headers.get("x-skew-admin-secret") === expected;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const sourceIds = Array.isArray(body?.sourceIds)
    ? body.sourceIds.filter((id: unknown): id is string => typeof id === "string")
    : undefined;

  try {
    const results = await scrapeActiveSources(sourceIds);

    const posthog = getPostHogClient();
    if (posthog) {
      const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
      const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
      const totalRejected = results.reduce((sum, r) => sum + r.rejected, 0);
      posthog.capture({
        distinctId: "system",
        event: "scrape_completed",
        properties: {
          sources_checked: results.length,
          articles_inserted: totalInserted,
          articles_skipped: totalSkipped,
          articles_rejected: totalRejected,
        },
      });
      await posthog.flush();
    }

    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
