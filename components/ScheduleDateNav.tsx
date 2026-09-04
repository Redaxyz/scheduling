"use client";

import { useRouter } from "next/navigation";

export default function ScheduleDateNav({ date }: { date: string }) {
  const router = useRouter();

  return (
    <input
      type="date"
      value={date}
      onChange={(e) => {
        if (e.target.value) router.push(`/schedule/${e.target.value}`);
      }}
      className="accent-border rounded-full border-2 bg-transparent px-4 py-1.5 text-sm font-bold outline-none"
    />
  );
}
