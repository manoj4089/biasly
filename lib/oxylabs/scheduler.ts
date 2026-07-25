const SCHEDULES_BASE = "https://data.oxylabs.io/v1/schedules";
const QUERIES_BASE = "https://data.oxylabs.io/v1/queries";

function authHeader(): string {
  const username = process.env.OXY_WSA_USERNAME;
  const password = process.env.OXY_WSA_PASSWORD;
  if (!username || !password) throw new Error("Missing OXY_WSA_USERNAME or OXY_WSA_PASSWORD");
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

async function request(url: string, init: RequestInit = {}): Promise<string> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: authHeader(), ...init.headers },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Oxylabs Scheduler request failed (${response.status}) for ${url}: ${text.slice(0, 500)}`);
  }
  return text;
}

/** Extracts an integer field's raw digit sequence from JSON text without JSON.parse, to avoid precision loss on 64-bit ids. */
function extractRawIntField(rawText: string, field: string): string | null {
  const match = rawText.match(new RegExp(`"${field}"\\s*:\\s*(\\d+)`));
  return match ? match[1] : null;
}

function extractRawIntArrayField(rawText: string, field: string): string[] {
  const arrayMatch = rawText.match(new RegExp(`"${field}"\\s*:\\s*\\[([^\\]]*)\\]`));
  if (!arrayMatch) return [];
  return [...arrayMatch[1].matchAll(/\d+/g)].map((m) => m[0]);
}

function formatEndTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export function fiveYearsFromNow(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 5);
  return formatEndTime(date);
}

export interface ScheduleItem {
  source: string;
  url: string;
  render?: "html" | "png" | "";
  [key: string]: unknown;
}

export async function createSchedule(cron: string, items: ScheduleItem[], endTime: string): Promise<string> {
  const rawText = await request(SCHEDULES_BASE, {
    method: "POST",
    body: JSON.stringify({ cron, items, end_time: endTime }),
  });
  const scheduleId = extractRawIntField(rawText, "schedule_id");
  if (!scheduleId) throw new Error(`Oxylabs schedule creation response missing schedule_id: ${rawText.slice(0, 300)}`);
  return scheduleId;
}

export async function listScheduleIds(): Promise<string[]> {
  const rawText = await request(SCHEDULES_BASE);
  return extractRawIntArrayField(rawText, "schedules");
}

export async function setScheduleState(scheduleId: string, active: boolean): Promise<void> {
  await request(`${SCHEDULES_BASE}/${scheduleId}/state`, {
    method: "PUT",
    body: JSON.stringify({ active }),
  });
}

export interface ScheduleRunJob {
  id: string;
  resultStatus: "done" | "failed" | "pending" | string;
  createdAt: string | null;
  resultCreatedAt: string | null;
}

export interface ScheduleRun {
  runId: string;
  jobs: ScheduleRunJob[];
}

function parseJobsBlock(jobsBlockText: string): ScheduleRunJob[] {
  const jobObjectTexts = jobsBlockText.match(/\{[^{}]*\}/g) ?? [];
  return jobObjectTexts.map((jobText) => {
    const id = extractRawIntField(jobText, "id") ?? "";
    const resultStatus = jobText.match(/"result_status"\s*:\s*"([^"]*)"/)?.[1] ?? "";
    const createdAt = jobText.match(/"created_at"\s*:\s*"([^"]*)"/)?.[1] ?? null;
    const resultCreatedAt = jobText.match(/"result_created_at"\s*:\s*"([^"]*)"/)?.[1] ?? null;
    return { id, resultStatus, createdAt, resultCreatedAt };
  });
}

export async function getScheduleRuns(scheduleId: string): Promise<ScheduleRun[]> {
  const rawText = await request(`${SCHEDULES_BASE}/${scheduleId}/runs`);
  const runObjectTexts = rawText.match(/\{\s*"run_id"[\s\S]*?"success_rate"\s*:\s*[\d.]+\s*\}/g) ?? [];
  return runObjectTexts.map((runText) => {
    const runId = extractRawIntField(runText, "run_id") ?? "";
    const jobsMatch = runText.match(/"jobs"\s*:\s*\[([\s\S]*)\]\s*,\s*"success_rate"/);
    const jobs = jobsMatch ? parseJobsBlock(jobsMatch[1]) : [];
    return { runId, jobs };
  });
}

export async function getJobResultHtml(jobId: string): Promise<string> {
  const response = await fetch(`${QUERIES_BASE}/${jobId}/results`, {
    headers: { Authorization: authHeader() },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Oxylabs job result fetch failed (${response.status}) for job ${jobId}: ${text.slice(0, 500)}`);
  }
  const data = JSON.parse(text) as { results?: Array<{ content: string; status_code: number }> };
  const [result] = data.results ?? [];
  if (!result) throw new Error(`No results returned for job ${jobId}`);
  if (result.status_code >= 400) throw new Error(`Upstream status ${result.status_code} for job ${jobId}`);
  return result.content;
}
