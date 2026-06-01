# Shop Lens Verification Strategy

## Goal
Verify the Shop Lens demo by testing each boundary independently, then running one narrow end-to-end path in a configured environment. Most tests should use mocked external providers. Real SerpApi, QStash, object storage, and Gemini calls should be reserved for manual or scheduled smoke checks because they are slower, cost money, and can fail for provider reasons.

## Verification Layers
1. **Static checks**
   - `npm run build`
   - TypeScript route and component compilation.
   - Drizzle migration generation review.

2. **Unit and contract tests**
   - Pure functions, normalization, schemas, fallback behavior, idempotency helpers.
   - Provider response fixtures for SerpApi and Gemini planner output.

3. **Local integration tests**
   - Next.js route handlers with mocked DB/provider boundaries where practical.
   - Local object cache for upload and asset proxy behavior.

4. **Configured staging smoke test**
   - Real Neon, Upstash Redis, QStash, SerpApi, object storage, and Gemini.
   - One controlled prompt/image set, manually reviewed.

5. **Manual demo rehearsal**
   - Mobile-first browser path on `/shop-lens`.
   - Validate the result feels broad, visual, selectable, and credible.

## Subcomponent Strategy

### 1. Mobile UI: `/shop-lens`
**What to verify**
- User can upload 1-4 images and enter a freeform prompt.
- UI is optimized for mobile aspect ratios.
- Run status is visible while the background job progresses.
- Products appear only after the run reaches `presenting_result`.
- Product selection checkboxes update selected total immediately.
- Reload/focus resumes polling from `localStorage`.
- Cancel button is shown only for active runs.

**Automated checks**
- Component smoke test for empty state, selected total calculation, and failed submit error rendering.
- Browser checks at `390x844`, `430x932`, and `360x800`.
- One accessibility scan once the browser test harness supports full DOM injection.

**Manual checks**
- iPhone-sized viewport: upload, prompt, submit, wait, deselect products, open product link.
- Confirm text does not overflow buttons/cards.

**Pass criteria**
- No layout overlap on target mobile widths.
- User can understand whether the agent is working, failed, canceled, or complete.

### 2. Submit API: `POST /api/shop-lens/runs`
**What to verify**
- Rejects missing `DATABASE_URL` with JSON `503`.
- Rejects missing prompt, missing image, too many images, invalid MIME, and oversized images.
- Creates `shop_sessions`, `agent_runs`, upload `image_assets`, and initial `run_events`.
- Sets signed visitor cookie for anonymous sessions.
- Enqueues QStash when configured.
- Starts local worker fallback only in non-production when QStash is unavailable.
- Does not call Gemini directly.

**Automated checks**
- Route tests using mocked DB, storage, and QStash.
- Upload fixture tests for JPEG, PNG, WebP, HEIC/HEIF if fixture is available.

**Manual checks**
- `curl` with a valid local image should return `202` in a configured environment.
- `curl` without `DATABASE_URL` should return JSON `503`, not an empty 500.

**Pass criteria**
- A valid request creates exactly one queued run.
- Invalid requests fail before writing partial expensive state.

### 3. Visitor Cookie and Rate Limits
**What to verify**
- Visitor cookie can be created, signed, read, and rejected if tampered.
- IP rate limiter blocks bursts.
- Redis generation cap blocks new generation attempts after daily cap.
- In-memory fallback works locally.

**Automated checks**
- Unit tests for cookie signing and tamper rejection.
- Unit test for `reserveDailyGenerationSlot` with mocked Redis.
- Integration test for submit route rate-limit response.

**Pass criteria**
- A tampered visitor cookie is ignored.
- Daily cap prevents spending before Gemini is called.

### 4. QStash Enqueue and Worker Entry
**What to verify**
- Enqueue uses `SHOP_LENS_APP_URL` or `VERCEL_URL`.
- QStash message has stable deduplication id.
- Worker verifies QStash signatures in production-like configuration.
- Worker returns `202` after processing or safely ignoring duplicate/non-queued runs.
- `maxDuration = 300` is exported.

**Automated checks**
- Unit test for `getAppBaseUrl`.
- Worker route test with mocked verifier and mocked `processShopLensRun`.
- Duplicate delivery test: current state not `queued` exits without creating another plan.

**Manual checks**
- Trigger a QStash delivery in staging and verify one run event sequence.

**Pass criteria**
- Duplicate QStash deliveries do not duplicate Gemini calls or product candidates.

### 5. Orchestrator and State Machine
**What to verify**
- State transitions are conditional and monotonic:
  `queued -> planning -> searching_products -> fetching_product_details -> caching_product_images -> building_context_bundle -> generating_image -> presenting_result`.
- Each transition writes a `run_events` row.
- Cancellation is checked before expensive steps.
- Failures mark run `failed` with `error_code` and `error_message`.
- Stale cron marks old running jobs failed.

**Automated checks**
- DB-backed integration tests for successful state transition sequence.
- Duplicate worker test where run starts in `generating_image`.
- Cancel-before-generation test.
- Stale-run cron test using old `started_at`.

**Pass criteria**
- Run state and event log never disagree.
- Expensive steps are not entered after cancellation.

### 6. Planner
**What to verify**
- Planner returns valid `designPlanSchema`.
- Output includes scenario, product count, hero count, generation goal, and search categories.
- Budget is optional; inferred only when prompt asks.
- Fallback heuristic planner works without Gemini credentials.
- Gemini structured output parse failures fail the run clearly.

**Automated checks**
- Schema fixture tests for valid and invalid planner JSON.
- Heuristic planner tests for room/event/outfit/generic prompts.
- Mock Gemini malformed JSON test.

**Manual checks**
- Review planner output for 5 demo prompts:
  - backyard party
  - green midcentury living room
  - outfit styling
  - tablescape
  - vague "make this better"

**Pass criteria**
- Planner produces useful search categories without asking for required budget/headcount.

### 7. Live Product Search: SerpApi
**What to verify**
- SerpApi Google Shopping results map to normalized product results.
- Price parsing is reasonable for common formats.
- Provider product id is used when available; otherwise URL hash is stable.
- Raw response is stored for debugging.
- Search failure falls back to emergency catalog.

**Automated checks**
- Fixture tests for SerpApi result mapping.
- Dedup tests by URL, image URL, title, and merchant.
- Failure fixture test that returns emergency catalog items.

**Manual checks**
- Run 3 live queries and inspect merchants, images, prices, and product links.

**Pass criteria**
- At least 6 usable product candidates for a normal prompt.
- Fallback never becomes the normal happy path.

### 8. Product Candidate Promotion and Selection
**What to verify**
- Best deduped results promote to `product_candidates`.
- Hero/supporting roles match plan counts.
- Price and quantity are copied at promotion time.
- Default `item_selections` are created as selected.
- Selection updates do not start a new generation.

**Automated checks**
- DB-backed promotion test with fixture results.
- Selection PATCH test for selected/deselected and quantity updates.
- Polling response total test excludes deselected items.

**Manual checks**
- Deselect products in UI and confirm total changes immediately.

**Pass criteria**
- User can choose what they actually want to procure.

### 9. Product Image Fetch and Normalization
**What to verify**
- Remote images are fetched server-side.
- Images larger than configured limits fail gracefully.
- Images are normalized to JPEG/WebP-compatible model input.
- HEIC/EXIF orientation is applied for uploads.
- Cached `image_assets` are created before Gemini context bundling.
- Failed product images write `product_image_failed` events and do not kill the run unless no images remain usable.

**Automated checks**
- Mock fetch tests for success, 404, bad MIME, huge content-length, and timeout.
- Sharp normalization tests with JPEG/PNG/WebP fixtures.
- HEIC fixture test if fixture can be added.

**Manual checks**
- Inspect cached product image URLs/assets for one staging run.

**Pass criteria**
- Context bundle never hotlinks remote product images into Gemini.

### 10. Object Storage and Asset Proxy
**What to verify**
- R2 writes and reads objects when configured.
- Local `.shop-lens-cache` fallback works in development.
- Asset proxy returns generated/product image bytes with correct content type.
- Asset proxy redirects only when storage URL is public HTTP.
- Missing assets return 404.

**Automated checks**
- Unit tests for local storage fallback.
- Route tests for asset proxy read, redirect, and 404.

**Manual checks**
- Open generated image and product image asset URLs in staging.

**Pass criteria**
- UI can render uploaded, product, and generated images through app-owned URLs.

### 11. Context Bundle Builder
**What to verify**
- Bundle includes scene image(s) first, then selected product references.
- `image_count <= 14`.
- Bundle references cached `image_assets`, not remote thumbnails.
- Prompt names product titles, merchants, roles, and quantities.
- Aspect ratio defaults to `9:16`.

**Automated checks**
- DB-backed context bundle test with more than 14 candidate images.
- Prompt snapshot test for stable structure.

**Manual checks**
- Inspect context bundle JSON for a staging run.

**Pass criteria**
- Gemini receives enough product references to create a roughly WYSIWYG preview.

### 12. Gemini Image Generation
**What to verify**
- Generation attempt row is inserted as `running` before Gemini call.
- Unique `(run_id, attempt_number)` prevents duplicate generation.
- Existing running attempt prevents a second Gemini call.
- Succeeded attempt creates generated `image_asset`.
- Failed attempt records error and fails the run.
- Placeholder SVG path works without Gemini credentials for local development.

**Automated checks**
- Mock Gemini success and failure tests.
- Idempotency conflict test for existing running/succeeded/failed attempt.
- Placeholder generation test.

**Manual checks**
- One real Gemini smoke run in staging with 1 scene image + 5 product images.

**Pass criteria**
- Exactly one generation attempt per run for MVP.
- Generated image is visible in the UI.

### 13. Polling API: `GET /api/shop-lens/runs/:runId`
**What to verify**
- Returns progress state and progress label for active runs.
- Does not return products until `presenting_result`.
- Returns generated image URL, product cards, and selected total on completion.
- Handles unknown run id with 404.

**Automated checks**
- Route tests for queued, running, completed, failed, canceled, and missing run.
- Product response shape test.

**Manual checks**
- Poll a live run during staging smoke and confirm labels advance.

**Pass criteria**
- Mobile client can lose/reload focus and resume from `localStorage`.

### 14. Cancel API
**What to verify**
- Cancels only queued/running runs.
- Does not alter completed/failed runs.
- Worker exits before next expensive step.

**Automated checks**
- Route test for active run cancellation.
- Route test for completed run no-op.
- Worker test that sees canceled state before generation.

**Manual checks**
- Start a staging run and cancel during product search or image caching.

**Pass criteria**
- Canceled run stops future spend.

### 15. Stale Run Cron
**What to verify**
- Marks running runs older than 30 minutes failed.
- Does not fail completed, canceled, or fresh running runs.
- Route can be called by Vercel Cron.

**Automated checks**
- DB-backed test with old/new run fixtures.

**Manual checks**
- Invoke `/api/cron/shop-lens-stale-runs` in staging and inspect affected rows.

**Pass criteria**
- No run remains indefinitely stuck in `running`.

### 16. Database Schema and Migrations
**What to verify**
- Migration applies cleanly to a fresh DB.
- Migration applies cleanly to staging DB with existing app tables.
- Required indexes and unique generation attempt constraint exist.
- Text enum values match Zod schemas.

**Automated checks**
- `npm run db:generate` produces no unexpected diff after migration is current.
- Migration dry-run against disposable Neon branch.

**Manual checks**
- Review `drizzle/0002_certain_shriek.sql`.

**Pass criteria**
- App routes can create a full run without schema drift.

### 17. Cost and Observability
**What to verify**
- Generation cap increments before Gemini call.
- `cost_events` rows are written for generation.
- `run_events` provide enough breadcrumbs to debug failed demos.
- Logs include provider failures without exposing secrets.

**Automated checks**
- Mock Redis cap test.
- Generation success test asserts cost event insert.

**Manual checks**
- Inspect one successful and one failed staging run in DB.

**Pass criteria**
- A reviewer can answer: what ran, what failed, and whether we spent money.

## End-to-End Smoke Script
Run only in a configured staging or production-preview environment.

1. Apply migrations.
2. Confirm env vars:
   - `DATABASE_URL`
   - `SERPAPI_API_KEY`
   - `QSTASH_TOKEN`
   - `QSTASH_CURRENT_SIGNING_KEY`
   - `QSTASH_NEXT_SIGNING_KEY`
   - `SHOP_LENS_APP_URL`
   - `GOOGLE_API_KEY` or Vertex enterprise envs
   - `SHOP_LENS_R2_ACCOUNT_ID`
   - `SHOP_LENS_R2_ACCESS_KEY_ID`
   - `SHOP_LENS_R2_SECRET_ACCESS_KEY`
   - `SHOP_LENS_R2_BUCKET`
   - optional `SHOP_LENS_R2_PUBLIC_BASE_URL`
3. Open `/shop-lens` on mobile viewport.
4. Upload one scene image.
5. Prompt: `Make this patio feel like a cinematic cowboy dinner party with great lighting and purchasable decor.`
6. Submit and wait for completion.
7. Verify:
   - `agent_runs.status = completed`
   - state reached `presenting_result`
   - generated image is visible
   - products include live merchants and prices
   - product image URLs are app-owned asset URLs
   - deselecting a product updates total
   - product links open
8. Repeat once with: `Make this room feel midcentury modern, calm, and green.`

## Release Gate
Ship the demo when all are true:
- `npm run test` passes.
- `npm run build` passes.
- Migration applies to staging.
- `/shop-lens` loads in target mobile viewports.
- Submit route returns `202` in configured staging.
- One live SerpApi search produces usable products.
- One Gemini generation completes and renders.
- Duplicate worker delivery does not create a second generation attempt.
- Cancel stops a queued/running job before generation.

## Known MVP Gaps
- No validator; human visual review is the quality gate for now.
- No checkout or affiliate validation.
- No signed image URLs.
- No formal eval set.
- No provider contract monitoring beyond fixtures and smoke tests.
