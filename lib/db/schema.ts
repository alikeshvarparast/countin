import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  telegramUsername: text("telegram_username").notNull(),
  telegramChatId: text("telegram_chat_id"),
  telegramLinkToken: text("telegram_link_token"),
  whatsappPhone: text("whatsapp_phone"),
    imageUrl: text("image_url"),
    passwordResetToken: text("password_reset_token"),
    passwordResetExpires: integer("password_reset_expires"),
    platformRole: text("platform_role"),
    createdAt: integer("created_at").notNull(),
});

export const communities = sqliteTable(
  "communities",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    location: text("location"),
    timezone: text("timezone").notNull().default("America/Toronto"),
    currency: text("currency").notNull().default("CAD"),
    uid: text("uid").notNull().unique(),
    imageUrl: text("image_url"),
    inviteToken: text("invite_token").notNull().unique(),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("communities_created_by_idx").on(t.createdById)],
);

export const memberships = sqliteTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").notNull().default("member"),
    status: text("status").notNull().default("pending"),
    ledgerAcceptedAt: integer("ledger_accepted_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("memberships_community_user_uidx").on(t.communityId, t.userId),
    index("memberships_user_idx").on(t.userId),
  ],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    communityId: text("community_id").references(() => communities.id),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    href: text("href"),
    readAt: integer("read_at"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("notifications_user_created_idx").on(t.userId, t.createdAt),
    index("notifications_user_unread_idx").on(t.userId, t.readAt),
  ],
);

export const notificationDeliveries = sqliteTable(
  "notification_deliveries",
  {
    id: text("id").primaryKey(),
    notificationId: text("notification_id")
      .notNull()
      .references(() => notifications.id),
    channel: text("channel").notNull(),
    status: text("status").notNull().default("pending"),
    providerMessageId: text("provider_message_id"),
    lastError: text("last_error"),
    attempts: integer("attempts").notNull().default(0),
    nextRetryAt: integer("next_retry_at"),
    createdAt: integer("created_at").notNull(),
    sentAt: integer("sent_at"),
  },
  (t) => [
    index("deliveries_notification_idx").on(t.notificationId),
    index("deliveries_retry_idx").on(t.status, t.nextRetryAt),
  ],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id),
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    meta: text("meta"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("audit_community_created_idx").on(t.communityId, t.createdAt)],
);

export const weeklyEvents = sqliteTable(
  "weekly_events",
  {
    id: text("id").primaryKey(),
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id),
    title: text("title").notNull(),
    location: text("location"),
    startsAt: integer("starts_at"),
    durationMinutes: integer("duration_minutes"),
    hasTime: integer("has_time", { mode: "boolean" }).notNull().default(true),
    minPlayers: integer("min_players").notNull().default(10),
    rsvpDeadlineAt: integer("rsvp_deadline_at"),
    status: text("status").notNull().default("open"),
    totalCostCents: integer("total_cost_cents"),
    paymentMode: text("payment_mode").notNull().default("postpay"),
    paymentInfo: text("payment_info"),
    collectorUserId: text("collector_user_id").references(() => users.id),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("weekly_events_community_idx").on(t.communityId, t.startsAt)],
);

export const polls = sqliteTable("polls", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => weeklyEvents.id)
    .unique(),
  question: text("question").notNull(),
  closesAt: integer("closes_at"),
  createdAt: integer("created_at").notNull(),
});

export const pollOptions = sqliteTable(
  "poll_options",
  {
    id: text("id").primaryKey(),
    pollId: text("poll_id")
      .notNull()
      .references(() => polls.id),
    label: text("label").notNull(),
    startsAt: integer("starts_at"),
  },
  (t) => [index("poll_options_poll_idx").on(t.pollId)],
);

export const votes = sqliteTable(
  "votes",
  {
    id: text("id").primaryKey(),
    optionId: text("option_id")
      .notNull()
      .references(() => pollOptions.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("votes_option_user_uidx").on(t.optionId, t.userId)],
);

export const rsvps = sqliteTable(
  "rsvps",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => weeklyEvents.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    status: text("status").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [uniqueIndex("rsvps_event_user_uidx").on(t.eventId, t.userId)],
);

export const seasons = sqliteTable(
  "seasons",
  {
    id: text("id").primaryKey(),
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id),
    name: text("name").notNull(),
    location: text("location"),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    weekdays: text("weekdays").notNull(),
    timeLocal: text("time_local").notNull(),
    durationMinutes: integer("duration_minutes"),
    regularPriceCents: integer("regular_price_cents").notNull().default(0),
    occasionalPriceCents: integer("occasional_price_cents"),
    minPlayers: integer("min_players").notNull().default(10),
    signupClosesAt: integer("signup_closes_at"),
    status: text("status").notNull().default("signup"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("seasons_community_idx").on(t.communityId)],
);

export const seasonSignups = sqliteTable(
  "season_signups",
  {
    id: text("id").primaryKey(),
    seasonId: text("season_id")
      .notNull()
      .references(() => seasons.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    intent: text("intent").notNull().default("agree"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("season_signups_season_user_uidx").on(t.seasonId, t.userId)],
);

export const contracts = sqliteTable(
  "contracts",
  {
    id: text("id").primaryKey(),
    seasonId: text("season_id")
      .notNull()
      .references(() => seasons.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    prepaid: integer("prepaid", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("contracts_season_user_uidx").on(t.seasonId, t.userId)],
);

export const seasonSessions = sqliteTable(
  "season_sessions",
  {
    id: text("id").primaryKey(),
    seasonId: text("season_id")
      .notNull()
      .references(() => seasons.id),
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id),
    startsAt: integer("starts_at").notNull(),
    status: text("status").notNull().default("scheduled"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("season_sessions_season_idx").on(t.seasonId, t.startsAt),
    index("season_sessions_community_idx").on(t.communityId, t.startsAt),
  ],
);

export const sessionSlots = sqliteTable(
  "session_slots",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => seasonSessions.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    invitedById: text("invited_by_id").references(() => users.id),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("session_slots_session_user_uidx").on(t.sessionId, t.userId),
    index("session_slots_session_idx").on(t.sessionId),
  ],
);

export const invitations = sqliteTable(
  "invitations",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => seasonSessions.id),
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => users.id),
    type: text("type").notNull(),
    toUserId: text("to_user_id").references(() => users.id),
    status: text("status").notNull().default("open"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("invitations_session_idx").on(t.sessionId, t.status)],
);

export const ledgerEntries = sqliteTable(
  "ledger_entries",
  {
    id: text("id").primaryKey(),
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id),
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => users.id),
    toUserId: text("to_user_id")
      .notNull()
      .references(() => users.id),
    amountCents: integer("amount_cents").notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("pending"),
    weeklyEventId: text("weekly_event_id").references(() => weeklyEvents.id),
    sessionId: text("session_id").references(() => seasonSessions.id),
    externalPaymentId: text("external_payment_id"),
    settledAt: integer("settled_at"),
    settledById: text("settled_by_id").references(() => users.id),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("ledger_community_idx").on(t.communityId, t.status),
    index("ledger_from_idx").on(t.fromUserId),
    index("ledger_to_idx").on(t.toUserId),
  ],
);

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: text("id").primaryKey(),
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    replyToId: text("reply_to_id"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("chat_community_created_idx").on(t.communityId, t.createdAt)],
);

export const chatReactions = sqliteTable(
  "chat_reactions",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id")
      .notNull()
      .references(() => chatMessages.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    emoji: text("emoji").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("chat_reactions_message_user_emoji_uidx").on(t.messageId, t.userId, t.emoji)],
);

export const chatReads = sqliteTable(
  "chat_reads",
  {
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    lastReadAt: integer("last_read_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.communityId, t.userId] })],
);

export const clubPolls = sqliteTable(
  "club_polls",
  {
    id: text("id").primaryKey(),
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id),
    question: text("question").notNull(),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id),
    closesAt: integer("closes_at"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("club_polls_community_idx").on(t.communityId, t.createdAt)],
);

export const clubPollOptions = sqliteTable(
  "club_poll_options",
  {
    id: text("id").primaryKey(),
    pollId: text("poll_id")
      .notNull()
      .references(() => clubPolls.id),
    label: text("label").notNull(),
  },
  (t) => [index("club_poll_options_poll_idx").on(t.pollId)],
);

export const clubPollVotes = sqliteTable(
  "club_poll_votes",
  {
    id: text("id").primaryKey(),
    optionId: text("option_id")
      .notNull()
      .references(() => clubPollOptions.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("club_poll_votes_option_user_uidx").on(t.optionId, t.userId)],
);

export const voteLogs = sqliteTable(
  "vote_logs",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    pollId: text("poll_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id),
    optionId: text("option_id"),
    previousOptionId: text("previous_option_id"),
    action: text("action").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("vote_logs_poll_idx").on(t.kind, t.pollId, t.createdAt)],
);

export const pollSuggestions = sqliteTable(
  "poll_suggestions",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    pollId: text("poll_id").notNull(),
    label: text("label").notNull(),
    suggestedById: text("suggested_by_id")
      .notNull()
      .references(() => users.id),
    status: text("status").notNull().default("pending"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("poll_suggestions_poll_idx").on(t.kind, t.pollId)],
);

export const supportTickets = sqliteTable(
  "support_tickets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id),
    name: text("name").notNull(),
    email: text("email").notNull(),
    category: text("category").notNull().default("support"),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull().default("open"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("support_tickets_status_idx").on(t.status, t.updatedAt),
    index("support_tickets_user_idx").on(t.userId, t.createdAt),
  ],
);

export const supportMessages = sqliteTable(
  "support_messages",
  {
    id: text("id").primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => supportTickets.id),
    authorId: text("author_id").references(() => users.id),
    authorKind: text("author_kind").notNull(),
    body: text("body").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("support_messages_ticket_idx").on(t.ticketId, t.createdAt)],
);

export const eventGuests = sqliteTable(
  "event_guests",
  {
    id: text("id").primaryKey(),
    weeklyEventId: text("weekly_event_id").references(() => weeklyEvents.id),
    sessionId: text("session_id").references(() => seasonSessions.id),
    hostUserId: text("host_user_id")
      .notNull()
      .references(() => users.id),
    label: text("label").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("event_guests_weekly_idx").on(t.weeklyEventId),
    index("event_guests_session_idx").on(t.sessionId),
  ],
);
