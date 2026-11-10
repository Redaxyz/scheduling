import type { Instrumentation } from "next";

// Server-side errors (a page or API route throwing) go to the same place as
// the browser's: see lib/errorReport.ts. The import has to sit inside this
// check, not after an early return, for Next to leave it out of the edge
// build, where its Node-only dependencies can't load.
export const onRequestError: Instrumentation.onRequestError = async (error, request) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { reportError } = await import("./lib/errorReport");
    const err = error instanceof Error ? error : new Error(String(error));
    await reportError({ source: "server", message: err.message, stack: err.stack, path: request.path });
  }
};
