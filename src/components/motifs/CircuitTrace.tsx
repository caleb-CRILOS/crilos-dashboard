// Circuit trace — a right-angle Signal path with nodes. Routes, connects,
// points at a target. Decorative; use where it encodes real structure.
export default function CircuitTrace({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 60" className={className} aria-hidden="true">
      <path
        d="M2 30 H40 V12 H92 V46 H140 V30 H198"
        fill="none"
        stroke="var(--clay)"
        strokeWidth="1.6"
      />
      <rect x="38" y="10" width="4" height="4" fill="var(--clay)" />
      <rect x="90" y="44" width="4" height="4" fill="var(--clay)" />
      <rect x="138" y="28" width="4" height="4" fill="var(--clay)" />
      <circle cx="2" cy="30" r="2.6" fill="var(--clay)" />
      <circle cx="198" cy="30" r="2.6" fill="var(--clay)" />
    </svg>
  );
}
