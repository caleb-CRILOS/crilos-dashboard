// A quiet strip across the top of the app: product name on the left, a
// standing line of scripture on the right.
export default function StatusBar() {
  return (
    <div className="status">
      <span className="shrink-0 font-medium text-paper">
        <span className="dot" aria-hidden="true" />
        CRILOS
      </span>
      <span className="grow">
        &ldquo;I am the way, and the truth, and the life. No one comes to the
        Father but through me.&rdquo; &middot; John 14:6
      </span>
    </div>
  );
}
