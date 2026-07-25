import {
  createSchedule,
  fiveYearsFromNow,
  getJobResultHtml,
  getScheduleRuns,
  listScheduleIds,
  setScheduleState,
} from "@/lib/oxylabs/scheduler";
import { logEvent, processSourceHomepage, type SourceScrapeResult } from "@/lib/pipeline/scrape";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type ScheduleRow = Database["public"]["Tables"]["oxylabs_schedules"]["Row"];

const CRON_EXPRESSION = "0 * * * *";

export interface ScheduleSyncSummary {
  sourcesChecked: number;
  created: number;
  deactivatedOrphans: number;
  deactivatedForInactiveSources: number;
  errors: Array<{ sourceId: string; message: string }>;
}

export async function syncOxylabsSchedules(): Promise<ScheduleSyncSummary> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");
  const supabase = createServerClient();

  await logEvent(supabase, "info", "Oxylabs schedule sync started");

  const [{ data: activeSources, error: sourcesError }, { data: existingSchedules, error: schedulesError }] = await Promise.all([
    supabase.from("sources").select("*").eq("active", true),
    supabase.from("oxylabs_schedules").select("*"),
  ]);
  if (sourcesError) throw new Error(sourcesError.message);
  if (schedulesError) throw new Error(schedulesError.message);

  const summary: ScheduleSyncSummary = {
    sourcesChecked: (activeSources ?? []).length,
    created: 0,
    deactivatedOrphans: 0,
    deactivatedForInactiveSources: 0,
    errors: [],
  };

  const schedulesBySourceId = new Map<string, ScheduleRow>();
  for (const row of existingSchedules ?? []) {
    const sourceId = row.source_ids[0];
    if (sourceId) schedulesBySourceId.set(sourceId, row);
  }
  const activeSourceIds = new Set((activeSources ?? []).map((source) => source.id));

  for (const row of existingSchedules ?? []) {
    const sourceId = row.source_ids[0];
    if (!row.active || !sourceId || activeSourceIds.has(sourceId)) continue;

    try {
      if (row.external_schedule_id) await setScheduleState(row.external_schedule_id, false);
      const { error } = await supabase.from("oxylabs_schedules").update({ active: false }).eq("id", row.id);
      if (error) throw new Error(error.message);
      summary.deactivatedForInactiveSources += 1;
      await logEvent(supabase, "info", `Deactivated schedule for inactive source ${sourceId}`, { sourceId, scheduleId: row.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.errors.push({ sourceId, message });
      await logEvent(supabase, "error", `Failed to deactivate schedule for inactive source ${sourceId}`, { sourceId, error: message });
    }
  }

  for (const source of activeSources ?? []) {
    const existing = schedulesBySourceId.get(source.id);
    if (existing?.active) continue;

    try {
      const externalScheduleId = await createSchedule(
        CRON_EXPRESSION,
        [{ source: "universal", url: source.listing_url, render: "html" }],
        fiveYearsFromNow(),
      );

      if (existing) {
        const { error } = await supabase
          .from("oxylabs_schedules")
          .update({ active: true, external_schedule_id: externalScheduleId, cron_expression: CRON_EXPRESSION })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("oxylabs_schedules").insert({
          name: `biasly-${source.id}`,
          source_ids: [source.id],
          cron_expression: CRON_EXPRESSION,
          active: true,
          external_schedule_id: externalScheduleId,
        });
        if (error) throw new Error(error.message);
      }

      summary.created += 1;
      await logEvent(supabase, "info", `Created Oxylabs schedule for source ${source.id}`, { sourceId: source.id, externalScheduleId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.errors.push({ sourceId: source.id, message });
      await logEvent(supabase, "error", `Failed to create schedule for source ${source.id}`, { sourceId: source.id, error: message });
    }
  }

  try {
    const allOxylabsIds = await listScheduleIds();
    const { data: activeDbSchedules } = await supabase
      .from("oxylabs_schedules")
      .select("external_schedule_id")
      .eq("active", true);
    const activeDbIds = new Set(
      (activeDbSchedules ?? []).map((row) => row.external_schedule_id).filter((id): id is string => Boolean(id)),
    );

    for (const oxylabsId of allOxylabsIds) {
      if (activeDbIds.has(oxylabsId)) continue;
      try {
        await setScheduleState(oxylabsId, false);
        summary.deactivatedOrphans += 1;
        await logEvent(supabase, "info", `Deactivated orphaned Oxylabs schedule ${oxylabsId}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await logEvent(supabase, "error", `Failed to deactivate orphaned schedule ${oxylabsId}`, { error: message });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logEvent(supabase, "error", "Failed to list Oxylabs schedules for orphan cleanup", { error: message });
  }

  await logEvent(supabase, "info", "Oxylabs schedule sync completed", { ...summary });
  return summary;
}

export interface ScheduledProcessSummary {
  status: "completed";
  schedulesChecked: number;
  jobsProcessed: number;
  candidatesFound: number;
  duplicatesSkipped: number;
  articlesInserted: number;
  articlesRejected: number;
  articlesFailed: number;
  durationMs: number;
}

export async function processScheduledResults(): Promise<ScheduledProcessSummary> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");
  const supabase = createServerClient();
  const startedAt = Date.now();

  await logEvent(supabase, "info", "Scheduled results processing started");

  const { data: activeSchedules, error: schedulesError } = await supabase
    .from("oxylabs_schedules")
    .select("*")
    .eq("active", true);
  if (schedulesError) throw new Error(schedulesError.message);

  const scheduleRows = activeSchedules ?? [];
  const sourceIds = scheduleRows.flatMap((row) => row.source_ids);
  const { data: sources, error: sourcesError } = sourceIds.length
    ? await supabase.from("sources").select("*").in("id", sourceIds)
    : { data: [], error: null };
  if (sourcesError) throw new Error(sourcesError.message);
  const sourceById = new Map((sources ?? []).map((source) => [source.id, source]));

  const results: SourceScrapeResult[] = [];
  let jobsProcessed = 0;

  for (const scheduleRow of scheduleRows) {
    const sourceId = scheduleRow.source_ids[0];
    const source = sourceId ? sourceById.get(sourceId) : undefined;
    if (!scheduleRow.external_schedule_id || !source) continue;

    let runs;
    try {
      runs = await getScheduleRuns(scheduleRow.external_schedule_id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await logEvent(supabase, "error", `Failed to fetch runs for schedule ${scheduleRow.id}`, { scheduleId: scheduleRow.id, error: message });
      continue;
    }

    const doneJobs = runs.flatMap((run) => run.jobs).filter((job) => job.resultStatus === "done" && job.id);
    if (!doneJobs.length) continue;

    const jobIds = doneJobs.map((job) => job.id);
    const { data: processedRuns } = await supabase
      .from("oxylabs_schedule_runs")
      .select("external_run_id")
      .eq("schedule_id", scheduleRow.id)
      .in("external_run_id", jobIds);
    const processedJobIds = new Set((processedRuns ?? []).map((row) => row.external_run_id));

    for (const job of doneJobs) {
      if (processedJobIds.has(job.id)) continue;

      try {
        const html = await getJobResultHtml(job.id);
        const result = await processSourceHomepage(source, html, supabase);
        results.push(result);
        jobsProcessed += 1;

        const { error } = await supabase.from("oxylabs_schedule_runs").insert({
          schedule_id: scheduleRow.id,
          external_run_id: job.id,
          status: "done",
          started_at: job.createdAt,
          finished_at: job.resultCreatedAt,
          error_message: null,
        });
        if (error) throw new Error(error.message);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await logEvent(supabase, "error", `Failed to process job ${job.id} for schedule ${scheduleRow.id}`, {
          scheduleId: scheduleRow.id,
          jobId: job.id,
          error: message,
        });

        await supabase.from("oxylabs_schedule_runs").insert({
          schedule_id: scheduleRow.id,
          external_run_id: job.id,
          status: "failed",
          started_at: job.createdAt,
          finished_at: null,
          error_message: message,
        });
      }
    }
  }

  const summary: ScheduledProcessSummary = {
    status: "completed",
    schedulesChecked: scheduleRows.length,
    jobsProcessed,
    candidatesFound: results.reduce((sum, result) => sum + result.discovered, 0),
    duplicatesSkipped: results.reduce((sum, result) => sum + result.skipped, 0),
    articlesInserted: results.reduce((sum, result) => sum + result.inserted, 0),
    articlesRejected: results.reduce((sum, result) => sum + result.rejected, 0),
    articlesFailed: results.reduce((sum, result) => sum + result.errors.length, 0),
    durationMs: Date.now() - startedAt,
  };

  await logEvent(supabase, "info", "Scheduled results processing completed", { ...summary });
  return summary;
}
