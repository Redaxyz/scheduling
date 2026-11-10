import { NextRequest, NextResponse, after } from "next/server";
import { reportError } from "@/lib/errorReport";

// Where the browser sends errors it hits (see lib/reportClientError.ts).
// Answers right away; the GitHub filing happens after the response.
const LIMIT = 20;
const WINDOW_MS = 10 * 60 * 1000;
const hits = new Map<string, number[]>();

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) return new NextResponse(null, { status: 429 });
  hits.set(ip, [...recent, now]);

  const body = await req.json().catch(() => null);
  const { message, stack, path } = body ?? {};
  if (typeof message !== "string" || !message.trim()) return NextResponse.json({ error: "Missing message" }, { status: 400 });

  after(() =>
    reportError({
      source: "browser",
      message: message.slice(0, 1000),
      stack: typeof stack === "string" ? stack.slice(0, 5000) : undefined,
      path: typeof path === "string" ? path.slice(0, 300) : undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
    })
  );
  return new NextResponse(null, { status: 204 });
}
