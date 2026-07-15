// Claude's chat responses are markdown-formatted, but @react-pdf/renderer's
// <Text> just renders raw characters -- without this, deliverable PDFs show
// literal "**bold**" and "> quote" syntax. Strips the common markers rather
// than fully re-rendering as styled text; good enough for a clean read.

export function cleanText(text?: string): string {
  if (!text) return "";
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*]\s+/gm, "• ")
    .trim();
}
