import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getDb } from "@/lib/db";
import { mutateDb } from "@/lib/dbWrite";
import { isRunning, startTurn, withResolvedRunState } from "@/lib/agentJobs";
import { HawkSession, OnboardingSession } from "@/lib/types";
import {
  ASSET_COMPLETE_SENTINEL,
  buildHawkDraftSystemPrompt,
  buildHawkEchoSystemPrompt,
  buildHawkOrchestratorSystemPrompt,
  DRAFT_REQUESTED_SENTINEL,
} from "@/lib/hawk/prompts";
import { hawkAssetSchema } from "@/lib/hawk/schemas";
import { extractStructured, SCRATCH_DIR, sendTurn } from "@/lib/claude-cli";
import { pickDefaultOnboardingSession } from "@/lib/agentContext";
import { logActivity } from "@/lib/activityLog";
import { saveUpload, deleteUpload } from "@/lib/hawk/uploads";
import { ExtractedText, extractInlineText, extractsInline } from "@/lib/uploadTextExtraction";
import { generateHawkDeliverable } from "@/lib/hawk/generate";
import { deleteDeliverableFile } from "@/lib/pdf/generate";

const KICKOFF_MESSAGE = "Begin the conversation now, following your instructions.";

const ALLOWED_UPLOAD_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".txt", ".md", ".pdf", ".docx"];
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

type ClientContext = Parameters<typeof buildHawkOrchestratorSystemPrompt>[0];

function newSession(onboardingSession: OnboardingSession | undefined): HawkSession {
  const now = new Date().toISOString();
  return {
    id: `hawk-${Date.now()}`,
    onboardingSessionId: onboardingSession?.id,
    clientLabel:
      onboardingSession?.profile.businessName || onboardingSession?.profile.name || "No client linked",
    messages: [],
    asset: {},
    complete: false,
    createdAt: now,
    updatedAt: now,
  };
}

export async function POST(req: Request) {
  const form = await req.formData();
  const sessionId = form.get("sessionId")?.toString() || undefined;
  const message = form.get("message")?.toString() || "";
  const file = form.get("file");
  const uploadedFile = file instanceof File ? file : undefined;

  if (uploadedFile) {
    const ext = path.extname(uploadedFile.name).toLowerCase();
    if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: "Upload a PNG, JPG, WEBP, GIF, TXT, MD, PDF, or DOCX file." },
        { status: 400 },
      );
    }
    if (uploadedFile.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File is too large (max 10 MB)." }, { status: 400 });
    }
  }

  const userText = (message ?? "").trim();

  // Durable upload + inline extraction / scratch copy, before touching the db.
  // Inline formats (txt/md/docx) are extracted straight into the prompt;
  // images/PDF get a scratch copy the background turn's CLI reads via its Read
  // tool, cleaned up by startTurn's `cleanup` after the detached turn.
  let uploadedScratchPath: string | undefined;
  let storedUploadName: string | undefined;
  let inlineAttachmentText: ExtractedText | undefined;
  if (uploadedFile) {
    const ext = path.extname(uploadedFile.name).toLowerCase();
    const buffer = Buffer.from(await uploadedFile.arrayBuffer());
    const safeOriginalName = uploadedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    storedUploadName = `${Date.now()}-${safeOriginalName}`;
    saveUpload(storedUploadName, buffer);

    if (extractsInline(ext)) {
      inlineAttachmentText = await extractInlineText(ext, buffer);
    } else {
      fs.mkdirSync(SCRATCH_DIR, { recursive: true });
      uploadedScratchPath = path.join(SCRATCH_DIR, storedUploadName);
      fs.writeFileSync(uploadedScratchPath, buffer);
    }
  }

  type Prep =
    | { kind: "error"; status: number; message: string }
    | {
        kind: "ok";
        session: HawkSession;
        clientContext: ClientContext;
        clientId?: string;
        model?: string;
        isKickoff: boolean;
      };

  const prep = await mutateDb<Prep>((data) => {
    const model = data.settings.anthropicModel;
    let session: HawkSession | undefined;
    if (sessionId) {
      session = data.hawkSessions.find((s) => s.id === sessionId);
      if (!session) return { kind: "error", status: 404, message: "Hawk session not found." };
    } else {
      const onboarding = pickDefaultOnboardingSession(data.onboardingSessions);
      session = newSession(onboarding);
      data.hawkSessions.push(session);
    }

    if (isRunning(session)) {
      return {
        kind: "error",
        status: 409,
        message: "Hawk is still working on your last message — give it a moment before sending another.",
      };
    }

    const isKickoff = userText.length === 0 && !uploadedFile && session.messages.length === 0;
    if (!isKickoff) {
      session.messages.push({
        role: "user",
        content: userText,
        ...(storedUploadName
          ? { attachment: { fileName: storedUploadName, title: uploadedFile!.name } }
          : {}),
      });
    }

    const now = new Date().toISOString();
    session.runStatus = "running";
    session.runningSince = now;
    session.runError = undefined;
    session.updatedAt = now;

    const onboarding = session.onboardingSessionId
      ? data.onboardingSessions.find((s) => s.id === session!.onboardingSessionId)
      : undefined;
    const clientContext: ClientContext = {
      profile: onboarding?.profile,
      voice: onboarding?.voice,
      ica: onboarding?.ica,
      contentBible: onboarding?.contentBible,
    };

    return {
      kind: "ok",
      session: structuredClone(session),
      clientContext,
      clientId: onboarding?.clientId,
      model,
      isKickoff,
    };
  });

  if (prep.kind === "error") {
    if (storedUploadName) deleteUpload(storedUploadName);
    if (uploadedScratchPath) {
      try {
        fs.unlinkSync(uploadedScratchPath);
      } catch {
        // Already gone -- fine.
      }
    }
    return NextResponse.json({ error: prep.message }, { status: prep.status });
  }

  const { session, clientContext, clientId, model, isKickoff } = prep;
  const prompt = isKickoff ? KICKOFF_MESSAGE : userText;

  // Only this first (Atlas) turn needs the attached file's content -- later
  // turns resume the same Claude session, so it's already in that transcript.
  let attachmentInstruction = "";
  if (inlineAttachmentText) {
    attachmentInstruction = inlineAttachmentText.ok
      ? `\n\n[The user attached a file named "${uploadedFile!.name}". Its full text content follows -- use it to inform your reply.${
          inlineAttachmentText.truncated ? " (Truncated for length; treat this as a partial excerpt.)" : ""
        }]\n\n## Attached file: "${uploadedFile!.name}"\n\n${inlineAttachmentText.text}`
      : `\n\n[The user attached a file named "${uploadedFile!.name}", but it couldn't be read (${inlineAttachmentText.reason}). Tell them plainly rather than guessing at its contents.]`;
  } else if (uploadedScratchPath) {
    attachmentInstruction = `\n\n[The user attached a file named "${storedUploadName}" in the current directory (original name: "${uploadedFile!.name}"). Use the Read tool to open and review it before responding, and factor what you learn into your reply. If you can't read it (e.g. an unsupported format), say so plainly rather than guessing at its contents.]`;
  }

  startTurn<HawkSession>({
    select: (data) => data.hawkSessions,
    sessionId: session.id,
    cleanup: () => {
      if (uploadedScratchPath) {
        try {
          fs.unlinkSync(uploadedScratchPath);
        } catch {
          // Already gone -- fine.
        }
      }
    },
    run: async (s) => {
      const turn = await sendTurn({
        prompt: prompt + attachmentInstruction,
        systemPrompt: buildHawkOrchestratorSystemPrompt(clientContext),
        resumeSessionId: s.claudeSessionId,
        model,
        ...(uploadedScratchPath ? { tools: "Read" } : {}),
      });
      let latestSessionId = turn.sessionId;
      let replyText = turn.result;

      // Atlas doesn't draft -- Hawk drafts, Echo reviews Hawk's draft for
      // voice fit and the pricing/guarantee guardrails, then Atlas presents
      // Echo's version. Each is a separate resumed CLI call.
      if (replyText.includes(DRAFT_REQUESTED_SENTINEL)) {
        const hawkTurn = await sendTurn({
          prompt: "Draft the asset now, following the brief above.",
          systemPrompt: buildHawkDraftSystemPrompt(clientContext),
          resumeSessionId: latestSessionId,
          model,
        });
        latestSessionId = hawkTurn.sessionId;

        const echoTurn = await sendTurn({
          prompt: "Review the draft above in apply mode. Output the final revised version.",
          systemPrompt: buildHawkEchoSystemPrompt(clientContext),
          resumeSessionId: latestSessionId,
          model,
        });
        latestSessionId = echoTurn.sessionId;

        const presentTurn = await sendTurn({
          prompt:
            "Present Echo's finished draft above to the client now, then ask if they want a revision or if this asset is done.",
          systemPrompt: buildHawkOrchestratorSystemPrompt(clientContext),
          resumeSessionId: latestSessionId,
          model,
        });
        latestSessionId = presentTurn.sessionId;
        replyText = presentTurn.result;
      }

      s.claudeSessionId = latestSessionId;

      let structuredOutput: Record<string, unknown> | undefined;
      if (replyText.includes(ASSET_COMPLETE_SENTINEL)) {
        replyText = replyText.replace(ASSET_COMPLETE_SENTINEL, "").trimEnd();
        const extraction = await extractStructured({
          resumeSessionId: latestSessionId,
          schema: hawkAssetSchema,
          model,
        });
        structuredOutput = extraction.structuredOutput;
      }

      if (replyText) {
        s.messages.push({ role: "assistant", content: replyText });
      }

      if (structuredOutput) {
        s.asset = { ...s.asset, ...structuredOutput };
        s.complete = true;
        try {
          s.deliverable = await generateHawkDeliverable(s);
        } catch (err) {
          console.error("[hawk] deliverable generation failed:", err);
        }
        await mutateDb((_data, db) => {
          logActivity(db, {
            agent: "Hawk",
            clientId,
            task: `Sales asset: ${s.asset.assetType || "untitled"} -- ${s.asset.prospectLabel || "no label"}`,
            status: "done",
          });
        });
      }
    },
  });

  return NextResponse.json({ sessionId: session.id, session, status: "running" });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const db = await getDb();
  if (id) {
    const session = db.data.hawkSessions.find((s) => s.id === id);
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ session: withResolvedRunState(session) });
  }
  return NextResponse.json({ sessions: db.data.hawkSessions.map(withResolvedRunState) });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "A session id is required." }, { status: 400 });
  }

  const removed = await mutateDb((data) => {
    const index = data.hawkSessions.findIndex((s) => s.id === id);
    if (index === -1) return undefined;
    const [session] = data.hawkSessions.splice(index, 1);
    return session;
  });
  if (!removed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (removed.deliverable?.fileName) {
    deleteDeliverableFile(removed.deliverable.fileName);
  }
  for (const m of removed.messages) {
    if (m.attachment?.fileName) deleteUpload(m.attachment.fileName);
  }

  return NextResponse.json({ ok: true });
}
