"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, X } from "lucide-react";
import { voteClubPoll } from "@/lib/actions/club";
import { votePoll } from "@/lib/actions/weekly";
import { acceptPollSuggestion, addPollOption, adminDeleteVote, adminSetVote, deletePoll, suggestPollOption } from "@/lib/actions/polls";
import { SubmitButton } from "@/components/submit-button";
import { cn, formatWhen } from "@/lib/utils";

export type PollVoter = {
  userId: string;
  name: string;
  vote: string;
  optionId: string;
  votedAt: number;
};

export type PollHistory = {
  id: string;
  at: number;
  userName: string;
  actorName: string;
  action: string;
  detail: string;
};

export type PollSuggestion = {
  id: string;
  label: string;
  name: string;
  status: string;
};

export function PollCard({
  pollId,
  question,
  closesLabel,
  options,
  voters,
  history,
  suggestions,
  kind,
  slug,
  timezone,
  staff,
  canVote,
  canSeeDetails,
}: {
  pollId: string;
  question: string;
  closesLabel?: string | null;
  options: { id: string; label: string; votes: number; mine?: boolean }[];
  voters: PollVoter[];
  history: PollHistory[];
  suggestions: PollSuggestion[];
  kind: "club" | "event";
  slug: string;
  timezone: string;
  staff: boolean;
  canVote: boolean;
  canSeeDetails: boolean;
}) {
  const router = useRouter();
  const myOption = options.find((o) => o.mine);
  const [selected, setSelected] = useState(myOption?.id ?? "");
  const [changing, setChanging] = useState(!myOption);
  const [menu, setMenu] = useState(false);
  const [panel, setPanel] = useState<"details" | "suggest" | "admin" | "delete" | null>(null);
  const total = options.reduce((s, o) => s + o.votes, 0) || 1;

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-[0_8px_24px_rgba(63,58,52,0.06)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-primary">Live poll</p>
          <h3 className="mt-1 font-display text-lg">{question}</h3>
          {closesLabel && <p className="mt-1 text-xs text-ink/45">{closesLabel}</p>}
          {myOption && <p className="mt-1 text-xs text-ink/60">Your vote: {myOption.label}</p>}
        </div>
        <div className="relative">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink/60 hover:bg-muted hover:text-ink"
            aria-label="Poll actions"
            onClick={() => setMenu((v) => !v)}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menu && (
            <>
              <button type="button" className="fixed inset-0 z-20 cursor-default" aria-label="Close menu" onClick={() => setMenu(false)} />
              <div className="absolute right-0 z-30 mt-1 w-52 rounded-2xl border border-line bg-card py-1 text-sm shadow-[0_12px_32px_rgba(63,58,52,0.12)]">
                {canSeeDetails && (
                  <button type="button" className="block w-full px-3 py-2 text-left hover:bg-muted" onClick={() => { setPanel("details"); setMenu(false); }}>
                    See details
                  </button>
                )}
                {canVote && myOption && (
                  <button type="button" className="block w-full px-3 py-2 text-left hover:bg-muted" onClick={() => { setChanging(true); setMenu(false); }}>
                    Change the vote
                  </button>
                )}
                {canVote && !staff && (
                  <button type="button" className="block w-full px-3 py-2 text-left hover:bg-muted" onClick={() => { setPanel("suggest"); setMenu(false); }}>
                    Suggest an option
                  </button>
                )}
                {staff && (
                  <button type="button" className="block w-full px-3 py-2 text-left hover:bg-muted" onClick={() => { setPanel("admin"); setMenu(false); }}>
                    Edit
                  </button>
                )}
                {staff && (
                  <button type="button" className="block w-full px-3 py-2 text-left text-clay hover:bg-muted" onClick={() => { setPanel("delete"); setMenu(false); }}>
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {options.map((opt) => {
          const pct = Math.round((opt.votes / total) * 100);
          const active = selected === opt.id;
          return (
            <li key={opt.id}>
              <button
                type="button"
                disabled={!canVote || (!changing && Boolean(myOption))}
                onClick={() => setSelected(opt.id)}
                className={cn(
                  "relative h-auto w-full overflow-hidden rounded-xl border px-3 py-3 text-left",
                  active ? "border-primary/60" : "border-line",
                  !canVote && "opacity-70",
                )}
              >
                <span className="absolute inset-y-0 left-0 bg-primary/15" style={{ width: `${pct}%` }} />
                <span className="relative flex w-full items-center justify-between gap-3">
                  <span className="break-words">{opt.label}</span>
                  <span className="shrink-0 text-xs text-ink/50">
                    {opt.votes} · {pct}%
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {canVote && (changing || !myOption) && (
        <form
          className="mt-3"
          action={async (formData) => {
            if (kind === "club") await voteClubPoll(formData);
            else await votePoll(formData);
            setChanging(false);
            router.refresh();
          }}
        >
          <input type="hidden" name="optionId" value={selected} />
          <input type="hidden" name="slug" value={slug} />
          <SubmitButton className="w-full" disabled={!selected}>
            Vote
          </SubmitButton>
        </form>
      )}

      {panel === "details" && canSeeDetails && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby={`poll-details-${pollId}`}>
          <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Close details" onClick={() => setPanel(null)} />
          <div className="relative z-10 max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-line bg-card p-5 shadow-[0_24px_64px_rgba(63,58,52,0.2)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-secondary">Poll details</p>
                <h4 id={`poll-details-${pollId}`} className="mt-1 font-display text-lg">{question}</h4>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink/60 hover:bg-muted hover:text-ink"
                aria-label="Close"
                onClick={() => setPanel(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-4 text-sm">
              {options.map((opt) => {
                const names = voters.filter((v) => v.optionId === opt.id);
                return (
                  <div key={opt.id}>
                    <p className="text-xs uppercase tracking-[0.18em] text-secondary">
                      {opt.label} · {names.length}
                    </p>
                    {names.length === 0 ? (
                      <p className="mt-1 text-ink/45">No votes yet.</p>
                    ) : (
                      <ul className="mt-1 space-y-1">
                        {names.map((v) => (
                          <li key={v.userId} className="font-medium">
                            {v.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
              <p className="pt-2 text-xs uppercase tracking-[0.18em] text-secondary">History</p>
              {history.length === 0 ? (
                <p className="text-ink/50">No changes recorded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {history.map((h) => (
                    <li key={h.id}>
                      <span className="text-ink/45">{formatWhen(h.at, timezone)}</span>
                      <br />
                      {h.actorName === h.userName
                        ? `${h.userName} ${h.action === "cast" ? "voted" : h.action === "change" ? "changed" : h.action}: ${h.detail}`
                        : `${h.actorName} ${h.action.replace("_", " ")} ${h.userName}: ${h.detail}`}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {panel === "suggest" && !staff && (
        <form
          className="mt-4 space-y-2 rounded-xl border border-line bg-muted p-3"
          action={async (formData) => {
            await suggestPollOption(formData);
            setPanel(null);
            router.refresh();
          }}
        >
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="pollId" value={pollId} />
          <input
            name="label"
            required
            placeholder={kind === "event" ? "Another kickoff time" : "New option"}
            className="h-11 w-full rounded-xl border border-line bg-card px-3 text-sm"
          />
          <SubmitButton>Send suggestion</SubmitButton>
        </form>
      )}

      {suggestions.filter((s) => s.status === "pending").length > 0 && staff && (
        <ul className="mt-3 space-y-2 text-sm">
          {suggestions
            .filter((s) => s.status === "pending")
            .map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2">
                <span>
                  {s.name} suggested <strong>{s.label}</strong>
                </span>
                <form
                  action={async (formData) => {
                    await acceptPollSuggestion(formData);
                    router.refresh();
                  }}
                >
                  <input type="hidden" name="suggestionId" value={s.id} />
                  <SubmitButton variant="ghost" className="h-8 px-2 text-xs">
                    Add option
                  </SubmitButton>
                </form>
              </li>
            ))}
        </ul>
      )}

      {panel === "admin" && staff && (
        <div className="mt-4 space-y-3 rounded-xl border border-line bg-muted p-3 text-sm">
          <form
            className="space-y-2 rounded-xl border border-line bg-card p-2"
            action={async (formData) => {
              await addPollOption(formData);
              router.refresh();
            }}
          >
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="pollId" value={pollId} />
            <input
              name="label"
              required
              placeholder={kind === "event" ? "Add a kickoff time" : "Add an option"}
              className="h-11 w-full rounded-xl border border-line bg-card px-3 text-sm"
            />
            <SubmitButton variant="ghost" className="h-9 px-3 text-xs">
              Add option
            </SubmitButton>
          </form>
          {voters.length === 0 && <p className="text-ink/50">No votes to edit.</p>}
          {voters.map((v) => (
            <div key={v.userId} className="flex flex-col gap-2 rounded-xl border border-line bg-card p-2">
              <p className="font-medium">{v.name}</p>
              <form
                className="flex flex-wrap gap-2"
                action={async (formData) => {
                  await adminSetVote(formData);
                  router.refresh();
                }}
              >
                <input type="hidden" name="kind" value={kind} />
                <input type="hidden" name="pollId" value={pollId} />
                <input type="hidden" name="userId" value={v.userId} />
                <select name="optionId" defaultValue={v.optionId} className="h-9 rounded-lg border border-line bg-card px-2">
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <SubmitButton variant="ghost" className="h-9 px-3 text-xs">
                  Save
                </SubmitButton>
              </form>
              <form
                action={async (formData) => {
                  await adminDeleteVote(formData);
                  router.refresh();
                }}
              >
                <input type="hidden" name="kind" value={kind} />
                <input type="hidden" name="pollId" value={pollId} />
                <input type="hidden" name="userId" value={v.userId} />
                <SubmitButton variant="danger" className="h-8 px-3 text-xs">
                  Delete vote
                </SubmitButton>
              </form>
            </div>
          ))}
        </div>
      )}

      {panel === "delete" && staff && (
        <form
          className="mt-4 space-y-3 rounded-xl border border-line bg-muted p-3 text-sm"
          action={async (formData) => {
            await deletePoll(formData);
            router.refresh();
          }}
        >
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="pollId" value={pollId} />
          <p>Delete this poll and every vote on it? This cannot be undone.</p>
          <div className="flex gap-2">
            <SubmitButton variant="danger">Delete poll</SubmitButton>
            <button type="button" className="text-sm text-ink/50" onClick={() => setPanel(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
