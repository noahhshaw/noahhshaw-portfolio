CREATE TABLE "milestone_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"baby_profile_id" integer NOT NULL,
	"milestone_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"observed_date" date,
	"completed_at" timestamp with time zone,
	"skipped_at" timestamp with time zone,
	"notes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "milestone_events_baby_milestone_unique" UNIQUE("baby_profile_id","milestone_id"),
	CONSTRAINT "milestone_events_status_valid" CHECK ("milestone_events"."status" IN ('pending', 'complete', 'skipped'))
);
--> statement-breakpoint
CREATE TABLE "milestones_catalog" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"display_name" text NOT NULL,
	"category" text NOT NULL,
	"age_window_low_days" integer NOT NULL,
	"age_window_high_days" integer NOT NULL,
	"source_url" text NOT NULL,
	"clinical_note" text,
	"seed_order" integer NOT NULL,
	"catalog_version" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "milestones_catalog_key_unique" UNIQUE("key"),
	CONSTRAINT "milestones_catalog_window_valid" CHECK ("milestones_catalog"."age_window_low_days" <= "milestones_catalog"."age_window_high_days")
);
--> statement-breakpoint
ALTER TABLE "milestone_events" ADD CONSTRAINT "milestone_events_baby_profile_id_baby_profile_id_fk" FOREIGN KEY ("baby_profile_id") REFERENCES "public"."baby_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_events" ADD CONSTRAINT "milestone_events_milestone_id_milestones_catalog_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones_catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "milestone_events_status_idx" ON "milestone_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "milestones_catalog_seed_order_idx" ON "milestones_catalog" USING btree ("seed_order");--> statement-breakpoint
CREATE INDEX "milestones_catalog_window_idx" ON "milestones_catalog" USING btree ("age_window_low_days");