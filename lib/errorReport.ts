import { createHash } from "node:crypto";
import { prisma } from "./prisma";
import { sendPush } from "./push";

// Turns errors from the live app into GitHub issues labeled `auto-bug`, which
// the hourly bug-fix agent works through, and pings Reda's phone about each
// new one. The repo is public, so a report carries only the error itself,
// the page path and the browser: never names or schedule details.
const REPO = "Redaxyz/scheduling";
const LABEL = "auto-bug";
const ALERT_STAFF = "Reda";

// Not bugs in the app: flaky phone connections, browser extensions, and
// cross-origin script errors that come with no detail at all.
const NOISE = [/ResizeObserver loop/, /^Script error\.?$/, /extension:\/\//, /^(Load failed|Failed to fetch)$/, /NetworkError/];

// The same error within this window (per server instance) isn't sent to
// GitHub again, and the phone gets at most a few pings an hour.
const REPEAT_MS = 10 * 60 * 1000;
const MAX_ALERTS_PER_HOUR = 5;
const recent = new Map<string, number>();
let alertTimes: number[] = [];

export type ErrorReport = {
  source: "browser" | "server";
  message: string;
  stack?: string;
  path?: string;
  userAgent?: string;
};

function fingerprint(r: ErrorReport): string {
  // Ids and numbers vary between occurrences of the same bug.
  const message = r.message.replace(/[0-9a-f]{8,}|\d+/gi, "#");
  const topFrame = (r.stack ?? "").split("\n").find((line) => line.trim().startsWith("at ")) ?? "";
  const frame = topFrame.replace(/:\d+:\d+\)?$/, "").replace(/\?[^)\s]*/, "");
  return createHash("sha1").update(`${r.source}|${message}|${frame}`).digest("hex").slice(0, 10);
}

async function github(path: string, init?: { method: string; body: unknown }) {
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    method: init?.method ?? "GET",
    body: init ? JSON.stringify(init.body) : undefined,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_ISSUES_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub ${init?.method ?? "GET"} ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function alertPhone(title: string, issueUrl: string) {
  const now = Date.now();
  alertTimes = alertTimes.filter((t) => now - t < 60 * 60 * 1000);
  if (alertTimes.length >= MAX_ALERTS_PER_HOUR) return;
  alertTimes.push(now);

  const staff = await prisma.staff.findFirst({ where: { name: ALERT_STAFF, active: true }, include: { pushSubscriptions: true } });
  for (const sub of staff?.pushSubscriptions ?? []) {
    await sendPush(sub, { title: "New bug in MOS Schedule", body: title, url: issueUrl }).catch((e) => console.error("Bug alert push failed", e));
  }
}

// Never throws: reporting an error must not cause another one.
export async function reportError(report: ErrorReport): Promise<void> {
  try {
    if (process.env.VERCEL_ENV !== "production") return;
    if (NOISE.some((re) => re.test(report.message))) return;
    if (!process.env.GITHUB_ISSUES_TOKEN) {
      console.error("Unreported app error (GITHUB_ISSUES_TOKEN isn't set)", report.message);
      return;
    }

    const fp = fingerprint(report);
    const now = Date.now();
    if (now - (recent.get(fp) ?? 0) < REPEAT_MS) return;
    recent.set(fp, now);

    const message = report.message.slice(0, 300);
    const details = [
      `**Where:** ${report.source}${report.path ? ` · \`${report.path.split("?")[0]}\`` : ""}`,
      report.userAgent ? `**Browser:** ${report.userAgent.slice(0, 200)}` : null,
      `**When:** ${new Date(now).toISOString()}`,
    ]
      .filter(Boolean)
      .join("\n");

    const open: { number: number; title: string; updated_at: string }[] = await github(`/issues?labels=${LABEL}&state=open&per_page=100`);
    const existing = open.find((issue) => issue.title.endsWith(`[${fp}]`));
    if (existing) {
      // Repeats just add a note, at most hourly, so the agent can see it's ongoing.
      if (now - Date.parse(existing.updated_at) > 60 * 60 * 1000) {
        await github(`/issues/${existing.number}/comments`, { method: "POST", body: { body: `Seen again.\n\n${details}` } });
      }
      return;
    }

    const title = `Bug: ${message.split("\n")[0].slice(0, 90)} [${fp}]`;
    const body = [
      details,
      "",
      "```",
      message,
      report.stack ? `\n${report.stack.slice(0, 3000)}` : "",
      "```",
      "",
      "_Filed automatically by the app. The hourly bug-fix agent picks these up._",
    ].join("\n");
    const issue: { html_url: string } = await github("/issues", { method: "POST", body: { title, body, labels: [LABEL] } });
    await alertPhone(message.split("\n")[0].slice(0, 140), issue.html_url);
  } catch (e) {
    console.error("Error reporting failed", e);
  }
}
