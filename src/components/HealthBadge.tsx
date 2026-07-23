import { HealthStatus } from "@/lib/types";

// A neutral pill carrying a colored status dot. The previous design system
// was monochrome + one blue, so the three tiers had to escalate through
// border weight and an inverted chip; with real semantic colors available
// the status reads straight off the dot. See src/app/globals.css for the
// --dm-health-* tokens, which flip per theme to stay legible.
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

export default function HealthBadge({ status }: { status: HealthStatus }) {
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
