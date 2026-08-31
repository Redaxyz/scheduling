"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type StaffOption = {
  id: string;
  name: string;
  kind: string;
  canScribe: boolean;
  color: string;
  homeOffice: string | null;
  dedicatedProviderId: string | null;
};

type WhoAmICtx = {
  staffList: StaffOption[];
  currentId: string | null;
  setCurrentId: (id: string | null) => void;
  current: StaffOption | null;
  ready: boolean;
};

const Ctx = createContext<WhoAmICtx | null>(null);

const STORAGE_KEY = "cfa-schedule-whoami";

export function WhoAmIProvider({ children }: { children: ReactNode }) {
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [currentId, setCurrentIdState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/staff")
      .then((r) => r.json())
      .then((data: StaffOption[]) => setStaffList(data));
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) setCurrentIdState(stored);
    setReady(true);
  }, []);

  const setCurrentId = (id: string | null) => {
    setCurrentIdState(id);
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  };

  const current = staffList.find((s) => s.id === currentId) ?? null;

  return <Ctx.Provider value={{ staffList, currentId, setCurrentId, current, ready }}>{children}</Ctx.Provider>;
}

export function useWhoAmI() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWhoAmI must be used within WhoAmIProvider");
  return ctx;
}
