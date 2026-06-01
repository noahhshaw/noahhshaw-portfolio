CREATE TABLE "agent_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"parent_run_id" text,
	"trigger" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"current_state" text DEFAULT 'queued' NOT NULL,
	"qstash_message_id" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"timeout_at" timestamp with time zone,
	"error_code" text,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "context_bundle_items" (
	"id" text PRIMARY KEY NOT NULL,
	"context_bundle_id" text NOT NULL,
	"image_asset_id" text NOT NULL,
	"product_candidate_id" text,
	"role" text NOT NULL,
	"position" integer NOT NULL,
	"caption" text,
	"include_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "context_bundles" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"run_id" text NOT NULL,
	"design_plan_id" text NOT NULL,
	"model" text NOT NULL,
	"aspect_ratio" text NOT NULL,
	"prompt_text" text NOT NULL,
	"image_count" integer NOT NULL,
	"bundle_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"run_id" text NOT NULL,
	"kind" text NOT NULL,
	"provider" text NOT NULL,
	"model" text,
	"estimated_cost_cents" integer,
	"actual_cost_cents" integer,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"run_id" text NOT NULL,
	"user_goal" text NOT NULL,
	"inferred_scenario" text NOT NULL,
	"budget_mode" text DEFAULT 'none' NOT NULL,
	"target_budget_cents" integer,
	"price_strategy" text DEFAULT 'best_result' NOT NULL,
	"desired_product_count" integer NOT NULL,
	"hero_product_count" integer NOT NULL,
	"generation_goal" text NOT NULL,
	"clarification_needed" boolean DEFAULT false NOT NULL,
	"clarification_question" text,
	"plan_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emergency_catalog_items" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"merchant" text NOT NULL,
	"category" text NOT NULL,
	"product_url" text NOT NULL,
	"image_url" text NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"tags_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"run_id" text NOT NULL,
	"context_bundle_id" text,
	"model" text NOT NULL,
	"status" text NOT NULL,
	"attempt_number" integer NOT NULL,
	"input_image_count" integer DEFAULT 0 NOT NULL,
	"output_image_asset_id" text,
	"latency_ms" integer,
	"cost_cents" integer,
	"raw_response_json" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"error_code" text,
	"error_message" text,
	CONSTRAINT "generation_attempt_run_attempt_unique" UNIQUE("run_id","attempt_number")
);
--> statement-breakpoint
CREATE TABLE "image_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"role" text NOT NULL,
	"source" text NOT NULL,
	"storage_url" text NOT NULL,
	"original_url" text,
	"mime_type" text NOT NULL,
	"width" integer,
	"height" integer,
	"aspect_ratio" text,
	"size_bytes" integer,
	"exif_orientation_applied" boolean DEFAULT false NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_selections" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"product_candidate_id" text NOT NULL,
	"selected" boolean DEFAULT true NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"variant_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_selections_candidate_unique" UNIQUE("product_candidate_id")
);
--> statement-breakpoint
CREATE TABLE "plan_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"name" text NOT NULL,
	"priority" integer NOT NULL,
	"desired_count" integer NOT NULL,
	"search_queries_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_candidate_images" (
	"id" text PRIMARY KEY NOT NULL,
	"product_candidate_id" text NOT NULL,
	"image_asset_id" text NOT NULL,
	"position" integer NOT NULL,
	"selected_for_context" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_candidates" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"run_id" text NOT NULL,
	"plan_category_id" text NOT NULL,
	"product_search_result_id" text,
	"emergency_catalog_item_id" text,
	"rank" integer NOT NULL,
	"role" text NOT NULL,
	"reason" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_cents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_search_results" (
	"id" text PRIMARY KEY NOT NULL,
	"product_search_id" text NOT NULL,
	"source" text NOT NULL,
	"external_product_id" text NOT NULL,
	"title" text NOT NULL,
	"merchant" text,
	"product_url" text NOT NULL,
	"image_url" text NOT NULL,
	"price_text" text,
	"price_cents" integer,
	"currency" text DEFAULT 'USD',
	"rating" integer,
	"review_count" integer,
	"rank" integer NOT NULL,
	"raw_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_searches" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"run_id" text NOT NULL,
	"plan_category_id" text NOT NULL,
	"source_id" text NOT NULL,
	"query" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"raw_response_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "product_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"priority" integer NOT NULL,
	"config_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_sources_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "run_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"run_id" text NOT NULL,
	"event_type" text NOT NULL,
	"from_state" text,
	"to_state" text,
	"message" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"visitor_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"initial_prompt" text NOT NULL,
	"current_prompt" text NOT NULL,
	"preferred_aspect_ratio" text DEFAULT '9:16' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_session_id_shop_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."shop_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_bundle_items" ADD CONSTRAINT "context_bundle_items_context_bundle_id_context_bundles_id_fk" FOREIGN KEY ("context_bundle_id") REFERENCES "public"."context_bundles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_bundle_items" ADD CONSTRAINT "context_bundle_items_image_asset_id_image_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "public"."image_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_bundle_items" ADD CONSTRAINT "context_bundle_items_product_candidate_id_product_candidates_id_fk" FOREIGN KEY ("product_candidate_id") REFERENCES "public"."product_candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_bundles" ADD CONSTRAINT "context_bundles_session_id_shop_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."shop_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_bundles" ADD CONSTRAINT "context_bundles_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_bundles" ADD CONSTRAINT "context_bundles_design_plan_id_design_plans_id_fk" FOREIGN KEY ("design_plan_id") REFERENCES "public"."design_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_session_id_shop_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."shop_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_plans" ADD CONSTRAINT "design_plans_session_id_shop_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."shop_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_plans" ADD CONSTRAINT "design_plans_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_attempts" ADD CONSTRAINT "generation_attempts_session_id_shop_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."shop_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_attempts" ADD CONSTRAINT "generation_attempts_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_attempts" ADD CONSTRAINT "generation_attempts_context_bundle_id_context_bundles_id_fk" FOREIGN KEY ("context_bundle_id") REFERENCES "public"."context_bundles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_attempts" ADD CONSTRAINT "generation_attempts_output_image_asset_id_image_assets_id_fk" FOREIGN KEY ("output_image_asset_id") REFERENCES "public"."image_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_session_id_shop_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."shop_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_selections" ADD CONSTRAINT "item_selections_session_id_shop_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."shop_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_selections" ADD CONSTRAINT "item_selections_product_candidate_id_product_candidates_id_fk" FOREIGN KEY ("product_candidate_id") REFERENCES "public"."product_candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_categories" ADD CONSTRAINT "plan_categories_plan_id_design_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."design_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_candidate_images" ADD CONSTRAINT "product_candidate_images_product_candidate_id_product_candidates_id_fk" FOREIGN KEY ("product_candidate_id") REFERENCES "public"."product_candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_candidate_images" ADD CONSTRAINT "product_candidate_images_image_asset_id_image_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "public"."image_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_candidates" ADD CONSTRAINT "product_candidates_session_id_shop_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."shop_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_candidates" ADD CONSTRAINT "product_candidates_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_candidates" ADD CONSTRAINT "product_candidates_plan_category_id_plan_categories_id_fk" FOREIGN KEY ("plan_category_id") REFERENCES "public"."plan_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_candidates" ADD CONSTRAINT "product_candidates_product_search_result_id_product_search_results_id_fk" FOREIGN KEY ("product_search_result_id") REFERENCES "public"."product_search_results"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_candidates" ADD CONSTRAINT "product_candidates_emergency_catalog_item_id_emergency_catalog_items_id_fk" FOREIGN KEY ("emergency_catalog_item_id") REFERENCES "public"."emergency_catalog_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_search_results" ADD CONSTRAINT "product_search_results_product_search_id_product_searches_id_fk" FOREIGN KEY ("product_search_id") REFERENCES "public"."product_searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_searches" ADD CONSTRAINT "product_searches_session_id_shop_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."shop_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_searches" ADD CONSTRAINT "product_searches_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_searches" ADD CONSTRAINT "product_searches_plan_category_id_plan_categories_id_fk" FOREIGN KEY ("plan_category_id") REFERENCES "public"."plan_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_searches" ADD CONSTRAINT "product_searches_source_id_product_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."product_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_events" ADD CONSTRAINT "run_events_session_id_shop_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."shop_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_events" ADD CONSTRAINT "run_events_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agent_runs_session" ON "agent_runs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_agent_runs_status_state" ON "agent_runs" USING btree ("status","current_state");--> statement-breakpoint
CREATE INDEX "idx_agent_runs_timeout" ON "agent_runs" USING btree ("timeout_at");--> statement-breakpoint
CREATE INDEX "idx_context_bundle_items_bundle" ON "context_bundle_items" USING btree ("context_bundle_id");--> statement-breakpoint
CREATE INDEX "idx_context_bundle_items_asset" ON "context_bundle_items" USING btree ("image_asset_id");--> statement-breakpoint
CREATE INDEX "idx_context_bundles_run" ON "context_bundles" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_context_bundles_session" ON "context_bundles" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_cost_events_session" ON "cost_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_cost_events_run" ON "cost_events" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_cost_events_created" ON "cost_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_design_plans_session" ON "design_plans" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_design_plans_run" ON "design_plans" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_emergency_catalog_category" ON "emergency_catalog_items" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_generation_attempts_run" ON "generation_attempts" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_generation_attempts_status" ON "generation_attempts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_image_assets_session" ON "image_assets" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_image_assets_role" ON "image_assets" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_item_selections_session" ON "item_selections" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_plan_categories_plan" ON "plan_categories" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "idx_plan_categories_priority" ON "plan_categories" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_product_candidate_images_candidate" ON "product_candidate_images" USING btree ("product_candidate_id");--> statement-breakpoint
CREATE INDEX "idx_product_candidate_images_asset" ON "product_candidate_images" USING btree ("image_asset_id");--> statement-breakpoint
CREATE INDEX "idx_product_candidates_session" ON "product_candidates" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_product_candidates_run" ON "product_candidates" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_product_candidates_category" ON "product_candidates" USING btree ("plan_category_id");--> statement-breakpoint
CREATE INDEX "idx_product_search_results_search" ON "product_search_results" USING btree ("product_search_id");--> statement-breakpoint
CREATE INDEX "idx_product_search_results_external" ON "product_search_results" USING btree ("source","external_product_id");--> statement-breakpoint
CREATE INDEX "idx_product_searches_run" ON "product_searches" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_product_searches_category" ON "product_searches" USING btree ("plan_category_id");--> statement-breakpoint
CREATE INDEX "idx_product_sources_status_priority" ON "product_sources" USING btree ("status","priority");--> statement-breakpoint
CREATE INDEX "idx_run_events_run_created" ON "run_events" USING btree ("run_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_run_events_session" ON "run_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_shop_sessions_visitor" ON "shop_sessions" USING btree ("visitor_id");--> statement-breakpoint
CREATE INDEX "idx_shop_sessions_status" ON "shop_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_shop_sessions_expires" ON "shop_sessions" USING btree ("expires_at");