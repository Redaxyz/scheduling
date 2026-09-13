"use client";

import { useWhoAmI } from "@/lib/whoami";
import UserPicker from "@/components/UserPicker";

export default function AppGate() {
  const { ready, current } = useWhoAmI();

  // Checks the resolved staff record, not the raw stored id — a stale id
  // left over from before a database reset (or someone else's old browser
  // profile) wouldn't match anyone in the current roster, and gating on the
  // raw id alone would wrongly keep the picker hidden forever in that case.
  if (!ready || current) return null;

  return <UserPicker />;
}
