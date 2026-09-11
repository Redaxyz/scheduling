"use client";

import type { MyScheduleRow } from "@/lib/schedule";
import { useThemeMode } from "@/lib/theme";
import FullHeightFrame from "@/components/FullHeightFrame";
import MyScheduleView from "@/components/MyScheduleView";
import ModernMyScheduleView from "@/components/ModernMyScheduleView";

// The modern view breaks out to full viewport width (see globals.css's full-
// bleed pattern), which FullHeightFrame's own overflow-hidden would clip if
// the break-out happened inside it — so here the full-bleed wrapper goes
// OUTSIDE the frame instead, and the frame (now naturally full width, since
// its parent is) just hands its exact height down like always.
export default function MyScheduleViewSwitcher({ rows }: { rows: MyScheduleRow[] }) {
  const { active } = useThemeMode();

  if (active) {
    return (
      <div className="relative left-1/2 w-screen -translate-x-1/2">
        <FullHeightFrame reserveBelow={52} heightScale={0.95}>
          <ModernMyScheduleView rows={rows} />
        </FullHeightFrame>
      </div>
    );
  }

  return (
    <FullHeightFrame className="pb-1" reserveBelow={52} heightScale={0.95}>
      <MyScheduleView rows={rows} />
    </FullHeightFrame>
  );
}
