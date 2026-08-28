import { decideWaitlist } from "@/lib/actions/season";
import { SubmitButton } from "@/components/submit-button";
import { formatWhen } from "@/lib/utils";

export type WaitlistItem = {
  slotId: string;
  name: string;
  askedAt: number;
  status: string;
  sessionLabel?: string;
};

export function WaitlistPanel({
  pending,
  history,
  timezone,
  canDecide,
  rateMissing,
  embedded,
}: {
  pending: WaitlistItem[];
  history: WaitlistItem[];
  timezone: string;
  canDecide: boolean;
  rateMissing?: boolean;
  embedded?: boolean;
}) {
  const body = (
    <>
      {embedded ? (
        <p className="text-xs uppercase tracking-[0.18em] text-secondary">Waitlist · {pending.length}</p>
      ) : (
        <h3 className="font-display text-lg">Waitlist</h3>
      )}
      <p className="mt-1 text-sm text-ink/55">Sorted by who asked first.</p>
      {rateMissing && canDecide && (
        <p className="mt-2 text-sm text-clay">Set the occasional rate on the season before you can approve anyone.</p>
      )}
      <ol className="mt-4 space-y-3">
        {pending.length === 0 && <li className="text-sm text-ink/45">No one is waiting.</li>}
        {pending.map((item, index) => (
          <li key={item.slotId} className="rounded-xl border border-line px-3 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  <span className="mr-2 text-ink/40">{index + 1}.</span>
                  {item.name}
                </p>
                <p className="mt-0.5 text-xs text-ink/50">
                  Asked {formatWhen(item.askedAt, timezone)}
                  {item.sessionLabel ? ` · ${item.sessionLabel}` : ""}
                </p>
              </div>
              {canDecide && (
                <div className="flex flex-wrap gap-2">
                  <form
                    action={async (formData) => {
                      "use server";
                      await decideWaitlist(formData);
                    }}
                  >
                    <input type="hidden" name="slotId" value={item.slotId} />
                    <input type="hidden" name="decision" value="approved" />
                    <SubmitButton size="sm" disabled={rateMissing}>
                      Approve
                    </SubmitButton>
                  </form>
                  <form
                    action={async (formData) => {
                      "use server";
                      await decideWaitlist(formData);
                    }}
                  >
                    <input type="hidden" name="slotId" value={item.slotId} />
                    <input type="hidden" name="decision" value="rejected" />
                    <SubmitButton size="sm" variant="ghost">
                      Decline
                    </SubmitButton>
                  </form>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
      {history.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-xs uppercase tracking-[0.18em] text-secondary">Record</p>
          <ul className="mt-2 space-y-2 text-sm">
            {history.map((item) => (
              <li key={item.slotId} className="flex flex-wrap items-baseline justify-between gap-2">
                <span>
                  {item.name}
                  <span className="text-ink/45">
                    {" "}
                    · {item.status.replaceAll("_", " ")}
                    {item.sessionLabel ? ` · ${item.sessionLabel}` : ""}
                  </span>
                </span>
                <span className="text-xs text-ink/45">Asked {formatWhen(item.askedAt, timezone)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
  if (embedded) return <div className="mt-5 border-t border-line pt-5">{body}</div>;
  return <div className="rounded-2xl border border-line bg-card p-5">{body}</div>;
}
