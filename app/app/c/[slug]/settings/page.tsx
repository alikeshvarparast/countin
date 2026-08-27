import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getCommunityBySlug, isAdmin } from "@/lib/access";
import { CommunitySettingsForm } from "@/components/community-forms";
import { Card } from "@/components/ui";
import { db } from "@/lib/db";
import { auditLogs, users } from "@/lib/db/schema";
import { formatWhen } from "@/lib/utils";

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const community = getCommunityBySlug(slug);
  if (!community) notFound();
  const session = await auth();
  const admin = session?.user?.id ? isAdmin(community.id, session.user.id) : false;
  if (!admin) {
    return <p>Only admins can change community settings.</p>;
  }
  const logs = db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.communityId, community.id))
    .orderBy(desc(auditLogs.createdAt))
    .all()
    .slice(0, 40);
  const people = db.select().from(users).all();
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? id;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Card>
        <h2 className="font-display text-2xl text-lime">Club settings</h2>
        <p className="mb-4 mt-1 text-sm text-cream/50">Timezone and currency apply to events, seasons, and money.</p>
        <CommunitySettingsForm
          slug={slug}
          name={community.name}
          description={community.description ?? ""}
          location={community.location ?? ""}
          timezone={community.timezone}
          currency={community.currency}
        />
      </Card>
      <Card>
        <h2 className="font-display text-2xl text-lime">Admin log</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {logs.length === 0 && <li className="text-cream/50">No actions yet.</li>}
          {logs.map((log) => (
            <li key={log.id}>
              <span className="text-cream/40">{formatWhen(log.createdAt, community.timezone)}</span>
              <br />
              {nameOf(log.actorId)} · {log.action}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
