"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, X } from "lucide-react";
import { voteClubPoll } from "@/lib/actions/club";
import { votePoll } from "@/lib/actions/weekly";
import {
  acceptPollSuggestion,
  addPollOption,
  adminDeleteVote,
  adminSetVote,
  deletePoll,
  removePollOption,
  suggestPollOption,
  updatePoll,
  updatePollOption,
} from "@/lib/actions/polls";
import { ActionMenu } from "@/components/action-menu";
import { SubmitButton } from "@/components/submit-button";
import { VoteNeedsFrame, VoteOptionButton } from "@/components/vote-choice";
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
  closesAtDefault,
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
  memberCount,
  nonVoters = [],
}: {
  pollId: string;
  question: string;
  closesLabel?: string | null;
  closesAtDefault?: string;
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
  /** Approved members who can vote — used for “haven’t voted” count. */
  memberCount?: number;
  nonVoters?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const myOption = options.find((o) => o.mine);
  const [selected, setSelected] = useState(myOption?.id ?? "");
  const [changing, setChanging] = useState(!myOption);
  const [menu, setMenu] = useState(false);
  const [panel, setPanel] = useState<"details" | "suggest" | "admin" | "delete" | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const totalVotes = options.reduce((s, o) => s + o.votes, 0);
  const total = totalVotes || 1;
  const needsReply = canVote && !myOption;
  const uniqueVoters = new Set(voters.map((v) => v.userId)).size;
  const notVotedCount =
    nonVoters.length > 0
      ? nonVoters.length
      : typeof memberCount === "number"
        ? Math.max(0, memberCount - uniqueVoters)
        : null;

  return (
    <VoteNeedsFrame needsReply={needsReply} className="h-full">
      <div
        className={cn(
          "flex h-full flex-col rounded-2xl border bg-card p-5 shadow-[0_8px_24px_rgba(63,58,52,0.06)]",
          needsReply
            ? "border-warn/40 bg-[color:var(--color-warn-wash)] shadow-[0_10px_28px_rgba(180,83,9,0.12)]"
            : "border-line",
        )}
      >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn("text-xs uppercase tracking-[0.18em]", needsReply ? "text-warn" : "text-primary")}>
            {needsReply ? "Needs your vote" : "Live poll"}
          </p>
          <h3 className="mt-1 font-display text-lg">{question}</h3>
          {closesLabel && <p className="mt-1 text-xs text-ink/45">{closesLabel}</p>}
          {myOption && <p className="mt-1 text-xs text-ink/60">Your vote: {myOption.label}</p>}
          {(myOption || totalVotes > 0) && (
            <p className="mt-1 text-xs text-ink/55">
              {totalVotes} vote{totalVotes === 1 ? "" : "s"}
              {notVotedCount != null
                ? ` · ${notVotedCount} ha${notVotedCount === 1 ? "s" : "ve"}n’t voted`
                : ""}
            </p>
          )}
          {needsReply && (
            <p className="mt-1 text-xs font-medium text-warn">Choose an option, then submit</p>
          )}
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
          <ActionMenu open={menu} onClose={() => setMenu(false)}>
            {canSeeDetails && (
              <button
                type="button"
                className="block w-full px-3 py-2.5 text-left hover:bg-muted"
                onClick={() => {
                  setPanel("details");
                  setMenu(false);
                }}
              >
                See details
              </button>
            )}
            {canVote && myOption && (
              <button
                type="button"
                className="block w-full px-3 py-2.5 text-left hover:bg-muted"
                onClick={() => {
                  setChanging(true);
                  setMenu(false);
                }}
              >
                Change the vote
              </button>
            )}
            {canVote && !staff && (
              <button
                type="button"
                className="block w-full px-3 py-2.5 text-left hover:bg-muted"
                onClick={() => {
                  setPanel("suggest");
                  setMenu(false);
                }}
              >
                Suggest an option
              </button>
            )}
            {staff && (
              <button
                type="button"
                className="block w-full px-3 py-2.5 text-left hover:bg-muted"
                onClick={() => {
                  setEditError(null);
                  setPanel("admin");
                  setMenu(false);
                }}
              >
                Edit
              </button>
            )}
            {staff && (
              <button
                type="button"
                className="block w-full px-3 py-2.5 text-left text-clay hover:bg-muted"
                onClick={() => {
                  setPanel("delete");
                  setMenu(false);
                }}
              >
                Delete
              </button>
            )}
          </ActionMenu>
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {options.map((opt) => {
          const pct = Math.round((opt.votes / total) * 100);
          const active = selected === opt.id;
          const locked = !canVote || (!changing && Boolean(myOption));
          return (
            <li key={opt.id} className="relative">
              <span
                className="vote-bar-fill pointer-events-none absolute inset-y-0 left-0 rounded-xl bg-primary/12"
                style={{ width: `${pct}%` }}
                aria-hidden
              />
              <VoteOptionButton
                active={active}
                disabled={locked}
                onClick={() => setSelected(opt.id)}
                label={opt.label}
                detail={`${opt.votes} vote${opt.votes === 1 ? "" : "s"} · ${pct}%`}
                className="relative bg-transparent"
              />
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
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`poll-details-${pollId}`}
        >
          <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Close details" onClick={() => setPanel(null)} />
          <div className="relative z-10 max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-line bg-card p-5 shadow-[0_24px_64px_rgba(63,58,52,0.2)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-secondary">Poll details</p>
                <h4 id={`poll-details-${pollId}`} className="mt-1 font-display text-lg">
                  {question}
                </h4>
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
              {(nonVoters.length > 0 || (notVotedCount != null && notVotedCount > 0)) && (
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-secondary">
                    Haven’t voted · {nonVoters.length || notVotedCount}
                  </p>
                  {nonVoters.length === 0 ? (
                    <p className="mt-1 text-ink/45">{notVotedCount} member{notVotedCount === 1 ? "" : "s"}.</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {nonVoters.map((p) => (
                        <li key={p.id} className="font-medium">
                          {p.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
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
            className="space-y-2 rounded-xl border border-line bg-card p-3"
            action={async (formData) => {
              const result = await updatePoll(formData);
              if (result?.error) {
                setEditError(result.error);
                return;
              }
              setEditError(null);
              router.refresh();
            }}
          >
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="pollId" value={pollId} />
            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wider text-ink/50">Question</span>
              <input
                name="question"
                required
                defaultValue={question}
                className="h-11 w-full rounded-xl border border-line bg-card px-3 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wider text-ink/50">Closes (optional)</span>
              <input
                name="closesAt"
                type="datetime-local"
                defaultValue={closesAtDefault ?? ""}
                className="h-11 w-full rounded-xl border border-line bg-card px-3 text-sm"
              />
            </label>
            <SubmitButton className="w-full">Save poll</SubmitButton>
          </form>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-ink/50">Options</p>
            {options.map((opt) => (
              <div key={opt.id} className="space-y-2 rounded-xl border border-line bg-card p-2">
                <form
                  className="flex flex-wrap gap-2"
                  action={async (formData) => {
                    const result = await updatePollOption(formData);
                    if (result?.error) {
                      setEditError(result.error);
                      return;
                    }
                    setEditError(null);
                    router.refresh();
                  }}
                >
                  <input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="optionId" value={opt.id} />
                  <input
                    name="label"
                    required
                    defaultValue={opt.label}
                    className="h-9 min-w-0 max-w-full flex-1 rounded-lg border border-line bg-card px-2 text-sm"
                  />
                  <SubmitButton variant="ghost" className="h-9 px-3 text-xs">
                    Save
                  </SubmitButton>
                </form>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-ink/45">{opt.votes} vote{opt.votes === 1 ? "" : "s"}</span>
                  {options.length > 2 && (
                    <form
                      action={async (formData) => {
                        const result = await removePollOption(formData);
                        if (result?.error) {
                          setEditError(result.error);
                          return;
                        }
                        setEditError(null);
                        router.refresh();
                      }}
                    >
                      <input type="hidden" name="kind" value={kind} />
                      <input type="hidden" name="optionId" value={opt.id} />
                      <SubmitButton variant="danger" className="h-8 px-3 text-xs">
                        Remove
                      </SubmitButton>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>

          <form
            className="space-y-2 rounded-xl border border-line bg-card p-2"
            action={async (formData) => {
              const result = await addPollOption(formData);
              if (result?.error) {
                setEditError(result.error);
                return;
              }
              setEditError(null);
              router.refresh();
            }}
          >
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="pollId" value={pollId} />
            <input
              name="label"
              required
              type={kind === "event" ? "datetime-local" : "text"}
              placeholder={kind === "event" ? "Add a kickoff time" : "Add an option"}
              className="h-11 w-full rounded-xl border border-line bg-card px-3 text-sm"
            />
            <SubmitButton variant="ghost" className="h-9 px-3 text-xs">
              Add option
            </SubmitButton>
          </form>

          {editError && <p className="text-clay">{editError}</p>}

          <p className="pt-1 text-xs uppercase tracking-wider text-ink/50">Votes</p>
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
                <select name="optionId" defaultValue={v.optionId} className="h-9 min-w-0 max-w-full flex-1 rounded-lg border border-line bg-card px-2">
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
    </VoteNeedsFrame>
  );
}
