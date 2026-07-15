// Halftone field — a 1-bit dot field whose density (dot radius) carries tone,
// left (light) to right (dark). Used as a plate texture. Decorative.
export default function HalftoneField({ className }: { className?: string }) {
  const cols = 22;
  const rows = 14;
  const dots = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const t = x / (cols - 1);
      const r = 0.4 + t * t * 2.6;
      dots.push(
        <circle key={`${x}-${y}`} cx={x * 8 + 4} cy={y * 8 + 4} r={r.toFixed(2)} fill="var(--paper)" />,
      );
    }
  }
  return (
    <svg
      viewBox={`0 0 ${cols * 8} ${rows * 8}`}
      className={className}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {dots}
    </svg>
  );
}
