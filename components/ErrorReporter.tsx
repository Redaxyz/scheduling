"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/reportClientError";

// Catches what slips past React's error boundaries (app/error.tsx): errors in
// event handlers, timers and promises nobody awaited.
export default function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportClientError(e.error ?? e.message);
    const onRejection = (e: PromiseRejectionEvent) => reportClientError(e.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
