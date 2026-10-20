# 02 · DESIGN — Lathe Visual System

> Goal: Lathe must look like a product a small, opinionated team shipped, not a template. Warm, editorial, precise. Think *print shop meets lab instrument*.

---

## 1. Design principles

1. **Paper, not glass.** Warm off-white surfaces, hairline borders, almost no shadow. No glassmorphism, no blur.
2. **Ink is the hero.** Near-black text, large serif headlines, generous whitespace.
3. **One accent, used sparingly.** Verdigris for actions; ochre only for highlights and quota warnings.
4. **Data is typographic.** IDs and outputs in monospace, numbers in tabular figures, results shown like a printed proof.
5. **Honest content.** No fake customer logos, fake metrics, or stock testimonials. Use real product facts (plans, limits, sample output).
6. **Asymmetry over symmetry.** Avoid centered everything and identical 3-card icon grids.

## 2. Anti-"vibe-coded" rules (checklist)

- ❌ Purple/indigo/blue-to-pink gradients, neon glows, glass cards
- ❌ Emoji as icons, sparkle icons, "AI-powered" badges
- ❌ Three identical feature cards with icon + title + 2 lines
- ❌ Inter-on-white-with-gray-cards default look; `rounded-2xl` everywhere
- ❌ Lorem ipsum, "Acme Inc", fake logos, fake "10,000+ users"
- ❌ Centered hero with gradient headline and two buttons stacked on mobile as the only idea
- ✅ Serif display type, mono for data, flat surfaces, 6 px radius, 1 px hairlines
- ✅ Specific microcopy ("3 of 10 runs left today · resets 05:30 IST")
- ✅ A real product artifact in the hero (a "proof" of HELLO HELLO output)

## 3. Colour palette — "Bench"

All values are tokens. Never hard-code hex in components.

### 3.1 Core

| Token | Hex | Use |
|---|---|---|
| `--paper` | `#F4EFE6` | App/page background |
| `--paper-2` | `#EAE3D6` | Sunken areas, table header, code blocks |
| `--card` | `#FBF8F2` | Raised surfaces, inputs |
| `--ink` | `#1D1B17` | Primary text |
| `--ink-2` | `#4A463E` | Secondary text |
| `--ink-3` | `#7A7468` | Tertiary/placeholder (large text only) |
| `--line` | `#D8CFBF` | Hairlines and borders |
| `--night` | `#14201E` | Login left panel, footer, dark sections |
| `--night-2` | `#1C2C29` | Dark surface variation |

### 3.2 Accent and semantics

| Token | Hex | Use |
|---|---|---|
| `--verdigris-700` | `#1F5E57` | Primary buttons, links, focus ring |
| `--verdigris-800` | `#174943` | Primary hover/pressed |
| `--verdigris-100` | `#DCE8E4` | Primary tint backgrounds, selected rows |
| `--ochre-500` | `#C28A2C` | Highlights, "Pro" mark, rules on dark |
| `--ochre-100` | `#F3E4C4` | Warning backgrounds (low quota) |
| `--moss-600` | `#55703A` | Succeeded |
| `--moss-100` | `#E0E8D2` | Succeeded tint |
| `--brick-600` | `#A4392B` | Failed, destructive, 4xx errors |
| `--brick-100` | `#F2D9D3` | Failed tint |
| `--slate-500` | `#5B6B73` | Running / neutral info |
| `--slate-100` | `#DDE4E7` | Running tint |

> Verify every text/background pair with a contrast checker (target ≥ 4.5:1 body, ≥ 3:1 large text and UI borders). `--ink-3` is for large/placeholder text only.

### 3.3 CSS variables

```css
:root {
  --paper:#F4EFE6; --paper-2:#EAE3D6; --card:#FBF8F2;
  --ink:#1D1B17; --ink-2:#4A463E; --ink-3:#7A7468; --line:#D8CFBF;
  --night:#14201E; --night-2:#1C2C29;
  --verdigris-700:#1F5E57; --verdigris-800:#174943; --verdigris-100:#DCE8E4;
  --ochre-500:#C28A2C; --ochre-100:#F3E4C4;
  --moss-600:#55703A; --moss-100:#E0E8D2;
  --brick-600:#A4392B; --brick-100:#F2D9D3;
  --slate-500:#5B6B73; --slate-100:#DDE4E7;
  --radius:6px; --radius-lg:10px;
  --focus:0 0 0 2px var(--paper), 0 0 0 4px var(--verdigris-700);
}
```

### 3.4 Tailwind mapping (`web/tailwind.config.ts`)

```ts
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: { DEFAULT: "var(--paper)", 2: "var(--paper-2)" },
        card: "var(--card)",
        ink: { DEFAULT: "var(--ink)", 2: "var(--ink-2)", 3: "var(--ink-3)" },
        line: "var(--line)",
        night: { DEFAULT: "var(--night)", 2: "var(--night-2)" },
        verdigris: { 100: "var(--verdigris-100)", 700: "var(--verdigris-700)", 800: "var(--verdigris-800)" },
        ochre: { 100: "var(--ochre-100)", 500: "var(--ochre-500)" },
        moss: { 100: "var(--moss-100)", 600: "var(--moss-600)" },
        brick: { 100: "var(--brick-100)", 600: "var(--brick-600)" },
        slate: { 100: "var(--slate-100)", 500: "var(--slate-500)" },
      },
      fontFamily: {
        display: ["Newsreader", "Georgia", "serif"],
        sans: ["Public Sans", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      borderRadius: { DEFAULT: "6px", lg: "10px" },
      boxShadow: { raised: "0 1px 0 var(--line)", pop: "0 8px 24px -12px rgba(29,27,23,.25)" },
    },
  },
};
```

## 4. Typography

| Role | Font | Weight | Notes |
|---|---|---|---|
| Display / headlines | **Newsreader** | 500–600 | Optical size on; tight tracking (-0.01em) |
| UI / body | **Public Sans** | 400, 500, 600 | 15–16 px base |
| Data / IDs / code | **IBM Plex Mono** | 400, 500 | Tabular figures, `font-variant-numeric: tabular-nums` |

Self-host via `@fontsource/*` packages (no external CDN calls; the container serves everything).

| Token | Size / line height | Use |
|---|---|---|
| `display-xl` | 64 / 68 (desktop), 40 / 44 (mobile) | Landing hero |
| `display-lg` | 44 / 48 | Section titles |
| `h1` | 30 / 36 (serif) | Page titles |
| `h2` | 22 / 28 (serif) | Panel titles |
| `body` | 15 / 24 | Default |
| `small` | 13 / 20 | Meta, table cells |
| `mono` | 13 / 20 | IDs, outputs |
| `eyebrow` | 12 / 16, uppercase, +0.08em tracking | Section labels |

## 5. Layout and spacing

- 4 px base grid: 4, 8, 12, 16, 24, 32, 48, 64, 96.
- Content max width 1160 px (landing), app content 1280 px with 240 px sidebar.
- Landing uses a 12-column grid with deliberate asymmetry (7/5 splits).
- Radius 6 px for controls, 10 px for large panels. No fully rounded pills except status chips.
- Elevation: borders first (`1px solid var(--line)`), shadow only on popovers/modals.

## 6. Components

### Buttons
| Variant | Style |
|---|---|
| Primary | bg `verdigris-700`, text `card`, hover `verdigris-800`, 40 px height, 6 px radius |
| Secondary | bg `card`, border `line`, text `ink`, hover bg `paper-2` |
| Ghost | no border, text `ink-2`, hover `paper-2` |
| Destructive | bg `brick-600`, text `card` (used only in cleanup-like confirmations) |

Focus: `--focus` ring on every interactive element. Disabled: 50% opacity with `cursor-not-allowed` **and** an explanatory tooltip (e.g. "Viewers can't submit runs").

### Inputs
Card background, 1 px `line` border, 6 px radius, label above (never placeholder-only), inline error in `brick-600` with an icon and text.

### Status chips
`Running` (slate), `Succeeded` (moss), `Failed` (brick), `Active` (moss), `Suspended` (brick), `Basic` (paper-2 with ink), `Pro` (ochre-100 with ochre-500 dot and ink text). Chips always carry text, never colour alone.

### Quota meter
Segmented bar, one segment per allowed run (3 for Basic, 10 for Pro). Filled segments `ink`, remaining `line`. At ≤ 1 left, remaining segments tint `ochre-500`. Text: `7 of 10 left · resets 00:00 UTC`.

### Proof block (signature element)
A "printed proof" card used in the hero and the result viewer.

```
┌───────────────────────────────────────────┐
│ T01   HELLO HELLO                  len 11 │
│ T02   world                         len 5 │
│ ───────────────────────────────────────── │
│ input_rows 2        output_characters 16  │
└───────────────────────────────────────────┘
```
Mono type on `paper-2`, left ruled with a 3 px `ochre-500` bar, dotted leaders, tabular numerals.

### Tables
Header on `paper-2`, 1 px row separators, zebra off, row hover `verdigris-100` at 40%, selected row `verdigris-100` with a 3 px left bar. IDs in mono.

### Toasts / banners
Inline banners preferred over toasts. Quota-exhausted, suspended, and forbidden states are banners with an explanation and next step.

## 7. Iconography
Lucide icons, stroke 1.5, 18 px, `ink-2`. Max one icon per list item. No icon-in-a-circle decorations. Where possible, use typographic marks (→, ·, §).

## 8. Imagery and illustration
- No stock photos or AI-generated gradients.
- Hero artefact: the live-looking **proof block** that types out `Hello` → `HELLO HELLO` (client-side only, deterministic, labelled "Sample output").
- Decorative: a subtle paper grain (2% noise SVG) on `--paper`, and ruled "baseline grid" lines in the hero background at 4% opacity.
- Brand mark: lowercase wordmark `lathe` in Newsreader 600 with a small ochre turned-groove glyph (a stylised spiral of three concentric arcs) as an inline SVG. Keep it simple enough to draw in 20 lines.

## 9. Motion
- 150–200 ms ease-out for hovers and menu opens; 240 ms for drawers.
- Result "proof" reveals row by row (40 ms stagger), once.
- Respect `prefers-reduced-motion`: disable all non-essential motion.

## 10. Voice and microcopy
Plain, specific, slightly dry. Examples:

| Situation | Copy |
|---|---|
| Quota low | "1 run left today. It resets at 00:00 UTC (05:30 IST)." |
| Quota exhausted (429) | "Today's runs are used up for your workspace. Replaying an earlier request still works." |
| Viewer attempts submit | "Viewers can read results but can't start runs." |
| Basic selects process | "Processing is a Pro feature. Validation is included on every plan." |
| Suspended | "This subscription is suspended. You can still read past results." |
| Failed run | "This run failed after it was accepted. It used one slot. Nothing was retried." |
| Empty history | "No runs yet. Submit a batch and it will show up here." |

## 11. Accessibility
- AA contrast verified for all token pairs used.
- Visible focus on all controls; skip-to-content link.
- Form errors announced with `aria-live="polite"`; tables have proper headers; chips include text.
- Keyboard: `Ctrl/Cmd+Enter` submits a run; `Esc` closes drawers.
- Target size ≥ 40 px for primary actions.

## 12. Responsive behaviour
Breakpoints: 480 / 768 / 1024 / 1280. Sidebar collapses to a top bar under 1024. Login split collapses to a single column under 900 px (brand panel becomes a compact header).

## 13. Design QA checklist
- [ ] Only tokens used (grep for `#` in components returns nothing)
- [ ] No gradient, glass, or neon anywhere
- [ ] Every status has text + colour
- [ ] Mono used for all IDs/outputs
- [ ] Empty/loading/error states exist for each screen
- [ ] Lighthouse accessibility ≥ 95
