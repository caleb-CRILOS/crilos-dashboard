// Reduces a CSS font-family stack (e.g. `"Poppins, sans-serif"` or
// `'"Playfair Display", serif'`) down to a single bare font name, for APIs
// that want one name rather than a fallback stack: docx's `font` option,
// pptxgenjs's `fontFace` option, and the Google Fonts lookup in
// googleFonts.ts. Returns null when there's nothing usable (empty stack) or
// the first name is a generic/system family with no Google Fonts entry to
// fetch -- callers should keep their existing default in that case.

const GENERIC_OR_SYSTEM_NAMES = new Set([
  "sans-serif",
  "serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "helvetica",
  "helvetica neue",
  "arial",
  "arial black",
  "georgia",
  "times",
  "times new roman",
  "verdana",
  "tahoma",
  "trebuchet ms",
  "courier",
  "courier new",
  "calibri",
  "segoe ui",
]);

// The first, bare font name from a CSS stack -- quotes stripped, whitespace
// trimmed -- or null if the stack is empty.
export function primaryFontName(stack?: string): string | null {
  if (!stack) return null;
  const first = stack.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "");
  return first || null;
}

// The bare name, but only when it's a real (likely Google Fonts) family --
// null for empty stacks and for generic/system names that aren't worth
// looking up.
export function customFontName(stack?: string): string | null {
  const name = primaryFontName(stack);
  if (!name) return null;
  return GENERIC_OR_SYSTEM_NAMES.has(name.toLowerCase()) ? null : name;
}

// docx/pptxgenjs both want hex colors without the leading "#".
export function hex(color?: string): string | undefined {
  return color?.replace(/^#/, "");
}
