import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { APP_DB_FILE, LEGACY_DB_FILE } from "../brand";
import { createCommunityUid, createInviteToken } from "../id";
import * as schema from "./schema";

const dataDir = path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, APP_DB_FILE);
const legacyPath = path.join(dataDir, LEGACY_DB_FILE);
function dbFileHasData(file: string) {
  return fs.existsSync(file) && fs.statSync(file).size > 0;
}
if (!dbFileHasData(dbPath) && dbFileHasData(legacyPath)) {
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  try {
    fs.renameSync(legacyPath, dbPath);
    for (const suffix of ["-wal", "-shm"] as const) {
      if (fs.existsSync(legacyPath + suffix)) {
        fs.renameSync(legacyPath + suffix, dbPath + suffix);
      }
    }
  } catch {
    const source = new Database(legacyPath);
    source.pragma("wal_checkpoint(PASSIVE)");
    source.close();
    fs.copyFileSync(legacyPath, dbPath);
  }
}

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

sqlite.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  telegram_username TEXT NOT NULL,
  telegram_chat_id TEXT,
  telegram_link_token TEXT,
  whatsapp_phone TEXT,
  image_url TEXT,
  password_reset_token TEXT,
  password_reset_expires INTEGER,
  platform_role TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS communities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  location TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Toronto',
  currency TEXT NOT NULL DEFAULT 'CAD',
  uid TEXT,
  image_url TEXT,
  invite_token TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  created_by_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS communities_created_by_idx ON communities(created_by_id);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'pending',
  ledger_accepted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS memberships_community_user_uidx ON memberships(community_id, user_id);
CREATE INDEX IF NOT EXISTS memberships_user_idx ON memberships(user_id);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  community_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  href TEXT,
  read_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications(user_id, created_at);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications(user_id, read_at);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL REFERENCES notifications(id),
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider_message_id TEXT,
  last_error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_retry_at INTEGER,
  created_at INTEGER NOT NULL,
  sent_at INTEGER
);
CREATE INDEX IF NOT EXISTS deliveries_notification_idx ON notification_deliveries(notification_id);
CREATE INDEX IF NOT EXISTS deliveries_retry_idx ON notification_deliveries(status, next_retry_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities(id),
  actor_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  meta TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_community_created_idx ON audit_logs(community_id, created_at);

CREATE TABLE IF NOT EXISTS weekly_events (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities(id),
  title TEXT NOT NULL,
  location TEXT,
  starts_at INTEGER,
  duration_minutes INTEGER,
  has_time INTEGER NOT NULL DEFAULT 1,
  min_players INTEGER NOT NULL DEFAULT 10,
  rsvp_deadline_at INTEGER,
  status TEXT NOT NULL DEFAULT 'open',
  total_cost_cents INTEGER,
  payment_mode TEXT NOT NULL DEFAULT 'postpay',
  payment_info TEXT,
  collector_user_id TEXT,
  created_by_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS weekly_events_community_idx ON weekly_events(community_id, starts_at);

CREATE TABLE IF NOT EXISTS polls (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE REFERENCES weekly_events(id),
  question TEXT NOT NULL,
  closes_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS poll_options (
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL REFERENCES polls(id),
  label TEXT NOT NULL,
  starts_at INTEGER
);
CREATE INDEX IF NOT EXISTS poll_options_poll_idx ON poll_options(poll_id);

CREATE TABLE IF NOT EXISTS votes (
  id TEXT PRIMARY KEY,
  option_id TEXT NOT NULL REFERENCES poll_options(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS votes_option_user_uidx ON votes(option_id, user_id);

CREATE TABLE IF NOT EXISTS rsvps (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES weekly_events(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS rsvps_event_user_uidx ON rsvps(event_id, user_id);

CREATE TABLE IF NOT EXISTS seasons (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities(id),
  name TEXT NOT NULL,
  location TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  weekdays TEXT NOT NULL,
  time_local TEXT NOT NULL,
  duration_minutes INTEGER,
  regular_price_cents INTEGER NOT NULL DEFAULT 0,
  occasional_price_cents INTEGER,
  min_players INTEGER NOT NULL DEFAULT 10,
  signup_closes_at INTEGER,
  status TEXT NOT NULL DEFAULT 'signup',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS seasons_community_idx ON seasons(community_id);

CREATE TABLE IF NOT EXISTS season_signups (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES seasons(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  intent TEXT NOT NULL DEFAULT 'agree',
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS season_signups_season_user_uidx ON season_signups(season_id, user_id);

CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES seasons(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  prepaid INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS contracts_season_user_uidx ON contracts(season_id, user_id);

CREATE TABLE IF NOT EXISTS season_sessions (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES seasons(id),
  community_id TEXT NOT NULL REFERENCES communities(id),
  starts_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS season_sessions_season_idx ON season_sessions(season_id, starts_at);
CREATE INDEX IF NOT EXISTS season_sessions_community_idx ON season_sessions(community_id, starts_at);

CREATE TABLE IF NOT EXISTS session_slots (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES season_sessions(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  invited_by_id TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS session_slots_session_user_uidx ON session_slots(session_id, user_id);
CREATE INDEX IF NOT EXISTS session_slots_session_idx ON session_slots(session_id);

CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES season_sessions(id),
  from_user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  to_user_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS invitations_session_idx ON invitations(session_id, status);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities(id),
  from_user_id TEXT NOT NULL REFERENCES users(id),
  to_user_id TEXT NOT NULL REFERENCES users(id),
  amount_cents INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  weekly_event_id TEXT REFERENCES weekly_events(id),
  session_id TEXT REFERENCES season_sessions(id),
  external_payment_id TEXT,
  settled_at INTEGER,
  settled_by_id TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ledger_community_idx ON ledger_entries(community_id, status);
CREATE INDEX IF NOT EXISTS ledger_from_idx ON ledger_entries(from_user_id);
CREATE INDEX IF NOT EXISTS ledger_to_idx ON ledger_entries(to_user_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  reply_to_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_community_created_idx ON chat_messages(community_id, created_at);

CREATE TABLE IF NOT EXISTS chat_reactions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES chat_messages(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  emoji TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS chat_reactions_message_user_emoji_uidx ON chat_reactions(message_id, user_id, emoji);

CREATE TABLE IF NOT EXISTS chat_reads (
  community_id TEXT NOT NULL REFERENCES communities(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  last_read_at INTEGER NOT NULL,
  PRIMARY KEY (community_id, user_id)
);

CREATE TABLE IF NOT EXISTS club_polls (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities(id),
  question TEXT NOT NULL,
  created_by_id TEXT NOT NULL REFERENCES users(id),
  closes_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS club_polls_community_idx ON club_polls(community_id, created_at);

CREATE TABLE IF NOT EXISTS club_poll_options (
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL REFERENCES club_polls(id),
  label TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS club_poll_options_poll_idx ON club_poll_options(poll_id);

CREATE TABLE IF NOT EXISTS club_poll_votes (
  id TEXT PRIMARY KEY,
  option_id TEXT NOT NULL REFERENCES club_poll_options(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS club_poll_votes_option_user_uidx ON club_poll_votes(option_id, user_id);

CREATE TABLE IF NOT EXISTS vote_logs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  poll_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  actor_id TEXT NOT NULL REFERENCES users(id),
  option_id TEXT,
  previous_option_id TEXT,
  action TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS vote_logs_poll_idx ON vote_logs(kind, poll_id, created_at);

CREATE TABLE IF NOT EXISTS poll_suggestions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  poll_id TEXT NOT NULL,
  label TEXT NOT NULL,
  suggested_by_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS poll_suggestions_poll_idx ON poll_suggestions(kind, poll_id);

CREATE TABLE IF NOT EXISTS event_guests (
  id TEXT PRIMARY KEY,
  weekly_event_id TEXT REFERENCES weekly_events(id),
  session_id TEXT REFERENCES season_sessions(id),
  host_user_id TEXT NOT NULL REFERENCES users(id),
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS event_guests_weekly_idx ON event_guests(weekly_event_id);
CREATE INDEX IF NOT EXISTS event_guests_session_idx ON event_guests(session_id);
`);

function hasColumn(table: string, column: string) {
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

if (!hasColumn("users", "image_url")) {
  sqlite.exec("ALTER TABLE users ADD COLUMN image_url TEXT");
}
if (!hasColumn("users", "password_reset_token")) {
  sqlite.exec("ALTER TABLE users ADD COLUMN password_reset_token TEXT");
}
if (!hasColumn("users", "password_reset_expires")) {
  sqlite.exec("ALTER TABLE users ADD COLUMN password_reset_expires INTEGER");
}
if (!hasColumn("communities", "image_url")) {
  sqlite.exec("ALTER TABLE communities ADD COLUMN image_url TEXT");
}
if (!hasColumn("communities", "uid")) {
  sqlite.exec("ALTER TABLE communities ADD COLUMN uid TEXT");
}

const missingUid = sqlite.prepare("SELECT id FROM communities WHERE uid IS NULL OR uid = ''").all() as { id: string }[];
const used = new Set(
  (sqlite.prepare("SELECT uid FROM communities WHERE uid IS NOT NULL AND uid != ''").all() as { uid: string }[]).map(
    (r) => r.uid,
  ),
);
const setUid = sqlite.prepare("UPDATE communities SET uid = ? WHERE id = ?");
for (const row of missingUid) {
  let uid = createCommunityUid();
  while (used.has(uid)) uid = createCommunityUid();
  used.add(uid);
  setUid.run(uid, row.id);
}
sqlite.exec("CREATE UNIQUE INDEX IF NOT EXISTS communities_uid_uidx ON communities(uid)");
if (!hasColumn("communities", "invite_token")) {
  sqlite.exec("ALTER TABLE communities ADD COLUMN invite_token TEXT");
}
if (!hasColumn("chat_messages", "reply_to_id")) {
  sqlite.exec("ALTER TABLE chat_messages ADD COLUMN reply_to_id TEXT");
}

const missingInvite = sqlite.prepare("SELECT id FROM communities WHERE invite_token IS NULL OR invite_token = ''").all() as {
  id: string;
}[];
const usedInvites = new Set(
  (sqlite.prepare("SELECT invite_token FROM communities WHERE invite_token IS NOT NULL AND invite_token != ''").all() as {
    invite_token: string;
  }[]).map((r) => r.invite_token),
);
const setInvite = sqlite.prepare("UPDATE communities SET invite_token = ? WHERE id = ?");
for (const row of missingInvite) {
  let token = createInviteToken();
  while (usedInvites.has(token)) token = createInviteToken();
  usedInvites.add(token);
  setInvite.run(token, row.id);
}
sqlite.exec("CREATE UNIQUE INDEX IF NOT EXISTS communities_invite_token_uidx ON communities(invite_token)");

if (!hasColumn("weekly_events", "payment_mode")) {
  sqlite.exec("ALTER TABLE weekly_events ADD COLUMN payment_mode TEXT NOT NULL DEFAULT 'postpay'");
}
if (!hasColumn("weekly_events", "payment_info")) {
  sqlite.exec("ALTER TABLE weekly_events ADD COLUMN payment_info TEXT");
}
if (!hasColumn("weekly_events", "collector_user_id")) {
  sqlite.exec("ALTER TABLE weekly_events ADD COLUMN collector_user_id TEXT");
}
if (!hasColumn("weekly_events", "duration_minutes")) {
  sqlite.exec("ALTER TABLE weekly_events ADD COLUMN duration_minutes INTEGER");
}
if (!hasColumn("weekly_events", "has_time")) {
  sqlite.exec("ALTER TABLE weekly_events ADD COLUMN has_time INTEGER NOT NULL DEFAULT 1");
}
if (!hasColumn("seasons", "occasional_price_cents")) {
  sqlite.exec("ALTER TABLE seasons ADD COLUMN occasional_price_cents INTEGER");
}
if (!hasColumn("seasons", "duration_minutes")) {
  sqlite.exec("ALTER TABLE seasons ADD COLUMN duration_minutes INTEGER");
  sqlite.exec("UPDATE seasons SET duration_minutes = 90 WHERE duration_minutes IS NULL");
}
if (!hasColumn("seasons", "signup_closes_at")) {
  sqlite.exec("ALTER TABLE seasons ADD COLUMN signup_closes_at INTEGER");
}
if (!hasColumn("seasons", "status")) {
  sqlite.exec("ALTER TABLE seasons ADD COLUMN status TEXT NOT NULL DEFAULT 'locked'");
}
if (!hasColumn("communities", "is_public")) {
  sqlite.exec("ALTER TABLE communities ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0");
}
if (!hasColumn("memberships", "ledger_accepted_at")) {
  sqlite.exec("ALTER TABLE memberships ADD COLUMN ledger_accepted_at INTEGER");
}
if (!hasColumn("users", "platform_role")) {
  sqlite.exec("ALTER TABLE users ADD COLUMN platform_role TEXT");
}
if (!hasColumn("event_guests", "status")) {
  sqlite.exec("ALTER TABLE event_guests ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'");
  sqlite.exec("UPDATE event_guests SET status = 'approved'");
}
if (!hasColumn("season_signups", "intent")) {
  sqlite.exec("ALTER TABLE season_signups ADD COLUMN intent TEXT NOT NULL DEFAULT 'agree'");
}
sqlite.exec(`
  UPDATE seasons SET status = 'locked'
  WHERE status = 'signup'
    AND EXISTS (SELECT 1 FROM season_sessions WHERE season_sessions.season_id = seasons.id)
`);

sqlite.exec(`
CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'support',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON support_tickets(status, updated_at);
CREATE INDEX IF NOT EXISTS support_tickets_user_idx ON support_tickets(user_id, created_at);

CREATE TABLE IF NOT EXISTS support_messages (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES support_tickets(id),
  author_id TEXT REFERENCES users(id),
  author_kind TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS support_messages_ticket_idx ON support_messages(ticket_id, created_at);
`);

sqlite.exec(`
UPDATE memberships SET role = 'owner'
WHERE role != 'owner'
  AND user_id = (SELECT created_by_id FROM communities WHERE communities.id = memberships.community_id)
`);

export const db = drizzle(sqlite, { schema });
export { sqlite };
