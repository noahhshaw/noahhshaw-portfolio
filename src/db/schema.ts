import {
  pgTable,
  serial,
  text,
  integer,
  bigint,
  boolean,
  smallint,
  timestamp,
  date,
  unique,
  check,
  index,
  char,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ============================================================
// NAMES — the canonical name database (~30K-50K rows)
// ============================================================
export const names = pgTable(
  "names",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    nameLower: text("name_lower").notNull().unique(),
    origin: text("origin"),
    meaning: text("meaning"),
    usRank: integer("us_rank").notNull().default(0),
    worldRank: integer("world_rank").notNull().default(0),
    famousPerson1: text("famous_person_1"),
    famousPerson2: text("famous_person_2"),
    famousPerson3: text("famous_person_3"),
    alternativeSpellings: text("alternative_spellings")
      .array()
      .default(sql`'{}'::text[]`),
    isBoy: boolean("is_boy").notNull().default(false),
    isGirl: boolean("is_girl").notNull().default(false),
    phonetic: text("phonetic"),
    startingLetter: char("starting_letter", { length: 1 }).notNull(),
    syllableCount: smallint("syllable_count"),
    meaningTags: text("meaning_tags")
      .array()
      .default(sql`'{}'::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_names_starting_letter").on(table.startingLetter),
    index("idx_names_origin").on(table.origin),
    index("idx_names_is_boy").on(table.isBoy),
    index("idx_names_is_girl").on(table.isGirl),
    index("idx_names_us_rank").on(table.usRank),
  ]
);

// ============================================================
// USERS — email-only identification, no auth
// ============================================================
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ============================================================
// COUPLES — links two users
// ============================================================
export const couples = pgTable(
  "couples",
  {
    id: serial("id").primaryKey(),
    user1Id: integer("user_1_id")
      .notNull()
      .references(() => users.id),
    user2Id: integer("user_2_id").references(() => users.id),
    genderFilter: text("gender_filter").notNull().default("all"),
    firstLetterFilter: text("first_letter_filter").notNull().default("all"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_couples_user_1").on(table.user1Id),
    index("idx_couples_user_2").on(table.user2Id),
    check("couples_different_users", sql`${table.user1Id} <> ${table.user2Id}`),
  ]
);

// ============================================================
// RATINGS — one row per (user, name), UPSERT on re-rating
// ============================================================
export const ratings = pgTable(
  "ratings",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    nameId: integer("name_id")
      .notNull()
      .references(() => names.id),
    coupleId: integer("couple_id")
      .notNull()
      .references(() => couples.id),
    rating: smallint("rating").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("ratings_user_name_unique").on(table.userId, table.nameId),
    index("idx_ratings_user_id").on(table.userId),
    index("idx_ratings_couple_id").on(table.coupleId),
    index("idx_ratings_user_updated").on(table.userId, table.updatedAt),
    index("idx_ratings_couple_name").on(
      table.coupleId,
      table.nameId,
      table.rating
    ),
    check("ratings_range", sql`${table.rating} >= 1 AND ${table.rating} <= 5`),
  ]
);

// ============================================================
// SHORT LIST — denormalized table for fast reads
// Managed by application logic on every rating write
// ============================================================
export const shortList = pgTable(
  "short_list",
  {
    id: serial("id").primaryKey(),
    coupleId: integer("couple_id")
      .notNull()
      .references(() => couples.id),
    nameId: integer("name_id")
      .notNull()
      .references(() => names.id),
    user1Rating: smallint("user_1_rating").notNull(),
    user2Rating: smallint("user_2_rating").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("short_list_couple_name_unique").on(table.coupleId, table.nameId),
    index("idx_short_list_couple").on(table.coupleId, table.addedAt),
  ]
);

// ============================================================
// Type exports for use across the app
// ============================================================
export type Name = typeof names.$inferSelect;
export type NewName = typeof names.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Couple = typeof couples.$inferSelect;
export type NewCouple = typeof couples.$inferInsert;
export type Rating = typeof ratings.$inferSelect;
export type NewRating = typeof ratings.$inferInsert;
export type ShortListRow = typeof shortList.$inferSelect;

// ============================================================
// BABY AGENT TABLES
// Daily email + interactive AI agent for the first child.
// Reuses `users` for parent identity (email-keyed).
// ============================================================

// Singleton row (id=1). All baby state lives here for simplicity.
export const babyProfile = pgTable("baby_profile", {
  id: serial("id").primaryKey(),
  dueDate: date("due_date").notNull(),
  birthDate: date("birth_date"),
  babyName: text("baby_name"),
  pediatricianName: text("pediatrician_name"),
  pediatricianPhone: text("pediatrician_phone"),
  // free-form jsonb for evolving fields without migrations
  meta: jsonb("meta").notNull().default(sql`'{}'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const dailyEmails = pgTable(
  "daily_emails",
  {
    id: serial("id").primaryKey(),
    sentDate: date("sent_date").notNull().unique(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    ageInDays: integer("age_in_days").notNull(),
    subject: text("subject").notNull(),
    bodyHtml: text("body_html").notNull(),
    bodyText: text("body_text").notNull(),
    recipients: text("recipients").array().notNull(),
    resendMessageId: text("resend_message_id"),
    sourcePath: text("source_path").notNull(), // 'routine' | 'cron-fallback'
    status: text("status").notNull().default("sent"), // 'sent' | 'failed' | 'queued'
    error: text("error"),
    tokensUsed: integer("tokens_used"),
    costUsd: text("cost_usd"), // string for decimal precision
  },
  (table) => [
    index("idx_daily_emails_sent_at").on(table.sentAt),
    index("idx_daily_emails_status").on(table.status),
  ]
);

export const emailReplies = pgTable(
  "email_replies",
  {
    id: serial("id").primaryKey(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    fromEmail: text("from_email").notNull(),
    toEmails: text("to_emails").array().notNull(),
    ccEmails: text("cc_emails").array().notNull().default(sql`'{}'::text[]`),
    subject: text("subject"),
    bodyText: text("body_text"),
    bodyHtml: text("body_html"),
    inReplyTo: text("in_reply_to"),
    messageId: text("message_id").unique(),
    dailyEmailId: integer("daily_email_id").references(() => dailyEmails.id),
    rawHeaders: jsonb("raw_headers"),
    classification: text("classification"), // 'question' | 'context' | 'feedback' | 'photo-only' | 'none'
    actionTaken: text("action_taken"), // 'replied' | 'stored-context' | 'queued-kb-update' | 'silent'
    agentResponseMessageId: text("agent_response_message_id"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    processingError: text("processing_error"),
  },
  (table) => [
    index("idx_email_replies_received_at").on(table.receivedAt),
    index("idx_email_replies_classification").on(table.classification),
    index("idx_email_replies_daily_email").on(table.dailyEmailId),
  ]
);

export const photos = pgTable(
  "photos",
  {
    id: serial("id").primaryKey(),
    r2Key: text("r2_key").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    takenAt: timestamp("taken_at", { withTimezone: true }),
    uploadedByEmail: text("uploaded_by_email").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    caption: text("caption"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    sourceReplyId: integer("source_reply_id").references(() => emailReplies.id),
  },
  (table) => [
    index("idx_photos_uploaded_at").on(table.uploadedAt),
    index("idx_photos_taken_at").on(table.takenAt),
  ]
);

// Catch-all for things the agent should remember about the family / baby.
// Examples: "Eli rolled over today", "Mother's Day is May 10", "we prefer no
// notifications on weekends". Surfaced to the daily render and reply agent.
export const parentContext = pgTable(
  "parent_context",
  {
    id: serial("id").primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    source: text("source").notNull(), // 'reply' | 'config' | 'agent'
    sourceReplyId: integer("source_reply_id").references(() => emailReplies.id),
    contentType: text("content_type").notNull(), // 'milestone' | 'note' | 'concern' | 'preference' | 'photo-tag'
    content: text("content").notNull(),
    relatedPhotoId: integer("related_photo_id").references(() => photos.id),
    // tags help the renderer pick what's relevant on a given day
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_parent_context_created_at").on(table.createdAt),
    index("idx_parent_context_content_type").on(table.contentType),
  ]
);

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: serial("id").primaryKey(),
    eventDate: date("event_date").notNull(),
    eventType: text("event_type").notNull(), // 'vaccine' | 'well-visit' | 'milestone' | 'family-date' | 'school-deadline' | 'custom'
    title: text("title").notNull(),
    description: text("description"),
    recurrence: text("recurrence").notNull().default("none"), // 'none' | 'yearly'
    source: text("source").notNull(), // 'aap' | 'parent' | 'agent'
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_calendar_events_date").on(table.eventDate),
    index("idx_calendar_events_type").on(table.eventType),
  ]
);

export const kbUpdateQueue = pgTable(
  "kb_update_queue",
  {
    id: serial("id").primaryKey(),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    requesterEmail: text("requester_email").notNull(),
    sourceReplyId: integer("source_reply_id").references(() => emailReplies.id),
    requestText: text("request_text").notNull(),
    targetTopic: text("target_topic"),
    status: text("status").notNull().default("queued"), // 'queued' | 'in-progress' | 'pr-opened' | 'merged' | 'rejected'
    prUrl: text("pr_url"),
    notes: text("notes"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_kb_update_queue_status").on(table.status),
  ]
);

// Magic-link auth for the /baby config page.
export const magicLinkTokens = pgTable(
  "magic_link_tokens",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_magic_link_email").on(table.email),
    index("idx_magic_link_expires").on(table.expiresAt),
  ]
);

// Pre-computed daily emails. Generated by scripts/precompute-emails.ts.
// One row per ageInDays. The body templates carry a `{{UPCOMING_HTML}}` /
// `{{UPCOMING_TEXT}}` placeholder that the daily cron substitutes with the
// current calendar at send time.
export const precomputedEmails = pgTable(
  "precomputed_emails",
  {
    id: serial("id").primaryKey(),
    ageInDays: integer("age_in_days").notNull().unique(),
    weekIndex: integer("week_index").notNull(),
    subject: text("subject").notNull(),
    bodyHtml: text("body_html").notNull(),
    bodyText: text("body_text").notNull(),
    citations: text("citations").array().notNull().default(sql`'{}'::text[]`),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    kbVersion: text("kb_version"), // git SHA at time of generation
    modelUsed: text("model_used"),
    tokensUsed: integer("tokens_used"),
    costUsd: text("cost_usd"),
    status: text("status").notNull().default("draft"), // 'draft' | 'approved' | 'sent' | 'rejected' | 'stale'
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByEmail: text("reviewed_by_email"),
    validationIssues: jsonb("validation_issues")
      .notNull()
      .default(sql`'[]'::jsonb`),
    rejectionReason: text("rejection_reason"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_precomputed_status").on(table.status),
    index("idx_precomputed_age").on(table.ageInDays),
  ]
);

// Key/value config the renderer & reply agent both read.
// Examples of keys: 'voice_overrides', 'topics_enabled', 'send_time_local',
// 'paused_until', 'enrichment_intensity'.
export const agentSettings = pgTable("agent_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedByEmail: text("updated_by_email"),
});

export type BabyProfile = typeof babyProfile.$inferSelect;
export type NewBabyProfile = typeof babyProfile.$inferInsert;
export type DailyEmail = typeof dailyEmails.$inferSelect;
export type NewDailyEmail = typeof dailyEmails.$inferInsert;
export type EmailReply = typeof emailReplies.$inferSelect;
export type NewEmailReply = typeof emailReplies.$inferInsert;
export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;
export type ParentContext = typeof parentContext.$inferSelect;
export type NewParentContext = typeof parentContext.$inferInsert;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type NewCalendarEvent = typeof calendarEvents.$inferInsert;
export type KbUpdateRequest = typeof kbUpdateQueue.$inferSelect;
export type NewKbUpdateRequest = typeof kbUpdateQueue.$inferInsert;
export type MagicLinkToken = typeof magicLinkTokens.$inferSelect;
export type AgentSetting = typeof agentSettings.$inferSelect;
export type PrecomputedEmail = typeof precomputedEmails.$inferSelect;
export type NewPrecomputedEmail = typeof precomputedEmails.$inferInsert;
