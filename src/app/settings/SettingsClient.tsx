"use client";

import { useEffect, useState } from "react";
import { Settings } from "@/lib/types";
import { ThemeName, THEMES, DEFAULT_THEME, isThemeName } from "@/lib/themes";
import { ModelKey, MODELS, DEFAULT_MODEL, isModelKey } from "@/lib/models";
import { Save, Upload, CheckCircle2, Mail, AlertCircle, Check } from "lucide-react";
import RegistrationMark from "@/components/motifs/RegistrationMark";

type MaskedSettings = Settings & {
  _hasGhlToken?: boolean;
  _hasSkoolSecret?: boolean;
  _hasGmailClientSecret?: boolean;
  _gmailConnected?: boolean;
};

export default function SettingsClient({
  initialSettings,
}: {
  initialSettings: MaskedSettings;
}) {
  // ARCHIVED — GoHighLevel integration, disabled from the UI but the
  // backend (src/lib/ghl.ts, /api/ghl/sync, Settings.ghlPrivateToken/
  // ghlLocationId) is untouched. Uncomment this state + the Section below
  // + its two lines in save() to bring the Settings UI back.
  // const [ghlLocationId, setGhlLocationId] = useState(
  //   initialSettings.ghlLocationId ?? "",
  // );
  // const [ghlPrivateToken, setGhlPrivateToken] = useState("");
  const [theme, setTheme] = useState<ThemeName>(
    isThemeName(initialSettings.theme) ? initialSettings.theme : DEFAULT_THEME,
  );
  const [themeSaved, setThemeSaved] = useState(false);
  const [model, setModel] = useState<ModelKey>(
    isModelKey(initialSettings.anthropicModel) ? initialSettings.anthropicModel : DEFAULT_MODEL,
  );
  const [skoolWebhookSecret, setSkoolWebhookSecret] = useState("");
  const [gmailClientId, setGmailClientId] = useState(initialSettings.gmailClientId ?? "");
  const [gmailClientSecret, setGmailClientSecret] = useState("");
  const [yellowDays, setYellowDays] = useState(
    initialSettings.healthThresholds.yellowDays,
  );
  const [redDays, setRedDays] = useState(initialSettings.healthThresholds.redDays);
  const [saved, setSaved] = useState(false);
  const [csvMessage, setCsvMessage] = useState<string | null>(null);
  const [gmailBanner, setGmailBanner] = useState<{ type: "ok" | "error"; text: string } | null>(
    null,
  );
  // Set post-mount only (starts "") so SSR and the initial client render
  // match -- window.location.origin doesn't exist during SSR.
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
    const params = new URLSearchParams(window.location.search);
    const err = params.get("gmailError");
    const connected = params.get("gmailConnected");
    const banner = err
      ? ({ type: "error", text: err } as const)
      : connected
        ? ({ type: "ok", text: "Gmail connected." } as const)
        : null;
    if (banner) setGmailBanner(banner);
    if (err || connected) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function save() {
    const body: Partial<Settings> = {
      // ghlLocationId: ghlLocationId || undefined, // ARCHIVED — see state above
      healthThresholds: { yellowDays, redDays },
      anthropicModel: model,
    };
    // Only send secrets if the user actually typed something new — avoids
    // overwriting a saved key with an empty string.
    // if (ghlPrivateToken) body.ghlPrivateToken = ghlPrivateToken; // ARCHIVED — see state above
    if (skoolWebhookSecret) body.skoolWebhookSecret = skoolWebhookSecret;
    if (gmailClientId) body.gmailClientId = gmailClientId;
    if (gmailClientSecret) body.gmailClientSecret = gmailClientSecret;

    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaved(true);
    // setGhlPrivateToken(""); // ARCHIVED — see state above
    setSkoolWebhookSecret("");
    setGmailClientSecret("");
    setTimeout(() => setSaved(false), 2500);
  }

  // Theme applies instantly (data-theme on <html>) and persists on click,
  // independent of the main Save button — mirrors the old ModelPicker.
  async function selectTheme(next: ThemeName) {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
    });
    setThemeSaved(true);
    setTimeout(() => setThemeSaved(false), 2000);
  }

  async function uploadCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvMessage(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/skool/import", { method: "POST", body: form });
    const data = await res.json();
    setCsvMessage(
      res.ok
        ? `Imported ${data.imported} members from CSV.`
        : data.error || "Import failed",
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="relative">
        <RegistrationMark className="absolute right-0 top-0 hidden h-5 w-5 sm:block" />
        <div className="sec-num mb-3">§ · SETTINGS</div>
        <h1 className="bleed-type text-paper">
          Settings
        </h1>
        <p className="mt-1 text-sm text-paper-dim">
          Keys are stored only in this app&apos;s local data file, never sent
          anywhere except the API you&apos;re configuring.
        </p>
      </div>

      <Section title="Appearance">
        <p className="text-xs text-paper-faint">
          Pick a color theme for the dashboard. Applies instantly and saves on
          click — only colors change, never fonts.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {THEMES.map((t) => {
            const active = theme === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => selectTheme(t.key)}
                aria-pressed={active}
                className={`flex items-center gap-3 border p-3 text-left transition-colors ${
                  active
                    ? "border-clay stack bg-ink-raised"
                    : "border-line-strong bg-ink-raised hover:border-clay"
                }`}
              >
                <span className="flex shrink-0 gap-1" aria-hidden="true">
                  {t.chips.map((c, i) => (
                    <span
                      key={i}
                      style={{ backgroundColor: c }}
                      className="h-7 w-4 border border-line-strong"
                    />
                  ))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="label-mono flex items-center gap-1 text-[12px] text-paper">
                    {t.label}
                    {active && <Check size={12} className="text-clay" />}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-paper-faint">
                    {t.blurb}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {themeSaved && (
          <div className="label-mono flex items-center gap-1 text-[10px] text-sage">
            <Check size={11} /> Saved
          </div>
        )}
      </Section>

      <Section title="Claude model">
        <p className="text-xs text-paper-faint">
          Which model powers the agent chats (Sage, Quill, Hawk, Steward, DM
          2 Close, onboarding, and the rest of the Build tools).
        </p>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value as ModelKey)}
          className="w-full field"
        >
          {MODELS.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-paper-faint">
          {MODELS.find((m) => m.key === model)?.blurb}
        </p>
      </Section>

      {/* ARCHIVED — GoHighLevel integration, disabled from the UI but the
          backend (src/lib/ghl.ts, /api/ghl/sync, Settings.ghlPrivateToken/
          ghlLocationId) is untouched. Uncomment this Section + the state
          and save() wiring above to bring it back.
      <Section title="GoHighLevel">
        <Field
          label="Location ID"
          value={ghlLocationId}
          onChange={setGhlLocationId}
          placeholder="e.g. ve9EPM428h8vShlRW1KT"
        />
        <Field
          label="Private Integration Token"
          value={ghlPrivateToken}
          onChange={setGhlPrivateToken}
          placeholder={initialSettings._hasGhlToken ? "•••• saved — enter to replace" : "pit-..."}
          type="password"
        />
        <p className="text-xs text-paper-faint">
          Create one in GHL under Settings → Private Integrations. Needs
          read access to Contacts and Opportunities.
        </p>
      </Section>
      */}

      <Section title="Skool (no public API — see below)">
        <p className="text-xs text-paper-faint">
          Skool doesn&apos;t offer a public API. Connect it one of two ways:
        </p>
        <ol className="list-decimal space-y-1 pl-4 text-xs text-paper-faint">
          <li>
            Point a Zapier/Stripe webhook at{" "}
            <code className="rounded-sm bg-paper/10 px-1 py-0.5 text-paper-dim">
              /api/skool/webhook
            </code>{" "}
            using the shared secret below.
          </li>
          <li>Or upload a member CSV export for a point-in-time snapshot.</li>
        </ol>
        <Field
          label="Webhook shared secret"
          value={skoolWebhookSecret}
          onChange={setSkoolWebhookSecret}
          placeholder={initialSettings._hasSkoolSecret ? "•••• saved — enter to replace" : "choose any random string"}
          type="password"
        />
        <div>
          <label className="label-mono mb-1 block text-[11px] text-paper-faint">
            Import member CSV
          </label>
          <label className="flex w-fit cursor-pointer items-center gap-2 rounded-sm border border-dashed border-line-strong px-3 py-2 text-xs text-paper-dim hover:border-electric">
            <Upload size={14} />
            Choose file
            <input type="file" accept=".csv" onChange={uploadCsv} className="hidden" />
          </label>
          {csvMessage && <p className="mt-1 text-xs text-paper-faint">{csvMessage}</p>}
        </div>
      </Section>

      <Section title="Gmail (Inbox skill)">
        {gmailBanner && (
          <div
            className={`flex items-center gap-2 border-l-[3px] px-3 py-2 text-xs ${
              gmailBanner.type === "ok"
                ? "border-sage bg-sage/10 text-sage"
                : "border-gold bg-gold/10 text-gold"
            }`}
          >
            <AlertCircle size={14} />
            {gmailBanner.text}
          </div>
        )}
        <p className="text-xs text-paper-faint">
          Needs a Google Cloud project with the Gmail API enabled and an
          OAuth client (type &quot;Web application&quot;) with this exact
          redirect URI added:
        </p>
        <code className="block rounded-sm bg-paper/10 px-2 py-1 text-xs text-paper-dim">
          {origin}/api/email/oauth/callback
        </code>
        <Field
          label="Client ID"
          value={gmailClientId}
          onChange={setGmailClientId}
          placeholder="....apps.googleusercontent.com"
        />
        <Field
          label="Client secret"
          value={gmailClientSecret}
          onChange={setGmailClientSecret}
          placeholder={
            initialSettings._hasGmailClientSecret ? "•••• saved — enter to replace" : "GOCSPX-..."
          }
          type="password"
        />
        <div className="flex items-center gap-3 pt-1">
          <a
            href="/api/email/oauth/start"
            className="label-mono flex items-center gap-1.5 rounded-sm border border-line-strong px-3 py-1.5 text-[12px] text-paper-dim hover:border-electric hover:text-paper"
          >
            <Mail size={14} />
            {initialSettings._gmailConnected ? "Reconnect Gmail" : "Connect Gmail"}
          </a>
          {initialSettings._gmailConnected && (
            <span className="label-mono flex items-center gap-1 text-[11px] text-sage">
              <CheckCircle2 size={14} />
              Connected
            </span>
          )}
        </div>
        <p className="text-xs text-paper-faint">
          Save the client ID/secret above first, then click Connect —
          Gmail access is read + create-draft only, nothing in this app
          can send mail.
        </p>
      </Section>

      <Section title="Health thresholds">
        <div className="flex gap-4">
          <Field
            label="Yellow after (days)"
            value={String(yellowDays)}
            onChange={(v) => setYellowDays(Number(v) || 0)}
            type="number"
          />
          <Field
            label="Red after (days)"
            value={String(redDays)}
            onChange={(v) => setRedDays(Number(v) || 0)}
            type="number"
          />
        </div>
      </Section>

      <button
        onClick={save}
        className="label-mono flex items-center gap-2 btn-accent px-4 py-2 text-[12px]"
      >
        {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
        {saved ? "Saved" : "Save settings"}
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="hud-panel stack p-5">
      <h2 className="font-display mb-3 text-base font-bold uppercase tracking-wide text-paper">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="label-mono mb-1 block text-[11px] text-paper-faint">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full field"
      />
    </div>
  );
}
