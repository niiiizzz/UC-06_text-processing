# 10 · UI/UX WORKFLOW — Lathe

Visual tokens live in `02_DESIGN.md`. This file defines **pages, flows, states, and copy**.
Scored screens: **Run tools** and **History**. Everything else is Tier 1/2.

---

## 1. Sitemap

```
/                    Landing (public)
/login               Split-screen login / sign-up (public)
/app                 → redirects to /app/tools
/app/tools           Run tools            [scored]
/app/history         History + result     [scored]
/app/billing         Plan & billing (sim) [Tier 2, flagged]
/app/*               404 inside the shell
```
No tenant admin, no user management, no settings page. The account menu holds: name, tenant, role, plan, Sign out.

## 2. Primary flows

### 2.1 Visitor → first run
Landing → "Sign in" → Login → `/app/tools` (plan + quota visible) → choose operation → load fixture or edit rows → Run → result drawer (proof block) → History.

### 2.2 Replay
User re-submits the same batch (same hidden key held for the current draft) → server returns the original run → banner: "Same request detected. Showing the original run — no quota used." Editing the batch generates a **new** key automatically. A "Retry with same key" developer toggle (collapsed under "Advanced") is available for the replay demo and shows the 409 on changed input.

### 2.3 Quota exhausted
Run → 429 → inline banner with reset time; Run button disabled until `resets_at`; History still works.

### 2.4 Suspended
Banner on every app page: "This subscription is suspended. You can still read past results." Run button disabled with tooltip.

### 2.5 Viewer
Run tools is visible but read-only (editor disabled, Run disabled with explanation). History fully usable.

### 2.6 Upgrade (Tier 2)
Basic Operator → "Upgrade to Pro" (Billing or inline CTA on a locked *Process* option) → pledge modal → choose test voucher → settle → receipt → plan chip flips to Pro without a reload.

## 3. Landing page `/`

Structure (asymmetric, editorial):

1. **Top bar:** `lathe` wordmark (left) · Product · Pricing · FAQ · **Sign in** (secondary button) · **Open the workspace** (primary).
2. **Hero** (7/5 split on desktop):
   - Left: eyebrow "Text processing for teams"; headline (serif, `display-xl`): **"Text, turned to spec."**; subcopy (2 lines): "Validate batches of text requests against clear rules. On Pro, transform them and keep the result." Buttons: **Open the workspace** · *See how it works ↓*.
   - Right: **Proof block** that plays once: input rows → validation ticks → `HELLO HELLO / world`. Caption: "Sample output. Rules R1–R4 shown below."
3. **Rules strip** (4 columns, mono): R1 `record_id` ≤ 20, unique · R2 `text` 1–80 ASCII · R3 `repeat` 1–3 · R4 `mode` UPPER | LOWER. Dotted leaders, no icons.
4. **How it works** (three numbered steps arranged as a vertical ruled list with a sticky small proof on the right): 1 Submit a batch (1–10 rows) · 2 Rules are checked, every failure is reported with row and rule · 3 Pro processes and stores the result; replays return the original.
5. **Plans** (two-column comparison, not three cards): Basic vs Pro table — operations, daily runs (3 / 10), shared by your workspace, history. Prices shown as sandbox values: Basic ₹0, Pro ₹499/month, labelled "Sandbox pricing — no real payments."
6. **Built for safe sharing** (short prose + 3 facts): each workspace is isolated; every request is idempotent; daily allowance is shared and enforced atomically. No logos, no testimonials.
7. **FAQ** (accordion, 5 items): What counts as a run? What happens on failure? Can I retry safely? Who can submit? What is sandbox mode?
8. **Footer** on `--night`: wordmark, small print "Sandbox environment. Synthetic data only.", links.

Mobile: stack; proof block moves under the headline; plans become a stacked comparison list.

## 4. Login page `/login` (split screen)

Two halves, like a modern AI-product sign-in. Desktop ≥ 900 px.

```
┌───────────────────────────────┬───────────────────────────────┐
│  LEFT · night panel           │  RIGHT · paper panel          │
│                               │                               │
│  lathe  (wordmark)            │        Welcome back           │
│                               │  ┌─────────────────────────┐  │
│  Text, turned to spec.        │  │ [Sign in | Create acct] │  │
│                               │  │ Email                   │  │
│  Validate batches against     │  │ [________________]      │  │
│  four clear rules. On Pro,    │  │ Password                │  │
│  transform and keep results.  │  │ [________________] show│  │
│                               │  │ [   Continue   ]        │  │
│  ▌HELLO HELLO       len 11    │  │ ─────  Sandbox demo ──  │  │
│  ▌world              len 5    │  │ [Northwind · Operator]  │  │
│                               │  │ [Northwind · Viewer ]   │  │
│  ◦ Isolated workspaces        │  │ [Harbor · Operator  ]   │  │
│  ◦ Safe retries               │  │ [Harbor · Viewer    ]   │  │
│  ◦ Shared daily allowance     │  └─────────────────────────┘  │
│                               │  Sandbox · synthetic data     │
└───────────────────────────────┴───────────────────────────────┘
```

**Left panel (brief):**
- Background `--night` with a faint baseline-grid pattern (4% opacity). Ochre 3 px rule beside the proof block.
- Content: wordmark, headline, 2-line description, small proof block, three short facts (typographic bullets), footer "Sandbox environment".
- No illustrations, no gradient.

**Right panel (auth box):**
- Centered card (max 400 px) on `--paper`, no heavy shadow, 1 px border.
- Tabs: **Sign in** / **Create account**.
- Sign in: email, password (show/hide toggle with label, not emoji), **Continue** button. Inline error: "Email or password is incorrect." Focus returns to the email field on error.
- **Sandbox demo accounts** (dev/sandbox only): four chips that fill the form with the seeded email (password hint shown from env in dev only). One click then **Continue**.
- **Create account** tab: when `FEATURE_SIGNUP_SIM=false` (default) it shows: "This workspace is invite-only in the sandbox. Use a demo account to explore." with the same four chips. Sign-up is excluded from the scored scope; the tab exists for realism and must never create tenants unless Tier 2 is explicitly enabled.
- Footer: "Sandbox · synthetic data only · Terms · Privacy" (placeholders).

**Behaviour:** after login, redirect to `/app/tools`. If already authenticated, `/login` redirects. Session expiry → return to `/login?reason=expired` with a banner "Your session ended. Sign in to continue."

Mobile: left panel collapses to a compact header (wordmark + one-line tagline); auth box fills the screen.

## 5. App shell

- **Sidebar (240 px):** wordmark; nav: *Run tools*, *History*, *Billing* (flagged); bottom: account block (name, role chip, tenant name).
- **Top bar:** page title (serif), **plan chip** (`Basic`/`Pro`), **status chip** (`Active`/`Suspended`), **quota meter** (segments + text).
- Under 1024 px: sidebar becomes a top drawer.
- Global banners area under the top bar for suspended/quota/session states.

## 6. Screen: Run tools `/app/tools` [scored]

Layout: two columns (editor 60% / guide 40%) on desktop.

**Left — Batch editor**
- Operation selector (segmented): **Validate** · **Process** (Process shows a lock + "Pro" when Basic; clicking shows the explanation, and in Tier 2 an Upgrade link).
- Row table (1–10 rows) with columns: `record_id`, `text`, `repeat`, `mode` (dropdown UPPER/LOWER), row delete. "Add row" disabled at 10. Inline per-cell rule hints (R1–R4) shown **live** as the user types (client-side hint only; server is authoritative).
- "Load sample" menu: *Valid fixture*, *Invalid fixture* (helps the demo).
- "Advanced" disclosure: JSON view of the exact request body; request key (read-only, regenerates on edit), copy-as-cURL.
- **Run** button (primary). Disabled with reason tooltip for Viewer, Suspended, exhausted quota. `Ctrl/Cmd+Enter` submits.

**Right — Plan & quota card + rules guide**
- Plan chip, status, `7 of 10 left · resets 00:00 UTC (05:30 IST)`, segmented meter.
- Compact rules R1–R4 reference in mono.
- Last result preview (collapsed proof block) after submit.

**After submit:** a drawer slides from the right with the result:
- Validate: counts (valid / invalid) + issues table (`row`, `field`, `rule`), rows highlighted in the editor.
- Process: **proof block** with rows and summary; "View in History" link.
- Failed: brick banner "This run failed after it was accepted. It used one slot. Nothing was retried." + error code.

States: loading (button spinner + disabled), 400 (field-level errors mapped to cells, plus summary), 403 variants (role/plan/suspended banners), 409 (conflict explanation + "Use a new key"), 429 (banner + disabled until reset), 5xx (retry banner).

## 7. Screen: History `/app/history` [scored]

**Left — Runs list (table):** time (local, relative with tooltip UTC), operation, status chip, rows, valid/invalid, run ID (mono, truncated with copy). Newest first. Row selection updates the right panel and the URL (`?run=<id>`).
**Right — Result viewer:** header with run ID, status, operation, timing; content as in §6 (proof block / issues table / failure banner). `Running` shows a neutral state ("Still running") with a refresh button (polling every 2 s up to 30 s).
Empty: "No runs yet. Submit a batch and it will show up here." with a link to Run tools.
Not found (e.g. another tenant's ID in URL): "That run doesn't exist in this workspace." (uniform with 404.)

## 8. Screen: Billing `/app/billing` [Tier 2, flagged]

- Current plan card: plan chip, status, "period ends", quota reminder: "Upgrading raises today's limit. Runs already used still count."
- Plan comparison (Basic/Pro) with **Upgrade to Pro** (Operators only).
- **Lathe Settle** modal (our own checkout, not a gateway clone):
  1. **Pledge**: summary "Pro · ₹499 / month · sandbox" → **Continue to settle**.
  2. **Settle**: choose a test voucher from a list (BENCH-CLEAR, BENCH-DECLINE, BENCH-HOLD, BENCH-EXPIRE) or type one. Clear "Sandbox — no real payment" label.
  3. **Result**: settled → receipt card (receipt no, signature fingerprint, amount, time) + plan chip updates; declined → reason + try another voucher; held → "Holding… checking again" with progress for ~5 s; expired → start over.
- Receipts list below (table). No invoices PDF, no card form, no real data.

## 9. Components inventory (map to `02_DESIGN.md`)
`Wordmark`, `Button`, `Input`, `Select`, `Segmented`, `Chip`, `QuotaMeter`, `ProofBlock`, `RowEditor`, `IssuesTable`, `RunsTable`, `Drawer`, `Banner`, `Tabs`, `Accordion`, `Tooltip`, `EmptyState`, `Skeleton`, `AccountMenu`, `PlanTable`, `SettleModal`.

## 10. Content design rules
- Say what happened and what to do next, in one or two sentences.
- Use "workspace" for tenant in the UI. Never expose tenant IDs as editable.
- Dates: relative in lists, absolute (local + UTC) in tooltips.
- Numbers: tabular, never abbreviated.
- Avoid exclamation marks; no "Oops".

## 11. Accessibility and responsiveness
- Tab order follows visual order; drawers trap focus and return it on close; `Esc` closes.
- Live regions for submit results and banners.
- Error text tied to fields via `aria-describedby`.
- Tables remain real `<table>`s; on mobile, History becomes a stacked list with a back button on the detail.
- Test at 360, 768, 1024, 1440 px; 200% zoom.

## 12. Frontend implementation notes
- Stack: React + TypeScript + Vite + Tailwind (tokens in `02_DESIGN.md`), React Router, TanStack Query for data fetching.
- API client adds `Idempotency-Key` (UUID per draft; regenerated when the draft changes), `Content-Type: application/json`, `X-Requested-With: lathe`. Cookie-based auth with `credentials: "include"`.
- Never send tenant fields. A unit test asserts request bodies contain only `operation` and `records`.
- Global 401 handler → `/login?reason=expired`.
- Feature flags come from `/auth/me` (`features: {billingSim, signupSim}`), not build-time constants.
- Fonts via `@fontsource/newsreader`, `@fontsource/public-sans`, `@fontsource/ibm-plex-mono`.

## 13. UX acceptance checklist
- [ ] Every status shows text and colour
- [ ] All error codes have specific copy
- [ ] Viewer, Basic, Suspended, Exhausted states reviewed on both screens
- [ ] Landing, login, app pass keyboard-only walkthrough
- [ ] No gradient/glass/emoji icons/fake social proof anywhere
- [ ] Lighthouse accessibility ≥ 95, no console errors
