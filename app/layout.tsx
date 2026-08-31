import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { WhoAmIProvider } from "@/lib/whoami";
import NavBar from "@/components/NavBar";
import BottomNav from "@/components/BottomNav";
import AppGate from "@/components/AppGate";
import ThemeAccent from "@/components/ThemeAccent";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CFA Ortho Schedule",
  description: "Daily staffing schedule for Bethesda and Germantown offices",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col">
        <WhoAmIProvider>
          <ThemeAccent />
          <AppGate />
          <NavBar />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-28">{children}</main>
          <BottomNav />
        </WhoAmIProvider>
      </body>
    </html>
  );
}
