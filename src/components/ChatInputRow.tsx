import { useRef } from "react";
import { Paperclip, Send, X } from "lucide-react";

export default function ChatInputRow({
  value,
  onChange,
  onSend,
  disabled,
  placeholder,
  attachedFile,
  onFileSelect,
  onClearFile,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  placeholder: string;
  // Optional file-attach support -- only rendered when onFileSelect is
  // passed, so existing callers (DM 2 Close) are unaffected.
  attachedFile?: File | null;
  onFileSelect?: (file: File) => void;
  onClearFile?: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="border-t border-line-strong p-3">
      {attachedFile && (
        <div className="mb-2 flex items-center gap-2 self-start text-xs text-paper-dim">
          <span className="flex items-center gap-1.5 border border-line-strong bg-ink-elevated px-2 py-1">
            <Paperclip size={13} />
            {attachedFile.name}
          </span>
          <button
            type="button"
            onClick={onClearFile}
            aria-label="Remove attachment"
            className="text-paper-faint hover:text-paper"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        {/* Console prompt glyph. */}
        <span className="label-mono select-none text-sm text-paper" aria-hidden="true">
          &gt;
        </span>
        {onFileSelect && (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              aria-label="Attach file"
              className="label-mono flex items-center rounded-sm border border-line-strong px-2 py-2 text-paper-dim hover:border-electric hover:text-paper disabled:opacity-50"
            >
              <Paperclip size={15} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.gif,.txt,.md,.pdf,.docx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFileSelect(f);
                e.target.value = "";
              }}
            />
          </>
        )}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          disabled={disabled}
          placeholder={placeholder}
          className="field flex-1 disabled:opacity-50"
        />
        <button
          onClick={onSend}
          disabled={disabled || (!value.trim() && !attachedFile)}
          className="btn-accent flex items-center gap-1.5 px-3 py-2 text-[12px]"
        >
          <Send size={15} />
          Send
        </button>
      </div>
    </div>
  );
}
