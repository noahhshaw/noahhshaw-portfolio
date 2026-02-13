import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  smallint,
  timestamp,
  unique,
  check,
  index,
  char,
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
