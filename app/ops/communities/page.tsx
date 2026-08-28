import Link from "next/link";
import { getOpsCommunities } from "@/lib/ops-metrics";
import { requirePlatformOwner } from "@/lib/platform";
import { formatWhen } from "@/lib/utils";

export default async function OpsCommunitiesPage() {
  await requirePlatformOwner();
  const clubs = getOpsCommunities();
  const totalMembers = clubs.reduce((sum, club) => sum + club.membersApproved, 0);

  return (
    <div>
      <h1 className="font-display text-3xl">Clubs</h1>
      <p className="mt-1 text-sm text-ink/50">
        {clubs.length} communities · {totalMembers.toLocaleString()} approved members in total
      </p>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="border-b border-line text-[11px] uppercase tracking-[0.16em] text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">Club</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Approved</th>
              <th className="px-4 py-3 font-medium">Pending</th>
              <th className="px-4 py-3 font-medium">Suspended</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {clubs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-ink/45">
                  No clubs yet.
                </td>
              </tr>
            )}
            {clubs.map((club) => (
              <tr key={club.id} className="border-b border-line/70 last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/app/c/${club.slug}`} className="font-medium text-ink hover:text-primary">
                    {club.name}
                  </Link>
                  <p className="text-xs text-ink/45">
                    {club.isPublic ? "Public" : "Private"} · {club.uid}
                    {club.location ? ` · ${club.location}` : ""}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p>{club.ownerName}</p>
                  <p className="text-xs text-ink/45">{club.ownerEmail}</p>
                </td>
                <td className="px-4 py-3 font-medium">{club.membersApproved}</td>
                <td className="px-4 py-3">{club.membersPending}</td>
                <td className="px-4 py-3">{club.membersSuspended}</td>
                <td className="px-4 py-3 text-ink/55">{formatWhen(club.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
