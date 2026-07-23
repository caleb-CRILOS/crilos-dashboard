import { HealthStatus } from "@/lib/types";

// Fork of HealthBadge.tsx scoped to DM 2 Close lead health. Both now render
// the same neutral pill with a colored status dot; this stays a separate
// component so the two can diverge again if DM 2 Close needs a louder
// treatment. See src/app/globals.css for the --dm-health-* tokens.
const dotStyles: Record<HealthStatus, string> = {
  green: "bg-dm-health-green",
  yellow: "bg-dm-health-yellow",
  red: "bg-dm-health-red",
};

const labels: Record<HealthStatus, string> = {
  green: "On track",
  yellow: "Needs attention",
  red: "At risk",
};

export default function DmHealthBadge({ status }: { status: HealthStatus }) {
  return (
    <span className="label-mono inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[13px] text-paper-dim">
      <span
        className={`h-2 w-2 rounded-full ${dotStyles[status]}`}
        aria-hidden="true"
      />
      {labels[status]}
    </span>
  );
}
