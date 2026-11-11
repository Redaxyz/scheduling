"use client";

import { useState, type ReactNode } from "react";
import { useWhoAmI } from "@/lib/whoami";
import MyTemplateEditor from "@/components/MyTemplateEditor";

// The Me tab's header row (the heading on the left; the week arrows, where
// a page shows them, and Edit on the right) over the week itself. Edit swaps
// the week for the weekly-template editor in the same spot, so there's
// nothing to scroll down to; Done swaps it back.
export default function MyScheduleShell({ heading, nav, children }: { heading: ReactNode; nav?: ReactNode; children: ReactNode }) {
  const { current } = useWhoAmI();
  const [editing, setEditing] = useState(false);
  const [unsaved, setUnsaved] = useState(0);

  function toggle() {
    if (editing && unsaved > 0 && !window.confirm(`Discard ${unsaved} unsaved change${unsaved === 1 ? "" : "s"}?`)) return;
    setUnsaved(0);
    setEditing((e) => !e);
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">{heading}</div>
        <div className="flex shrink-0 items-center gap-2">
          {!editing && nav}
          {current && (
            // Same slanted outline as the app's other controls; lit with
            // the active tint while the editor is open.
            <button
              type="button"
              onClick={toggle}
              aria-pressed={editing}
              title={editing ? "Back to my week" : "Edit my weekly template"}
              className="skew-btn accent-border border-2 px-3 py-1 text-xs font-bold transition active:scale-95 lg:text-sm"
              style={editing ? { background: "color-mix(in srgb, var(--theme-accent) 30%, var(--page-bg))" } : undefined}
            >
              <span className="skew-label">{editing ? "Done" : "Edit"}</span>
            </button>
          )}
        </div>
      </div>
      {editing ? <MyTemplateEditor onDirtyChange={setUnsaved} /> : children}
    </>
  );
}
