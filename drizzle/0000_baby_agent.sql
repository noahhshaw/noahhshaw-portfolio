CREATE TABLE "agent_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_email" text
);
--> statement-breakpoint
CREATE TABLE "baby_profile" (
	"id" serial PRIMARY KEY NOT NULL,
	"due_date" date NOT NULL,
	"birth_date" date,
	"baby_name" text,
	"pediatrician_name" text,
	"pediatrician_phone" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_date" date NOT NULL,
	"event_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"recurrence" text DEFAULT 'none' NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "couples" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_1_id" integer NOT NULL,
	"user_2_id" integer,
	"gender_filter" text DEFAULT 'all' NOT NULL,
	"first_letter_filter" text DEFAULT 'all' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "couples_different_users" CHECK ("couples"."user_1_id" <> "couples"."user_2_id")
);
--> statement-breakpoint
CREATE TABLE "daily_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"sent_date" date NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"age_in_days" integer NOT NULL,
	"subject" text NOT NULL,
	"body_html" text NOT NULL,
	"body_text" text NOT NULL,
	"recipients" text[] NOT NULL,
	"resend_message_id" text,
	"source_path" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"error" text,
	"tokens_used" integer,
	"cost_usd" text,
	CONSTRAINT "daily_emails_sent_date_unique" UNIQUE("sent_date")
);
--> statement-breakpoint
CREATE TABLE "email_replies" (
	"id" serial PRIMARY KEY NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"from_email" text NOT NULL,
	"to_emails" text[] NOT NULL,
	"cc_emails" text[] DEFAULT '{}'::text[] NOT NULL,
	"subject" text,
	"body_text" text,
	"body_html" text,
	"in_reply_to" text,
	"message_id" text,
	"daily_email_id" integer,
	"raw_headers" jsonb,
	"classification" text,
	"action_taken" text,
	"agent_response_message_id" text,
	"processed_at" timestamp with time zone,
	"processing_error" text,
	CONSTRAINT "email_replies_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
CREATE TABLE "kb_update_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"requester_email" text NOT NULL,
	"source_reply_id" integer,
	"request_text" text NOT NULL,
	"target_topic" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"pr_url" text,
	"notes" text,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "magic_link_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "magic_link_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "names" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_lower" text NOT NULL,
	"origin" text,
	"meaning" text,
	"us_rank" integer DEFAULT 0 NOT NULL,
	"world_rank" integer DEFAULT 0 NOT NULL,
	"famous_person_1" text,
	"famous_person_2" text,
	"famous_person_3" text,
	"alternative_spellings" text[] DEFAULT '{}'::text[],
	"is_boy" boolean DEFAULT false NOT NULL,
	"is_girl" boolean DEFAULT false NOT NULL,
	"phonetic" text,
	"starting_letter" char(1) NOT NULL,
	"syllable_count" smallint,
	"meaning_tags" text[] DEFAULT '{}'::text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "names_name_lower_unique" UNIQUE("name_lower")
);
--> statement-breakpoint
CREATE TABLE "parent_context" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text NOT NULL,
	"source_reply_id" integer,
	"content_type" text NOT NULL,
	"content" text NOT NULL,
	"related_photo_id" integer,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"r2_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"taken_at" timestamp with time zone,
	"uploaded_by_email" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"caption" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"source_reply_id" integer,
	CONSTRAINT "photos_r2_key_unique" UNIQUE("r2_key")
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name_id" integer NOT NULL,
	"couple_id" integer NOT NULL,
	"rating" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ratings_user_name_unique" UNIQUE("user_id","name_id"),
	CONSTRAINT "ratings_range" CHECK ("ratings"."rating" >= 1 AND "ratings"."rating" <= 5)
);
--> statement-breakpoint
CREATE TABLE "short_list" (
	"id" serial PRIMARY KEY NOT NULL,
	"couple_id" integer NOT NULL,
	"name_id" integer NOT NULL,
	"user_1_rating" smallint NOT NULL,
	"user_2_rating" smallint NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "short_list_couple_name_unique" UNIQUE("couple_id","name_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "couples" ADD CONSTRAINT "couples_user_1_id_users_id_fk" FOREIGN KEY ("user_1_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "couples" ADD CONSTRAINT "couples_user_2_id_users_id_fk" FOREIGN KEY ("user_2_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_replies" ADD CONSTRAINT "email_replies_daily_email_id_daily_emails_id_fk" FOREIGN KEY ("daily_email_id") REFERENCES "public"."daily_emails"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_update_queue" ADD CONSTRAINT "kb_update_queue_source_reply_id_email_replies_id_fk" FOREIGN KEY ("source_reply_id") REFERENCES "public"."email_replies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_context" ADD CONSTRAINT "parent_context_source_reply_id_email_replies_id_fk" FOREIGN KEY ("source_reply_id") REFERENCES "public"."email_replies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_context" ADD CONSTRAINT "parent_context_related_photo_id_photos_id_fk" FOREIGN KEY ("related_photo_id") REFERENCES "public"."photos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_source_reply_id_email_replies_id_fk" FOREIGN KEY ("source_reply_id") REFERENCES "public"."email_replies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_name_id_names_id_fk" FOREIGN KEY ("name_id") REFERENCES "public"."names"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_list" ADD CONSTRAINT "short_list_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_list" ADD CONSTRAINT "short_list_name_id_names_id_fk" FOREIGN KEY ("name_id") REFERENCES "public"."names"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_calendar_events_date" ON "calendar_events" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX "idx_calendar_events_type" ON "calendar_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_couples_user_1" ON "couples" USING btree ("user_1_id");--> statement-breakpoint
CREATE INDEX "idx_couples_user_2" ON "couples" USING btree ("user_2_id");--> statement-breakpoint
CREATE INDEX "idx_daily_emails_sent_at" ON "daily_emails" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "idx_daily_emails_status" ON "daily_emails" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_email_replies_received_at" ON "email_replies" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "idx_email_replies_classification" ON "email_replies" USING btree ("classification");--> statement-breakpoint
CREATE INDEX "idx_email_replies_daily_email" ON "email_replies" USING btree ("daily_email_id");--> statement-breakpoint
CREATE INDEX "idx_kb_update_queue_status" ON "kb_update_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_magic_link_email" ON "magic_link_tokens" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_magic_link_expires" ON "magic_link_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_names_starting_letter" ON "names" USING btree ("starting_letter");--> statement-breakpoint
CREATE INDEX "idx_names_origin" ON "names" USING btree ("origin");--> statement-breakpoint
CREATE INDEX "idx_names_is_boy" ON "names" USING btree ("is_boy");--> statement-breakpoint
CREATE INDEX "idx_names_is_girl" ON "names" USING btree ("is_girl");--> statement-breakpoint
CREATE INDEX "idx_names_us_rank" ON "names" USING btree ("us_rank");--> statement-breakpoint
CREATE INDEX "idx_parent_context_created_at" ON "parent_context" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_parent_context_content_type" ON "parent_context" USING btree ("content_type");--> statement-breakpoint
CREATE INDEX "idx_photos_uploaded_at" ON "photos" USING btree ("uploaded_at");--> statement-breakpoint
CREATE INDEX "idx_photos_taken_at" ON "photos" USING btree ("taken_at");--> statement-breakpoint
CREATE INDEX "idx_ratings_user_id" ON "ratings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ratings_couple_id" ON "ratings" USING btree ("couple_id");--> statement-breakpoint
CREATE INDEX "idx_ratings_user_updated" ON "ratings" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_ratings_couple_name" ON "ratings" USING btree ("couple_id","name_id","rating");--> statement-breakpoint
CREATE INDEX "idx_short_list_couple" ON "short_list" USING btree ("couple_id","added_at");