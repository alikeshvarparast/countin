"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { setMembershipRole, setMembershipStatus } from "@/lib/actions/community";
import { SubmitButton } from "@/components/submit-button";

export function MemberManage({
  membershipId,
  role,
  status,
}: {
  membershipId: string;
  role: string;
  status: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink/60 hover:bg-muted hover:text-ink"
        aria-label="Member actions"
        onClick={() => {
          setOpen((v) => !v);
          setConfirmDelete(false);
        }}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-20 cursor-default" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-30 mt-1 w-56 rounded-2xl border border-line bg-card p-2 text-sm shadow-[0_12px_32px_rgba(63,58,52,0.12)]">
            <form
              className="flex items-center gap-2 rounded-xl px-1 py-1"
              action={async (formData) => {
                await setMembershipRole(formData);
                setOpen(false);
              }}
            >
              <input type="hidden" name="membershipId" value={membershipId} />
              <label className="sr-only" htmlFor={`role-${membershipId}`}>
                Role
              </label>
              <select
                id={`role-${membershipId}`}
                name="role"
                defaultValue={role === "admin" ? "admin" : "member"}
                className="h-9 min-w-0 flex-1 rounded-full border border-line bg-card px-3 text-xs text-ink"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <SubmitButton variant="ghost" className="h-9 px-3 text-xs">
                Save
              </SubmitButton>
            </form>
            <form
              action={async (formData) => {
                await setMembershipStatus(formData);
                setOpen(false);
              }}
            >
              <input type="hidden" name="membershipId" value={membershipId} />
              <input type="hidden" name="status" value={status === "suspended" ? "approved" : "suspended"} />
              <button type="submit" className="block w-full rounded-xl px-3 py-2 text-left hover:bg-muted">
                {status === "suspended" ? "Restore" : "Suspend"}
              </button>
            </form>
            {confirmDelete ? (
              <form
                action={async (formData) => {
                  await setMembershipStatus(formData);
                  setOpen(false);
                }}
              >
                <input type="hidden" name="membershipId" value={membershipId} />
                <input type="hidden" name="status" value="removed" />
                <SubmitButton variant="danger" className="mt-1 h-9 w-full px-3 text-xs">
                  Delete forever
                </SubmitButton>
              </form>
            ) : (
              <button
                type="button"
                className="block w-full rounded-xl px-3 py-2 text-left text-clay hover:bg-muted"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
