"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export default function SyncButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  async function handleSync() {
    setMessage(null);
    try {
      const res = await fetch("/api/ghl/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Sync failed");
        return;
      }
      setMessage(`Synced ${data.pulled} contacts from GoHighLevel.`);
      startTransition(() => router.refresh());
    } catch {
      setMessage("Sync failed — is the dev server running?");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleSync}
        disabled={pending}
        className="btn-ghost label-mono flex items-center gap-2 px-3 py-1.5 text-[12px] disabled:opacity-50"
      >
        <RefreshCw size={14} className={pending ? "animate-spin" : ""} />
        Sync GoHighLevel
      </button>
      {message && <span className="text-xs text-paper-faint">{message}</span>}
    </div>
  );
}
