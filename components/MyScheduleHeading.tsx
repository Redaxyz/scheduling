"use client";

import { useWhoAmI } from "@/lib/whoami";

// "X's schedule" instead of a plain "Me" — this is a client component
// specifically because it needs the signed-in name, which only resolves
// client-side (see lib/whoami).
export default function MyScheduleHeading() {
  const { current } = useWhoAmI();
  return <h1 className="text-lg font-extrabold tracking-tight">{current ? `${current.name}'s schedule` : "My schedule"}</h1>;
}
