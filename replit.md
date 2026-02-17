# UTM Spec

## Overview
UTM Spec is a SaaS application for parsing, linting, and cleaning UTM parameters in marketing URLs. The core workflow is: Paste → Parse → Lint → Clean Formatting (safe only) → Diff patches → Export.

**Key Principle:** Semantic changes (alias mapping, allowed values fixes, removing UTMs) are NEVER auto-applied; they require explicit user approval. Only safe formatting changes (whitespace trim, case normalization) can be auto-applied.

## Current State
- **Phase:** UI workbench + auth + billing
- **Stack:** Vite + Express + React (fullstack JS template)
- **Database:** PostgreSQL (Neon-backed) via Drizzle ORM
- **Auth:** Supabase magic link (requires VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)
- **Billing:** Stripe subscriptions via stripe-replit-sync (managed webhooks, data sync)
- **Testing:** Vitest for kernel unit tests (`npx vitest run`) — 60 passing

## Project Architecture

### Design System (Neo-Brutalist)
- **Theme:** Paper background, thick 3px borders, brutal offset shadows
- **Colors:** paper, ink, brutal-accent (purple), brutal-alert (red), brutal-warn (yellow), brutal-ok (green)
- **Shadows:** shadow-brutal (4px offset), shadow-brutal-hover (2px), shadow-brutal-active (0px)
- **Components:** `client/src/components/brutal/` - Button, Card, Chip, Drawer

### Kernel (Pure Functions)
Located in `lib/core/`:
- `types.ts` - TypeScript types + Zod schemas (RulesetConfig, ParseRow, ParsedUrl, LintIssue, Patch, DraftPayload, InputMode)
- `detectInput.ts` - Detects whether input is URL_LIST or TSV_RANGE
- `parseTSV.ts` - TSV parsing via PapaParse (NOT string splitting), with URL column detection
- `parseUrl.ts` - Extract utm_* params, detect duplicate keys, separate other params
- `lint.ts` - Returns Issues with severity Error/Warning/Info (malformed URL, duplicates, missing/empty required, strict violations, casing drift, illegal chars, UTM-like keys, internal-link warning)
- `clean.ts` - cleanFormatting (idempotent safe-only: casing, trim, space→underscore, param ordering, trailing slash removal) + suggestSemanticFixes (Levenshtein-based closest-match suggestions for allowed values)
- `diff.ts` - diffRows compares original vs cleaned ParsedUrl, classifies patches as SAFE/SEMANTIC/ERROR with reason codes
- `export.ts` - reconstructUrl, toUrlList, toTSV (with optional originalShape), toCSV (with proper escaping)

### Entitlements & Billing
Located in `lib/entitlements.ts`:
- `isPro(profile)` - Returns true for active/trialing/past_due OR canceled with current_period_end in future
- `getPlanTier(profile, isGuest)` - Returns "guest" | "free" | "pro"
- `LIMITS` - guest: 10 rows/0 rulesets/no CSV, free: 50 rows/2 rulesets/no CSV, pro: unlimited/50 rulesets/CSV
- Backend enforces ruleset caps (free=2, pro=50) with 403 responses
- CSV export gated client-side via ExportBar
- Row caps enforced in Workspace during parsing

### Stripe Integration
- `server/stripeClient.ts` - Stripe client via Replit connector (getUncachableStripeClient, getStripePublishableKey, getStripeSync)
- `server/webhookHandlers.ts` - Processes Stripe webhooks via stripe-replit-sync
- `server/index.ts` - Webhook route registered BEFORE express.json() (requires Buffer body)
- `scripts/seed-products.ts` - Creates "UTM Spec Pro" product with monthly ($29) and yearly ($290) prices
- stripe-replit-sync auto-creates stripe schema tables and syncs data from Stripe API

### Folder Structure
```
lib/core/           - Pure functional kernel (types, parsing, linting, etc.)
lib/core/__tests__/ - Vitest unit tests for kernel
lib/draftStore.ts   - In-memory draft store with 24h TTL (saveDraft, loadDraft, clearDraft)
lib/core/rehydrate.ts - Replays full pipeline from DraftPayload (detect→parse→lint→clean→diff)
lib/entitlements.ts - Plan-based feature gating (isPro, getLimits, getPlanTier)
lib/supabase/client.ts - Browser Supabase client (lazy init, safe when unconfigured)
lib/supabase/server.ts - Server Supabase admin client (service role key)
client/src/lib/auth.tsx - AuthProvider context (session, user, profile, tier, entitlements, checkout, portal, draft persistence)
client/src/components/brutal/  - Neo-brutalist UI components
client/src/components/workspace/ - Workspace UI (Workspace, RulesPanel, RowReviewDrawer, ExportBar, PaywallModal)
client/src/pages/play.tsx       - Guest playground page (Sign In link)
client/src/pages/app-run.tsx    - Logged-in workspace page (auth-gated, shows user email, plan, billing link)
client/src/pages/app-rulesets.tsx - Saved rulesets CRUD page (auth-gated)
client/src/pages/login.tsx      - Magic link login page
server/db.ts                    - Drizzle database connection
server/routes.ts                - API routes (profile, stripe checkout/portal, rulesets CRUD)
server/stripeClient.ts          - Stripe client via Replit connector
server/webhookHandlers.ts       - Stripe webhook processing
shared/schema.ts                - Database schema (profiles + rulesets tables)
scripts/seed-products.ts        - Stripe product/price seeding script
```

### Routes
- `/` - Redirects to /play
- `/play` - Guest playground (Workspace component, 10-row cap)
- `/app/run` - Logged-in workspace (Workspace component, auth-gated, shows plan/billing)
- `/login` - Magic link login (accepts ?draft= query param)
- `/app/rulesets` - Saved rulesets list/editor (auth-gated, CRUD with paywall)

### API Endpoints
- `POST /api/profile/upsert` - Create/update profile
- `GET /api/profile/:id` - Fetch profile
- `GET /api/stripe/publishable-key` - Get Stripe publishable key
- `POST /api/stripe/checkout` - Create Stripe Checkout session
- `POST /api/stripe/portal` - Create Stripe Billing Portal session
- `POST /api/stripe/webhook` - Stripe webhook (raw body, before express.json)
- `POST /api/stripe/subscription-webhook` - Internal subscription status updates
- `GET /api/rulesets/:userId` - List user's rulesets
- `POST /api/rulesets` - Create ruleset (enforces tier limits)
- `PATCH /api/rulesets/:id?userId=` - Update ruleset
- `DELETE /api/rulesets/:id?userId=` - Delete ruleset

### Auth
- **Auth:** Supabase magic link via @supabase/supabase-js
- **Profile:** profiles table (id=supabase uid, email, plan, subscription_status, stripe_customer_id, stripe_subscription_id, current_period_end)
- On successful login, profile auto-upserted via POST /api/profile/upsert
- /app/run auth-gated: redirects to /login if not signed in
- Graceful degradation: app works without Supabase env vars (auth features disabled)
- AuthProvider exposes: user, session, profile, tier, maxRows, maxRulesets, csvExport, startCheckout(), openPortal(), refreshProfile()
- Draft persistence via localStorage (saveDraftToLocal, loadDraftFromLocal)

### Billing
- **Billing:** Stripe subscriptions via stripe-replit-sync connector
- Products created via Stripe API (seed script), synced to local DB via webhooks
- Checkout creates Stripe Customer if needed, links to profile
- Portal accessible from /app/run header for Pro users
- PaywallModal shown for: CSV export, row limit exceeded, ruleset limit exceeded
- No multi-tenancy in MVP

## Recent Changes
- 2026-02-17: Created neo-brutalist design system (tailwind config, globals.css, brutal components)
- 2026-02-17: Created kernel types with Zod schemas
- 2026-02-17: Created detectInput and parseTSV modules with PapaParse
- 2026-02-17: Created vitest tests (13 passing) for parseTSV and detectLikelyUrlColumns
- 2026-02-17: Created parseUrl.ts and lint.ts with 19 additional tests (32 total passing)
- 2026-02-17: Added strictMode, hostDomain, allowedCampaigns to RulesetConfig
- 2026-02-17: Created clean.ts, diff.ts, export.ts with 27 additional tests (59 total passing)
- 2026-02-17: Added ERROR to PatchKindSchema for diff patch classification
- 2026-02-17: Created draftStore.ts (nanoid-based in-memory store with 24h TTL) and rehydrate.ts (full pipeline replay)
- 2026-02-17: Built UI workbench with Workspace, RulesPanel, RowReviewDrawer, ExportBar using brutal components
- 2026-02-17: Added /play and /app/run routes, wired to kernel functions
- 2026-02-17: Added Supabase magic link auth, profiles table, /login page, auth-gated /app/run
- 2026-02-17: Integrated Stripe billing (checkout, portal, webhooks, stripe-replit-sync)
- 2026-02-17: Added rulesets table + CRUD API with entitlement-based limits
- 2026-02-17: Created lib/entitlements.ts (isPro, LIMITS, getPlanTier, feature gating functions)
- 2026-02-17: Built PaywallModal, updated ExportBar with CSV Pro-only gating
- 2026-02-17: Extended AuthContext with profile data, tier, entitlements, startCheckout(), openPortal()
- 2026-02-17: Created /app/rulesets page with full CRUD and paywall gating
- 2026-02-17: Added row caps enforcement in Workspace, save ruleset gating in RulesPanel
- 2026-02-17: Created seed-products.ts script for Stripe product/price creation
- 2026-02-17: Updated row caps (guest: 10→25, free: 50→100, pro: unlimited)
- 2026-02-17: Updated pricing ($29/$290 → $19/$190) in seed script and PaywallModal
- 2026-02-17: Added missingRequiredSeverity config option to RulesetConfig (error/warn, defaults to error)
- 2026-02-17: Fixed REPLIT_DOMAINS guard in Stripe webhook setup (graceful skip when unset)
- 2026-02-17: Added missingRequiredSeverity dropdown to RulesPanel UI
- 2026-02-17: 62 vitest tests passing (2 new for missingRequiredSeverity)

## User Preferences
- Follows build prompts sequentially
- Prefers pure functions in kernel, UI calls kernel
- PapaParse for TSV/CSV parsing (no string splitting)
- GitHub tracking required
