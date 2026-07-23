// Renders and saves the deliverable PDF for a given onboarding stage.
// Files live in data/deliverables/ (gitignored, same as db.json) --
// db.json only stores metadata pointing at them.

import { renderToBuffer } from "@react-pdf/renderer";
import fs from "fs";
import path from "path";
import {
  ChatMessage,
  DeliverableMeta,
  MessagingSession,
  OnboardingSession,
  OnboardingStage,
  VideoAdSession,
} from "../types";
import RecommendationPdf from "./RecommendationPdf";
import IcaPdf from "./IcaPdf";
import ContentGuidePdf from "./ContentGuidePdf";
import MessagingPiecePdf from "./MessagingPiecePdf";
import VideoAdScriptPdf from "./VideoAdScriptPdf";

const DELIVERABLES_DIR = path.join(process.cwd(), "data", "deliverables");

function lastAssistantMessage(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") return messages[i].content;
  }
  return "";
}

const TITLES: Record<OnboardingStage, string> = {
  setup: "Your First Recommendation",
  ica: "Ideal Client Avatar",
  contentGuide: "Content Guide",
};

export async function generateDeliverable(
  session: OnboardingSession,
  stage: OnboardingStage,
): Promise<DeliverableMeta> {
  let doc;
  if (stage === "setup") {
    doc = RecommendationPdf({
      profile: session.profile,
      recommendation: lastAssistantMessage(session.setupMessages),
    });
  } else if (stage === "ica") {
    doc = IcaPdf({ profile: session.profile, ica: session.ica });
  } else {
    doc = ContentGuidePdf({ profile: session.profile, contentGuide: session.contentGuide });
  }

  const buffer = await renderToBuffer(doc);
  fs.mkdirSync(DELIVERABLES_DIR, { recursive: true });
  const fileName = `${session.id}-${stage}.pdf`;
  fs.writeFileSync(path.join(DELIVERABLES_DIR, fileName), buffer);

  return {
    fileName,
    title: TITLES[stage],
    generatedAt: new Date().toISOString(),
  };
}

export function deliverablePath(fileName: string): string {
  return path.join(DELIVERABLES_DIR, fileName);
}

export function deleteDeliverableFile(fileName: string): void {
  try {
    fs.unlinkSync(deliverablePath(fileName));
  } catch {
    // Already gone -- fine, the db record is the thing being deleted.
  }
}

export async function generateMessagingDeliverable(
  session: MessagingSession,
): Promise<DeliverableMeta> {
  const doc = MessagingPiecePdf({ piece: session.piece, clientLabel: session.clientLabel });
  const buffer = await renderToBuffer(doc);
  fs.mkdirSync(DELIVERABLES_DIR, { recursive: true });
  const fileName = `${session.id}-piece.pdf`;
  fs.writeFileSync(path.join(DELIVERABLES_DIR, fileName), buffer);

  return {
    fileName,
    title: session.piece.topic || "Content Piece",
    generatedAt: new Date().toISOString(),
  };
}

export async function generateVideoAdDeliverable(
  session: VideoAdSession,
): Promise<DeliverableMeta> {
  const doc = VideoAdScriptPdf({ script: session.script, clientLabel: session.clientLabel });
  const buffer = await renderToBuffer(doc);
  fs.mkdirSync(DELIVERABLES_DIR, { recursive: true });
  const fileName = `${session.id}-script.pdf`;
  fs.writeFileSync(path.join(DELIVERABLES_DIR, fileName), buffer);

  return {
    fileName,
    title: "Video Ad Script",
    generatedAt: new Date().toISOString(),
  };
}

