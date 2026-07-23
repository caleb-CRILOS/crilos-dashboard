import Link from "next/link";
import { LucideIcon } from "lucide-react";

export interface ActivityItem {
  id: string;
  agentName: string;
  icon: LucideIcon;
  label: string;
  summary: string;
  updatedAtLabel: string;
  href?: string;
}

export default function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="hud-panel stack p-8 text-center text-sm text-paper-dim">
        No activity yet.
      </div>
    );
  }
  return (
    <div className="hud-panel stack divide-y divide-line overflow-hidden">
      {items.map((item) => {
        const Icon = item.icon;
        const content = (
          <div className="flex items-center gap-3 px-4 py-3">
            <Icon size={16} className="shrink-0 text-paper" />
            <div className="min-w-0 flex-1">
              <div className="label-mono text-xs text-paper-faint">
                {item.agentName} · {item.label}
              </div>
              <div className="truncate text-xs text-paper-dim">{item.summary}</div>
            </div>
            <div className="shrink-0 text-xs text-paper-faint">{item.updatedAtLabel}</div>
          </div>
        );
        return item.href ? (
          <Link key={item.id} href={item.href} className="block hover:bg-paper/[0.03]">
            {content}
          </Link>
        ) : (
          <div key={item.id}>{content}</div>
        );
      })}
    </div>
  );
}
