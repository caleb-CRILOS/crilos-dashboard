import { LucideIcon, Compass, Search, PenLine, Send, ClipboardList, Ear } from "lucide-react";

export interface AgentDirectoryEntry {
  key: string;
  name: string;
  role: string;
  purpose: string;
  icon: LucideIcon;
}

// Order reflects the actual workflow: Atlas takes the brief and routes it,
// a specialist drafts, Echo QAs the draft, Atlas relays it back.
export const AGENT_DIRECTORY: AgentDirectoryEntry[] = [
  {
    key: "atlas",
    name: "Atlas",
    role: "Orchestrator",
    icon: Compass,
    purpose: "Gathers your brief and routes it to the right specialist, then relays their draft back.",
  },
  {
    key: "sage",
    name: "Sage",
    role: "Research",
    icon: Search,
    purpose: "Market and competitor intel, discovery-call prep — filtered to the client's niche, sourced from real web search.",
  },
  {
    key: "quill",
    name: "Quill",
    role: "Messaging & copy",
    icon: PenLine,
    purpose: "Drafts video scripts, blog posts, carousels, and image posts in a fixed 6-part structure, matched to the client's voice.",
  },
  {
    key: "hawk",
    name: "Hawk",
    role: "Sales outreach",
    icon: Send,
    purpose: "Drafts outreach copy, proposals, discovery-call prep, and follow-ups tied to the client's actual offer — flags unverified claims instead of inventing them.",
  },
  {
    key: "steward",
    name: "Steward",
    role: "Document ops",
    icon: ClipboardList,
    purpose: "Drafts client-facing deliverables and internal ops docs: onboarding docs, SOPs, recap emails, program material.",
  },
  {
    key: "echo",
    name: "Echo",
    role: "Voice QA",
    icon: Ear,
    purpose: "Reviews another specialist's draft for voice and tone fit before Atlas presents it — not a standalone destination.",
  },
];
