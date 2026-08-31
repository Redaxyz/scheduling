"use client";

import { useWhoAmI } from "@/lib/whoami";
import UserPicker from "@/components/UserPicker";

export default function AppGate() {
  const { ready, currentId } = useWhoAmI();

  if (!ready || currentId) return null;

  return <UserPicker />;
}
