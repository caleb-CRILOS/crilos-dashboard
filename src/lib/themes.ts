// Color themes for the dashboard. Single source of truth for the theme
// keys used across the Settings picker, the Settings type, and the root
// layout (which stamps `data-theme` on <html>).
//
// The actual re-skinning lives in globals.css: each key (except the
// default `kore`, which is the `:root` palette) has a `[data-theme="…"]`
// block that overrides the name-stable color variables. The `chips` here
// are ONLY the small preview swatches shown in the Settings picker
// (surface / text / accent) — they mirror three representative values
// from each CSS block. Fonts and structure never change between themes.

export type ThemeName = "kore" | "noir" | "light" | "slate" | "rosette";

export const DEFAULT_THEME: ThemeName = "kore";

export type ThemeMeta = {
  key: ThemeName;
  label: string;
  blurb: string;
  // [surface, text, accent] — preview swatch chips only.
  chips: [string, string, string];
};

export const THEMES: ThemeMeta[] = [
  {
    key: "kore",
    label: "KORE",
    blurb: "Bone substrate, ink geometry, one signal blue.",
    chips: ["#e7e3d6", "#111110", "#0c77c2"],
  },
  {
    key: "noir",
    label: "Noir",
    blurb: "Dark inversion — charcoal sheet, bone type, warm yellow.",
    chips: ["#17160f", "#e8e4d7", "#f2c14e"],
  },
  {
    key: "light",
    label: "Light",
    blurb: "Cool bright sheet, ink type, scarlet accent.",
    chips: ["#f4f6f7", "#14181d", "#e63946"],
  },
  {
    key: "slate",
    label: "Slate",
    blurb: "Cool — pale blue-gray paper, navy ink, steel accent.",
    chips: ["#e3e6ea", "#14181d", "#3f6b8c"],
  },
  {
    key: "rosette",
    label: "Rosette",
    blurb: "Soft — blush sheet, deep plum ink, rose accent.",
    chips: ["#f3e7ea", "#2a1620", "#c13e7a"],
  },
];

export function isThemeName(v: unknown): v is ThemeName {
  return typeof v === "string" && THEMES.some((t) => t.key === v);
}
