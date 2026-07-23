// Core data model for the dashboard.
// Kept intentionally simple (flat JSON-friendly shapes) since the storage
// layer is a local JSON file, not a relational database.

import type { ThemeName } from "./themes";

export type HealthStatus = "green" | "yellow" | "red";

export type ClientStatus = "active" | "paused" | "churned";

export type ClientSource = "ghl" | "skool" | "manual";

export interface Client {
  id: string;
  name: string;
  email?: string;
  source: ClientSource;
  ghlContactId?: string;
  ghlOpportunityId?: string;
  skoolUserId?: string;
  status: ClientStatus;
  joinedAt: string; // ISO date
  lastActivityAt?: string; // ISO date - most recent engagement of any kind
  lastPaymentAt?: string; // ISO date
  paymentStatus?: "current" | "past_due" | "unknown";
  mrr?: number; // monthly recurring revenue in dollars, if known
  tags?: string[];
  notes?: string;
  // Cached health status, recomputed by lib/health.ts whenever data changes.
  health?: HealthStatus;
}

export type EngagementType =
  | "skool_post"
  | "skool_comment"
  | "skool_login"
  | "payment"
  | "payment_failed"
  | "ghl_note"
  | "ghl_stage_change"
  | "call"
  | "email"
  | "manual";

export interface EngagementEvent {
  id: string;
  clientId: string;
  type: EngagementType;
  occurredAt: string; // ISO date
  meta?: Record<string, unknown>;
}

export interface RevenueSnapshot {
  date: string; // ISO date, one entry per day
  mrr: number;
  activeClients: number;
  newClients: number;
  churnedClients: number;
}

export interface HealthThresholds {
  yellowDays: number; // days since last activity before a client goes yellow
  redDays: number; // days since last activity before a client goes red
}

/**
 * A verified Memberful sign-in. Being a single-user local app, this record
 * in db.json IS the session — presence of a non-null value unlocks the app.
 */
export interface MemberAuth {
  email: string;
  verifiedAt: string; // ISO timestamp of when membership was last verified
}

export interface Settings {
  ghlPrivateToken?: string;
  ghlLocationId?: string;
  anthropicApiKey?: string;
  anthropicModel?: string;
  skoolWebhookSecret?: string;
  healthThresholds: HealthThresholds;
  // Dashboard color theme (see src/lib/themes.ts). Stamped on <html>
  // as data-theme by the root layout; only colors change, never fonts.
  theme?: ThemeName;
  lastGhlSyncAt?: string;
  // Gmail OAuth app credentials (from a Google Cloud project the user
  // sets up themselves) plus the long-lived refresh token from
  // completing the consent flow once. Independent of anthropicApiKey --
  // this app-level client id/secret only proves the app is allowed to
  // ask for Gmail access, the refresh token is what actually grants it.
  gmailClientId?: string;
  gmailClientSecret?: string;
  gmailRefreshToken?: string;
  // Optional fal.ai API key, used ONLY when the coach opts into an AI-generated
  // background for a Digital Product cover (src/lib/covers/imageGen.ts).
  // Pay-as-you-go on the coach's own account; everything else stays $0.
  falApiKey?: string;
  // Set by the background inbox watcher (src/lib/inbox/watcher.ts) each
  // time it polls, independent of any user visiting /inbox.
  inboxLastCheckedAt?: string;
  // True from the moment the watcher finds new unread mail until the
  // user visits /inbox (Sidebar clears it on navigation) -- drives the
  // "Inbox" nav link's attention color.
  inboxHasUnseenMail?: boolean;
  // Verified Memberful member (the sign-in gate). Null/absent = signed out,
  // which makes the app render the MemberfulGate instead of the dashboard.
  memberAuth?: MemberAuth | null;
}

export interface DbSchema {
  // Bumped when the SHAPE of stored data changes; drives the migration
  // runner in src/lib/db.ts. Absent on pre-versioning db.json files (read
  // as 0). See CURRENT_SCHEMA_VERSION.
  schemaVersion: number;
  clients: Client[];
  events: EngagementEvent[];
  revenueSnapshots: RevenueSnapshot[];
  settings: Settings;
  insights: InsightEntry[];
  onboardingSessions: OnboardingSession[];
  messagingSessions: MessagingSession[];
  videoAdSessions: VideoAdSession[];
  dmSessions: DmSession[];
  dmConversionOutcomes: DmConversionOutcome[];
  activityLog: ActivityLogEntry[];
  sageSessions: SageSession[];
  hawkSessions: HawkSession[];
  stewardSessions: StewardSession[];
  skoolPostSessions: SkoolPostSession[];
  digitalProductSessions: DigitalProductSession[];
  clientAssets: ClientAsset[];
  emailDraftSessions: EmailDraftSession[];
  composeEmailSessions: ComposeEmailSession[];
  // The single active branding standard (one at a time -- uploading a new
  // brand image replaces it). Null until the user generates one. The HTML,
  // markdown, and source image bytes live on disk under data/branding/;
  // this record only holds metadata + the extracted design tokens.
  brandingStandard: BrandingStandard | null;
  // Thread IDs the background inbox watcher has already logged, so it
  // doesn't write a duplicate activity-log entry for the same unread
  // thread on every 90-minute cycle.
  inboxSeenThreadIds: string[];
}

// Concrete design values extracted from the branding standard, consumed by
// the deliverable renderers (pdf/styles.ts, steward/generate.ts) so their
// output matches the user's brand instead of hard-coded CRILOS defaults.
// Every field is optional -- a partial extraction is merged over DEFAULTS
// (see src/lib/branding/standard.ts) so a missing value never breaks a render.
export interface BrandTokens {
  primary?: string; // accent / link color (hex)
  ink?: string; // primary text color (hex)
  paper?: string; // page background (hex)
  muted?: string; // secondary text color (hex)
  line?: string; // border / rule color (hex)
  fontFamily?: string; // body font stack
  headingFontFamily?: string; // heading font stack
  bodyFont?: BrandFontFile; // cached Google Fonts file for fontFamily, if resolved
  headingFont?: BrandFontFile; // cached Google Fonts file for headingFontFamily, if resolved
}

// A brand font resolved to an actual downloadable file (regular + optional
// bold weight), cached on disk under data/branding/fonts/ so PDF rendering
// can register it with @react-pdf/renderer synchronously. Null/absent when
// the font name couldn't be matched to a Google Fonts family -- callers fall
// back to the default Helvetica look, same as before this feature existed.
export interface BrandFontFile {
  family: string; // resolved Google Fonts family name
  regularFileName?: string; // .ttf file under data/branding/
  boldFileName?: string; // .ttf file under data/branding/
}

// The user's active branding standard: an HTML design-system reference +
// a design markdown doc, generated by Atlas from an uploaded brand image.
// Becomes the standard every document/HTML output in the dashboard
// references. File bytes live on disk under data/branding/, not in db.json.
export interface BrandingStandard {
  id: string;
  createdAt: string;
  title: string; // display name, from the uploaded image's file name
  sourceImageFileName: string; // original brand image on disk
  htmlFileName: string; // generated design.html on disk
  mdFileName: string; // generated design.md on disk
  tokens: BrandTokens;
}

// The dashboard's equivalent of the CRILOS CLI's reports/status-log.md --
// one entry per agent action, so a client's page can answer "what's been
// done for this client" without digging through session transcripts.
export interface ActivityLogEntry {
  id: string;
  timestamp: string; // ISO date
  agent: string; // e.g. "Quill", "Echo", "Sage", "Hawk", "Steward"
  clientId?: string;
  task: string;
  status: "done" | "blocked" | "needs-review";
  output?: string;
  notes?: string;
}

export interface InsightEntry {
  id: string;
  generatedAt: string;
  summary: string;
  priorities: string[];
  flags: string[];
}

// Onboarding — a chat-driven interview modeled on the setup.md / /ica /
// /content-bible scripts from the client's own CRILOS CLI product.
// Three stages, run in order; each ends when the model calls that stage's
// "finish_*" tool with its full structured output.

export type OnboardingStage = "setup" | "ica" | "contentBible";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  // Optional -- only DM 2 Close currently populates this, to compute Lead
  // Health from time elapsed since the last message. Other tools' chat
  // messages leave it undefined.
  timestamp?: string;
  // Set only on Document Ops (Steward) messages where the user attached a
  // file for Steward to review. Bytes live on disk under
  // data/steward-uploads/ (see src/lib/steward/uploads.ts); fileName is the
  // stored (globally-unique) name, title is the original upload name.
  attachment?: { fileName: string; title: string };
}

export interface OnboardingProfile {
  name?: string;
  age?: string;
  businessName?: string;
  owner?: string;
  whatTheyDo?: string;
  website?: string;
  leadSource?: string;
  offer?: string;
  pricePoint?: string;
  deliveryFormat?: string;
  crm?: string;
  calendar?: string;
  emailTool?: string;
  payment?: string;
  otherTools?: string;
  goal90?: string;
  bottleneck?: string;
  kpis?: string;
  dreamOutcome?: string;
}

export interface VoiceProfile {
  toneDescriptors?: string;
  energyLevel?: string;
  formality?: string;
  humor?: string;
  wordsUsed?: string;
  wordsAvoided?: string;
  jargon?: string;
  sentenceLength?: string;
  paragraphLength?: string;
  contractions?: string;
  formattingQuirks?: string;
  claimsOk?: string;
  claimsGuarded?: string;
  samples?: string[];
}

export interface IcaProfile {
  vertical?: string;
  idealResult?: string;
  icaAge?: string;
  icaGender?: string;
  icaOccupation?: string;
  icaLocation?: string;
  icaIncome?: string;
  icaFears?: string;
  icaScared?: string;
  icaAvoids?: string;
  icaWorstCase?: string;
  icaPowerless?: string;
  icaSignatureOffer?: string;
  icaEaseFear?: string;
  customerAvatar?: string;
  painPoints?: string;
  goalsDreams?: string;
  icaExcludes?: string;
  icaObjection?: string;
}

export interface ContentBibleGoalRow {
  goal: string;
  mechanism: string;
  problem: string;
  knowsWhen: string;
}

export interface ContentBibleStepRow {
  step: string;
  problem: string;
  resource: string;
}

export interface ContentBible {
  overallAim?: string;
  goals?: ContentBibleGoalRow[];
  objections?: string;
  voc?: string;
  methodologyName?: string;
  steps?: ContentBibleStepRow[][];
}

export interface OnboardingSession {
  id: string;
  // Which Client record this onboarding data belongs to. Optional so
  // existing sessions created before this field existed still load; new
  // sessions should always set it via the client picker.
  clientId?: string;
  stage: OnboardingStage;
  setupMessages: ChatMessage[];
  icaMessages: ChatMessage[];
  contentBibleMessages: ChatMessage[];
  // Claude Code CLI's own session id per stage, used with `--resume` so
  // each stage's conversation keeps context across turns.
  claudeSessionIds: Partial<Record<OnboardingStage, string>>;
  profile: OnboardingProfile;
  voice: VoiceProfile;
  ica: IcaProfile;
  contentBible: ContentBible;
  setupComplete: boolean;
  icaComplete: boolean;
  contentBibleComplete: boolean;
  // When each stage last finished, so the UI can tell that a later stage was
  // built on answers a redo has since changed (ICA is stale if setup completed
  // after it). Derived rather than stored as a flag so it can't drift. Absent
  // on sessions predating this field -- those are treated as not stale, since
  // the ordering genuinely isn't known.
  stageCompletedAt?: Partial<Record<OnboardingStage, string>>;
  // Stages currently being redone. Every CLI call gets a fresh --system-prompt
  // even when resuming (see extractStructured in claude-cli.ts), so this has to
  // persist across turns -- otherwise turn 2 of a redo would be handed the
  // first-contact prompt and greet an existing client as a stranger. Cleared
  // when the stage completes again.
  revisingStages?: Partial<Record<OnboardingStage, boolean>>;
  // Metadata for generated deliverable PDFs, keyed by stage. The PDF bytes
  // themselves live on disk under data/deliverables/, not in this JSON file.
  deliverables: Partial<Record<OnboardingStage, DeliverableMeta>>;
  createdAt: string;
  updatedAt: string;
}

export interface DeliverableMeta {
  fileName: string;
  title: string;
  generatedAt: string;
}

// Background-run state mixed into every chat session type. A turn now runs
// detached from the HTTP request that kicked it off (see src/lib/agentJobs.ts)
// so the user can navigate away without losing it -- the session itself
// carries whether a turn is in flight, and db.json is the source of truth the
// poll endpoint (GET ?id=) and the client hook (useAgentChat) both read.
// `runStatus` undefined = settled/idle.
export interface AgentRunState {
  runStatus?: "running" | "error";
  // Human-readable failure message for the error banner, set when a detached
  // turn throws (mirrors the message the old synchronous 502 returned).
  runError?: string;
  // ISO timestamp of when the in-flight turn started. A session still marked
  // "running" whose runningSince is older than the max plausible turn is
  // treated as interrupted (e.g. the dev server restarted mid-turn) rather
  // than spinning forever -- see the staleness guard in the GET handlers.
  runningSince?: string;
}

// Messaging Creator -- a chat-driven content-drafting conversation modeled
// on the CRILOS CLI's `/messaging-creator` skill: greets, proposes ideas
// pulled from the client's content bible, then drafts and voice-QAs
// whichever one is picked. Unlike onboarding this is meant to be run
// repeatedly, so each run is its own short session tied to a client
// (an onboarding session) rather than a multi-stage flow.

// One slide of a carousel piece, extracted alongside finalText so the piece
// can be rendered as on-brand slide images (see src/lib/slides/renderSlides.ts).
export interface CarouselSlide {
  headline?: string;
  body?: string;
}

// How much on-image text a single-image post (IG image / LinkedIn post)
// should carry when rendered. Chosen by the client during the chat brief;
// the renderer honors it. Carousels ignore this.
export type ImageCardStyle = "hook-cta" | "hook-intro" | "headline-only";

export interface MessagingPiece {
  topic?: string;
  format?: string;
  platform?: string;
  cta?: string;
  finalText?: string;
  // The post body the client actually pastes into the platform. Distinct from
  // finalText: on a carousel, finalText is the whole 6-beat piece and `slides`
  // carry the on-slide text, so the post itself would otherwise have no copy.
  caption?: string;
  // Platform-appropriate tags, stored WITHOUT the leading "#" -- the UI and
  // PDF add it, so the raw values stay easy to re-use elsewhere.
  hashtags?: string[];
  // 2-3 alternate opening lines for the same piece, for A/B testing a hook.
  hookVariants?: string[];
  // A short visual direction for the piece (mood, subject, palette). Seeds the
  // fal.ai background prompt -- see src/lib/covers/imageGen.ts.
  imageConcept?: string;
  // Plain-language posting recommendation from the conversation, e.g.
  // "Tuesday morning". Pre-fills the schedule picker; not itself a date.
  suggestedPostAt?: string;
  // Present for carousel pieces (the draft split into ordered slides) and for
  // single-image posts (exactly one slide: the short on-image text).
  slides?: CarouselSlide[];
  // Single-image posts only: which on-image text treatment the client picked.
  imageCardStyle?: ImageCardStyle;
}

export interface MessagingSession extends AgentRunState {
  id: string;
  // The onboarding session this piece is being drafted for -- supplies the
  // profile/voice/ICA/content bible context. Optional so the tool still
  // degrades gracefully if no client has been onboarded yet.
  onboardingSessionId?: string;
  clientLabel: string;
  messages: ChatMessage[];
  claudeSessionId?: string;
  piece: MessagingPiece;
  complete: boolean;
  deliverable?: DeliverableMeta;
  // File names (under data/deliverables/) of rendered on-brand slide PNGs,
  // in slide order, once the user has generated them for a carousel piece.
  slideFiles?: string[];
  // File name (under data/messaging-uploads/) of the photo used as the
  // full-bleed background of the rendered slides. Optional. Either uploaded by
  // the user or generated from the piece's imageConcept -- slideImageKind says
  // which, so the UI can label the thumbnail.
  slideImageFile?: string;
  slideImageKind?: "ai" | "upload";
  // The day this piece is planned to go out (YYYY-MM-DD), set by the user in
  // the Posting schedule panel. Local only -- deliberately not synced to
  // Google Calendar.
  scheduledFor?: string;
  createdAt: string;
  updatedAt: string;
}

// Video Ad Framework -- a chat-driven tool that drafts a 9-step video ad
// script (hook, promise, value-bomb tease, credibility, problem, why
// solutions fail, solution, why it works, CTA), same session/deliverable
// shape as Messaging Creator.

export interface VideoAdScript {
  hook?: string;
  promise?: string;
  valueBombKeyword?: string;
  valueBombResource?: string;
  credibility?: string;
  problem?: string;
  whySolutionsFail?: string;
  solutionSteps?: string;
  whyItWorks?: string;
  cta?: string;
  platform?: string;
  finalScript?: string;
}

export interface VideoAdSession extends AgentRunState {
  id: string;
  onboardingSessionId?: string;
  clientLabel: string;
  messages: ChatMessage[];
  claudeSessionId?: string;
  script: VideoAdScript;
  complete: boolean;
  deliverable?: DeliverableMeta;
  createdAt: string;
  updatedAt: string;
}

// DM 2 Close -- a live reply assistant for DM-based lead conversations,
// modeled on the same Quill-drafts/Echo-reviews split as the other tools,
// except Quill is the visible persona here (no Atlas relay) since this is
// a fast back-and-forth tool, not a one-time deliverable interview. Unlike
// Messaging Creator/Video Ad Framework, a DM thread never "completes" --
// each session is an ongoing conversation tied to one lead, resumed
// indefinitely as the coach feeds in the lead's latest reply.

export type DmStage = "Respond" | "Relate" | "Assess" | "Frame" | "Ask";

export interface DmSession extends AgentRunState {
  id: string;
  onboardingSessionId?: string;
  clientLabel: string;
  // Identifies which lead/prospect this thread is with (e.g. "@janedoe --
  // IG comment reply"), since a coach runs many of these concurrently.
  leadLabel: string;
  messages: ChatMessage[];
  claudeSessionId?: string;
  currentStage?: DmStage;
  createdAt: string;
  updatedAt: string;
}

// A KPI record captured when a DM 2 Close thread is deleted: did this
// lead convert (sale, new client, or other offer conversion)? Kept as its
// own list, independent of DmSession, so the metric survives the thread
// being deleted -- meant to feed the Insights section later.
export interface DmConversionOutcome {
  id: string;
  sessionId: string;
  onboardingSessionId?: string;
  clientLabel: string;
  leadLabel: string;
  converted: boolean;
  stageAtDeletion?: DmStage;
  recordedAt: string;
}

// Source material for Steward (and Echo) to stay consistent with --
// existing SOPs, session notes, program material. v1 scope: plain-text/
// markdown only (mirrors how the CRILOS CLI's client/assets/ were plain
// files Claude could read directly) -- no binary/PDF text extraction.
// File content itself lives on disk under data/assets/<clientId>/, not in
// this JSON record.
export interface ClientAsset {
  id: string;
  clientId: string;
  fileName: string; // name on disk under data/assets/<clientId>/
  title: string; // display name
  uploadedAt: string;
}

// Hawk -- sales assets (outreach copy, proposals, discovery-call prep,
// follow-up sequences). Same Atlas-orchestrates / specialist-drafts /
// Echo-reviews split as Messaging Creator, with Hawk as the drafter
// instead of Quill. Same file-intake + multi-format deliverable pipeline
// as Document Ops (Steward) -- see HawkOutputFormat/generateHawkDeliverable
// in src/lib/hawk/generate.ts -- but with no audience (client-facing vs.
// internal) distinction, since sales assets are always prospect-facing.
export type HawkOutputFormat = "word" | "pdf" | "powerpoint" | "email-html";

export interface HawkAsset {
  assetType?: string; // outreach, proposal, discovery-call prep, follow-up sequence
  prospectLabel?: string; // who this is for, e.g. "Discovery call -- Jane at Acme"
  outputFormat?: HawkOutputFormat;
  finalText?: string;
}

// Discovery Call reuses HawkSession/hawkSessions wholesale (same storage,
// PDF pipeline, upload handling) rather than a dedicated session type --
// these two fields are the only Discovery-Call-specific additions.
// Untouched by the general Sales Outreach flow.
export type HawkLeadStage = "Gathering Info" | "Prep Ready" | "Call Completed";

export interface HawkSession extends AgentRunState {
  id: string;
  onboardingSessionId?: string;
  clientLabel: string;
  messages: ChatMessage[];
  claudeSessionId?: string;
  asset: HawkAsset;
  complete: boolean;
  // Metadata for the generated deliverable file, keyed to
  // session.asset.outputFormat. The file bytes live on disk under
  // data/deliverables/, not in this JSON file.
  deliverable?: DeliverableMeta;
  // Front-loaded lead label, set at creation -- only present on sessions
  // started from the Discovery Call page (mirrors DmSession.leadLabel).
  // Presence of this field is what distinguishes a Discovery Call session
  // from a generic Sales Outreach one sharing the same array.
  leadLabel?: string;
  // Discovery Call's own status tracking (the "Lead Conversion" list) --
  // unused by the general Sales Outreach flow.
  stage?: HawkLeadStage;
  createdAt: string;
  updatedAt: string;
}

// Sage -- research threads (market/competitor intel, discovery-call prep,
// fact-finding). No Atlas relay and no Echo QA pass (findings aren't
// voice-sensitive copy), and no "complete" state -- unlike Messaging
// Creator/Video Ad Framework this is an open-ended research conversation,
// not a one-time drafted piece. The on-brand doc export is manual/on-demand
// (see generateSageBrandedDoc) rather than triggered by an AI sentinel,
// since there's no natural "done" moment to hook into.
export interface SageSession extends AgentRunState {
  id: string;
  onboardingSessionId?: string;
  clientLabel: string;
  // What this research thread is about (e.g. "Competitor teardown --
  // Acme Coaching"), since a coach runs many of these concurrently.
  topic: string;
  messages: ChatMessage[];
  claudeSessionId?: string;
  // Metadata for the on-brand HTML research doc (Atlas-authored, styled by
  // the active branding standard's design.md). The file bytes live on disk
  // under data/deliverables/, not in this JSON file.
  brandedDoc?: DeliverableMeta;
  createdAt: string;
  updatedAt: string;
}

// Steward -- client-facing deliverables and internal ops (onboarding
// docs, session notes, SOPs, recap emails, program materials). Same
// Atlas-orchestrates / specialist-drafts pattern as Hawk/Messaging
// Creator, but with a branch: client-facing deliverables get an Echo
// voice-QA pass, internal-only docs (SOPs, session notes) don't, per
// Steward's own rule that internal material doesn't need voice-matching.
export type StewardOutputFormat = "word" | "pdf" | "powerpoint" | "email-html";

export interface StewardAsset {
  docType?: string; // onboarding doc, session notes, SOP, recap email, program material
  audience?: "client-facing" | "internal";
  outputFormat?: StewardOutputFormat;
  finalText?: string;
}

export interface StewardSession extends AgentRunState {
  id: string;
  onboardingSessionId?: string;
  clientLabel: string;
  messages: ChatMessage[];
  claudeSessionId?: string;
  asset: StewardAsset;
  complete: boolean;
  // Metadata for the generated deliverable file, keyed to session.asset.outputFormat.
  // The file bytes live on disk under data/deliverables/, not in this JSON file.
  deliverable?: DeliverableMeta;
  createdAt: string;
  updatedAt: string;
}

// Skool Posts (Efficiency Engine) -- drafts Skool community posts across 10
// formats (celebration, Monday goal, vulnerable, 3-version launch, hot-take,
// poll, draft rewrite, hook-only, long-form story, frustrated-member reply).
// Same Atlas-orchestrates/Quill-drafts/Echo-QAs shape as Messaging Creator
// (src/lib/messaging/prompts.ts), no PDF deliverable -- posts are meant to be
// copied straight into Skool, not downloaded.
export interface SkoolPost {
  mode?: string; // which of the 10 formats this is
  finalText?: string;
}

export interface SkoolPostSession extends AgentRunState {
  id: string;
  onboardingSessionId?: string;
  clientLabel: string;
  messages: ChatMessage[];
  claudeSessionId?: string;
  post: SkoolPost;
  complete: boolean;
  createdAt: string;
  updatedAt: string;
}

// Digital Product Builder (Lead Generation) -- turns a client's content
// bible (goals + the per-step "resource" column) into a finished digital
// product (ebook, workbook, checklist, etc.): Quill proposes ideas, gathers
// a brief (including target length + output format), drafts an outline for
// the client to confirm, then drafts the full product, Echo does a voice-QA
// pass, and it's exported as a branded Word or PDF file. Same Quill-is-the-
// visible-persona shape as Skool Posts (src/lib/skoolPost/prompts.ts), but
// produces a downloadable deliverable like Messaging Creator does.
export type DigitalProductOutputFormat = "word" | "pdf";

export interface DigitalProductSection {
  heading: string;
  body: string;
}

export interface DigitalProductAsset {
  title?: string;
  subtitle?: string;
  productType?: string; // Quill's own freeform label, e.g. "7-Day Challenge Workbook"
  targetPages?: number;
  outputFormat?: DigitalProductOutputFormat;
  sections?: DigitalProductSection[];
  // Cover art (see src/lib/covers/renderCover.ts). The rendered cover PNG
  // (under data/deliverables/) doubles as a standalone download and page 1 of
  // the generated PDF. The optional background is an AI-generated or uploaded
  // photo composited full-bleed behind the cover text (see data/cover-uploads/).
  coverImageFileName?: string;
  coverBackgroundFileName?: string;
  coverBackgroundKind?: "ai" | "upload";
}

export interface DigitalProductSession extends AgentRunState {
  id: string;
  onboardingSessionId?: string;
  clientLabel: string;
  messages: ChatMessage[];
  claudeSessionId?: string;
  asset: DigitalProductAsset;
  complete: boolean;
  // Metadata for the generated deliverable file. The file bytes live on
  // disk under data/deliverables/, not in this JSON file.
  deliverable?: DeliverableMeta;
  createdAt: string;
  updatedAt: string;
}

// Email skill -- read unread mail, summarize, draft a reply in the
// matched client's voice, and stop: never sends anything. Unlike the
// chat-driven tools above, this isn't a back-and-forth conversation --
// it's a one-shot pipeline per thread (summarize + draft happen together,
// no --resume chaining needed) with a human approval gate before
// anything touches Gmail. Steward drafts (reusing its persona/rules from
// src/lib/steward/prompts.ts), Echo reviews for voice fit.
export interface EmailDraftSession {
  id: string;
  gmailThreadId: string;
  clientId?: string; // resolved by matching the thread's counterparty against Client.email
  clientLabel: string;
  fromAddress: string;
  subject: string;
  summary: string;
  draftText: string;
  status: "drafted" | "saved";
  gmailDraftId?: string; // set once "Save as Gmail draft" succeeds
  createdAt: string;
  updatedAt: string;
}

// Compose Email -- chat-driven "write a brand-new email from scratch"
// companion to EmailDraftSession (which only handles replies to existing
// unread threads). Atlas gathers recipient + topic, Quill drafts, Echo
// reviews for voice fit, then the user edits/approves and explicitly
// saves it as a standalone Gmail draft -- never sent, same guarantee as
// the reply flow.
export interface ComposeEmailSession extends AgentRunState {
  id: string;
  clientId?: string; // resolved if the recipient matches a known client's email
  clientLabel?: string;
  messages: ChatMessage[];
  claudeSessionId?: string;
  to: string;
  subject: string;
  bodyText: string;
  status: "drafting" | "drafted" | "saved";
  gmailDraftId?: string; // set once "Save as Gmail draft" succeeds
  createdAt: string;
  updatedAt: string;
}
