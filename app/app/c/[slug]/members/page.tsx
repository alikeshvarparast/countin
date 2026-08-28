import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getCommunityBySlug, isOwner, isStaff } from "@/lib/access";
import { decideMembership } from "@/lib/actions/community";
import { AddMemberButton } from "@/components/add-member-button";
import { MemberManage } from "@/components/member-manage";
import { Avatar } from "@/components/avatar";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card } from "@/components/ui";
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

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">Squad</h2>
        {staff && <AddMemberButton slug={slug} />}
      </div>
      {staff && pending.length > 0 && (
        <section>
          <h3 className="font-display text-xl">Join requests</h3>
          <div className="mt-4 space-y-3">
            {pending.map(({ membership, user }) => (
              <Card key={membership.id} className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar src={user.imageUrl} name={user.name} size="md" />
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-cream/50">{user.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form
                    action={async (formData) => {
                      "use server";
                      await decideMembership(formData);
                    }}
                  >
                    <input type="hidden" name="membershipId" value={membership.id} />
                    <input type="hidden" name="decision" value="approved" />
                    <SubmitButton>Approve</SubmitButton>
                  </form>
                  <form
                    action={async (formData) => {
                      "use server";
                      await decideMembership(formData);
                    }}
                  >
                    <input type="hidden" name="membershipId" value={membership.id} />
                    <input type="hidden" name="decision" value="rejected" />
                    <SubmitButton variant="ghost">Decline</SubmitButton>
                  </form>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
      <ul className="grid gap-3">
        {squad.map(({ membership, user }) => (
          <li key={membership.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar src={user.imageUrl} name={user.name} size="md" />
              <div className="min-w-0">
                <p className="truncate font-medium">{user.name}</p>
                <p className="text-xs text-cream/50">@{user.telegramUsername}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
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
