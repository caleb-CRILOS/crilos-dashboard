import { NextResponse } from "next/server";
import fs from "fs";
import { deliverablePath } from "@/lib/pdf/generate";
import { mimeTypeForFileName } from "@/lib/hawk/generate";

const SAFE_FILENAME = /^[a-zA-Z0-9_-]+\.(pdf|docx|pptx|html)$/;
const INLINE_EXTENSIONS = new Set(["pdf", "html"]);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ fileName: string }> },
) {
  const { fileName } = await params;
  if (!SAFE_FILENAME.test(fileName)) {
    return NextResponse.json({ error: "Invalid file name." }, { status: 400 });
  }

  const filePath = deliverablePath(fileName);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Deliverable not found." }, { status: 404 });
  }

  const ext = fileName.split(".").pop() ?? "";
  const disposition = INLINE_EXTENSIONS.has(ext) ? "inline" : "attachment";

  const buffer = fs.readFileSync(filePath);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mimeTypeForFileName(fileName),
      "Content-Disposition": `${disposition}; filename="${fileName}"`,
    },
  });
}
