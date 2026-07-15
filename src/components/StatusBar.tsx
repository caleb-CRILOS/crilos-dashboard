// The KORE status ticker across the top of the sheet. Mono micro-type, an
// ink hairline, a blinking Signal dot. Left = system, right = a terse
// operating coordinate.
export default function StatusBar() {
  return (
    <div className="status">
      <span className="shrink-0">
        <span className="dot" aria-hidden="true" />
        CRILOS · OPERATING SYSTEM
      </span>
      <span className="grow" aria-hidden="true">
        JESUS SAID TO HIM, "I AM THE WAY, AND THE TRUTH, AND THE LIFE. NO ONE
        COMES TO THE FATHER BUT THROUGH ME." · JOHN 14:6
      </span>
    </div>
  );
}
