import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { WhoAmIProvider } from "@/lib/whoami";
import BottomNav from "@/components/BottomNav";
import AppGate from "@/components/AppGate";
import ThemeAccent from "@/components/ThemeAccent";
import { NotificationPrompt } from "@/components/NotificationSetup";
import DockMode from "@/components/DockMode";
import ErrorReporter from "@/components/ErrorReporter";
import { DOCK_COOKIE } from "@/lib/sideDock";
import { HolidayProvider } from "@/components/HolidayProvider";
import { HolidayGarland } from "@/components/HolidayDecor";
import { HOLIDAY_COOKIE, holidayFor, isHolidayKey, type HolidayKey } from "@/lib/holidayTheme";
import { easternToday } from "@/lib/date";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// On the iPhone Duo (see lib/sideDock.ts) the page is let under the status
// bar, so the dock can use the empty strip it otherwise leaves on the right.
async function isDuo() {
  return (await cookies()).get(DOCK_COOKIE)?.value === "side";
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "MOS Schedule",
    description: "Daily staffing schedule for Bethesda and Germantown offices",
    appleWebApp: {
      capable: true,
      statusBarStyle: (await isDuo()) ? "black-translucent" : "default",
      title: "Schedule",
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  return {
    themeColor: "#94a3b8",
    // Never zoomed out past the page's own width: a zoomed-out page is where
    // a fixed bar starts scrolling along with everything else.
    minimumScale: 1,
    ...((await isDuo()) ? { viewportFit: "cover" as const } : {}),
  };
}

// The holiday theme in effect (see lib/holidayTheme.ts): this browser's
// ?holiday=... pick if it made one, otherwise whatever today's date says.
async function currentHoliday(): Promise<HolidayKey | null> {
  const pick = (await cookies()).get(HOLIDAY_COOKIE)?.value;
  if (pick === "none") return null;
  if (isHolidayKey(pick)) return pick;
  return holidayFor(easternToday());
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const duo = await isDuo();
  const holiday = await currentHoliday();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} antialiased`}
      data-cover={duo ? "" : undefined}
      data-dock={duo ? "side" : undefined}
      data-holiday={holiday ?? undefined}
    >
      <body className="flex min-h-dvh flex-col">
        <DockMode />
        <ErrorReporter />
        <HolidayProvider holiday={holiday}>
        <HolidayGarland />
        <WhoAmIProvider>
          <ThemeAccent />
          <AppGate />
          <NotificationPrompt />
          {/* --main-pb is the measured height of the bottom chrome (see
              BottomNav), so nothing ends up hidden behind it. */}
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-[var(--main-pb)] pt-4">{children}</main>
          <BottomNav />
        </WhoAmIProvider>
        </HolidayProvider>
      </body>
    </html>
  );
}
