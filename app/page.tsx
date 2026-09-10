import { redirect } from "next/navigation";
import { todayStr } from "@/lib/date";

// No dynamic segment here, so without this Next.js prerenders the redirect
// once at build time and freezes whatever todayStr() was that day — this
// page must recompute "today" on every request instead.
export const dynamic = "force-dynamic";

export default function Home() {
  redirect(`/schedule/${todayStr()}`);
}
