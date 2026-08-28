import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCommunityBySlug, isAdmin, isStaff } from "@/lib/access";
import { CreatePlayForm } from "@/components/create-play-form";
import { Card } from "@/components/ui";

export default async function NewEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const community = getCommunityBySlug(slug);
  if (!community) notFound();
  const session = await auth();
  if (!session?.user?.id || !isStaff(community.id, session.user.id)) {
    redirect(`/app/c/${slug}`);
  }
  const admin = isAdmin(community.id, session.user.id);
  return (
    <div className="max-w-lg">
      <h2 className="font-display text-2xl">New event</h2>
      <p className="mt-1 text-sm text-ink/55">First choose a single session or a repeating season.</p>
      <Card className="mt-6">
        <CreatePlayForm slug={slug} defaultLocation={community.location ?? ""} canCreateSeason={admin} />
      </Card>
    </div>
  );
}
