import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import StatusBar from "@/components/StatusBar";
import MemberfulGate from "@/components/MemberfulGate";
import { getDb } from "@/lib/db";
import { DEFAULT_THEME, isThemeName } from "@/lib/themes";
import { MEMBERFUL_CONFIGURED, JOIN_URL } from "@/lib/auth/memberfulConfig";

// Inter carries both display and body; globals maps --font-display and
// --font-sans to it.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-ui",
  weight: ["400", "500", "600", "700"],
});

// JetBrains Mono is reserved for genuine data: tabular figures, IDs, code.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "CRILOS",
  description: "Run your coaching business and your AI tools from one place",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Persisted color theme -> stamped on <html> so it's server-rendered
  // (flash-free). db is uncached and pages are force-dynamic, so this
  // stays in sync across full loads; the Settings picker applies changes
  // instantly client-side and this covers the next load.
  const db = await getDb();
  // Validate (not just ??-default) so a removed/stale persisted value — e.g.
  // an old "ember" — degrades to the default instead of stamping a dead
  // data-theme with no matching CSS block.
  const theme = isThemeName(db.data.settings.theme)
    ? db.data.settings.theme
    : DEFAULT_THEME;

  // The stored Memberful session IS the gate: no verified member -> render
  // the sign-in gate in place of the entire app (covers every route, since
  // this layout wraps them all).
  const memberAuth = db.data.settings.memberAuth ?? null;

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`h-full antialiased ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-full text-paper font-sans">
        {memberAuth ? (
          <div className="sheet">
            <StatusBar />

            <div className="flex min-h-[calc(100vh-3rem)]">
              <Sidebar memberEmail={memberAuth.email} />
              <main className="flex-1 min-w-0 px-6 py-8 md:px-10 md:py-12">
                {children}
              </main>
            </div>
          </div>
        ) : (
          <Suspense>
            <MemberfulGate configured={MEMBERFUL_CONFIGURED} joinUrl={JOIN_URL} />
          </Suspense>
        )}
      </body>
    </html>
  );
}
