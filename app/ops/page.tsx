import { APP_NAME } from "@/lib/brand";
import { getOpsOverview } from "@/lib/ops-metrics";
import { requirePlatformOwner } from "@/lib/platform";
import { Card } from "@/components/ui";

function n(value: number) {
  return value.toLocaleString();
}

export default async function OpsOverviewPage() {
  await requirePlatformOwner();
  const m = getOpsOverview();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Overview</h1>
        <p className="mt-1 text-sm text-ink/50">Live counts across {APP_NAME}.</p>
      </div>

      <section>
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-secondary">People & clubs</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Accounts" value={n(m.usersTotal)} hint={`${n(m.usersWeek)} this week · ${n(m.usersMonth)} this month`} />
          <Stat label="Telegram linked" value={n(m.telegramLinked)} hint="Bot chat started" />
          <Stat label="Clubs" value={n(m.clubsTotal)} hint={`${n(m.clubsPublic)} public · ${n(m.clubsPrivate)} private`} />
          <Stat label="New clubs (7d)" value={n(m.clubsWeek)} />
        </div>
      </section>

      <section>
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-secondary">Memberships</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Approved seats" value={n(m.membersApproved)} hint="Across all clubs" />
          <Stat label="Unique members" value={n(m.uniqueMembers)} hint="People in at least one club" />
          <Stat label="Join requests" value={n(m.membersPending)} />
          <Stat label="Suspended" value={n(m.membersSuspended)} />
        </div>
      </section>

      <section>
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-secondary">Play</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Weekly events" value={n(m.eventsTotal)} hint={`${n(m.eventsOpen)} open`} />
          <Stat label="Going RSVPs" value={n(m.rsvpGoing)} />
          <Stat label="Guests listed" value={n(m.guests)} />
          <Stat label="Polls" value={n(m.pollsTotal)} hint="Club + event polls" />
        </div>
      </section>

      <section>
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-secondary">Seasons & ledger</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Seasons" value={n(m.seasonsTotal)} />
          <Stat label="Sessions" value={n(m.sessionsTotal)} />
          <Stat label="Contracts" value={n(m.contractsTotal)} />
          <Stat label="Ledger entries" value={n(m.ledgerPending + m.ledgerSettled)} hint={`${n(m.ledgerPending)} pending · ${n(m.ledgerSettled)} settled`} />
        </div>
      </section>

      <section>
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-secondary">Engagement & ops</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Chat messages" value={n(m.chatTotal)} hint={`${n(m.chatWeek)} this week`} />
          <Stat label="Notifications" value={n(m.notificationsTotal)} />
          <Stat label="Action log" value={n(m.auditTotal)} />
          <Stat label="Tickets" value={n(m.ticketsTotal)} hint={`${n(m.ticketsOpen)} open · ${n(m.ticketsPending)} waiting`} />
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-secondary">{label}</p>
      <p className="mt-2 font-display text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink/45">{hint}</p>}
    </Card>
  );
}
