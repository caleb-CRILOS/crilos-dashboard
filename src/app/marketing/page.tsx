"use client";

import ToolShell from "@/components/ToolShell";
import { Megaphone } from "lucide-react";

export default function MarketingPage() {
  return (
    <ToolShell
      icon={Megaphone}
      eyebrow="Build / Influence Building"
      title="Influence Building"
      description="Draft on-brand marketing content — emails, social posts, landing pages — from a short brief."
      actionLabel="Draft content"
      fields={[
        {
          name: "format",
          label: "Format",
          type: "select",
          placeholder: "Choose a format",
          options: ["Email", "Social post", "Landing page", "Ad copy"],
        },
        {
          name: "audience",
          label: "Audience",
          type: "text",
          placeholder: "Who is this for?",
        },
        {
          name: "brief",
          label: "Key message",
          type: "textarea",
          placeholder: "What should this content say or promote?",
        },
      ]}
      emptyStateCopy="No marketing drafts yet. Once connected, drafts will appear here."
    />
  );
}
