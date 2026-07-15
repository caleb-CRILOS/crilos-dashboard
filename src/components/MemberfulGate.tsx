"use client";

import { useSearchParams } from "next/navigation";

// Full-screen sign-in gate shown (in place of the whole app) whenever there
// is no verified Memberful session. Reads the outcome of a sign-in attempt
// from the URL (?auth=denied|error|unconfigured). Rendered inside a Suspense
// boundary (see layout.tsx) as useSearchParams requires.
export default function MemberfulGate({
  configured,
  joinUrl,
}: {
  configured: boolean;
  joinUrl: string;
}) {
  const reason = useSearchParams().get("auth");

  const notice =
    reason === "denied"
      ? "No active membership was found for that account. Use the email tied to your active membership, or join below."
      : reason === "error"
        ? "Something went wrong signing you in. Please try again."
        : null;

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="sheet stack relative w-full max-w-md p-8 md:p-10">
        <span className="corner tl acid" aria-hidden="true" />
        <span className="corner tr" aria-hidden="true" />
        <span className="corner bl" aria-hidden="true" />
        <span className="corner br acid" aria-hidden="true" />

        <div className="label-mono text-[11px] text-signal-ink">
          § MEMBERS ONLY
        </div>
        <h1 className="bleed-type mt-3">CRILOS</h1>
        <p className="mt-4 text-sm leading-relaxed text-paper-dim">
          This dashboard is for active members. Sign in with your Memberful
          account to continue.
        </p>

        {notice && (
          <div className="callout mt-6 text-[13px] leading-relaxed text-paper">
            <span className="cross" aria-hidden="true">
              +
            </span>
            {notice}
          </div>
        )}

        {configured ? (
          <a
            href="/api/auth/memberful/start"
            className="btn-accent stack-sm mt-8 flex w-full items-center justify-center px-5 py-3 text-[13px]"
          >
            Sign in with Memberful
          </a>
        ) : (
          <div className="callout mt-8 text-[13px] leading-relaxed text-paper">
            <span className="cross" aria-hidden="true">
              +
            </span>
            Sign-in isn&apos;t configured yet. Add your Memberful subdomain and
            Client ID in{" "}
            <code className="font-mono text-signal-ink">
              src/lib/auth/memberfulConfig.ts
            </code>
            . See the README &ldquo;Members-only sign-in&rdquo; section.
          </div>
        )}

        {configured && (
          <div className="rule-lab mt-8">
            <span>Not a member</span>
          </div>
        )}
        {configured && (
          <a
            href={joinUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost mt-4 flex w-full items-center justify-center px-5 py-3 text-[12px]"
          >
            Join the community
          </a>
        )}
      </div>
    </div>
  );
}
