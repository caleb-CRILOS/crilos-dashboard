// File storage for the branding standard. Metadata + design tokens live in
// db.json (see BrandingStandard in ../types); the actual bytes -- the source
// brand image, the generated design.html, and design.md -- live on disk
// under data/branding/, gitignored the same as data/deliverables/ and
// data/assets/. Unlike assets.ts (UTF-8 text only), the source image is
// binary, so this exposes both a Buffer and a text save.

import fs from "fs";
import path from "path";

const BRANDING_DIR = path.join(process.cwd(), "data", "branding");

export function brandingPath(fileName: string): string {
  return path.join(BRANDING_DIR, fileName);
}

export function saveBinary(fileName: string, buffer: Buffer): void {
  fs.mkdirSync(BRANDING_DIR, { recursive: true });
  fs.writeFileSync(brandingPath(fileName), buffer);
}

export function saveText(fileName: string, content: string): void {
  fs.mkdirSync(BRANDING_DIR, { recursive: true });
  fs.writeFileSync(brandingPath(fileName), content, "utf-8");
}

export function readTextFile(fileName: string): string {
  return fs.readFileSync(brandingPath(fileName), "utf-8");
}

export function deleteFile(fileName: string): void {
  try {
    fs.unlinkSync(brandingPath(fileName));
  } catch {
    // Already gone -- fine, the db record is the thing being cleared.
  }
}
