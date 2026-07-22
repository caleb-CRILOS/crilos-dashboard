// Copy text to the clipboard from a client component.
//
// Tries the modern Clipboard API first (it's a browser API, not an OS
// shell-out, so it behaves the same on Windows and macOS). If it's missing,
// blocked by permissions policy, or the page isn't a secure context, falls
// back to the classic textarea + execCommand trick rather than giving up --
// the app is served over plain http://localhost, where that guard can bite.
//
// Throws on failure so callers can surface their own error copy.
export async function copyText(text: string): Promise<void> {
  try {
    if (!navigator.clipboard || !window.isSecureContext) {
      throw new Error("Clipboard API unavailable");
    }
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (!ok) throw new Error("execCommand copy failed");
  }
}
