// Color themes for the dashboard. Single source of truth for the theme
// keys used across the Settings picker, the Settings type, and the root
// layout (which stamps `data-theme` on <html>).
//
// The actual re-skinning lives in globals.css: `light` is the `:root`
// palette and `dark` has a `[data-theme="dark"]` block overriding the
// name-stable color variables. The `chips` here are ONLY the small
// preview swatches shown in the Settings picker (surface / text /
// accent) — they mirror three representative values from each CSS
// block. Fonts, radius, and shape never change between themes.
//
// Note the root layout validates with `isThemeName()` rather than
// defaulting, so a value persisted by an older build (e.g. "kore",
// "noir", "slate", "rosette") degrades to DEFAULT_THEME instead of
// stamping a data-theme with no matching CSS block.

export type ThemeName = "light" | "dark";

export const DEFAULT_THEME: ThemeName = "light";

export type ThemeMeta = {
  key: ThemeName;
  label: string;
  blurb: string;
  // [surface, text, accent] — preview swatch chips only.
  chips: [string, string, string];
};

export const THEMES: ThemeMeta[] = [
  {
    key: "light",
    label: "Light",
    blurb: "White cards on a cool near-white canvas, signal blue accent.",
    chips: ["#f4f7fb", "#101725", "#0c77c2"],
  },
  {
    key: "dark",
    label: "Dark",
    blurb: "Deep slate surfaces, bright type, the same signal blue.",
    chips: ["#0d1117", "#e6edf5", "#2b8fdb"],
  },
];

export function isThemeName(v: unknown): v is ThemeName {
  return typeof v === "string" && THEMES.some((t) => t.key === v);
}
