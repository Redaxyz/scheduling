// Browser side of error reporting (see lib/errorReport.ts): sends an error
// to /api/errors, once per page load for any given message.
const sent = new Set<string>();

export function reportClientError(error: unknown) {
  const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : JSON.stringify(error));
  if (!err.message || sent.has(err.message)) return;
  sent.add(err.message);
  fetch("/api/errors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: err.message, stack: err.stack, path: window.location.pathname }),
    keepalive: true,
  }).catch(() => {});
}
