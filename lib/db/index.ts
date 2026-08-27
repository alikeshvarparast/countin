import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const dbPath = path.join(process.cwd(), "data", "pitchside.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

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
  min_players INTEGER NOT NULL DEFAULT 10,
  rsvp_deadline_at INTEGER,
  status TEXT NOT NULL DEFAULT 'open',
  total_cost_cents INTEGER,
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
  regular_price_cents INTEGER NOT NULL,
  min_players INTEGER NOT NULL DEFAULT 10,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS seasons_community_idx ON seasons(community_id);

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
`);

export const db = drizzle(sqlite, { schema });
export { sqlite };
