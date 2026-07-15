// Registration mark — a crosshair in a ring. The system's fingerprint;
// pins a frame corner or marks a coordinate. Decorative.
export default function RegistrationMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="13" fill="none" stroke="var(--paper)" strokeWidth="1.4" />
      <line x1="24" y1="3" x2="24" y2="45" stroke="var(--paper)" strokeWidth="1.4" />
      <line x1="3" y1="24" x2="45" y2="24" stroke="var(--paper)" strokeWidth="1.4" />
    </svg>
  );
}
