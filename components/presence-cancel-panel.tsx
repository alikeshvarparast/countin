import {
  cancelPresenceCancelRequest,
  decidePresenceCancel,
} from "@/lib/actions/weekly";
import { SubmitButton } from "@/components/submit-button";
import { formatWhen } from "@/lib/utils";

export type PresenceCancelItem = {
  id: string;
  userName: string;
  userId: string;
  askedAt: number;
};

export function PresenceCancelPanel({
  pending,
  timezone,
  canDecide,
  userId,
  minPlayers,
}: {
  pending: PresenceCancelItem[];
  timezone: string;
  canDecide: boolean;
  userId?: string;
  minPlayers: number;
}) {
  if (pending.length === 0) return null;

  return (
    <div
      id="presence-cancel"
      className="rounded-2xl border border-warn/40 bg-[color:var(--color-warn-wash)] p-5 shadow-[0_10px_28px_rgba(180,83,9,0.1)]"
    >
      <h3 className="font-display text-lg">
        Leave requests{pending.length ? ` · ${pending.length}` : ""}
      </h3>
      <p className="mt-1 text-sm text-ink/65">
        These members want to mark not going, but that would drop below the minimum of {minPlayers}.{" "}
        {canDecide ? "Approve or decline each request." : "Waiting for an admin or owner to decide."}
      </p>
      <ol className="mt-4 space-y-3">
        {pending.length === 0 && (
          <li className="rounded-xl border border-dashed border-line/80 bg-card/60 px-3 py-4 text-sm text-ink/45">
            No leave requests right now.
          </li>
        )}
        {pending.map((item) => {
          const mine = userId === item.userId;
          return (
            <li key={item.id} className="rounded-xl border border-line bg-card px-3 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.userName}</p>
                  <p className="mt-0.5 text-xs text-ink/50">
                    Asked {formatWhen(item.askedAt, timezone)} · would go below min {minPlayers}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canDecide && (
                    <>
                      <form
                        action={async (formData) => {
                          "use server";
                          await decidePresenceCancel(formData);
                        }}
                      >
                        <input type="hidden" name="requestId" value={item.id} />
                        <input type="hidden" name="decision" value="approved" />
                        <SubmitButton size="sm">Approve leave</SubmitButton>
                      </form>
                      <form
                        action={async (formData) => {
                          "use server";
                          await decidePresenceCancel(formData);
                        }}
                      >
                        <input type="hidden" name="requestId" value={item.id} />
                        <input type="hidden" name="decision" value="declined" />
                        <SubmitButton size="sm" variant="ghost">
                          Decline
                        </SubmitButton>
                      </form>
                    </>
                  )}
                  {mine && (
                    <form
                      action={async () => {
                        "use server";
                        await cancelPresenceCancelRequest(item.id);
                      }}
                    >
                      <SubmitButton size="sm" variant="ghost">
                        Withdraw
                      </SubmitButton>
                    </form>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
