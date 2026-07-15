import { NextResponse } from "next/server";
import fs from "fs";
import { deliverablePath } from "@/lib/pdf/generate";

// The on-brand HTML research doc (generateSageBrandedDoc) lives in
// data/deliverables/. Market Research only produces HTML now -- the legacy
// react-pdf export was removed.
const SAFE_FILENAME = /^[a-zA-Z0-9_-]+\.html$/;

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

  const buffer = fs.readFileSync(filePath);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="${fileName}"`,
    },
  });
}
