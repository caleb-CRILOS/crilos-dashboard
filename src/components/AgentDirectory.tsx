import { AGENT_DIRECTORY } from "@/lib/agents/directory";

export default function AgentDirectory() {
  return (
    <div className="hud-panel stack divide-y divide-line overflow-hidden">
      {AGENT_DIRECTORY.map(({ key, name, role, purpose, icon: Icon }) => (
        <div key={key} className="flex items-start gap-3 px-4 py-3">
          <Icon size={17} className="mt-0.5 shrink-0 text-paper" />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-sm font-bold uppercase tracking-tight text-paper">
                {name}
              </span>
              <span className="label-mono text-[10px] text-paper-faint">{role}</span>
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-paper-dim">{purpose}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
