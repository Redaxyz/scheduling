"use client";

import { useState } from "react";
import { useWhoAmI } from "@/lib/whoami";

function keyToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "="));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// Reda-only for now: saves this phone for the nightly change alerts and sends
// a preview, see app/api/push/test.
export default function PushTest() {
  const { current } = useWhoAmI();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (current?.name !== "Reda") return null;

  async function run() {
    setBusy(true);
    setStatus(null);
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        throw new Error("This browser can't do notifications here. On iPhone, open the app from its home screen icon, not Safari.");
      }
      // Has to come first: iPhones only show the prompt directly off a tap.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Notifications are turned off for this app. You can turn them on in Settings > Notifications > Schedule.");
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const keyRes = await fetch("/api/push/test");
      const keyData = await keyRes.json();
      if (!keyRes.ok) throw new Error(keyData.error || `Request failed (${keyRes.status})`);
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(keyData.publicKey) }));
      setStatus("Sending in 5 seconds. Lock your phone now!");
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: current?.id, subscription }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setStatus("This phone is saved for change alerts, and a preview should show up now.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="accent-border-soft rounded-2xl border-2 p-3">
      <div className="mb-1 text-xs font-bold uppercase tracking-wide opacity-40">Notifications test</div>
      <button onClick={run} disabled={busy} className="accent-border rounded-full border-2 px-4 py-1 text-sm font-bold transition active:scale-95 disabled:opacity-40">
        {busy ? "Working…" : "Send test notification"}
      </button>
      {status && <p className="mt-2 text-sm font-bold">{status}</p>}
    </div>
  );
}
