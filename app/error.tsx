"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/reportClientError";

// Shown instead of a blank "Application error" page when a page crashes.
// Errors from the server side carry a digest and were already reported there
// (see instrumentation.ts).
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (!error.digest) reportClientError(error);
  }, [error]);

  return (
    <div className="accent-border-soft mx-auto mt-8 max-w-md rounded-2xl border-2 p-5 text-center">
      <p className="text-base font-extrabold">Something went wrong on this page.</p>
      <p className="mt-1 text-sm font-medium opacity-60">It&apos;s been reported automatically.</p>
      <button type="button" onClick={reset} className="accent-border mt-4 rounded-full border-2 px-4 py-1 text-sm font-bold transition active:scale-95">
        Try again
      </button>
    </div>
  );
}
