"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useWhoAmI } from "@/lib/whoami";
import { detectDevice, type Device, type DeviceKind } from "@/lib/device";
import { NOTIFIED_STAFF } from "@/lib/types";
import { PlusSquareIcon, ShareIcon } from "@/components/icons";

type SetupState = "on" | "off" | "blocked";
type View = DeviceKind | "blocked" | "on";

const DISMISSED_KEY = "cfa-notification-guide-dismissed";

const PREVIEWS: { view: View; label: string }[] = [
  { view: "ios-safari", label: "iPhone, Safari" },
  { view: "ios-other-browser", label: "iPhone, other browser" },
  { view: "ios-app", label: "iPhone, home screen" },
  { view: "ios-outdated", label: "Old iPhone" },
  { view: "android", label: "Android" },
  { view: "computer", label: "Computer" },
  { view: "blocked", label: "Blocked" },
  { view: "on", label: "All set" },
];

function keyToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "="));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function readSetupState(): Promise<SetupState> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return "off";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted") return "off";
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ? "on" : "off";
}

// Saves this device for change alerts and has the server send it a sample.
async function turnOn(staffId: string): Promise<void> {
  // Has to come first: iPhones only show the prompt directly off a tap.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications weren't allowed on this device.");
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const keyRes = await fetch("/api/push/test");
  const keyData = await keyRes.json();
  if (!keyRes.ok) throw new Error(keyData.error || `Request failed (${keyRes.status})`);
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(keyData.publicKey) }));
  const res = await fetch("/api/push/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ staffId, subscription }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
}

function useSetup() {
  const { current } = useWhoAmI();
  const [device, setDevice] = useState<Device | null>(null);
  const [state, setState] = useState<SetupState | null>(null);
  const eligible = Boolean(current && NOTIFIED_STAFF.includes(current.name));

  useEffect(() => {
    if (!eligible) return;
    setDevice(detectDevice());
    readSetupState()
      .then(setState)
      .catch(() => setState("off"));
  }, [eligible]);

  return { current, eligible, device, state, setState };
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="accent-bg-soft accent-text flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-extrabold">{n}</span>
      <div className="min-w-0 flex-1 pt-0.5 text-sm font-medium leading-snug">{children}</div>
    </li>
  );
}

function CopyLink() {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-2">
      <span className="break-all rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold">{window.location.host}</span>
      <button type="button" onClick={copy} className="accent-border rounded-full border-2 px-3 py-0.5 text-xs font-bold transition active:scale-95">
        {copied ? "Copied" : "Copy link"}
      </button>
    </span>
  );
}

function blockedHelp(kind: DeviceKind) {
  if (kind === "android" || kind === "android-other-browser") {
    return "Tap the icon to the left of the web address, then Permissions, then turn Notifications on.";
  }
  if (kind === "computer") return "Click the icon to the left of the web address and allow notifications for this site.";
  return "Open your phone's Settings app, tap Notifications, then Schedule, and turn on Allow Notifications.";
}

function SetupSheet({ onClose, setup }: { onClose: () => void; setup: ReturnType<typeof useSetup> }) {
  const { current, device, state, setState } = setup;
  const [preview, setPreview] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justTurnedOn, setJustTurnedOn] = useState(false);

  if (!device || !state || !current) return null;

  const actual: View = state === "on" ? "on" : state === "blocked" ? "blocked" : device.kind;
  const view = preview ?? actual;
  const previewing = view !== actual;
  // A preview of another device's steps describes that device, not this one.
  const name = previewing ? (view === "android" ? "Android phone" : view === "computer" ? "computer" : "iPhone") : device.name;

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await turnOn(current!.id);
      setState("on");
      setJustTurnedOn(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setState(await readSetupState());
    } finally {
      setBusy(false);
    }
  }

  const turnOnButton = (
    <button
      type="button"
      onClick={run}
      disabled={busy || previewing}
      className="mt-2 rounded-full bg-slate-900 px-4 py-1.5 text-sm font-bold text-white transition active:scale-95 disabled:opacity-40"
    >
      {busy ? "Turning on…" : "Turn on notifications"}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 lg:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Set up notifications"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] lg:max-w-md lg:rounded-3xl"
      >
        {current.name === "Reda" && (
          <div className="mb-4 rounded-2xl bg-slate-100 p-2">
            <div className="mb-1.5 px-1 text-xs font-bold opacity-60">Preview, only you see this. Detected: {device.name}</div>
            <div className="flex flex-wrap gap-1">
              {PREVIEWS.map((p) => (
                <button
                  key={p.view}
                  type="button"
                  onClick={() => setPreview(p.view)}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${view === p.view ? "bg-slate-900 text-white" : "bg-white"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-lg font-extrabold tracking-tight">{view === "on" ? "You're all set" : "Get schedule alerts"}</h2>

        {view === "on" ? (
          <p className="mt-1 text-sm font-medium leading-snug">
            This {name} is saved, so you don't need to do this again. The night before, around 9pm, you'll get an alert if you're in a different office or role than usual,
            with who else will be there. No change, no alert.{justTurnedOn && " A sample is on its way."}
          </p>
        ) : (
          <p className="mt-1 text-sm font-medium leading-snug opacity-70">
            A heads-up the night before if you're in a different office or role than usual. You only set this up once on each device.
          </p>
        )}

        {view === "ios-safari" && (
          <ol className="mt-4 space-y-3">
            <Step n={1}>
              Tap the <strong>Share</strong> button <ShareIcon className="inline h-5 w-5 align-text-bottom" /> in Safari's toolbar. If you don't see it, tap <strong>•••</strong>{" "}
              first.
            </Step>
            <Step n={2}>
              Scroll down and tap <strong>Add to Home Screen</strong> <PlusSquareIcon className="inline h-5 w-5 align-text-bottom" />.
            </Step>
            <Step n={3}>
              If you see <strong>Open as Web App</strong>, leave it on. Then tap <strong>Add</strong>.
            </Step>
            <Step n={4}>
              Close Safari and open <strong>Schedule</strong> from your home screen. You'll sign in one more time, and this guide will finish up there.
            </Step>
          </ol>
        )}

        {view === "ios-other-browser" && (
          <ol className="mt-4 space-y-3">
            <Step n={1}>
              On {name === "iPad" ? "an iPad" : "an iPhone"}, this has to be set up from <strong>Safari</strong>. Copy this link:
              <CopyLink />
            </Step>
            <Step n={2}>Open Safari and paste it into the address bar. This guide will walk you through the rest.</Step>
          </ol>
        )}

        {view === "ios-outdated" && (
          <ol className="mt-4 space-y-3">
            <Step n={1}>
              Your {name} needs a software update first. Open <strong>Settings</strong>, then <strong>General</strong>, then <strong>Software Update</strong>.
            </Step>
            <Step n={2}>Once it's updated, open this app in Safari and this guide will walk you through the rest.</Step>
          </ol>
        )}

        {(view === "ios-app" || view === "android") && (
          <ol className="mt-4 space-y-3">
            <Step n={1}>
              Tap the button below, then choose <strong>Allow</strong>.
              <br />
              {turnOnButton}
            </Step>
            {view === "android" && (
              <Step n={2}>
                Optional: for one-tap access, open Chrome's <strong>⋮</strong> menu and tap <strong>Add to Home screen</strong>.
              </Step>
            )}
          </ol>
        )}

        {view === "android-other-browser" && (
          <ol className="mt-4 space-y-3">
            <Step n={1}>
              This browser can't do notifications. Copy this link:
              <CopyLink />
            </Step>
            <Step n={2}>Open Chrome and paste it into the address bar. This guide will walk you through the rest.</Step>
          </ol>
        )}

        {view === "computer" && (
          <ol className="mt-4 space-y-3">
            <Step n={1}>
              Alerts are most useful on your phone. Go to this address on your phone and this guide will walk you through it:
              <CopyLink />
            </Step>
            <Step n={2}>
              You can also get them on this computer, but only while your browser is running.
              <br />
              {turnOnButton}
            </Step>
          </ol>
        )}

        {view === "blocked" && (
          <p className="mt-4 text-sm font-medium leading-snug">
            Notifications are turned off for this app. {blockedHelp(previewing && preview ? "ios-app" : device.kind)} Then come back here.
          </p>
        )}

        {previewing && (view === "ios-app" || view === "android" || view === "computer") && <p className="mt-3 text-xs font-bold opacity-50">The button is off in this preview.</p>}
        {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">{error}</p>}

        <button type="button" onClick={onClose} className="mt-4 w-full py-1 text-sm font-bold opacity-50 hover:opacity-100">
          {view === "on" ? "Done" : "Not now"}
        </button>
      </div>
    </div>
  );
}

// The My Schedule box: where this device stands, and a way back into the guide.
export default function NotificationSetup() {
  const setup = useSetup();
  const { current, eligible, state } = setup;
  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  if (!eligible || !state || !current) return null;

  async function test() {
    setTesting(true);
    setStatus(null);
    try {
      await turnOn(current!.id);
      setStatus("Sent! It should show up in a few seconds.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setTesting(false);
    }
  }

  const buttonClass = "accent-border rounded-full border-2 px-4 py-1 text-sm font-bold transition active:scale-95 disabled:opacity-40";

  return (
    <div className="accent-border-soft rounded-2xl border-2 p-3">
      <div className="mb-1 text-xs font-bold uppercase tracking-wide opacity-40">Notifications</div>
      <p className="mb-2 text-sm font-bold">{state === "on" ? "On for this device" : state === "blocked" ? "Blocked on this device" : "Not set up on this device"}</p>
      <div className="flex flex-wrap gap-2">
        {state === "on" && (
          <button type="button" onClick={test} disabled={testing} className={buttonClass}>
            {testing ? "Sending…" : "Send a sample"}
          </button>
        )}
        <button type="button" onClick={() => setOpen(true)} className={buttonClass}>
          {state === "on" ? "See the guide" : "Set up"}
        </button>
      </div>
      {status && <p className="mt-2 text-sm font-bold">{status}</p>}
      {open && <SetupSheet onClose={() => setOpen(false)} setup={setup} />}
    </div>
  );
}

// Opens the guide by itself, once, on phones that aren't set up yet. Computers
// only get it from the My Schedule box, since the alerts are meant for phones.
export function NotificationPrompt() {
  const setup = useSetup();
  const { device, state } = setup;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!device || !state || state === "on" || device.kind === "computer") return;
    try {
      if (window.localStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      return;
    }
    setOpen(true);
  }, [device, state]);

  if (!open) return null;

  function close() {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {}
    setOpen(false);
  }

  return <SetupSheet onClose={close} setup={setup} />;
}
