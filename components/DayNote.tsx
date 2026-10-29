"use client";

import { useEffect, useState } from "react";
import { useWhoAmI } from "@/lib/whoami";

export type DayNoteData = { text: string; updatedByName: string | null };

// The free-text note under the date on Home — one per day, anyone can add
// or edit it, everyone sees it. `textClass` is the title's color (dark over
// Bethesda's white, light over Germantown's black on a phone).
export default function DayNote({ date, initial, textClass }: { date: string; initial: DayNoteData; textClass: string }) {
  const { current } = useWhoAmI();
  const [note, setNote] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial.text);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pick up someone else's edit on the page's periodic refresh, unless
  // you're in the middle of writing your own.
  useEffect(() => {
    if (!editing) setNote(initial);
  }, [initial.text, initial.updatedByName]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/day-notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, text: draft, updatedByName: current?.name ?? null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save the note");
      setNote({ text: data.text, updatedByName: data.updatedByName });
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the note");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="mt-2 w-full max-w-md space-y-1.5">
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="A note for everyone today…"
          className="w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none"
        />
        {error && <p className="text-xs font-bold text-red-500">{error}</p>}
        <div className="flex gap-2 text-xs font-bold">
          <button type="button" onClick={save} disabled={saving} className="rounded-full bg-slate-900 px-4 py-1 text-white disabled:opacity-40">
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setError(null);
            }}
            className={`rounded-full px-3 py-1 opacity-70 hover:opacity-100 ${textClass}`}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const startEditing = () => {
    setDraft(note.text);
    setEditing(true);
  };

  return note.text ? (
    <button type="button" onClick={startEditing} title="Tap to edit" className={`mt-2 block max-w-md text-left ${textClass}`}>
      <span className="whitespace-pre-wrap text-sm font-medium">{note.text}</span>
      {note.updatedByName && <span className="ml-1.5 text-xs font-bold opacity-50">— {note.updatedByName}</span>}
    </button>
  ) : (
    <button type="button" onClick={startEditing} className={`mt-1 text-xs font-bold opacity-50 hover:opacity-100 ${textClass}`}>
      + Add a note for today
    </button>
  );
}
