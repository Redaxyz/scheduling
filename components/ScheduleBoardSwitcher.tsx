"use client";

import type { DaySchedule, FreeStaffMember } from "@/lib/schedule";
import type { Half } from "@/lib/types";
import { useThemeMode } from "@/lib/theme";
import ScheduleBoard from "@/components/ScheduleBoard";
import ModernScheduleBoard from "@/components/ModernScheduleBoard";

// Picks classic vs. modern purely off the (Reda-only, toggleable) theme
// state — the page itself stays a plain server component that just fetches
// the schedule once and hands it to whichever board is active.
export default function ScheduleBoardSwitcher(props: { date: string; day: DaySchedule; freeStaff: Record<Half, FreeStaffMember[]> }) {
  const { active } = useThemeMode();
  return active ? <ModernScheduleBoard {...props} /> : <ScheduleBoard {...props} />;
}
