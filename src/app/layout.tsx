import type { Metadata } from "next";
import { Suspense } from "react";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import StatusBar from "@/components/StatusBar";
import MemberfulGate from "@/components/MemberfulGate";
import { getDb } from "@/lib/db";
import { DEFAULT_THEME, isThemeName } from "@/lib/themes";
import { MEMBERFUL_CONFIGURED, JOIN_URL } from "@/lib/auth/memberfulConfig";

// Space Grotesk carries both display and body (variable name kept stable
// as --font-space-grotesk; globals maps both --font-display and --font-sans
// to it).
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["400", "500", "700"],
});

// JetBrains Mono carries data, labels, coordinates, annotations.
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
      className={`h-full antialiased ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-full text-paper font-sans">
        {memberAuth ? (
          /* The print-sheet — the whole app framed with hairline ink and
             corner registration crosshairs. */
          <div className="sheet overflow-hidden">
            <span className="corner tl acid" aria-hidden="true" />
            <span className="corner tr" aria-hidden="true" />
            <span className="corner bl" aria-hidden="true" />
            <span className="corner br acid" aria-hidden="true" />

            <StatusBar />

            <div className="flex min-h-[calc(100vh-10rem)]">
              <Sidebar memberEmail={memberAuth.email} />
              <main className="flex-1 min-w-0 px-6 py-8 md:px-10 md:py-10">
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
