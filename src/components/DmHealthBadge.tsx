import { HealthStatus } from "@/lib/types";

// Fork of HealthBadge.tsx scoped to DM 2 Close lead health -- literal
// green/yellow/red filled chips instead of KORE's monochrome+blue
// escalation. See src/app/globals.css for the --dm-health-* tokens.
// text/dot use --ink (the surface color) rather than --signal-fg so the
// chip stays readable when a theme inverts polarity: in light themes --ink
// is a light tint (light text on the dark health fill), in Noir --ink is
// dark (dark text on the brightened health fill).
const styles: Record<HealthStatus, string> = {
  green: "border-dm-health-green bg-dm-health-green text-ink",
  yellow: "border-dm-health-yellow bg-dm-health-yellow text-ink",
  red: "border-dm-health-red bg-dm-health-red text-ink",
};

const dotStyles: Record<HealthStatus, string> = {
  green: "bg-ink",
  yellow: "bg-ink",
  red: "bg-ink",
};

const labels: Record<HealthStatus, string> = {
  green: "On track",
  yellow: "Needs attention",
  red: "At risk",
};

export default function DmHealthBadge({ status }: { status: HealthStatus }) {
  return (
    <span
      className={`label-mono inline-flex items-center gap-1.5 border px-2.5 py-0.5 text-[11px] ${styles[status]}`}
    >
      <span className={`h-1.5 w-1.5 ${dotStyles[status]}`} aria-hidden="true" />
      {labels[status]}
    </span>
  );
}
