import { decideEventGuest } from "@/lib/actions/weekly";
import { SubmitButton } from "@/components/submit-button";
import { formatWhen } from "@/lib/utils";

export type GuestWaitItem = {
  id: string;
  label: string;
  hostName: string;
  askedAt: number;
  status: string;
};

export function GuestWaitlist({
  pending,
  history,
  timezone,
  canDecide,
}: {
  pending: GuestWaitItem[];
  history: GuestWaitItem[];
  timezone: string;
  canDecide: boolean;
}) {
  return (
    <div className="mt-5 border-t border-line pt-5">
      <p className="text-xs uppercase tracking-[0.18em] text-secondary">Guest waitlist · {pending.length}</p>
      <p className="mt-1 text-sm text-ink/55">Guests wait here until an admin approves them onto the list.</p>
      <ol className="mt-4 space-y-3">
        {pending.length === 0 && <li className="text-sm text-ink/45">No guests waiting.</li>}
        {pending.map((item, index) => (
          <li key={item.id} className="rounded-xl border border-line px-3 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  <span className="mr-2 text-ink/40">{index + 1}.</span>
                  {item.label}
                </p>
                <p className="mt-0.5 text-xs text-ink/50">
                  Guest of {item.hostName} · asked {formatWhen(item.askedAt, timezone)}
                </p>
              </div>
              {canDecide && (
                <div className="flex flex-wrap gap-2">
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
          <p className="text-xs uppercase tracking-[0.18em] text-secondary">Guest record</p>
          <ul className="mt-2 space-y-2 text-sm">
            {history.map((item) => (
              <li key={item.id}>
                {item.label}
                <span className="text-ink/45">
                  {" "}
                  · guest of {item.hostName} · {item.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
