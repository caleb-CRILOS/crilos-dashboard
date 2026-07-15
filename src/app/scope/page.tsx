"use client";

import ToolShell from "@/components/ToolShell";
import { ClipboardList } from "lucide-react";

export default function ScopePage() {
  return (
    <ToolShell
      icon={ClipboardList}
      eyebrow="Build / Efficiency Engine"
      title="Efficiency Engine"
      description="Turn a rough client ask into a clear scope document — goals, deliverables, timeline, boundaries."
      actionLabel="Draft scope doc"
      fields={[
        {
          name: "client",
          label: "Client",
          type: "text",
          placeholder: "Who is this scope for?",
        },
        {
          name: "goal",
          label: "Project goal",
          type: "textarea",
          placeholder: "What are they trying to achieve?",
        },
        {
          name: "constraints",
          label: "Constraints",
          type: "text",
          placeholder: "Budget, timeline, anything off the table",
        },
      ]}
      emptyStateCopy="No scope docs yet. Once connected, drafts will appear here."
    />
  );
}
