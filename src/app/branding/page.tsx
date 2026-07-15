"use client";

import ToolShell from "@/components/ToolShell";
import { Palette } from "lucide-react";

export default function BrandingPage() {
  return (
    <ToolShell
      icon={Palette}
      eyebrow="Build / Sales Conversion"
      title="Sales Conversion"
      description="Generate a brand brief — voice, positioning, visual direction — for yourself or a client's business."
      actionLabel="Generate brand brief"
      fields={[
        {
          name: "business",
          label: "Business name",
          type: "text",
          placeholder: "e.g. the client's business",
        },
        {
          name: "industry",
          label: "Industry / niche",
          type: "text",
          placeholder: "e.g. executive coaching, fitness, consulting",
        },
        {
          name: "notes",
          label: "Tone or style notes",
          type: "textarea",
          placeholder: "How should this brand come across?",
        },
      ]}
      emptyStateCopy="No brand briefs yet. Once connected, briefs will appear here."
    />
  );
}
