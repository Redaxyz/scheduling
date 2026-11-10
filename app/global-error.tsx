"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/reportClientError";

// Last resort when the app's own layout crashes, so it has to bring its own
// <html> and <body> and can't rely on the app's styles.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (!error.digest) reportClientError(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#fafafa", color: "#334155", textAlign: "center", padding: "4rem 1.5rem" }}>
        <p style={{ fontWeight: 800 }}>Something went wrong.</p>
        <p style={{ opacity: 0.6, fontSize: 14 }}>It&apos;s been reported automatically.</p>
        <button type="button" onClick={reset} style={{ marginTop: 16, padding: "6px 16px", borderRadius: 9999, border: "2px solid #94a3b8", fontWeight: 700, background: "white" }}>
          Try again
        </button>
      </body>
    </html>
  );
}
