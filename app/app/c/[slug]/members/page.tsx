import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getCommunityBySlug, isOwner, isStaff } from "@/lib/access";
import { decideMembership } from "@/lib/actions/community";
import { AddMemberButton } from "@/components/add-member-button";
import { MemberManage } from "@/components/member-manage";
import { Avatar } from "@/components/avatar";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui";
import { db } from "@/lib/db";
import { memberships, users } from "@/lib/db/schema";
import { notFound } from "next/navigation";

function roleRank(role: string) {
  if (role === "owner") return 0;
  if (role === "admin") return 1;
  return 2;
}

function roleTone(role: string, status: string): "lime" | "clay" | "line" {
  if (status === "suspended") return "clay";
  if (role === "owner") return "lime";
  if (role === "admin") return "clay";
  return "line";
}

export default async function MembersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const community = getCommunityBySlug(slug);
  if (!community) notFound();
  const session = await auth();
  const userId = session?.user?.id;
  const staff = userId ? isStaff(community.id, userId) : false;
  const owner = userId ? isOwner(community.id, userId) : false;
  const rows = db
    .select({
      membership: memberships,
      user: users,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.communityId, community.id))
    .all();

  const pending = rows.filter((r) => r.membership.status === "pending");
  const squad = rows
    .filter((r) => r.membership.status === "approved" || r.membership.status === "suspended")
    .sort((a, b) => roleRank(a.membership.role) - roleRank(b.membership.role) || a.user.name.localeCompare(b.user.name));
  const memberCount = squad.filter((r) => r.membership.status === "approved").length;
  const suspendedCount = squad.filter((r) => r.membership.status === "suspended").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Squad</h2>
          <p className="mt-1 text-sm text-ink/55">
            {memberCount} {memberCount === 1 ? "member" : "members"}
            {suspendedCount > 0
              ? ` · ${suspendedCount} suspended`
              : ""}
            {staff && pending.length > 0
              ? ` · ${pending.length} join request${pending.length === 1 ? "" : "s"}`
              : ""}
          </p>
        </div>
        {staff && <AddMemberButton slug={slug} />}
      </div>
      {staff && pending.length > 0 && (
        <section>
          <h3 className="font-display text-lg">Join requests</h3>
          <ul className="mt-3 overflow-hidden rounded-2xl border border-line bg-card">
            {pending.map(({ membership, user }) => (
              <li key={membership.id} className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-b-0">
                <Avatar src={user.imageUrl} name={user.name} size="sm" />
                <p className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-medium">{user.name}</span>
                  <span className="ml-2 text-ink/45">{user.email}</span>
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <form
                    action={async (formData) => {
                      "use server";
                      await decideMembership(formData);
                    }}
                  >
                    <input type="hidden" name="membershipId" value={membership.id} />
                    <input type="hidden" name="decision" value="approved" />
                    <SubmitButton size="sm">Approve</SubmitButton>
                  </form>
                  <form
                    action={async (formData) => {
                      "use server";
                      await decideMembership(formData);
                    }}
                  >
                    <input type="hidden" name="membershipId" value={membership.id} />
                    <input type="hidden" name="decision" value="rejected" />
                    <SubmitButton variant="ghost" size="sm">
                      Decline
                    </SubmitButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ul className="overflow-hidden rounded-2xl border border-line bg-card">
        {squad.map(({ membership, user }) => (
          <li key={membership.id} className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-b-0">
            <Avatar src={user.imageUrl} name={user.name} size="sm" />
            <p className="min-w-0 flex-1 truncate text-sm">
              <span className="font-medium">{user.name}</span>
              {user.telegramUsername && <span className="ml-2 text-ink/45">@{user.telegramUsername}</span>}
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              <Badge tone={roleTone(membership.role, membership.status)}>
                {membership.status === "suspended" ? "suspended" : membership.role}
              </Badge>
              {owner && membership.role !== "owner" && (
                <MemberManage membershipId={membership.id} role={membership.role} status={membership.status} />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
