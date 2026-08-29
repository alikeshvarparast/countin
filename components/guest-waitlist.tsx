import { decideEventGuest, removeEventGuest } from "@/lib/actions/weekly";
import { SubmitButton } from "@/components/submit-button";
import { formatWhen } from "@/lib/utils";

export type GuestWaitItem = {
  id: string;
  label: string;
  hostName: string;
  hostUserId: string;
  askedAt: number;
  status: string;
};

export function GuestWaitlist({
  pending,
  timezone,
  canDecide,
  userId,
}: {
  pending: GuestWaitItem[];
  timezone: string;
  canDecide: boolean;
  userId?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <h3 className="font-display text-lg">
        Guest requests{pending.length ? ` · ${pending.length}` : ""}
      </h3>
      <p className="mt-1 text-sm text-ink/55">
        New guests wait here. An admin can approve or ignore a request. The person who added them can cancel it.
      </p>
      <ol className="mt-4 space-y-3">
        {pending.length === 0 && (
          <li className="rounded-xl border border-dashed border-line px-3 py-4 text-sm text-ink/45">
            No guest requests right now.
          </li>
        )}
        {pending.map((item) => {
          const canCancel = Boolean(canDecide || userId === item.hostUserId);
          return (
            <li key={item.id} className="rounded-xl border border-line px-3 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="mt-0.5 text-xs text-ink/50">
                    Guest of {item.hostName} · asked {formatWhen(item.askedAt, timezone)}
                  </p>
                </div>
                {(canDecide || canCancel) && (
                  <div className="flex flex-wrap gap-2">
                    {canDecide && (
                      <>
                        <form
                          action={async (formData) => {
                            "use server";
                            await decideEventGuest(formData);
                          }}
                        >
                          <input type="hidden" name="guestId" value={item.id} />
                          <input type="hidden" name="decision" value="approved" />
                          <SubmitButton size="sm">Approve</SubmitButton>
                        </form>
                        <form
                          action={async (formData) => {
                            "use server";
                            await decideEventGuest(formData);
                          }}
                        >
                          <input type="hidden" name="guestId" value={item.id} />
                          <input type="hidden" name="decision" value="rejected" />
                          <SubmitButton size="sm" variant="ghost">
                            Ignore
                          </SubmitButton>
                        </form>
                      </>
                    )}
                    {canCancel && (
                      <form
                        action={async () => {
                          "use server";
                          await removeEventGuest(item.id);
                        }}
                      >
                        <SubmitButton size="sm" variant="ghost">
                          Cancel
                        </SubmitButton>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function GuestCancelButton({ guestId }: { guestId: string }) {
  return (
    <form
      action={async () => {
        "use server";
        await removeEventGuest(guestId);
      }}
    >
      <SubmitButton size="sm" variant="ghost">
        Cancel
      </SubmitButton>
    </form>
  );
}
