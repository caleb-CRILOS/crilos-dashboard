"use client";

import { useState } from "react";
import { LucideIcon } from "lucide-react";

export type ToolField = {
  name: string;
  label: string;
  type: "text" | "textarea" | "select";
  placeholder?: string;
  options?: string[];
};

export default function ToolShell({
  icon: Icon,
  eyebrow,
  title,
  description,
  actionLabel,
  fields,
  emptyStateCopy,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  actionLabel: string;
  fields: ToolField[];
  emptyStateCopy: string;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [note, setNote] = useState<string | null>(null);

  function run() {
    setNote("Not connected yet — this tool isn't wired up.");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="label-mono mb-2 flex items-center gap-2 text-[13px] text-electric">
        <Icon size={14} />
        {eyebrow}
      </div>
      <h1 className="bleed-type text-paper">
        {title}
      </h1>
      <p className="mt-1 text-sm text-paper-dim">{description}</p>

      <div className="hud-panel hud-panel-magenta stack mt-8 space-y-4 p-5">
        {fields.map((field) => (
          <div key={field.name}>
            <label className="label-mono mb-1 block text-[13px] text-paper-dim">
              {field.label}
            </label>
            {field.type === "textarea" ? (
              <textarea
                rows={3}
                value={values[field.name] ?? ""}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [field.name]: e.target.value }))
                }
                placeholder={field.placeholder}
                className="field w-full resize-none"
              />
            ) : field.type === "select" ? (
              <select
                value={values[field.name] ?? ""}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [field.name]: e.target.value }))
                }
                className="field w-full"
              >
                <option value="" disabled>
                  {field.placeholder ?? "Choose one"}
                </option>
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={values[field.name] ?? ""}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [field.name]: e.target.value }))
                }
                placeholder={field.placeholder}
                className="field w-full"
              />
            )}
          </div>
        ))}

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={run}
            className="label-mono btn-accent px-4 py-2 text-[13px]"
          >
            {actionLabel}
          </button>
          {note && <span className="text-xs text-paper-faint">{note}</span>}
        </div>
      </div>

      <div className="mt-10">
        <h2 className="font-display mb-3 text-lg font-semibold text-paper">
          Recent runs
        </h2>
        <div className="hud-panel stack p-8 text-center text-sm text-paper-faint">
          {emptyStateCopy}
        </div>
      </div>
    </div>
  );
}
