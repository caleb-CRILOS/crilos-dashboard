// On-disk storage for the optional background photo behind a Digital Product
// cover -- either AI-generated (src/lib/covers/imageGen.ts) or uploaded by the
// coach. Metadata (the file name) lives on the asset (see
// DigitalProductAsset.coverBackgroundFileName in ../types); the bytes live
// under data/cover-uploads/, gitignored like the other data/* upload dirs.
// The route normalizes everything to PNG before saving.

import fs from "fs";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "data", "cover-uploads");

export function coverUploadPath(fileName: string): string {
  return path.join(UPLOADS_DIR, fileName);
}

export function saveCoverUpload(fileName: string, buffer: Buffer): void {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.writeFileSync(coverUploadPath(fileName), buffer);
}

export function deleteCoverUpload(fileName: string): void {
  try {
    fs.unlinkSync(coverUploadPath(fileName));
  } catch {
    // Already gone -- fine, the db record is the thing being cleared.
  }
}
