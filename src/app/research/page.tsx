"use client";

import ToolShell from "@/components/ToolShell";
import { Search } from "lucide-react";

export default function ResearchPage() {
  return (
    <ToolShell
      icon={Search}
      eyebrow="Build / Lead Generation"
      title="Lead Generation"
      description="Point Claude at a company, market, or person and get back a structured research brief."
      actionLabel="Run research"
      fields={[
        {
          name: "subject",
          label: "Subject",
          type: "text",
          placeholder: "e.g. a client's company, a competitor, a niche",
        },
        {
          name: "focus",
          label: "What you want to know",
          type: "textarea",
          placeholder: "Positioning, recent news, target audience, pricing...",
        },
      ]}
      emptyStateCopy="No research runs yet. Once connected, results will appear here."
    />
  );
}
