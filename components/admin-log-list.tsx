import { formatWhen } from "@/lib/utils";

export function AdminLogList({
  logs,
  timezone,
  nameOf,
}: {
  logs: { id: string; actorId: string; action: string; createdAt: number }[];
  timezone: string;
  nameOf: (id: string) => string;
}) {
  if (logs.length === 0) {
    return <p className="mt-4 text-sm text-ink/50">No actions yet.</p>;
  }

  return (
    <ul className="mt-4 space-y-3 text-sm">
      {logs.map((log) => (
        <li key={log.id}>
          <span className="text-ink/40">{formatWhen(log.createdAt, timezone)}</span>
          <br />
          {nameOf(log.actorId)} · {log.action}
        </li>
      ))}
    </ul>
  );
}
