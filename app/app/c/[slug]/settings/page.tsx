import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getCommunityBySlug, isOwner, isStaff } from "@/lib/access";
import { CommunityUid } from "@/components/community-uid";
import { InviteShare } from "@/components/invite-share";
import { PhotoPicker } from "@/components/photo-picker";
import { SettingsEditor } from "@/components/settings-editor";
import { Avatar } from "@/components/avatar";
import { updateCommunityPhoto } from "@/lib/actions/community";
import { Card } from "@/components/ui";
import { db } from "@/lib/db";
import { auditLogs, users } from "@/lib/db/schema";
import { getAppOrigin } from "@/lib/origin";
import { formatWhen } from "@/lib/utils";

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const community = getCommunityBySlug(slug);
  if (!community) notFound();
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) notFound();
  const owner = isOwner(community.id, userId);
  const staff = isStaff(community.id, userId);
  const origin = await getAppOrigin();
  const inviteUrl = `${origin}/join/${community.inviteToken}`;
  const logs = owner
    ? db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.communityId, community.id))
        .orderBy(desc(auditLogs.createdAt))
        .all()
        .slice(0, 40)
    : [];
  const people = owner ? db.select().from(users).all() : [];
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? id;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-6">
        <Card>
          <div className="flex items-start gap-4">
            {staff ? (
              <PhotoPicker
                name={community.name}
                imageUrl={community.imageUrl}
                label="Change club picture"
                action={updateCommunityPhoto}
                extraFields={<input type="hidden" name="slug" value={slug} />}
              />
            ) : (
              <>
                <Avatar src={community.imageUrl} name={community.name} size="lg" />
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.2em] text-secondary">Community</p>
                  <h2 className="font-display text-2xl">{community.name}</h2>
                  <p className="mt-1 text-sm text-ink/55">{community.location || "Pitch TBD"}</p>
                </div>
              </>
            )}
          </div>
          {staff && (
            <div className="mt-3 min-w-0">
              <p className="text-xs uppercase tracking-[0.2em] text-secondary">Community</p>
              <h2 className="font-display text-2xl">{community.name}</h2>
              <p className="mt-1 text-sm text-ink/55">{community.location || "Pitch TBD"}</p>
            </div>
          )}
          {community.description && <p className="mt-4 text-sm text-ink/70">{community.description}</p>}
          <dl className="mt-4 grid gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink/45">Timezone</dt>
              <dd>{community.timezone}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink/45">Currency</dt>
              <dd>{community.currency}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink/45">Directory</dt>
              <dd>{community.isPublic ? "Public" : "Private"}</dd>
            </div>
          </dl>
          <div className="mt-4">
            <CommunityUid uid={community.uid} />
          </div>
          {owner && (
            <div className="mt-5">
              <SettingsEditor
                slug={slug}
                name={community.name}
                description={community.description ?? ""}
                location={community.location ?? ""}
                timezone={community.timezone}
                currency={community.currency}
                imageUrl={community.imageUrl}
                isPublic={community.isPublic}
              />
            </div>
          )}
        </Card>
        {staff && (
          <Card>
            <h2 className="font-display text-lg">Invite link</h2>
            <div className="mt-4">
              <InviteShare url={inviteUrl} canRegenerate={owner} slug={slug} />
            </div>
          </Card>
        )}
      </div>
      {owner && (
        <Card>
          <h2 className="font-display text-lg">Admin log</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {logs.length === 0 && <li className="text-ink/50">No actions yet.</li>}
            {logs.map((log) => (
              <li key={log.id}>
                <span className="text-ink/40">{formatWhen(log.createdAt, community.timezone)}</span>
                <br />
                {nameOf(log.actorId)} · {log.action}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
