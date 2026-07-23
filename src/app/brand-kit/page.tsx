"use client";

import { useEffect, useRef, useState } from "react";
import {
  SwatchBook,
  Upload,
  Trash2,
  Download,
  ExternalLink,
  FileCode2,
  FileText,
} from "lucide-react";
import { BrandingStandard } from "@/lib/types";
import Alert from "@/components/Alert";

export default function BrandKitPage() {
  const [standard, setStandard] = useState<BrandingStandard | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/brand-kit");
      const data = await res.json();
      if (res.ok) setStandard(data.standard ?? null);
    } catch {
      // List just won't refresh this time -- not worth an error banner.
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, []);

  async function handleUpload(file: File) {
    setGenerating(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/brand-kit", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Generation failed.");
        return;
      }
      setStandard(data.standard ?? null);
    } catch {
      setError("Request failed — is the dev server running?");
    } finally {
      setGenerating(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (!standard) return;
    try {
      await fetch("/api/brand-kit", { method: "DELETE" });
      setStandard(null);
    } catch {
      setError("Request failed — is the dev server running?");
    }
  }

  const fileHref = (name: string, download = false) =>
    `/api/brand-kit/files/${encodeURIComponent(name)}${download ? "?download=1" : ""}`;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="label-mono mb-2 flex items-center gap-2 text-[13px] text-electric">
        <SwatchBook size={14} />
        Operate / Branding
      </div>
      <h1 className="bleed-type text-paper">Branding</h1>
      <p className="mt-1 text-sm text-paper-dim">
        Upload a brand image — a logo, screenshot, or moodboard. CRILOS turns it
        into a design system (an HTML reference + a design doc) that becomes the
        standard every document and HTML output in CRILOS follows.
      </p>

      {error && (
        <div className="mt-6">
          <Alert variant="warn" title="Something went wrong">
            {error}
          </Alert>
        </div>
      )}

      {/* Upload / generate card */}
      <div className="hud-panel hud-panel-magenta stack mt-8 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="label-mono text-[13px] text-paper-dim">
              {standard ? "Replace brand image" : "Brand image"}
            </div>
            <p className="mt-1 text-xs text-paper-faint">
              PNG, JPG, WEBP, or GIF · up to 10 MB.
              {standard && " Generating a new one replaces the current standard."}
            </p>
          </div>
          <label className="label-mono flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-sm border border-line-strong px-3 py-2 text-[13px] text-paper-dim hover:border-electric hover:text-paper">
            <Upload size={14} />
            {generating ? "Generating…" : standard ? "Upload new" : "Upload image"}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              disabled={generating}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
            />
          </label>
        </div>
        {generating && (
          <p className="mt-4 text-xs text-paper-dim">
            CRILOS is studying the image and building your design system. This can
            take a minute or two — keep this tab open.
          </p>
        )}
      </div>

      {/* Active standard */}
      <div className="mt-10">
        <h2 className="font-display mb-3 text-lg font-semibold text-paper">
          Active standard
        </h2>

        {loading ? (
          <div className="hud-panel stack p-8 text-center text-sm text-paper-faint">
            Loading…
          </div>
        ) : !standard ? (
          <div className="hud-panel stack p-8 text-center text-sm text-paper-faint">
            No branding standard yet. Upload a brand image to generate one.
          </div>
        ) : (
          <div className="hud-panel stack p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <img
                  src={fileHref(standard.sourceImageFileName)}
                  alt="Brand source"
                  className="h-14 w-14 shrink-0 rounded-sm border border-line object-cover"
                />
                <div>
                  <div className="text-sm text-paper">{standard.title}</div>
                  <div className="label-mono mt-0.5 text-[13px] text-paper-faint">
                    Generated {new Date(standard.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
              <button
                onClick={handleDelete}
                aria-label="Delete branding standard"
                className="rounded-sm p-1.5 text-paper-faint hover:bg-ink-elevated hover:text-paper"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {/* Token swatches */}
            <div className="mt-4 flex flex-wrap gap-2">
              {(
                [
                  ["primary", standard.tokens.primary],
                  ["ink", standard.tokens.ink],
                  ["paper", standard.tokens.paper],
                  ["muted", standard.tokens.muted],
                  ["line", standard.tokens.line],
                ] as const
              )
                .filter(([, hex]) => !!hex)
                .map(([name, hex]) => (
                  <div
                    key={name}
                    className="flex items-center gap-1.5 rounded-sm border border-line bg-ink-raised px-2 py-1"
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-[2px] border border-line-strong"
                      style={{ backgroundColor: hex }}
                    />
                    <span className="label-mono text-[13px] text-paper-dim">{hex}</span>
                  </div>
                ))}
            </div>

            {/* Output files */}
            <ul className="mt-4 space-y-2">
              <li className="flex items-center justify-between rounded-sm border border-line bg-ink-raised px-4 py-2.5 text-sm">
                <span className="flex items-center gap-2 text-paper-dim">
                  <FileCode2 size={16} className="text-electric" />
                  design.html
                </span>
                <span className="flex items-center gap-1">
                  <a
                    href={fileHref(standard.htmlFileName)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Preview design.html"
                    className="rounded-sm p-1.5 text-paper-faint hover:bg-ink-elevated hover:text-paper"
                  >
                    <ExternalLink size={15} />
                  </a>
                  <a
                    href={fileHref(standard.htmlFileName, true)}
                    aria-label="Download design.html"
                    className="rounded-sm p-1.5 text-paper-faint hover:bg-ink-elevated hover:text-paper"
                  >
                    <Download size={15} />
                  </a>
                </span>
              </li>
              <li className="flex items-center justify-between rounded-sm border border-line bg-ink-raised px-4 py-2.5 text-sm">
                <span className="flex items-center gap-2 text-paper-dim">
                  <FileText size={16} className="text-electric" />
                  design.md
                </span>
                <span className="flex items-center gap-1">
                  <a
                    href={fileHref(standard.mdFileName)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Preview design.md"
                    className="rounded-sm p-1.5 text-paper-faint hover:bg-ink-elevated hover:text-paper"
                  >
                    <ExternalLink size={15} />
                  </a>
                  <a
                    href={fileHref(standard.mdFileName, true)}
                    aria-label="Download design.md"
                    className="rounded-sm p-1.5 text-paper-faint hover:bg-ink-elevated hover:text-paper"
                  >
                    <Download size={15} />
                  </a>
                </span>
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
