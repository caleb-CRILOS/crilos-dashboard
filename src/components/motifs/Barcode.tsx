import { mulberry } from "./prng";

// Decorative serial marker — variable-width vertical bars. Pair with a mono
// serial in the consumer. Encodes nothing (provenance flavor only).
export default function Barcode({
  count = 40,
  className,
}: {
  count?: number;
  className?: string;
}) {
  const W = 200;
  const H = 90;
  const rnd = mulberry(count * 7 + 13);
  const unit = W / (count * 1.8);
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (let i = 0; i < count && x < W; i++) {
    const w = unit * (0.6 + rnd() * 2.2);
    if (rnd() > 0.32) bars.push({ x, w });
    x += w + unit * (0.5 + rnd() * 1.1);
  }
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      {bars.map((b, i) => (
        <rect
          key={i}
          x={b.x.toFixed(2)}
          y={0}
          width={b.w.toFixed(2)}
          height={H}
          fill="var(--paper)"
        />
      ))}
    </svg>
  );
}
