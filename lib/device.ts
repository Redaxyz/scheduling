// Browser-only: which setup steps a device needs for push notifications, read
// from what the browser reports about itself so nobody has to tell us.
export type DeviceKind =
  | "ios-safari" // has to be added to the home screen first
  | "ios-other-browser" // in-app browsers and the like can't add it reliably
  | "ios-outdated" // web push arrived in iOS 16.4
  | "ios-app" // opened from the home screen icon, ready to turn on
  | "android"
  | "android-other-browser"
  | "computer";

export type Device = { kind: DeviceKind; name: string };

export function detectDevice(): Device {
  const ua = navigator.userAgent;
  // iPads have asked for the desktop site by default since iPadOS 13, so they
  // report as a Mac and only the touchscreen gives them away.
  const isIPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const pushSupported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  if (isIPad || /iPhone|iPod/.test(ua)) {
    const name = isIPad ? "iPad" : "iPhone";
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return { kind: pushSupported ? "ios-app" : "ios-outdated", name };
    const version = ua.match(/OS (\d+)_(\d+)/);
    if (version && (Number(version[1]) < 16 || (Number(version[1]) === 16 && Number(version[2]) < 4))) {
      return { kind: "ios-outdated", name };
    }
    const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|DuckDuckGo|FBAN|FBAV|Instagram|Line\//.test(ua);
    return { kind: safari ? "ios-safari" : "ios-other-browser", name };
  }
  if (/Android/.test(ua)) return { kind: pushSupported ? "android" : "android-other-browser", name: "Android phone" };
  return { kind: "computer", name: "computer" };
}
