"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useWhoAmI } from "./whoami";

const STORAGE_KEY = "cfa-modern-theme";

type ThemeModeCtx = {
  // Modern is now the shipped look for everyone, so this defaults to true
  // for every browser — it only reads false if a device explicitly stored
  // "0" (i.e. someone flipped the hidden toggle off on that device).
  modernEnabled: boolean;
  setModernEnabled: (v: boolean) => void;
  // The hidden toggle itself is only ever shown to Reda, as a personal
  // escape hatch back to the classic look — it no longer gates who gets
  // the modern theme, just who can see the switch.
  modernAvailable: boolean;
  active: boolean;
};

const Ctx = createContext<ThemeModeCtx | null>(null);

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const { current } = useWhoAmI();
  const [modernEnabled, setModernEnabledState] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "0") setModernEnabledState(false);
  }, []);

  const modernAvailable = current?.name === "Reda";
  const active = modernEnabled;

  useEffect(() => {
    document.body.setAttribute("data-modern", active ? "true" : "false");
  }, [active]);

  function setModernEnabled(v: boolean) {
    setModernEnabledState(v);
    window.localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
  }

  return <Ctx.Provider value={{ modernEnabled, setModernEnabled, modernAvailable, active }}>{children}</Ctx.Provider>;
}

export function useThemeMode() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useThemeMode must be used within ThemeModeProvider");
  return ctx;
}
