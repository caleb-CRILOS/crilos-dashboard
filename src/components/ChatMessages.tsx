import { RefObject } from "react";
import { Paperclip } from "lucide-react";
import { ChatMessage } from "@/lib/types";

function PersonaTag({ name }: { name: string }) {
  return (
    <div className="label-mono mb-1 flex items-center gap-1.5 text-[11px] text-signal-ink">
      <span className="h-1.5 w-1.5 bg-clay" aria-hidden="true" />
      {name}
    </div>
  );
}

export default function ChatMessages({
  messages,
  loading,
  loadingLabel,
  personaName,
  scrollRef,
  uploadsBasePath,
}: {
  messages: ChatMessage[];
  loading: boolean;
  loadingLabel: string;
  personaName: string;
  scrollRef: RefObject<HTMLDivElement | null>;
  // Base path for an attachment's download link, e.g. "/api/hawk/uploads".
  // Defaults to Document Ops' route so that existing caller keeps working
  // unchanged without passing this prop.
  uploadsBasePath?: string;
}) {
  return (
    <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
      {messages.map((m, i) => (
        <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
          <div className={m.role === "user" ? "max-w-[85%]" : "max-w-[90%]"}>
            {m.role === "assistant" && <PersonaTag name={personaName} />}
            <div
              className={`whitespace-pre-wrap px-3.5 py-2.5 text-sm ${
                m.role === "user"
                  ? "border border-line bg-ink-elevated text-paper"
                  : "border border-line-strong bg-ink-raised text-paper"
              }`}
            >
              {m.attachment && (
                <a
                  href={`${uploadsBasePath ?? "/api/steward/uploads"}/${m.attachment.fileName}?download=1`}
                  target="_blank"
                  rel="noreferrer"
                  className="label-mono mb-1.5 flex w-fit items-center gap-1.5 border border-line-strong bg-ink px-2 py-1 text-[11px] text-paper-dim hover:border-electric hover:text-paper"
                >
                  <Paperclip size={12} />
                  {m.attachment.title}
                </a>
              )}
              {m.content}
            </div>
          </div>
        </div>
      ))}
      {loading && (
        <div>
          <PersonaTag name={personaName} />
          <div className="inline-block border border-line-strong bg-ink-raised px-3.5 py-2.5 text-sm text-paper-faint">
            {loadingLabel}
          </div>
        </div>
      )}
    </div>
  );
}
