import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getCommunityBySlug, isAdmin } from "@/lib/access";
import { decideMembership } from "@/lib/actions/community";
import { AddMemberForm } from "@/components/community-forms";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card } from "@/components/ui";
import { db } from "@/lib/db";
import { memberships, users } from "@/lib/db/schema";
import { notFound } from "next/navigation";

export default async function MembersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const community = getCommunityBySlug(slug);
  if (!community) notFound();
  const session = await auth();
  const admin = session?.user?.id ? isAdmin(community.id, session.user.id) : false;
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
  const approved = rows.filter((r) => r.membership.status === "approved");

  return (
    <div className="space-y-8">
      {admin && (
        <Card>
          <AddMemberForm slug={slug} />
        </Card>
      )}
      {admin && pending.length > 0 && (
        <section>
          <h2 className="font-display text-2xl text-lime">Requests</h2>
          <div className="mt-4 space-y-3">
            {pending.map(({ membership, user }) => (
              <Card key={membership.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-sm text-cream/50">{user.email}</p>
                </div>
                <div className="flex gap-2">
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
      <section>
        <h2 className="font-display text-2xl text-lime">Members</h2>
        <ul className="mt-4 space-y-2">
          {approved.map(({ membership, user }) => (
            <li key={membership.id} className="flex items-center justify-between rounded-xl border border-line px-4 py-3">
              <div>
                <p>{user.name}</p>
                <p className="text-xs text-cream/50">@{user.telegramUsername}</p>
              </div>
              <Badge tone={membership.role === "admin" ? "lime" : "line"}>{membership.role}</Badge>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
