// File storage for Sales Outreach (Hawk) chat attachments. Metadata lives
// on the owning ChatMessage (see ChatMessage.attachment in ../types); the
// actual bytes live on disk under data/hawk-uploads/, gitignored the same
// as data/assets/, data/branding/, and data/steward-uploads/. Buffer-based
// like steward/uploads.ts since attachments can be images or binary docs,
// not just plain text.

import fs from "fs";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "data", "hawk-uploads");

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
