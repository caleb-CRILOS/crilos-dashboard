// File storage for ClientAsset content. Metadata (title, uploadedAt)
// lives in db.json like everything else; the actual text content lives
// on disk under data/assets/<clientId>/, gitignored the same as
// data/deliverables/ -- same split already established by
// src/lib/pdf/generate.ts for deliverable PDFs.

import fs from "fs";
import path from "path";

const ASSETS_DIR = path.join(process.cwd(), "data", "assets");

export function assetPath(clientId: string, fileName: string): string {
  return path.join(ASSETS_DIR, clientId, fileName);
}

export function saveAssetFile(clientId: string, fileName: string, content: string): void {
  const dir = path.join(ASSETS_DIR, clientId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), content, "utf-8");
}

export function readAssetFile(clientId: string, fileName: string): string {
  return fs.readFileSync(assetPath(clientId, fileName), "utf-8");
}

export function deleteAssetFile(clientId: string, fileName: string): void {
  try {
    fs.unlinkSync(assetPath(clientId, fileName));
  } catch {
    // Already gone -- fine, the db record is the thing being deleted.
  }
}
