// File storage for a photo the user uploads to use as the full-bleed
// background of rendered Messaging Creator slides. Metadata (the file name)
// lives on the MessagingSession (see slideImageFile in ../types); the bytes
// live on disk under data/messaging-uploads/, gitignored the same as
// data/deliverables/ and data/digital-product-uploads/. Buffer-based like
// branding/storage.ts and digitalProduct/uploads.ts since the payload is a
// binary image. The route normalizes uploads to PNG before saving.

import fs from "fs";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "data", "messaging-uploads");

export function uploadPath(fileName: string): string {
  return path.join(UPLOADS_DIR, fileName);
}

export function saveUpload(fileName: string, buffer: Buffer): void {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.writeFileSync(uploadPath(fileName), buffer);
}

export function deleteUpload(fileName: string): void {
  try {
    fs.unlinkSync(uploadPath(fileName));
  } catch {
    // Already gone -- fine, the db record is the thing being cleared.
  }
}
