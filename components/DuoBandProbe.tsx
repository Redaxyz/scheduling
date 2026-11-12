"use client";

import { useEffect, useState } from "react";
import { useWhoAmI } from "@/lib/whoami";

// TEMPORARY test (Reda only, iPhone Duo only): can the page draw in the band
// iOS keeps along the top when the Duo is turned so its status strip is on
// top? Two bright blocks sit just above the top edge, one pinned to the
// screen (magenta) and one part of the page (lime). If either shows inside
// the band, the page can paint there. The readout gives the numbers iOS
// reports. Remove once answered.
export default function DuoBandProbe() {
  const { current } = useWhoAmI();
  const [info, setInfo] = useState("");
  const enabled = current?.name === "Reda";

  useEffect(() => {
    if (!enabled || !("cover" in document.documentElement.dataset)) return;
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;visibility:hidden;top:env(safe-area-inset-top);right:env(safe-area-inset-right);bottom:env(safe-area-inset-bottom);left:env(safe-area-inset-left)";
    document.body.appendChild(probe);
    const read = () => {
      const cs = getComputedStyle(probe);
      const vv = window.visualViewport;
      setInfo(
        `inset t${cs.top} r${cs.right} b${cs.bottom} l${cs.left} · view ${innerWidth}×${innerHeight} · screen ${screen.width}×${screen.height} · vv ${vv ? `${Math.round(vv.width)}×${Math.round(vv.height)} @${Math.round(vv.offsetTop)}` : "-"} · scrollY ${Math.round(scrollY)}`,
      );
    };
    read();
    const timer = window.setInterval(read, 1000);
    return () => {
      window.clearInterval(timer);
      probe.remove();
    };
  }, [enabled]);

  if (!enabled || !info) return null;
  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-x-0 z-[60]" style={{ top: -150, height: 150, background: "#ff00ff" }} />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 z-[60]" style={{ top: -150, height: 150, background: "#00ff00" }} />
      <div className="pointer-events-none fixed bottom-2 left-2 z-[60] max-w-[70vw] rounded bg-black/80 px-2 py-1 font-mono text-[10px] leading-tight text-white">
        {info}
      </div>
    </>
  );
}
