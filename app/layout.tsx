import type { Metadata } from "next";
import "./globals.css";
import { WhoAmIProvider } from "@/lib/whoami";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "CFA Ortho Schedule",
  description: "Daily staffing schedule for Bethesda and Germantown offices",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WhoAmIProvider>
          <NavBar />
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        </WhoAmIProvider>
      </body>
    </html>
  );
}
