import { getOpsActivity } from "@/lib/ops-metrics";
import { requirePlatformOwner } from "@/lib/platform";
import { formatWhen } from "@/lib/utils";

export default async function OpsActivityPage() {
  await requirePlatformOwner();
  const rows = getOpsActivity();

  return (
    <div>
      <h1 className="font-display text-3xl">Activity</h1>
      <p className="mt-1 text-sm text-ink/50">Club actions: creates, memberships, events, seasons, and joins.</p>
      <ul className="mt-6 space-y-2">
        {rows.length === 0 && (
          <li className="rounded-2xl border border-dashed border-line bg-card px-4 py-8 text-center text-sm text-ink/45">
            No audited actions yet.
          </li>
        )}
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl border border-line bg-card px-4 py-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p>
                <span className="font-medium">{row.actorName}</span>{" "}
                <span className="text-ink/55">{row.action.replaceAll("_", " ")}</span>{" "}
                <span className="text-ink/45">{row.entityType}</span>
                {row.clubName && (
                  <>
                    {" "}
                    in <span className="font-medium">{row.clubName}</span>
                  </>
                )}
              </p>
              <p className="text-xs text-ink/40">{formatWhen(row.createdAt)}</p>
            </div>
            <p className="mt-1 text-xs text-ink/40">{row.actorEmail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
