import React, { useState } from "react";
import { BRAND_NAME, BRAND_TAGLINE } from "../brand";

interface LandingPageProps {
  onSignIn: () => void;
  onOpenWorkspace: () => void;
}

export function LandingPage({ onSignIn, onOpenWorkspace }: LandingPageProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  return (
    <div className="min-h-screen bg-paper text-ink font-sans flex flex-col selection:bg-verdigris-100">
      {/* 1. Top Bar */}
      <header className="border-b border-line bg-card/80 backdrop-blur-sm sticky top-0 z-20 px-6 sm:px-12 py-3.5 flex justify-between items-center max-w-[1160px] mx-auto w-full">
        <div className="flex items-center space-x-8">
          <span className="font-serif text-2xl font-bold tracking-tight text-ink">
            {BRAND_NAME.toLowerCase()}
          </span>
          <nav className="hidden md:flex space-x-6 text-sm text-ink-2">
            <a href="#how-it-works" className="hover:text-ink transition-colors">
              Product
            </a>
            <a href="#pricing" className="hover:text-ink transition-colors">
              Pricing
            </a>
            <a href="#faq" className="hover:text-ink transition-colors">
              FAQ
            </a>
          </nav>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onSignIn}
            className="px-4 py-1.5 text-sm font-medium border border-line bg-card hover:bg-paper-2 rounded transition-colors text-ink shadow-sm"
          >
            Sign in
          </button>
          <button
            onClick={onOpenWorkspace}
            className="px-4 py-1.5 text-sm font-medium bg-verdigris-700 hover:bg-verdigris-800 text-card rounded transition-colors shadow-sm"
          >
            Open the workspace
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-[1160px] mx-auto w-full px-6 sm:px-12 py-12 md:py-16 space-y-24">
        {/* 2. Hero (7/5 split) */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center pt-4">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-block px-2.5 py-0.5 text-xs font-mono font-medium tracking-wider uppercase bg-paper-2 border border-line text-ink-2 rounded">
              Text processing for teams
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-ink leading-[1.08]">
              {BRAND_TAGLINE}
            </h1>
            <p className="text-ink-2 text-lg sm:text-xl font-normal leading-relaxed max-w-xl">
              Validate batches of short text requests against clear rules. On Pro, transform them
              and keep the result.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={onOpenWorkspace}
                className="px-5 py-2.5 text-base font-medium bg-verdigris-700 hover:bg-verdigris-800 text-card rounded transition-colors shadow-sm"
              >
                Open the workspace
              </button>
              <a
                href="#how-it-works"
                className="px-4 py-2.5 text-base font-medium text-ink-2 hover:text-ink hover:underline decoration-line underline-offset-4"
              >
                See how it works ↓
              </a>
            </div>
          </div>

          {/* Right: Proof block */}
          <div className="lg:col-span-5">
            <div className="border border-line bg-card rounded shadow-raised p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-line pb-3">
                <span className="font-mono text-xs uppercase tracking-wider text-ink-3">
                  Sample Proof Block · Process
                </span>
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-mono font-medium bg-moss-100 text-moss-600 rounded">
                  201 Succeeded
                </span>
              </div>

              {/* Monospace output lines */}
              <div className="space-y-2 font-mono text-sm bg-paper-2 p-4 rounded border border-line">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <span className="text-ochre-500 font-bold">▌</span>
                    <span className="text-ink font-semibold">HELLO HELLO</span>
                  </div>
                  <span className="text-ink-3 text-xs">len 11</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <span className="text-ochre-500 font-bold">▌</span>
                    <span className="text-ink font-semibold">world</span>
                  </div>
                  <span className="text-ink-3 text-xs">len 5</span>
                </div>
              </div>

              <div className="text-xs text-ink-3 flex justify-between items-center pt-1 font-mono">
                <span>Summary: 2 rows · 16 characters</span>
                <span className="text-ink-2">Rules R1–R4 active</span>
              </div>
              <p className="text-xs text-ink-3 italic border-t border-line/60 pt-2">
                Sample output. Rules R1–R4 shown below.
              </p>
            </div>
          </div>
        </section>

        {/* 3. Rules Strip (4 columns, mono) */}
        <section className="border-t border-b border-line py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 font-mono text-xs">
            <div className="space-y-1">
              <div className="text-ink font-bold">R1 · RECORD_ID</div>
              <div className="text-ink-2">Length ≤ 20, unique per batch. Later duplicates fail.</div>
            </div>
            <div className="space-y-1">
              <div className="text-ink font-bold">R2 · TEXT</div>
              <div className="text-ink-2">1–80 ASCII characters. Trailing whitespace trimmed.</div>
            </div>
            <div className="space-y-1">
              <div className="text-ink font-bold">R3 · REPEAT</div>
              <div className="text-ink-2">Strict integer 1–3. Bools & numeric strings rejected.</div>
            </div>
            <div className="space-y-1">
              <div className="text-ink font-bold">R4 · MODE</div>
              <div className="text-ink-2">Exact enum: UPPER or LOWER. Case conversions applied.</div>
            </div>
          </div>
        </section>

        {/* 4. How it works (Numbered steps list) */}
        <section id="how-it-works" className="space-y-8">
          <div className="space-y-2">
            <span className="text-xs font-mono tracking-wider uppercase text-ink-3">Workflow</span>
            <h2 className="font-serif text-3xl font-normal text-ink">How it works</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-line pt-6">
            <div className="space-y-3">
              <div className="font-serif text-2xl text-ochre-500 font-medium">01</div>
              <h3 className="text-base font-semibold text-ink">Submit a batch</h3>
              <p className="text-sm text-ink-2 leading-relaxed">
                Provide 1 to 10 rows in a single batch. Each row specifies an ID, text, repeat count,
                and transformation mode.
              </p>
            </div>
            <div className="space-y-3">
              <div className="font-serif text-2xl text-ochre-500 font-medium">02</div>
              <h3 className="text-base font-semibold text-ink">Rules checked atomically</h3>
              <p className="text-sm text-ink-2 leading-relaxed">
                Every failure is reported with its row index, target field, and violated rule ID. If
                any row fails on Process, none are accepted.
              </p>
            </div>
            <div className="space-y-3">
              <div className="font-serif text-2xl text-ochre-500 font-medium">03</div>
              <h3 className="text-base font-semibold text-ink">Pro transforms and stores</h3>
              <p className="text-sm text-ink-2 leading-relaxed">
                Pro runs transform rows and store results in durable storage. Replay with the same key
                returns the original run without debiting quota.
              </p>
            </div>
          </div>
        </section>

        {/* 5. Plans (Two-column comparison) */}
        <section id="pricing" className="space-y-8">
          <div className="space-y-2">
            <span className="text-xs font-mono tracking-wider uppercase text-ink-3">Plans</span>
            <h2 className="font-serif text-3xl font-normal text-ink">Simple workspace pricing</h2>
            <p className="text-sm text-ink-2">Sandbox pricing — no real payments required.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border border-line bg-card rounded shadow-raised p-6 md:p-8">
            {/* Basic Plan */}
            <div className="space-y-6 md:pr-8 md:border-r border-line flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex justify-between items-baseline">
                  <h3 className="font-serif text-2xl text-ink font-semibold">Basic</h3>
                  <div className="text-2xl font-mono text-ink font-semibold">₹0</div>
                </div>
                <p className="text-sm text-ink-2">
                  For exploratory batch checks and testing rule violations.
                </p>
                <ul className="space-y-2.5 text-sm text-ink-2 font-mono pt-2">
                  <li className="flex items-center space-x-2">
                    <span className="text-verdigris-700">✓</span>
                    <span>Validate operation</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="text-verdigris-700">✓</span>
                    <span>3 runs per day allowance</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="text-verdigris-700">✓</span>
                    <span>Full history & issue reporting</span>
                  </li>
                  <li className="flex items-center space-x-2 text-ink-3">
                    <span>✕</span>
                    <span>Process & persist (Pro only)</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={onSignIn}
                className="w-full py-2 px-4 text-sm font-medium border border-line bg-card hover:bg-paper-2 rounded transition-colors text-ink"
              >
                Sign in with Basic demo
              </button>
            </div>

            {/* Pro Plan */}
            <div className="space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex justify-between items-baseline">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-serif text-2xl text-ink font-semibold">Pro</h3>
                    <span className="px-2 py-0.5 text-xs font-mono font-medium bg-ochre-100 text-ochre-500 rounded">
                      Standard
                    </span>
                  </div>
                  <div className="text-2xl font-mono text-ink font-semibold">
                    ₹499<span className="text-sm font-normal text-ink-3">/mo</span>
                  </div>
                </div>
                <p className="text-sm text-ink-2">
                  For teams needing automated batch transformations and persistent artifact results.
                </p>
                <ul className="space-y-2.5 text-sm text-ink-2 font-mono pt-2">
                  <li className="flex items-center space-x-2">
                    <span className="text-verdigris-700">✓</span>
                    <span>Validate AND Process operations</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="text-verdigris-700">✓</span>
                    <span>10 runs per day allowance</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="text-verdigris-700">✓</span>
                    <span>Private blob result persistence</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="text-verdigris-700">✓</span>
                    <span>Zero-cost idempotent replays</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={onSignIn}
                className="w-full py-2 px-4 text-sm font-medium bg-verdigris-700 hover:bg-verdigris-800 text-card rounded transition-colors"
              >
                Sign in with Pro demo
              </button>
            </div>
          </div>
        </section>

        {/* 6. Built for Safe Sharing (Facts) */}
        <section className="border-t border-line pt-8 space-y-6">
          <div className="space-y-2">
            <span className="text-xs font-mono tracking-wider uppercase text-ink-3">Guarantees</span>
            <h2 className="font-serif text-3xl font-normal text-ink">Built for safe sharing</h2>
            <p className="text-sm text-ink-2 max-w-2xl leading-relaxed">
              Every request is authenticated against a verified session. We enforce hard boundaries
              across operations, tenants, and state.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 font-mono text-sm pt-4">
            <div className="p-4 bg-card border border-line rounded space-y-2">
              <div className="text-verdigris-700 font-bold">◦ ISOLATED WORKSPACES</div>
              <p className="text-xs text-ink-2 font-sans">
                Tenant identity comes strictly from verified session tokens. Client overrides return 400.
              </p>
            </div>
            <div className="p-4 bg-card border border-line rounded space-y-2">
              <div className="text-verdigris-700 font-bold">◦ SAFE RETRIES</div>
              <p className="text-xs text-ink-2 font-sans">
                Idempotency keys prevent duplicate runs and guarantee consistent replays without extra cost.
              </p>
            </div>
            <div className="p-4 bg-card border border-line rounded space-y-2">
              <div className="text-verdigris-700 font-bold">◦ SHARED DAILY ALLOWANCE</div>
              <p className="text-xs text-ink-2 font-sans">
                Atomic reservation in a single conditional SQL transaction prevents concurrency overages.
              </p>
            </div>
          </div>
        </section>

        {/* 7. FAQ Accordion */}
        <section id="faq" className="space-y-6 border-t border-line pt-8">
          <div className="space-y-2">
            <span className="text-xs font-mono tracking-wider uppercase text-ink-3">FAQ</span>
            <h2 className="font-serif text-3xl font-normal text-ink">Frequently asked questions</h2>
          </div>

          <div className="divide-y divide-line border-t border-b border-line">
            {[
              {
                q: "What counts as a run?",
                a: "Every accepted run (status 201), whether it ultimately succeeds or encounters execution failure, uses one quota slot. Requests rejected upfront for validation or authorization errors do not debit your allowance.",
              },
              {
                q: "What happens on validation failure?",
                a: "If submitting a Validate run, the batch is accepted and returns the exact row and field-level rule issues. If submitting a Process run with any invalid row, the entire batch is rejected with HTTP 400 and zero quota is debited.",
              },
              {
                q: "Can I retry safely?",
                a: "Yes. Every request accepts an Idempotency-Key. Repeating a request with the exact same payload returns the existing run result without consuming an additional quota slot.",
              },
              {
                q: "Who can submit runs?",
                a: "Users with the Operator role can submit runs and settle pledges. Users with the Viewer role have read-only access to past runs and results.",
              },
              {
                q: "What is sandbox mode?",
                a: "TextForge runs on Azure Container Apps with synthetic demo accounts. All payments and subscriptions in Tier 2 use test vouchers like BENCH-CLEAR.",
              },
            ].map((faq, idx) => (
              <div key={idx} className="py-4">
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full flex justify-between items-center text-left text-base font-medium text-ink focus:outline-none"
                >
                  <span>{faq.q}</span>
                  <span className="font-mono text-ink-3 text-lg">{openFaq === idx ? "−" : "+"}</span>
                </button>
                {openFaq === idx && (
                  <p className="mt-3 text-sm text-ink-2 leading-relaxed max-w-3xl">{faq.a}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* 8. Footer on --night */}
      <footer className="bg-night text-paper/80 py-12 px-6 sm:px-12 border-t border-line">
        <div className="max-w-[1160px] mx-auto w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div className="space-y-1">
            <span className="font-serif text-2xl font-bold text-paper">
              {BRAND_NAME.toLowerCase()}
            </span>
            <p className="text-xs text-paper/60 font-mono">
              Sandbox environment. Synthetic data only. Advantix × Rajalakshmi.
            </p>
          </div>
          <div className="flex space-x-6 text-xs font-mono text-paper/60">
            <span>Lathe Spec UC-06</span>
            <span>Azure Container Apps</span>
            <span>REST API v1</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
