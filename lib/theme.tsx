"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useWhoAmI } from "./whoami";

const STORAGE_KEY = "cfa-modern-theme";

type ThemeModeCtx = {
  // Whether Reda has flipped the toggle on — persisted, but only ever acted
  // on while she's actually signed in (see `active` below), so switching to
  // anyone else always shows the classic look regardless of what's stored.
  modernEnabled: boolean;
  setModernEnabled: (v: boolean) => void;
  // The toggle itself is only ever shown to Reda — everyone else never sees
  // it and never gets the modern theme, no matter what's in localStorage.
  modernAvailable: boolean;
  active: boolean;
};

const Ctx = createContext<ThemeModeCtx | null>(null);

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const { current } = useWhoAmI();
  const [modernEnabled, setModernEnabledState] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "1") setModernEnabledState(true);
  }, []);

  const modernAvailable = current?.name === "Reda";
  const active = modernAvailable && modernEnabled;

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
