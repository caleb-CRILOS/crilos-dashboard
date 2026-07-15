import Link from "next/link";
import { Client } from "@/lib/types";
import HealthBadge from "./HealthBadge";
import { formatDistanceToNow } from "date-fns";

export default function ClientTable({ clients }: { clients: Client[] }) {
  if (clients.length === 0) {
    return (
      <div className="hud-panel stack p-8 text-center text-sm text-paper-dim">
        No clients yet. Sync GoHighLevel or import a Skool CSV from Settings.
      </div>
    );
  }

  return (
    <div className="hud-panel stack overflow-hidden">
      <table className="w-full text-sm">
        <thead className="label-mono bg-paper text-left text-[11px] text-ink">
          <tr>
            <th className="px-4 py-3 font-semibold">Client</th>
            <th className="px-4 py-3 font-semibold">Source</th>
            <th className="px-4 py-3 font-semibold">Health</th>
            <th className="px-4 py-3 font-semibold">Last activity</th>
            <th className="px-4 py-3 font-semibold">MRR</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line bg-ink">
          {clients.map((c) => (
            <tr key={c.id} className="hover:bg-paper/[0.03]">
              <td className="px-4 py-3">
                <Link
                  href={`/clients/${c.id}`}
                  className="font-medium text-paper hover:underline"
                >
                  {c.name}
                </Link>
                {c.email && (
                  <div className="text-xs text-paper-faint">{c.email}</div>
                )}
              </td>
              <td className="px-4 py-3">
                <span className="tag tag--plain">{c.source}</span>
              </td>
              <td className="px-4 py-3">
                <HealthBadge status={c.health ?? "red"} />
              </td>
              <td className="px-4 py-3 text-paper-dim">
                {c.lastActivityAt
                  ? formatDistanceToNow(new Date(c.lastActivityAt), {
                      addSuffix: true,
                    })
                  : "No activity recorded"}
              </td>
              <td className="px-4 py-3 font-mono tabular-nums text-paper">
                {c.mrr ? `$${c.mrr.toLocaleString()}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
