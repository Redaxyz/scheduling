// Browser-only: which setup steps a device needs for push notifications, read
// from what the browser reports about itself so nobody has to tell us.
export type DeviceKind =
  | "ios-safari" // has to be added to the home screen first
  | "ios-other-browser" // in-app browsers and the like can't add it reliably
  | "ios-outdated" // web push arrived in iOS 16.4
  | "ios-app" // opened from the home screen icon, ready to turn on
  | "android" // Chrome, including Pixels
  | "android-samsung" // Samsung Internet: same idea, different menus
  | "android-app" // opened from the home screen icon, ready to turn on
  | "android-other-browser"
  | "mac-safari" // can add it to the Dock (macOS Sonoma and up)
  | "mac-app" // opened from the Dock, ready to turn on
  | "computer";

export type Device = { kind: DeviceKind; name: string };

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

export function detectDevice(): Device {
  const ua = navigator.userAgent;
  // iPads have asked for the desktop site by default since iPadOS 13, so they
  // report as a Mac and only the touchscreen gives them away.
  const isIPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const pushSupported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  if (isIPad || /iPhone|iPod/.test(ua)) {
    const name = isIPad ? "iPad" : "iPhone";
    if (isStandalone()) return { kind: pushSupported ? "ios-app" : "ios-outdated", name };
    const version = ua.match(/OS (\d+)_(\d+)/);
    if (version && (Number(version[1]) < 16 || (Number(version[1]) === 16 && Number(version[2]) < 4))) {
      return { kind: "ios-outdated", name };
    }
    const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|DuckDuckGo|FBAN|FBAV|Instagram|Line\//.test(ua);
    return { kind: safari ? "ios-safari" : "ios-other-browser", name };
  }
  if (/Android/.test(ua)) {
    const name = "Android phone";
    if (!pushSupported) return { kind: "android-other-browser", name };
    if (isStandalone()) return { kind: "android-app", name };
    return { kind: /SamsungBrowser/.test(ua) ? "android-samsung" : "android", name };
  }
  if (/Macintosh/.test(ua) && pushSupported) {
    if (isStandalone()) return { kind: "mac-app", name: "Mac" };
    if (/Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg|Firefox|OPR/.test(ua)) return { kind: "mac-safari", name: "Mac" };
  }
  return { kind: "computer", name: "computer" };
}
