"use client";

import { useEffect, useState } from "react";
import { Client } from "@/lib/types";

// Reused across every Build-tool's pre-start screen (Messaging Creator,
// Video Ad Framework, DM 2 Close, Onboarding) so a session gets tied to a
// real Client record instead of guessing "most recent" onboarding data.
export default function ClientPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (clientId: string) => void;
  disabled?: boolean;
}) {
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    fetch("/api/clients")
      .then((res) => res.json())
      .then((data) => setClients(data.clients ?? []))
      .catch(() => {
        // Picker just stays empty (generic-draft option only) -- not worth
        // an error banner over a list that failed to load.
      });
  }, []);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full field disabled:opacity-50"
    >
      <option value="">No client selected (generic draft)</option>
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
