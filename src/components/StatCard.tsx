import { ReactNode } from "react";

// tone "ink" = default (dark number on a white card).
// tone "accent" = the ONE blue Data panel per view (Signal fill). Never
// more than one.
export default function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "ink",
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
  tone?: "ink" | "accent";
}) {
  if (tone === "accent") {
    return (
      <div className="datapanel stack">
        <div className="dp-k">{label}</div>
        <div className="dp-v mt-2 text-3xl tabular-nums">{value}</div>
        {sub && <div className="dp-k mt-2 opacity-80">{sub}</div>}
      </div>
    );
  }
  return (
    <div className="hud-panel stack p-5">
      <div className="flex items-center justify-between">
        <span className="label-mono text-[13px] text-paper-faint">{label}</span>
        {icon}
      </div>
      <div className="mt-2 font-display text-4xl font-semibold tabular-nums text-paper">
        {value}
      </div>
      {sub && <div className="label-mono mt-1 text-[13px] text-paper-faint">{sub}</div>}
    </div>
  );
}
