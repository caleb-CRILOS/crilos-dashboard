// The business identity to show on any generated document (PDF eyebrow/
// footer, branded email) in place of CRILOS/agent branding -- these are
// documents the coach/consultant hands to their own clients or uses as
// their own business material, so they should carry the coach's identity,
// not this app's. Blank (not a placeholder string) when there's genuinely
// no business name on file, e.g. clientLabel's "No client linked" sentinel
// (see each tool's newSession() in src/app/api/*/message/route.ts) -- an
// empty eyebrow/footer beats leaking an internal placeholder.
export function businessLabel(name?: string): string {
  if (!name || name === "No client linked") return "";
  return name;
}
