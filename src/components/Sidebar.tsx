"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  Settings,
  Search,
  Megaphone,
  Palette,
  SwatchBook,
  ClipboardList,
  UserPlus,
  Inbox,
  ChevronDown,
  LucideIcon,
} from "lucide-react";
import QuitButton from "./QuitButton";
const operate = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/onboarding", label: "Onboarding", icon: UserPlus },
  { href: "/brand-kit", label: "Branding", icon: SwatchBook },
  { href: "/insights", label: "Insights", icon: Sparkles },
];

type NavChild = { href: string; label: string };

type ExpandableGroup = {
  href: string;
  label: string;
  icon: LucideIcon;
  children: NavChild[];
};

// Sub-tools for each Build group live here once they exist.
const build: ExpandableGroup[] = [
  {
    href: "/research",
    label: "Lead Generation",
    icon: Search,
    children: [
      { href: "/research/video-ad-framework", label: "Video Ad Framework" },
      { href: "/research/market-research", label: "Market Research" },
      { href: "/research/digital-product-builder", label: "Digital Product Builder" },
    ],
  },
  {
    href: "/marketing",
    label: "Influence Building",
    icon: Megaphone,
    children: [{ href: "/marketing/messaging-creator", label: "Messaging Creator" }],
  },
  {
    href: "/branding",
    label: "Sales Conversion",
    icon: Palette,
    children: [
      { href: "/branding/dm-2-close", label: "DM 2 Close" },
      { href: "/branding/sales-outreach", label: "Sales Outreach" },
      { href: "/branding/discovery-call", label: "Discovery Call" },
    ],
  },
  {
    href: "/scope",
    label: "Efficiency Engine",
    icon: ClipboardList,
    children: [
      { href: "/scope/document-ops", label: "Document Ops" },
      { href: "/scope/skool-post", label: "Skool Posts" },
    ],
  },
];

const UNSEEN_MAIL_POLL_MS = 60_000;

export default function Sidebar({ memberEmail }: { memberEmail?: string }) {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(build.map((g) => [g.href, pathname.startsWith(g.href)])),
  );
  const [hasUnseenMail, setHasUnseenMail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    function poll() {
      fetch("/api/email/watcher-status")
        .then((res) => res.json())
        .then((data) => {
          if (!cancelled) setHasUnseenMail(Boolean(data.hasUnseenMail));
        })
        .catch(() => {});
    }
    poll();
    const interval = setInterval(poll, UNSEEN_MAIL_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (pathname !== "/inbox") return;
    setHasUnseenMail(false);
    fetch("/api/email/watcher-status", { method: "POST" }).catch(() => {});
  }, [pathname]);

  const linkClass = (active: boolean) =>
    `label-mono flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
      active
        ? "bg-clay-soft font-semibold text-signal-ink"
        : "text-paper-dim hover:bg-paper/[0.04] hover:text-paper"
    }`;

  function toggleGroup(href: string) {
    setOpenGroups((g) => ({ ...g, [href]: !g[href] }));
  }

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-line bg-ink-recessed px-3 py-6">
      <div className="mb-8 px-3">
        <div className="font-display text-2xl font-semibold tracking-tight text-paper">
          CRILOS
        </div>
        <div className="label-mono mt-1 text-[13px] leading-relaxed text-paper-faint">
          Coach Reasoning, Intelligence &amp; Leverage OS
        </div>
      </div>

      <nav className="flex flex-col gap-4">
        <div>
          <div className="label-mono mb-1.5 px-3 text-[13px] font-semibold text-paper-faint">
            Operate
          </div>
          <div className="flex flex-col gap-0.5">
            {operate.map(({ href, label, icon: Icon }) => {
              const flagUnseen = href === "/inbox" && hasUnseenMail && pathname !== href;
              return (
                <Link key={href} href={href} className={linkClass(pathname === href)}>
                  <Icon size={17} />
                  {label}
                  {flagUnseen && (
                    <span
                      className="ml-auto h-2 w-2 shrink-0 rounded-full bg-clay"
                      aria-hidden="true"
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <div className="label-mono mb-1.5 px-3 text-[13px] font-semibold text-paper-faint">
            Build
          </div>
          <div className="flex flex-col gap-0.5">
            {build.map((group) => {
              const active = pathname.startsWith(group.href);
              const open = !!openGroups[group.href];
              const Icon = group.icon;
              return (
                <div key={group.href}>
                  <div
                    className={`label-mono flex items-center rounded-lg text-sm transition-colors ${
                      active
                        ? "bg-clay-soft font-semibold text-signal-ink"
                        : "text-paper-dim hover:bg-paper/[0.04] hover:text-paper"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.href)}
                      className="flex flex-1 items-center gap-3 px-3 py-2.5 text-left"
                    >
                      <Icon size={17} />
                      {group.label}
                    </button>
                    <button
                      onClick={() => toggleGroup(group.href)}
                      aria-label={open ? `Collapse ${group.label}` : `Expand ${group.label}`}
                      aria-expanded={open}
                      className="px-2.5 py-2 text-paper-faint hover:text-paper"
                    >
                      <ChevronDown
                        size={15}
                        className={`transition-transform ${open ? "" : "-rotate-90"}`}
                      />
                    </button>
                  </div>
                  {open && (
                    <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-line pl-3">
                      {group.children.length === 0 ? (
                        <div className="label-mono px-3 py-1.5 text-sm text-paper-faint">
                          No tools yet
                        </div>
                      ) : (
                        group.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={linkClass(pathname === child.href)}
                          >
                            {child.label}
                          </Link>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </nav>

      <div className="mt-auto flex flex-col gap-4">
        <Link href="/settings" className={linkClass(pathname === "/settings")}>
          <Settings size={17} />
          Settings
        </Link>
        <div className="px-3 text-[13px] leading-relaxed text-paper-faint">
          Runs 100% locally.
          <br />
          Your data never leaves this machine
          <br />
          except calls you configure.
        </div>
        {memberEmail && (
          <div className="border-t border-line px-3 pt-4">
            <div className="label-mono text-[13px] text-paper-faint">
              Signed in
            </div>
            <div
              className="mt-1 truncate text-sm text-paper-dim"
              title={memberEmail}
            >
              {memberEmail}
            </div>
            <div className="mt-2">
              <QuitButton />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
