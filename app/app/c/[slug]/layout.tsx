import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getApprovedMembership, getCommunityBySlug } from "@/lib/access";
import { cn } from "@/lib/utils";

const links = [
  { href: "", label: "Overview" },
  { href: "/events", label: "Weekly" },
  { href: "/seasons", label: "Seasons" },
  { href: "/members", label: "People" },
  { href: "/ledger", label: "Ledger" },
  { href: "/settings", label: "Settings" },
];

export default async function CommunityLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const community = getCommunityBySlug(slug);
  if (!community) notFound();
  const membership = getApprovedMembership(community.id, session.user.id);
  if (!membership) redirect(`/communities/${slug}`);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.25em] text-lime/70">{membership.role}</p>
        <h1 className="font-display text-4xl">{community.name}</h1>
      </div>
      <nav className="mb-8 flex flex-wrap gap-2 border-b border-line pb-4">
        {links.map((l) => (
          <Link
            key={l.href}
            href={`/app/c/${slug}${l.href}`}
            className={cn("rounded-full px-3 py-1 text-sm text-cream/70 hover:bg-pitch-3 hover:text-cream")}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
