"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addContract, removeContract, replaceContractMember } from "@/lib/actions/season";
import { Badge, Button, Field, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { formatMoney } from "@/lib/utils";

type Member = { userId: string; name: string };
type ContractRow = { userId: string; name: string; prepaid: boolean };

export function ContractMembersPanel({
  seasonId,
  isAdmin,
  contracts,
  occasionalMembers,
  currency,
  duesPerPlayerCents,
  paymentRequested,
}: {
  seasonId: string;
  isAdmin: boolean;
  contracts: ContractRow[];
  occasionalMembers: Member[];
  currency: string;
  duesPerPlayerCents: number | null;
  paymentRequested: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addUserId, setAddUserId] = useState(occasionalMembers[0]?.userId ?? "");
  const [replaceFrom, setReplaceFrom] = useState(contracts[0]?.userId ?? "");
  const [replaceTo, setReplaceTo] = useState(occasionalMembers[0]?.userId ?? "");
  const duesLabel = duesPerPlayerCents != null ? formatMoney(duesPerPlayerCents, currency) : null;

  async function run(action: (fd: FormData) => Promise<{ error?: string } | { ok?: boolean }>, fd: FormData) {
    setError(null);
    const result = await action(fd);
    if (result && "error" in result && result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg">Contract members</h3>
          <p className="mt-1 text-sm text-ink/60">
            {contracts.length} on contract
            {duesLabel ? ` · ${duesLabel} each` : ""}
            {paymentRequested ? " · ledger dues follow this list" : ""}
          </p>
        </div>
        {isAdmin && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing((v) => !v)}>
            {editing ? "Done" : "Edit"}
          </Button>
        )}
      </div>

      <ul className="space-y-2">
        {contracts.length === 0 && <li className="text-sm text-ink/45">No contract members yet.</li>}
        {contracts.map((row) => (
          <li
            key={row.userId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2"
          >
            <span className="text-sm font-medium">{row.name}</span>
            <div className="flex items-center gap-2">
              {row.prepaid && <Badge tone="lime">prepaid</Badge>}
              {editing && isAdmin && (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("seasonId", seasonId);
                    fd.set("userId", row.userId);
                    void run(removeContract, fd);
                  }}
                >
                  Remove
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {!editing && (
        <>
          <h4 className="text-xs uppercase tracking-[0.18em] text-secondary">
            Occasional · {occasionalMembers.length}
          </h4>
          <ul className="space-y-1 text-sm">
            {occasionalMembers.length === 0 && <li className="text-ink/45">Everyone is on contract.</li>}
            {occasionalMembers.map((m) => (
              <li key={m.userId}>{m.name}</li>
            ))}
          </ul>
        </>
      )}

      {editing && isAdmin && (
        <div className="space-y-4 border-t border-line pt-4">
          {occasionalMembers.length > 0 && (
            <form
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
              action={async () => {
                const fd = new FormData();
                fd.set("seasonId", seasonId);
                fd.set("userId", addUserId);
                await run(addContract, fd);
              }}
            >
              <div className="flex-1">
                <Field label="Add member">
                  <Select value={addUserId} onChange={(e) => setAddUserId(e.target.value)}>
                    {occasionalMembers.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <SubmitButton>Add</SubmitButton>
            </form>
          )}

          {contracts.length > 0 && occasionalMembers.length > 0 && (
            <form
              className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
              action={async () => {
                const fd = new FormData();
                fd.set("seasonId", seasonId);
                fd.set("fromUserId", replaceFrom);
                fd.set("toUserId", replaceTo);
                await run(replaceContractMember, fd);
              }}
            >
              <Field label="Replace">
                <Select value={replaceFrom} onChange={(e) => setReplaceFrom(e.target.value)}>
                  {contracts.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="With">
                <Select value={replaceTo} onChange={(e) => setReplaceTo(e.target.value)}>
                  {occasionalMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <SubmitButton>Replace</SubmitButton>
            </form>
          )}

          <p className="text-xs text-ink/50">
            Adding or replacing updates future nights and recalculates open season payment requests on the ledger.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-clay">{error}</p>}
    </div>
  );
}
