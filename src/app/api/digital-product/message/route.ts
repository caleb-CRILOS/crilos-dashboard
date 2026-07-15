import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getDb } from "@/lib/db";
import { mutateDb } from "@/lib/dbWrite";
import { isRunning, startTurn, withResolvedRunState } from "@/lib/agentJobs";
import { DigitalProductSession, OnboardingSession } from "@/lib/types";
import {
  buildEchoSystemPrompt,
  buildQuillDraftSystemPrompt,
  buildQuillSystemPrompt,
  DRAFT_REQUESTED_SENTINEL,
  PRODUCT_COMPLETE_SENTINEL,
} from "@/lib/digitalProduct/prompts";
import { digitalProductSchema } from "@/lib/digitalProduct/schemas";
import { extractStructured, SCRATCH_DIR, sendTurn } from "@/lib/claude-cli";
import { pickDefaultOnboardingSession } from "@/lib/agentContext";
import { logActivity } from "@/lib/activityLog";
import { saveUpload, deleteUpload } from "@/lib/digitalProduct/uploads";
import { ExtractedText, extractInlineText, extractsInline } from "@/lib/uploadTextExtraction";
import { generateDigitalProductDeliverable } from "@/lib/digitalProduct/generate";
import { deleteDeliverableFile } from "@/lib/pdf/generate";

const KICKOFF_MESSAGE = "Begin the conversation now, following your instructions.";

const ALLOWED_UPLOAD_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".txt", ".md", ".pdf", ".docx"];
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

type ClientContext = Parameters<typeof buildQuillSystemPrompt>[0];

function newSession(onboardingSession: OnboardingSession | undefined): DigitalProductSession {
  const now = new Date().toISOString();
  return {
    id: `digital-product-${Date.now()}`,
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

  // If a file was attached, save a durable copy (for the transcript chip /
  // download). Formats the server can reliably turn into plain text itself
  // (txt/md/docx -- see src/lib/uploadTextExtraction.ts) get extracted here
  // and inlined straight into the prompt below, skipping the CLI entirely.
  // Everything else (images, PDF) still needs a scratch copy in SCRATCH_DIR
  // so the background turn's Claude CLI process can Read it with its own
  // binary-aware tooling. The scratch copy is cleaned up by startTurn's
  // `cleanup` after the (detached) turn finishes -- not here, since this
  // handler now returns before the turn runs.
  let uploadedScratchPath: string | undefined;
  let storedUploadName: string | undefined;
  let inlineAttachmentText: ExtractedText | undefined;
  if (uploadedFile) {
    const ext = path.extname(uploadedFile.name).toLowerCase();
    const buffer = Buffer.from(await uploadedFile.arrayBuffer());
    // The original name can contain spaces/parens/etc, which the uploads
    // serving route's SAFE_FILENAME regex rejects -- sanitize what's stored
    // on disk, but keep the real name for the attachment's display title.
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

  // Resolve/create the session, guard against a double-submit, append the
  // user's message, and mark the turn running -- all in one serialized write
  // (mutateDb) so a poll landing immediately after sees a consistent state and
  // a concurrent turn on another tool can't clobber it.
  type Prep =
    | { kind: "error"; status: number; message: string }
    | {
        kind: "ok";
        session: DigitalProductSession;
        clientContext: ClientContext;
        clientId?: string;
        model?: string;
        isKickoff: boolean;
      };

  const prep = await mutateDb<Prep>((data) => {
    const model = data.settings.anthropicModel;
    let session: DigitalProductSession | undefined;
    if (sessionId) {
      session = data.digitalProductSessions.find((s) => s.id === sessionId);
      if (!session) return { kind: "error", status: 404, message: "Digital product session not found." };
    } else {
      const onboarding = pickDefaultOnboardingSession(data.onboardingSessions);
      session = newSession(onboarding);
      data.digitalProductSessions.push(session);
    }

    // Single-user tool -- no client picker. Always resolves to the one
    // onboarding profile on file so Quill/Echo draft against a real voice
    // profile + content bible instead of a blank one.
    if (isRunning(session)) {
      return {
        kind: "error",
        status: 409,
        message: "Quill is still working on your last message — give it a moment before sending another.",
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
    // The turn won't run, so nothing references the files we staged -- drop
    // them rather than leave orphans.
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

  // Only this first (Quill) turn needs the attached file's content -- every
  // later turn resumes the same Claude session via resumeSessionId, so
  // whatever's folded in here is already part of that transcript.
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

  // Hand the (potentially multi-minute) turn to the background runner and
  // respond immediately. The client polls GET ?id= for the result.
  startTurn<DigitalProductSession>({
    select: (data) => data.digitalProductSessions,
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
        systemPrompt: buildQuillSystemPrompt(clientContext),
        resumeSessionId: s.claudeSessionId,
        model,
        ...(uploadedScratchPath ? { tools: "Read" } : {}),
      });
      let latestSessionId = turn.sessionId;
      let replyText = turn.result;

      // Quill doesn't draft the full product in the same turn it gathers the
      // brief/outline -- Echo reviews Quill's draft for voice fit, then Quill
      // presents a summary of Echo's version. Each is a separate resumed CLI
      // call with its own --system-prompt.
      if (replyText.includes(DRAFT_REQUESTED_SENTINEL)) {
        const draftTurn = await sendTurn({
          prompt: "Draft the full product now, following the confirmed outline above.",
          systemPrompt: buildQuillDraftSystemPrompt(clientContext),
          resumeSessionId: latestSessionId,
          model,
        });
        latestSessionId = draftTurn.sessionId;

        const echoTurn = await sendTurn({
          prompt: "Review the draft above in apply mode. Output the final revised version.",
          systemPrompt: buildEchoSystemPrompt(clientContext),
          resumeSessionId: latestSessionId,
          model,
        });
        latestSessionId = echoTurn.sessionId;

        const presentTurn = await sendTurn({
          prompt:
            "Present a summary of Echo's finished draft above to the client now, then ask if they want any changes, a different format, or if this product is done.",
          systemPrompt: buildQuillSystemPrompt(clientContext),
          resumeSessionId: latestSessionId,
          model,
        });
        latestSessionId = presentTurn.sessionId;
        replyText = presentTurn.result;
      }

      s.claudeSessionId = latestSessionId;

      let structuredOutput: Record<string, unknown> | undefined;
      if (replyText.includes(PRODUCT_COMPLETE_SENTINEL)) {
        replyText = replyText.replace(PRODUCT_COMPLETE_SENTINEL, "").trimEnd();
        const extraction = await extractStructured({
          resumeSessionId: latestSessionId,
          schema: digitalProductSchema,
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
          s.deliverable = await generateDigitalProductDeliverable(s);
        } catch (err) {
          // A failed deliverable leaves the session complete without a
          // download chip rather than failing the whole turn (the draft is
          // still in the transcript). Rare enough to just log.
          console.error("[digital-product] deliverable generation failed:", err);
        }
        await mutateDb((_data, db) => {
          logActivity(db, {
            agent: "Quill",
            clientId,
            task: `Digital product: ${s.asset.title || "untitled"}`,
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
    const session = db.data.digitalProductSessions.find((s) => s.id === id);
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ session: withResolvedRunState(session) });
  }
  return NextResponse.json({ sessions: db.data.digitalProductSessions.map(withResolvedRunState) });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const all = url.searchParams.get("all") === "true";

  if (all) {
    // "all" clears completed history (keeps whatever's still in progress),
    // same semantics as Skool Posts' delete-all -- plus, unlike Skool Posts,
    // each completed session has a real deliverable file to clean up too. The
    // array swap goes through mutateDb so it can't clobber a concurrent turn;
    // the disk cleanup happens after, outside the lock.
    const toDelete = await mutateDb((data) => {
      const removed = data.digitalProductSessions.filter((s) => s.complete);
      data.digitalProductSessions = data.digitalProductSessions.filter((s) => !s.complete);
      return removed;
    });
    for (const s of toDelete) {
      if (s.deliverable?.fileName) deleteDeliverableFile(s.deliverable.fileName);
      for (const m of s.messages) {
        if (m.attachment?.fileName) deleteUpload(m.attachment.fileName);
      }
    }
    return NextResponse.json({ ok: true, deleted: toDelete.length });
  }

  if (!id) {
    return NextResponse.json({ error: "A session id is required." }, { status: 400 });
  }
  const removed = await mutateDb((data) => {
    const index = data.digitalProductSessions.findIndex((s) => s.id === id);
    if (index === -1) return undefined;
    const [session] = data.digitalProductSessions.splice(index, 1);
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
