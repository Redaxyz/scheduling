"use client";

import { useThemeMode } from "@/lib/theme";

// Reda-only A/B toggle between the classic look and the modern CAO-branded
// redesign — see globals.css's [data-modern="true"] rules for the actual
// restyling. Nobody else ever sees this control or the modern theme.
//
// Deliberately unlabeled and nearly invisible: just a dot in the corner that
// brightens on hover/focus. Reda knows it's there; nobody else needs to.
export default function ThemeModeToggle() {
  const { modernAvailable, modernEnabled, setModernEnabled } = useThemeMode();

  if (!modernAvailable) return null;

  return (
    <button
      type="button"
      onClick={() => setModernEnabled(!modernEnabled)}
      title={modernEnabled ? "Switch to classic look" : "Switch to modern look"}
      aria-label={modernEnabled ? "Switch to classic look" : "Switch to modern look"}
      className="fixed left-2 top-2 z-50 h-3 w-3 rounded-full opacity-20 transition hover:scale-125 hover:opacity-100 focus:opacity-100"
      style={{ background: modernEnabled ? "linear-gradient(135deg, #1878B4, #F5871F)" : "#94a3b8" }}
    />
  );
}
