import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listMemberClubs } from "@/lib/access";
import { CLUB_COOKIE, LEGACY_CLUB_COOKIE } from "@/lib/brand";
import { InboxList } from "@/components/inbox-list";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const clubs = listMemberClubs(session.user.id);
  const jar = await cookies();
  const hintedRaw = jar.get(CLUB_COOKIE)?.value ?? jar.get(LEGACY_CLUB_COOKIE)?.value;
  const hinted = hintedRaw ? decodeURIComponent(hintedRaw) : undefined;
  const target = clubs.find((c) => c.slug === hinted)?.slug ?? clubs[0]?.slug;
  if (target) redirect(`/app/c/${target}/notifications`);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <InboxList />
    </main>
  );
}
