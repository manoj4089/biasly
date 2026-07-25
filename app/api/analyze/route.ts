import { NextResponse } from "next/server";
import { analyzePendingArticles } from "@/lib/pipeline/analyze";
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
  const limit = typeof body?.limit === "number" && body.limit > 0 ? body.limit : undefined;
  const articleIds = Array.isArray(body?.articleIds)
    ? body.articleIds.filter((id: unknown): id is string => typeof id === "string")
    : undefined;

  try {
    const summary = await analyzePendingArticles({ limit, articleIds });

    const posthog = getPostHogClient();
    if (posthog) {
      posthog.capture({
        distinctId: "system",
        event: "analysis_completed",
        properties: {
          articles_analyzed: summary.analyzed,
          articles_skipped: summary.skipped,
          articles_failed: summary.failed,
          embeddings_backfilled: summary.embeddingsBackfilled,
          duration_ms: summary.durationMs,
        },
      });
      await posthog.flush();
    }

    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
