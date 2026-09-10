"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { setMembershipRole, setMembershipStatus } from "@/lib/actions/community";
import { ActionMenu } from "@/components/action-menu";
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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const nextRole = role === "admin" ? "member" : "admin";

  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink/60 hover:bg-muted hover:text-ink"
        aria-label="Member actions"
        onClick={() => {
          setOpen((v) => !v);
          setConfirmRemove(false);
        }}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      <ActionMenu
        open={open}
        onClose={() => {
          setOpen(false);
          setConfirmRemove(false);
        }}
      >
        <form
          action={async (formData) => {
            await setMembershipRole(formData);
            setOpen(false);
            router.refresh();
          }}
        >
          <input type="hidden" name="membershipId" value={membershipId} />
          <input type="hidden" name="role" value={nextRole} />
          <button type="submit" className="block w-full px-3 py-2.5 text-left hover:bg-muted">
            {nextRole === "admin" ? "Make admin" : "Make member"}
          </button>
        </form>
        <form
          action={async (formData) => {
            await setMembershipStatus(formData);
            setOpen(false);
            router.refresh();
          }}
        >
          <input type="hidden" name="membershipId" value={membershipId} />
          <input type="hidden" name="status" value={status === "suspended" ? "approved" : "suspended"} />
          <button type="submit" className="block w-full px-3 py-2.5 text-left hover:bg-muted">
            {status === "suspended" ? "Restore" : "Suspend"}
          </button>
        </form>
        {confirmRemove ? (
          <form
            action={async (formData) => {
              await setMembershipStatus(formData);
              setOpen(false);
              router.refresh();
            }}
          >
            <input type="hidden" name="membershipId" value={membershipId} />
            <input type="hidden" name="status" value="removed" />
            <SubmitButton variant="danger" className="mt-1 mx-2 mb-2 h-10 w-[calc(100%-1rem)] px-3 text-xs">
              Confirm remove
            </SubmitButton>
          </form>
        ) : (
          <button
            type="button"
            className="block w-full px-3 py-2.5 text-left text-clay hover:bg-muted"
            onClick={() => setConfirmRemove(true)}
          >
            Remove from club
          </button>
        )}
      </ActionMenu>
    </div>
  );
}
