import { NextResponse } from "next/server";
import { analyzePendingArticles } from "@/lib/pipeline/analyze";
import { processScheduledResults } from "@/lib/pipeline/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  if (process.env.NODE_ENV === "development") return true;

  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let processResult: { status: "completed" | "failed"; summary?: unknown; error?: string };
  try {
    const summary = await processScheduledResults();
    processResult = { status: "completed", summary };
    console.log("[cron/pipeline] scheduled results processed", summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    processResult = { status: "failed", error: message };
    console.error("[cron/pipeline] scheduled results processing failed", message);
  }

  let analyzeResult: { status: "completed" | "failed"; summary?: unknown; error?: string };
  try {
    const summary = await analyzePendingArticles();
    analyzeResult = { status: "completed", summary };
    console.log("[cron/pipeline] analysis completed", summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    analyzeResult = { status: "failed", error: message };
    console.error("[cron/pipeline] analysis failed", message);
  }

  return NextResponse.json({ process: processResult, analyze: analyzeResult });
}
