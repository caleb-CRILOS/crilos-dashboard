import { mulberry } from "./prng";

// Decorative 29×29 data-matrix (faux-QR) with three finder patterns. Index /
// provenance flavor — encodes nothing.
export default function DataMatrix({ className }: { className?: string }) {
  const N = 29;
  const rnd = mulberry(20260712);
  const cells: { x: number; y: number }[] = [];

  const inFinder = (x: number, y: number) => {
    const f = (ox: number, oy: number) =>
      x >= ox - 1 && x <= ox + 7 && y >= oy - 1 && y <= oy + 7;
    return f(0, 0) || f(N - 7, 0) || f(0, N - 7);
  };

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (inFinder(x, y)) continue;
      if (rnd() > 0.52) cells.push({ x, y });
    }
  }

  const finder = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const edge = x === 0 || x === 6 || y === 0 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        if (edge || core) cells.push({ x: ox + x, y: oy + y });
      }
    }
  };
  finder(0, 0);
  finder(N - 7, 0);
  finder(0, N - 7);
  for (let i = 8; i < N - 7; i++) {
    if (i % 2 === 0) {
      cells.push({ x: 6, y: i });
      cells.push({ x: i, y: 6 });
    }
  }

  return (
    <svg
      viewBox={`0 0 ${N} ${N}`}
      className={className}
      aria-hidden="true"
      style={{ imageRendering: "pixelated" }}
    >
      {cells.map((c, i) => (
        <rect key={i} x={c.x} y={c.y} width={1} height={1} fill="var(--paper)" />
      ))}
    </svg>
  );
}
