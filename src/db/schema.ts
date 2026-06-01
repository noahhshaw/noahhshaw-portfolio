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

// ============================================================
// DEVELOPMENTAL MILESTONES
// ============================================================
// Catalog seeded from baby-kb/milestones/aap-cdc-2022.json. Each row is a
// clinically-resourced milestone with an AAP/CDC age window. The catalog
// is immutable per-version; bumping the version reseeds.
export const milestonesCatalog = pgTable(
  "milestones_catalog",
  {
    id: serial("id").primaryKey(),
    // Stable string key, used in URLs (e.g. /baby/milestones/first-social-smile/complete).
    key: text("key").notNull().unique(),
    displayName: text("display_name").notNull(),
    // 'social-emotional' | 'language-communication' | 'cognitive' | 'movement-gross' | 'movement-fine'
    category: text("category").notNull(),
    ageWindowLowDays: integer("age_window_low_days").notNull(),
    ageWindowHighDays: integer("age_window_high_days").notNull(),
    sourceUrl: text("source_url").notNull(),
    clinicalNote: text("clinical_note"),
    seedOrder: integer("seed_order").notNull(),
    catalogVersion: text("catalog_version").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    catVerIdx: index("milestones_catalog_seed_order_idx").on(t.seedOrder),
    windowIdx: index("milestones_catalog_window_idx").on(t.ageWindowLowDays),
    catCheck: check(
      "milestones_catalog_window_valid",
      sql`${t.ageWindowLowDays} <= ${t.ageWindowHighDays}`
    ),
  })
);

// Per-baby state. One row per (baby_profile, milestone). UPDATEs in place —
// no change-log table. status starts 'pending' and moves to 'complete' or
// 'skipped'. observed_date is the parent's recall of when it happened; can
// differ from completed_at (the moment the row was flipped).
export const milestoneEvents = pgTable(
  "milestone_events",
  {
    id: serial("id").primaryKey(),
    babyProfileId: integer("baby_profile_id")
      .notNull()
      .references(() => babyProfile.id, { onDelete: "cascade" }),
    milestoneId: integer("milestone_id")
      .notNull()
      .references(() => milestonesCatalog.id, { onDelete: "cascade" }),
    // 'pending' | 'complete' | 'skipped'
    status: text("status").notNull().default("pending"),
    observedDate: date("observed_date"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    skippedAt: timestamp("skipped_at", { withTimezone: true }),
    notes: text("notes"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqBabyMilestone: unique("milestone_events_baby_milestone_unique").on(
      t.babyProfileId,
      t.milestoneId
    ),
    statusIdx: index("milestone_events_status_idx").on(t.status),
    statusCheck: check(
      "milestone_events_status_valid",
      sql`${t.status} IN ('pending', 'complete', 'skipped')`
    ),
  })
);

// ============================================================
// SHOP LENS
// Mobile visual shopping demo. Text enums are validated at the app boundary
// so the MVP can iterate without frequent DB enum migrations.
// ============================================================

export const shopSessions = pgTable(
  "shop_sessions",
  {
    id: text("id").primaryKey(),
    visitorId: text("visitor_id").notNull(),
    status: text("status").notNull().default("active"),
    initialPrompt: text("initial_prompt").notNull(),
    currentPrompt: text("current_prompt").notNull(),
    preferredAspectRatio: text("preferred_aspect_ratio")
      .notNull()
      .default("9:16"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("idx_shop_sessions_visitor").on(table.visitorId),
    index("idx_shop_sessions_status").on(table.status),
    index("idx_shop_sessions_expires").on(table.expiresAt),
  ]
);

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => shopSessions.id, { onDelete: "cascade" }),
    parentRunId: text("parent_run_id"),
    trigger: text("trigger").notNull(),
    status: text("status").notNull().default("queued"),
    currentState: text("current_state").notNull().default("queued"),
    qstashMessageId: text("qstash_message_id"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    timeoutAt: timestamp("timeout_at", { withTimezone: true }),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
  },
  (table) => [
    index("idx_agent_runs_session").on(table.sessionId),
    index("idx_agent_runs_status_state").on(table.status, table.currentState),
    index("idx_agent_runs_timeout").on(table.timeoutAt),
  ]
);

export const runEvents = pgTable(
  "run_events",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => shopSessions.id, { onDelete: "cascade" }),
    runId: text("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    fromState: text("from_state"),
    toState: text("to_state"),
    message: text("message"),
    metadataJson: jsonb("metadata_json").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_run_events_run_created").on(table.runId, table.createdAt),
    index("idx_run_events_session").on(table.sessionId),
  ]
);

export const imageAssets = pgTable(
  "image_assets",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => shopSessions.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    source: text("source").notNull(),
    storageUrl: text("storage_url").notNull(),
    originalUrl: text("original_url"),
    mimeType: text("mime_type").notNull(),
    width: integer("width"),
    height: integer("height"),
    aspectRatio: text("aspect_ratio"),
    sizeBytes: integer("size_bytes"),
    exifOrientationApplied: boolean("exif_orientation_applied")
      .notNull()
      .default(false),
    metadataJson: jsonb("metadata_json").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_image_assets_session").on(table.sessionId),
    index("idx_image_assets_role").on(table.role),
  ]
);

export const productSources = pgTable(
  "product_sources",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    status: text("status").notNull().default("active"),
    priority: integer("priority").notNull(),
    configJson: jsonb("config_json").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_product_sources_status_priority").on(
      table.status,
      table.priority
    ),
  ]
);

export const designPlans = pgTable(
  "design_plans",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => shopSessions.id, { onDelete: "cascade" }),
    runId: text("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    userGoal: text("user_goal").notNull(),
    inferredScenario: text("inferred_scenario").notNull(),
    budgetMode: text("budget_mode").notNull().default("none"),
    targetBudgetCents: integer("target_budget_cents"),
    priceStrategy: text("price_strategy").notNull().default("best_result"),
    desiredProductCount: integer("desired_product_count").notNull(),
    heroProductCount: integer("hero_product_count").notNull(),
    generationGoal: text("generation_goal").notNull(),
    clarificationNeeded: boolean("clarification_needed").notNull().default(false),
    clarificationQuestion: text("clarification_question"),
    planJson: jsonb("plan_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_design_plans_session").on(table.sessionId),
    index("idx_design_plans_run").on(table.runId),
  ]
);

export const planCategories = pgTable(
  "plan_categories",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .references(() => designPlans.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priority: integer("priority").notNull(),
    desiredCount: integer("desired_count").notNull(),
    searchQueriesJson: jsonb("search_queries_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_plan_categories_plan").on(table.planId),
    index("idx_plan_categories_priority").on(table.priority),
  ]
);

export const productSearches = pgTable(
  "product_searches",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => shopSessions.id, { onDelete: "cascade" }),
    runId: text("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    planCategoryId: text("plan_category_id")
      .notNull()
      .references(() => planCategories.id, { onDelete: "cascade" }),
    sourceId: text("source_id")
      .notNull()
      .references(() => productSources.id),
    query: text("query").notNull(),
    status: text("status").notNull().default("queued"),
    rawResponseJson: jsonb("raw_response_json"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
  },
  (table) => [
    index("idx_product_searches_run").on(table.runId),
    index("idx_product_searches_category").on(table.planCategoryId),
  ]
);

export const productSearchResults = pgTable(
  "product_search_results",
  {
    id: text("id").primaryKey(),
    productSearchId: text("product_search_id")
      .notNull()
      .references(() => productSearches.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    externalProductId: text("external_product_id").notNull(),
    title: text("title").notNull(),
    merchant: text("merchant"),
    productUrl: text("product_url").notNull(),
    imageUrl: text("image_url").notNull(),
    priceText: text("price_text"),
    priceCents: integer("price_cents"),
    currency: text("currency").default("USD"),
    rating: integer("rating"),
    reviewCount: integer("review_count"),
    rank: integer("rank").notNull(),
    rawJson: jsonb("raw_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_product_search_results_search").on(table.productSearchId),
    index("idx_product_search_results_external").on(
      table.source,
      table.externalProductId
    ),
  ]
);

export const emergencyCatalogItems = pgTable(
  "emergency_catalog_items",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    merchant: text("merchant").notNull(),
    category: text("category").notNull(),
    productUrl: text("product_url").notNull(),
    imageUrl: text("image_url").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    currency: text("currency").notNull().default("USD"),
    tagsJson: jsonb("tags_json").notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_emergency_catalog_category").on(table.category),
  ]
);

export const productCandidates = pgTable(
  "product_candidates",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => shopSessions.id, { onDelete: "cascade" }),
    runId: text("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    planCategoryId: text("plan_category_id")
      .notNull()
      .references(() => planCategories.id, { onDelete: "cascade" }),
    productSearchResultId: text("product_search_result_id").references(
      () => productSearchResults.id
    ),
    emergencyCatalogItemId: text("emergency_catalog_item_id").references(
      () => emergencyCatalogItems.id
    ),
    rank: integer("rank").notNull(),
    role: text("role").notNull(),
    reason: text("reason"),
    quantity: integer("quantity").notNull().default(1),
    unitPriceCents: integer("unit_price_cents"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_product_candidates_session").on(table.sessionId),
    index("idx_product_candidates_run").on(table.runId),
    index("idx_product_candidates_category").on(table.planCategoryId),
  ]
);

export const productCandidateImages = pgTable(
  "product_candidate_images",
  {
    id: text("id").primaryKey(),
    productCandidateId: text("product_candidate_id")
      .notNull()
      .references(() => productCandidates.id, { onDelete: "cascade" }),
    imageAssetId: text("image_asset_id")
      .notNull()
      .references(() => imageAssets.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    selectedForContext: boolean("selected_for_context").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_product_candidate_images_candidate").on(table.productCandidateId),
    index("idx_product_candidate_images_asset").on(table.imageAssetId),
  ]
);

export const contextBundles = pgTable(
  "context_bundles",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => shopSessions.id, { onDelete: "cascade" }),
    runId: text("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    designPlanId: text("design_plan_id")
      .notNull()
      .references(() => designPlans.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    aspectRatio: text("aspect_ratio").notNull(),
    promptText: text("prompt_text").notNull(),
    imageCount: integer("image_count").notNull(),
    bundleJson: jsonb("bundle_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_context_bundles_run").on(table.runId),
    index("idx_context_bundles_session").on(table.sessionId),
  ]
);

export const contextBundleItems = pgTable(
  "context_bundle_items",
  {
    id: text("id").primaryKey(),
    contextBundleId: text("context_bundle_id")
      .notNull()
      .references(() => contextBundles.id, { onDelete: "cascade" }),
    imageAssetId: text("image_asset_id")
      .notNull()
      .references(() => imageAssets.id, { onDelete: "cascade" }),
    productCandidateId: text("product_candidate_id").references(
      () => productCandidates.id
    ),
    role: text("role").notNull(),
    position: integer("position").notNull(),
    caption: text("caption"),
    includeReason: text("include_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_context_bundle_items_bundle").on(table.contextBundleId),
    index("idx_context_bundle_items_asset").on(table.imageAssetId),
  ]
);

export const generationAttempts = pgTable(
  "generation_attempts",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => shopSessions.id, { onDelete: "cascade" }),
    runId: text("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    contextBundleId: text("context_bundle_id").references(
      () => contextBundles.id
    ),
    model: text("model").notNull(),
    status: text("status").notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    inputImageCount: integer("input_image_count").notNull().default(0),
    outputImageAssetId: text("output_image_asset_id").references(
      () => imageAssets.id
    ),
    latencyMs: integer("latency_ms"),
    costCents: integer("cost_cents"),
    rawResponseJson: jsonb("raw_response_json"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
  },
  (table) => [
    unique("generation_attempt_run_attempt_unique").on(
      table.runId,
      table.attemptNumber
    ),
    index("idx_generation_attempts_run").on(table.runId),
    index("idx_generation_attempts_status").on(table.status),
  ]
);

export const itemSelections = pgTable(
  "item_selections",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => shopSessions.id, { onDelete: "cascade" }),
    productCandidateId: text("product_candidate_id")
      .notNull()
      .references(() => productCandidates.id, { onDelete: "cascade" }),
    selected: boolean("selected").notNull().default(true),
    quantity: integer("quantity").notNull().default(1),
    variantJson: jsonb("variant_json").notNull().default(sql`'{}'::jsonb`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("item_selections_candidate_unique").on(table.productCandidateId),
    index("idx_item_selections_session").on(table.sessionId),
  ]
);

export const costEvents = pgTable(
  "cost_events",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => shopSessions.id, { onDelete: "cascade" }),
    runId: text("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    provider: text("provider").notNull(),
    model: text("model"),
    estimatedCostCents: integer("estimated_cost_cents"),
    actualCostCents: integer("actual_cost_cents"),
    metadataJson: jsonb("metadata_json").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_cost_events_session").on(table.sessionId),
    index("idx_cost_events_run").on(table.runId),
    index("idx_cost_events_created").on(table.createdAt),
  ]
);

export type BabyProfile = typeof babyProfile.$inferSelect;
export type NewBabyProfile = typeof babyProfile.$inferInsert;
export type MilestoneCatalog = typeof milestonesCatalog.$inferSelect;
export type NewMilestoneCatalog = typeof milestonesCatalog.$inferInsert;
export type MilestoneEvent = typeof milestoneEvents.$inferSelect;
export type NewMilestoneEvent = typeof milestoneEvents.$inferInsert;
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
export type ShopSession = typeof shopSessions.$inferSelect;
export type NewShopSession = typeof shopSessions.$inferInsert;
export type AgentRun = typeof agentRuns.$inferSelect;
export type NewAgentRun = typeof agentRuns.$inferInsert;
export type RunEvent = typeof runEvents.$inferSelect;
export type NewRunEvent = typeof runEvents.$inferInsert;
export type ImageAsset = typeof imageAssets.$inferSelect;
export type NewImageAsset = typeof imageAssets.$inferInsert;
export type ProductSource = typeof productSources.$inferSelect;
export type NewProductSource = typeof productSources.$inferInsert;
export type DesignPlan = typeof designPlans.$inferSelect;
export type NewDesignPlan = typeof designPlans.$inferInsert;
export type PlanCategory = typeof planCategories.$inferSelect;
export type NewPlanCategory = typeof planCategories.$inferInsert;
export type ProductSearch = typeof productSearches.$inferSelect;
export type NewProductSearch = typeof productSearches.$inferInsert;
export type ProductSearchResult = typeof productSearchResults.$inferSelect;
export type NewProductSearchResult = typeof productSearchResults.$inferInsert;
export type EmergencyCatalogItem = typeof emergencyCatalogItems.$inferSelect;
export type NewEmergencyCatalogItem = typeof emergencyCatalogItems.$inferInsert;
export type ProductCandidate = typeof productCandidates.$inferSelect;
export type NewProductCandidate = typeof productCandidates.$inferInsert;
export type ProductCandidateImage = typeof productCandidateImages.$inferSelect;
export type NewProductCandidateImage = typeof productCandidateImages.$inferInsert;
export type ContextBundle = typeof contextBundles.$inferSelect;
export type NewContextBundle = typeof contextBundles.$inferInsert;
export type ContextBundleItem = typeof contextBundleItems.$inferSelect;
export type NewContextBundleItem = typeof contextBundleItems.$inferInsert;
export type GenerationAttempt = typeof generationAttempts.$inferSelect;
export type NewGenerationAttempt = typeof generationAttempts.$inferInsert;
export type ItemSelection = typeof itemSelections.$inferSelect;
export type NewItemSelection = typeof itemSelections.$inferInsert;
export type CostEvent = typeof costEvents.$inferSelect;
export type NewCostEvent = typeof costEvents.$inferInsert;
