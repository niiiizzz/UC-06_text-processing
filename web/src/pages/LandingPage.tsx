import React, { useState, useEffect } from "react";
import { BRAND_NAME, BRAND_TAGLINE } from "../brand";

interface LandingPageProps {
  onSignIn: () => void;
  onOpenWorkspace: () => void;
}

const NAV_LINKS = ["Product", "Pricing", "FAQ"];

const RULES = [
  { id: "R1", field: "record_id", desc: "≤ 20 chars · strictly unique · case-sensitive" },
  { id: "R2", field: "text",      desc: "1–80 printable ASCII · trailing whitespace trimmed" },
  { id: "R3", field: "repeat",    desc: "strict int 1–3 · bools and numeric strings rejected" },
  { id: "R4", field: "mode",      desc: "exact enum: UPPER or LOWER" },
];

const STEPS = [
  { n: "01", title: "Submit a batch", body: "Send 1–10 rows. Each carries a unique ID, text body, repeat count, and transformation mode. A single Idempotency-Key covers the whole batch." },
  { n: "02", title: "Rules enforced atomically", body: "Every failure returns the exact row, field, and rule ID. For Process, one invalid row blocks the whole batch — zero quota used." },
  { n: "03", title: "Pro transforms and stores", body: "Validated rows are transformed server-side and persisted in private blob storage. Replay with the same key retrieves the original result free." },
];

const FAQS = [
  { q: "What counts as a run?", a: "Every accepted run — whether it ultimately succeeds or fails during execution — uses one daily quota slot. Requests rejected for validation or authorization errors before acceptance do not count." },
  { q: "What happens when a row is invalid?", a: "Validate runs accept the batch and return all issues with row index, field name, and rule ID. Process runs reject the entire batch if any row is invalid — HTTP 400, no quota used." },
  { q: "Can I retry the same request safely?", a: "Yes. Use the same Idempotency-Key to replay a request — you get back the identical result with zero additional quota cost. Changing any field while reusing the key returns 409." },
  { q: "Who can submit runs?", a: "Users with the Operator role submit runs and manage billing pledges. Viewers have read-only access to the run history and results." },
  { q: "What is sandbox mode?", a: "TextForge runs in a sandboxed Azure Container App environment with synthetic demo accounts. All billing in Tier 2 uses test vouchers (BENCH-CLEAR, BENCH-DECLINE, etc.) — no real payments." },
];

export function LandingPage({ onSignIn, onOpenWorkspace }: LandingPageProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--paper)", color: "var(--ink)", fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* ── TOP BAR ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 20,
        background: scrolled ? "rgba(251,248,242,0.92)" : "var(--card)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--line)",
        transition: "box-shadow 0.2s",
        boxShadow: scrolled ? "0 1px 12px rgba(29,27,23,.06)" : "none",
      }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
            <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, letterSpacing: "-0.02em", color: "var(--ink)" }}>
              {BRAND_NAME.toLowerCase()}
            </span>
            <nav style={{ display: "flex", gap: 28 }}>
              {NAV_LINKS.map(l => (
                <a key={l} href={`#${l.toLowerCase()}`} style={{ fontSize: 13.5, color: "var(--ink-2)", textDecoration: "none", fontWeight: 500, transition: "color 0.15s" }}
                  onMouseEnter={e => (e.target as HTMLElement).style.color = "var(--ink)"}
                  onMouseLeave={e => (e.target as HTMLElement).style.color = "var(--ink-2)"}
                >{l}</a>
              ))}
            </nav>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-md btn-secondary" onClick={onSignIn}>Sign in</button>
            <button className="btn btn-md btn-primary" onClick={onOpenWorkspace}>Open workspace →</button>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section style={{ maxWidth: 1160, margin: "0 auto", padding: "80px 32px 96px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "7fr 5fr", gap: 64, alignItems: "center" }}>
          {/* Left */}
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 12px", background: "var(--paper-2)", border: "1px solid var(--line)", borderRadius: 20, marginBottom: 24 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--verdigris-700)", display: "inline-block" }} />
              <span style={{ fontSize: 11.5, fontFamily: "JetBrains Mono, monospace", color: "var(--ink-2)", fontWeight: 500 }}>Text processing for teams</span>
            </div>

            <h1 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 58, lineHeight: 1.06, letterSpacing: "-0.02em", color: "var(--ink)", margin: "0 0 24px", maxWidth: 560 }}>
              {BRAND_TAGLINE}
            </h1>

            <p style={{ fontSize: 17, color: "var(--ink-2)", lineHeight: 1.65, maxWidth: 480, margin: "0 0 36px" }}>
              Validate batches of short text against four precise rules.
              On Pro, transform them and keep the results in private storage.
            </p>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <button className="btn btn-lg btn-primary" onClick={onOpenWorkspace}>
                Open the workspace →
              </button>
              <a href="#product" style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 40, padding: "0 16px", fontSize: 14, color: "var(--ink-2)", textDecoration: "none", fontWeight: 500, borderRadius: "var(--radius)", border: "1px solid transparent", transition: "all 0.15s" }}
                onMouseEnter={e => { (e.target as HTMLElement).style.color = "var(--ink)"; (e.target as HTMLElement).style.borderColor = "var(--line)"; }}
                onMouseLeave={e => { (e.target as HTMLElement).style.color = "var(--ink-2)"; (e.target as HTMLElement).style.borderColor = "transparent"; }}
              >
                How it works ↓
              </a>
            </div>
          </div>

          {/* Right — Proof block */}
          <div>
            <div style={{ background: "var(--night)", borderRadius: 12, padding: "20px 24px", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 20px 60px -12px rgba(20,32,30,.5)" }}>
              {/* Window chrome */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#A4392B", opacity: 0.7 }} />
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#C28A2C", opacity: 0.7 }} />
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#55703A", opacity: 0.7 }} />
                <span style={{ marginLeft: "auto", fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: "rgba(255,255,255,0.25)" }}>
                  POST /runs · 201 Succeeded
                </span>
              </div>

              {/* Request snippet */}
              <div style={{ marginBottom: 16, fontFamily: "JetBrains Mono, monospace", fontSize: 11.5, color: "rgba(255,255,255,0.4)", lineHeight: 1.7 }}>
                <div><span style={{ color: "var(--ochre-500)" }}>operation</span>: <span style={{ color: "#9ecbff" }}>"process"</span></div>
                <div><span style={{ color: "var(--ochre-500)" }}>records</span>: [</div>
                <div style={{ paddingLeft: 14 }}>&nbsp;&#123; record_id: <span style={{ color: "#9ecbff" }}>"T01"</span>, text: <span style={{ color: "#9ecbff" }}>"Hello"</span>, repeat: 2, mode: <span style={{ color: "#9ecbff" }}>"UPPER"</span> &#125;</div>
                <div style={{ paddingLeft: 14 }}>&nbsp;&#123; record_id: <span style={{ color: "#9ecbff" }}>"T02"</span>, text: <span style={{ color: "#9ecbff" }}>"world"</span>, repeat: 1, mode: <span style={{ color: "#9ecbff" }}>"LOWER"</span> &#125;</div>
                <div>]</div>
              </div>

              <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "14px 0" }} />

              {/* Proof output */}
              <div style={{ marginBottom: 6, fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Proof Output
              </div>
              {[{ out: "HELLO HELLO", len: 11 }, { out: "world", len: 5 }].map(r => (
                <div key={r.out} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0" }}>
                  <span style={{ color: "var(--ochre-500)", fontSize: 14, lineHeight: 1 }}>▌</span>
                  <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 14, fontWeight: 600, color: "white", flex: 1 }}>{r.out}</span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "JetBrains Mono, monospace" }}>len {r.len}</span>
                </div>
              ))}
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: "rgba(255,255,255,0.3)" }}>
                2 rows · 16 characters · Rules R1–R4 active
              </div>
            </div>
            <p style={{ textAlign: "center", marginTop: 10, fontSize: 11.5, color: "var(--ink-3)", fontStyle: "italic" }}>
              Sample output — rules R1–R4 shown below
            </p>
          </div>
        </div>
      </section>

      {/* ── RULES STRIP ── */}
      <section style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: "var(--card)", padding: "32px 0" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 32px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 32 }}>
          {RULES.map(r => (
            <div key={r.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 10, padding: "2px 6px", background: "var(--paper-2)", border: "1px solid var(--line)", borderRadius: 4, fontFamily: "JetBrains Mono, monospace", fontWeight: 700, color: "var(--ink-2)" }}>{r.id}</span>
                <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12.5, fontWeight: 700, color: "var(--verdigris-700)" }}>{r.field}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", fontFamily: "JetBrains Mono, monospace", lineHeight: 1.6 }}>{r.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="product" style={{ maxWidth: 1160, margin: "0 auto", padding: "80px 32px" }}>
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Workflow</div>
          <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 38, fontWeight: 400, color: "var(--ink)", margin: 0 }}>How it works</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 40 }}>
          {STEPS.map(s => (
            <div key={s.n} style={{ borderTop: "2px solid var(--line)", paddingTop: 24 }}>
              <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 36, color: "var(--ochre-500)", opacity: 0.6, marginBottom: 12, lineHeight: 1 }}>{s.n}</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>{s.title}</h3>
              <p style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.7, margin: 0 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ background: "var(--card)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", padding: "80px 0" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 32px" }}>
          <div style={{ marginBottom: 48 }}>
            <div style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Plans</div>
            <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 38, fontWeight: 400, color: "var(--ink)", margin: "0 0 8px" }}>Simple workspace pricing</h2>
            <p style={{ fontSize: 13.5, color: "var(--ink-3)", margin: 0 }}>Sandbox pricing — no real payments in this environment.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, maxWidth: 860 }}>
            {/* Basic */}
            <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "28px 28px 24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, color: "var(--ink)" }}>Basic</div>
                    <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 3 }}>For exploration & testing</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 26, fontWeight: 700, color: "var(--ink)" }}>₹0</div>
                  </div>
                </div>
                {[
                  "Validate operation",
                  "3 daily runs (shared)",
                  "Full issue reporting",
                  "Run history",
                ].map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, fontSize: 13, color: "var(--ink-2)" }}>
                    <span style={{ color: "var(--verdigris-700)", fontSize: 12 }}>✓</span> {f}
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, fontSize: 13, color: "var(--ink-3)", textDecoration: "line-through" }}>
                  <span style={{ color: "var(--line)", fontSize: 12 }}>✕</span> Process operation
                </div>
              </div>
              <div style={{ padding: "0 28px 28px" }}>
                <button className="btn btn-md btn-secondary" onClick={onSignIn} style={{ width: "100%", justifyContent: "center" }}>
                  Sign in with Basic demo
                </button>
              </div>
            </div>

            {/* Pro */}
            <div style={{ background: "var(--night)", border: "1px solid rgba(194,138,44,.2)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "28px 28px 24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, color: "white" }}>Pro</span>
                      <span style={{ fontSize: 10, padding: "2px 7px", background: "var(--ochre-500)", color: "white", borderRadius: 4, fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>Standard</span>
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>For teams & production</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 26, fontWeight: 700, color: "white" }}>₹499</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>/month</div>
                  </div>
                </div>
                {[
                  "Validate + Process",
                  "10 daily runs (shared)",
                  "Private blob result storage",
                  "Idempotent replays free",
                  "Full issue reporting",
                ].map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
                    <span style={{ color: "var(--ochre-500)", fontSize: 12 }}>✓</span> {f}
                  </div>
                ))}
              </div>
              <div style={{ padding: "0 28px 28px" }}>
                <button className="btn btn-md btn-primary" onClick={onSignIn} style={{ width: "100%", justifyContent: "center" }}>
                  Sign in with Pro demo
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── GUARANTEES ── */}
      <section style={{ maxWidth: 1160, margin: "0 auto", padding: "80px 32px" }}>
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Guarantees</div>
          <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 38, fontWeight: 400, color: "var(--ink)", margin: 0 }}>Built for safe sharing</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {[
            { label: "ISOLATED WORKSPACES", body: "Tenant identity is derived exclusively from verified session tokens. Any attempt to override tenant in request data returns 400." },
            { label: "SAFE RETRIES", body: "Every request carries an Idempotency-Key. Identical keys return the original result without consuming a quota slot." },
            { label: "ATOMIC QUOTA", body: "A single conditional SQL transaction reserves the daily slot. Zero overages are possible even under high concurrency." },
          ].map(g => (
            <div key={g.label} style={{ padding: "24px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10 }}>
              <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, fontWeight: 700, color: "var(--verdigris-700)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
                ◦ {g.label}
              </div>
              <p style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.65, margin: 0 }}>{g.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ borderTop: "1px solid var(--line)", background: "var(--card)", padding: "80px 0" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 32px" }}>
          <div style={{ marginBottom: 40 }}>
            <div style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>FAQ</div>
            <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 38, fontWeight: 400, color: "var(--ink)", margin: 0 }}>Common questions</h2>
          </div>

          <div style={{ borderTop: "1px solid var(--line)" }}>
            {FAQS.map((faq, idx) => (
              <div key={idx} style={{ borderBottom: "1px solid var(--line)" }}>
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 0", background: "none", border: "none", cursor: "pointer", textAlign: "left", gap: 20 }}
                >
                  <span style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)", lineHeight: 1.4 }}>{faq.q}</span>
                  <span style={{ fontSize: 20, color: "var(--ink-3)", lineHeight: 1, flexShrink: 0, fontFamily: "JetBrains Mono, monospace", transform: openFaq === idx ? "rotate(45deg)" : "none", transition: "transform 0.2s" }}>+</span>
                </button>
                {openFaq === idx && (
                  <p style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.7, margin: "0 0 20px", animation: "slideInUp 0.2s ease-out" }}>{faq.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: "var(--night)", borderTop: "1px solid rgba(255,255,255,0.05)", padding: "40px 0" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 32px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
          <div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: "white", marginBottom: 4 }}>{BRAND_NAME.toLowerCase()}</div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.35)", fontFamily: "JetBrains Mono, monospace" }}>Sandbox environment · Synthetic data only · UC-06</div>
          </div>
          <div style={{ display: "flex", gap: 24, fontSize: 11.5, fontFamily: "JetBrains Mono, monospace", color: "rgba(255,255,255,0.3)" }}>
            <span>Azure Container Apps</span>
            <span>REST API v1</span>
            <span>Advantix × Rajalakshmi</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
