import { ReactNode } from "react";

// KORE annotation callout — ink border, a 6px Signal left edge, and a + mark.
// Variants differ by the mono eyebrow, not by hue.
export default function Alert({
  variant = "info",
  title,
  children,
}: {
  variant?: "info" | "warn";
  title: string;
  children: ReactNode;
}) {
  const eyebrow = variant === "warn" ? "[ ! ] WARNING" : "[ NOTICE ]";
  return (
    <div className="callout">
      <span className="cross" aria-hidden="true">
        +
      </span>
      <span className="label-mono block text-xs text-signal-ink">
        {eyebrow} · {title}
      </span>
      <span className="mt-1 block text-sm text-paper-dim">{children}</span>
    </div>
  );
}
