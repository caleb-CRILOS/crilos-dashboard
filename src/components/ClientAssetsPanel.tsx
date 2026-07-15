"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { ClientAsset } from "@/lib/types";
import Alert from "./Alert";

// Source material (SOPs, session notes, program material) for Steward
// and Echo to stay consistent with -- lives on the client's own page
// since it's client-scoped data, not tied to any one tool's session.
export default function ClientAssetsPanel({ clientId }: { clientId: string }) {
  const [assets, setAssets] = useState<ClientAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    try {
      const res = await fetch(`/api/clients/${clientId}/assets`);
      const data = await res.json();
      if (res.ok) setAssets(data.assets ?? []);
    } catch {
      // List just won't refresh this time -- not worth an error banner.
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch(`/api/clients/${clientId}/assets`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed.");
        return;
      }
      await refresh();
    } catch {
      setError("Request failed — is the dev server running?");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(assetId: string) {
    try {
      await fetch(`/api/clients/${clientId}/assets/${assetId}`, { method: "DELETE" });
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
    } catch {
      setError("Request failed — is the dev server running?");
    }
  }

  return (
    <div className="mt-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold uppercase tracking-wide text-paper">
          Source material
        </h2>
        <label className="label-mono flex cursor-pointer items-center gap-1.5 rounded-sm border border-line-strong px-3 py-1.5 text-[12px] text-paper-dim hover:border-electric hover:text-paper">
          <Upload size={14} />
          {uploading ? "Uploading…" : "Upload .txt/.md"}
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
        </label>
      </div>
      <p className="mb-3 text-sm text-paper-faint">
        Existing SOPs, session notes, or program material — Steward matches
        their structure instead of inventing a new format each time.
      </p>

      {error && (
        <div className="mb-3">
          <Alert variant="warn" title="Upload failed">
            {error}
          </Alert>
        </div>
      )}

      {assets.length === 0 ? (
        <div className="hud-panel stack p-6 text-center text-sm text-paper-faint">
          No source material uploaded yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {assets.map((a) => (
            <li
              key={a.id}
              className="group flex items-center justify-between rounded-sm border border-line bg-ink-raised px-4 py-2.5 text-sm"
            >
              <span className="flex items-center gap-2 text-paper-dim">
                <FileText size={16} className="text-electric" />
                {a.title}
              </span>
              <button
                onClick={() => handleDelete(a.id)}
                aria-label={`Delete ${a.title}`}
                className="rounded-sm p-1.5 text-paper-faint opacity-0 hover:bg-ink-elevated hover:text-paper group-hover:opacity-100"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
