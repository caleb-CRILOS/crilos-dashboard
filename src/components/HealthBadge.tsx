import { HealthStatus } from "@/lib/types";

// KORE is monochrome + one Signal blue. The three tiers escalate in weight,
// with blue reserved for the two states that ask you to act:
//   on-track       -> halftone border + half square (quiet)
//   needs-attention-> ink border + Signal square dot
//   at-risk        -> inverted Signal chip (blue fill + light text) — "act"
const styles: Record<HealthStatus, string> = {
  green: "border-line text-paper-faint",
  yellow: "border-paper text-paper",
  red: "border-clay bg-clay text-signal-fg",
};

const dotStyles: Record<HealthStatus, string> = {
  green: "bg-line",
  yellow: "bg-clay",
  red: "bg-signal-fg",
};

const labels: Record<HealthStatus, string> = {
  green: "On track",
  yellow: "Needs attention",
  red: "At risk",
};

export default function HealthBadge({ status }: { status: HealthStatus }) {
  return (
    <span
      className={`label-mono inline-flex items-center gap-1.5 border px-2.5 py-0.5 text-[11px] ${styles[status]}`}
    >
      <span className={`h-1.5 w-1.5 ${dotStyles[status]}`} aria-hidden="true" />
      {labels[status]}
    </span>
  );
}
