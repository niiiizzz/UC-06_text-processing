import React, { useState, useEffect, useCallback } from "react";
import { BRAND_NAME } from "./brand";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { UpgradeModal } from "./components/UpgradeModal";
import {
  fetchSubscription,
  fetchRuns,
  fetchRunResult,
  submitRun,
  SubscriptionInfo,
  RunSummary,
  RunResultResponse,
  RecordItem,
} from "./lib/api";

const SAMPLE_VALID_ROWS: RecordItem[] = [
  { record_id: "T01", text: "Hello", repeat: 2, mode: "UPPER" },
  { record_id: "T02", text: "world", repeat: 1, mode: "LOWER" },
];

const SAMPLE_INVALID_ROWS: RecordItem[] = [
  { record_id: "T01", text: "Hello", repeat: 2, mode: "UPPER" },
  { record_id: "T01", text: "Duplicate ID", repeat: 1, mode: "LOWER" },
  { record_id: "T03", text: "", repeat: 1, mode: "UPPER" },
  { record_id: "T04", text: "Valid text", repeat: 5, mode: "UPPER" },
];

/* ────────────────────────────────────────────
   SVG ICONS (inline, no emoji, AA-safe)
──────────────────────────────────────────── */
const Icons = {
  Tools: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2 8h12M8 2v12"/>
      <rect x="5" y="5" width="6" height="6" rx="1"/>
    </svg>
  ),
  History: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="8" r="6"/>
      <path d="M8 5v3.5l2 1.5"/>
    </svg>
  ),
  Billing: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="2" y="4" width="12" height="9" rx="1.5"/>
      <path d="M2 7h12"/>
    </svg>
  ),
  Play: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M3 2.5l8 4.5-8 4.5V2.5z"/>
    </svg>
  ),
  Plus: () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 1v10M1 6h10"/>
    </svg>
  ),
  X: () => (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M1 1l8 8M9 1L1 9"/>
    </svg>
  ),
  Copy: () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="4" y="4" width="7" height="7" rx="1"/>
      <path d="M2 8V2a1 1 0 0 1 1-1h6"/>
    </svg>
  ),
  Check: () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M2 6l3 3 5-5"/>
    </svg>
  ),
  Warning: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M7 1L1 12h12L7 1zM7 6v3M7 10.5v.5"/>
    </svg>
  ),
  Info: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="7" cy="7" r="6"/>
      <path d="M7 6v4M7 4.5v.5"/>
    </svg>
  ),
  Logout: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M9 3l4 4-4 4M13 7H5M5 1H2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>
    </svg>
  ),
  Spinner: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: "spin 0.8s linear infinite" }}>
      <path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.9 2.9l1.4 1.4M9.7 9.7l1.4 1.4M2.9 11.1l1.4-1.4M9.7 4.3l1.4-1.4"/>
    </svg>
  ),
};

/* ────────────────────────────────────────────
   SMALL REUSABLE ATOMS
──────────────────────────────────────────── */
function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    Succeeded: "chip chip-moss",
    Failed:    "chip chip-brick",
    Running:   "chip chip-slate",
    Active:    "chip chip-moss",
    Suspended: "chip chip-brick",
  };
  const dot: Record<string, string> = {
    Succeeded: "#55703A", Failed: "#A4392B", Running: "#5B6B73",
    Active: "#55703A", Suspended: "#A4392B",
  };
  return (
    <span className={map[status] ?? "chip chip-slate"}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot[status] ?? "#5B6B73", display: "inline-block" }} />
      {status}
    </span>
  );
}

function PlanChip({ plan }: { plan: string }) {
  if (plan === "Pro") {
    return <span className="chip chip-ochre">✦ Pro</span>;
  }
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 20, fontSize: 11.5, fontWeight: 600, background: "var(--paper-2)", color: "var(--ink-2)", border: "1px solid var(--line)" }}>Basic</span>;
}

function QuotaMeter({ used, limit }: { used: number; limit: number }) {
  const remaining = Math.max(0, limit - used);
  const low = remaining <= 1;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div className="quota-bar">
        {Array.from({ length: limit }).map((_, i) => (
          <div key={i} className="quota-seg" style={{
            background: i < used
              ? (low ? "var(--brick-600)" : "var(--ink)")
              : (low ? "var(--ochre-100)" : "var(--line)"),
            opacity: i < used ? 0.85 : 1,
          }} />
        ))}
      </div>
      <span style={{ fontSize: 12, color: low ? "var(--brick-600)" : "var(--ink-2)", fontFamily: "JetBrains Mono, monospace", fontWeight: 500 }}>
        {remaining}/{limit} left
      </span>
    </div>
  );
}

function Banner({ type, children, onClose }: { type: "error" | "warning" | "info" | "success"; children: React.ReactNode; onClose?: () => void }) {
  const iconMap = { error: <Icons.Warning />, warning: <Icons.Warning />, info: <Icons.Info />, success: <Icons.Check /> };
  return (
    <div className={`banner banner-${type}`}>
      {iconMap[type]}
      <span style={{ flex: 1, fontSize: 13 }}>{children}</span>
      {onClose && (
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.6, padding: "0 2px" }}>
          <Icons.X />
        </button>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────
   SIDEBAR
──────────────────────────────────────────── */
function Sidebar({
  tab, setTab, sub, onSignOut, billingEnabled
}: {
  tab: string;
  setTab: (t: "tools" | "history" | "billing") => void;
  sub: SubscriptionInfo | null;
  onSignOut: () => void;
  billingEnabled: boolean;
}) {
  return (
    <aside style={{
      width: 232,
      minHeight: "100vh",
      background: "var(--night)",
      display: "flex",
      flexDirection: "column",
      padding: "0",
      flexShrink: 0,
      borderRight: "1px solid rgba(255,255,255,0.06)",
    }}>
      {/* Logo */}
      <div style={{ padding: "22px 20px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, color: "white", letterSpacing: "-0.02em", lineHeight: 1 }}>
          {BRAND_NAME.toLowerCase()}
        </div>
        <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.38)", fontFamily: "JetBrains Mono, monospace", marginTop: 3, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Text Processing
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: "12px 10px", flex: 1 }}>
        <div style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", padding: "6px 10px 8px", marginBottom: 2 }}>
          Workspace
        </div>
        <button className={`nav-item ${tab === "tools" ? "active" : ""}`} onClick={() => setTab("tools")}>
          <Icons.Tools /> Run tools
        </button>
        <button className={`nav-item ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>
          <Icons.History /> History
        </button>
        {billingEnabled && (
          <button className={`nav-item ${tab === "billing" ? "active" : ""}`} onClick={() => setTab("billing")}>
            <Icons.Billing />
            Billing
            <span style={{ marginLeft: "auto", fontSize: 9, padding: "1px 5px", background: "var(--ochre-500)", color: "white", borderRadius: 3, fontFamily: "Inter, sans-serif", fontWeight: 600, letterSpacing: "0.04em" }}>T2</span>
          </button>
        )}
      </nav>

      {/* Account block */}
      {sub && (
        <div style={{ padding: "14px 12px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "var(--verdigris-700)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, color: "white", flexShrink: 0,
            }}>
              {sub.tenant.name[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,0.9)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {sub.tenant.name}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>
                {sub.role}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <PlanChip plan={sub.plan} />
            <StatusChip status={sub.status} />
          </div>
          <button
            onClick={onSignOut}
            className="nav-item"
            style={{ opacity: 0.55, fontSize: 12.5 }}
          >
            <Icons.Logout /> Sign out
          </button>
        </div>
      )}
    </aside>
  );
}

/* ────────────────────────────────────────────
   TOPBAR
──────────────────────────────────────────── */
function TopBar({
  title, sub, onUpgrade
}: {
  title: string;
  sub: SubscriptionInfo | null;
  onUpgrade: () => void;
}) {
  return (
    <header style={{
      height: 56,
      background: "var(--card)",
      borderBottom: "1px solid var(--line)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 28px",
      flexShrink: 0,
    }}>
      <h1 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 20, fontWeight: 400, color: "var(--ink)", margin: 0 }}>
        {title}
      </h1>

      {sub && (
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <QuotaMeter used={sub.used_today} limit={sub.daily_limit} />
          <div style={{ width: 1, height: 20, background: "var(--line)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PlanChip plan={sub.plan} />
            {sub.plan === "Basic" && (
              <button
                className="btn btn-sm btn-primary"
                onClick={onUpgrade}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "linear-gradient(135deg, var(--ochre-500, #c28a2c) 0%, #b47b22 100%)",
                  border: "none",
                  color: "#ffffff",
                  boxShadow: "0 2px 6px rgba(194, 138, 44, 0.25)",
                  padding: "6px 12px",
                }}
              >
                <span>⚡ Upgrade plan</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

/* ────────────────────────────────────────────
   RUN TOOLS SCREEN
──────────────────────────────────────────── */
function RunToolsScreen({
  sub, operation, setOperation, rows, setRows,
  loading, errorBanner, replayBanner, activeResult,
  onSubmit, onClearError, onClearReplay, onUpgrade
}: any) {
  const isDisabled = loading || sub?.role === "Viewer" || sub?.status === "Suspended" || (sub?.remaining ?? 1) <= 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, height: "100%", minHeight: 0 }}>
      {/* LEFT COLUMN */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>

        {/* Banners */}
        {sub?.status === "Suspended" && (
          <Banner type="error">This workspace is suspended. History is still readable.</Banner>
        )}
        {errorBanner && (
          <Banner type="error" onClose={onClearError}>{errorBanner}</Banner>
        )}
        {replayBanner && (
          <Banner type="info" onClose={onClearReplay}>{replayBanner}</Banner>
        )}

        {/* Operation selector + fixtures */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "JetBrains Mono, monospace" }}>Operation</span>
              <div className="segmented">
                <button
                  className={`segmented-item ${operation === "validate" ? "active" : ""}`}
                  onClick={() => setOperation("validate")}
                >
                  validate
                </button>
                <button
                  className={`segmented-item ${operation === "process" ? "active" : ""}`}
                  onClick={() => {
                    if (sub?.plan === "Pro") setOperation("process");
                    else onUpgrade();
                  }}
                  style={{ display: "flex", alignItems: "center", gap: 5 }}
                >
                  process
                  {sub?.plan !== "Pro" && (
                    <span style={{ fontSize: 9, padding: "1px 4px", background: "var(--ochre-100)", color: "var(--ochre-500)", borderRadius: 3, fontWeight: 700 }}>PRO</span>
                  )}
                </button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-sm btn-secondary" onClick={() => setRows(SAMPLE_VALID_ROWS)}>Valid fixture</button>
              <button className="btn btn-sm btn-secondary" onClick={() => setRows(SAMPLE_INVALID_ROWS)}>Invalid fixture</button>
            </div>
          </div>

          {/* Row editor */}
          <div style={{ padding: "4px 0" }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "28px 100px 1fr 90px 80px 32px",
              gap: 8,
              padding: "8px 16px",
              background: "var(--paper-2)",
              borderBottom: "1px solid var(--line)",
            }}>
              {["#", "record_id", "text", "repeat", "mode", ""].map(h => (
                <div key={h} style={{ fontSize: 10.5, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "JetBrains Mono, monospace" }}>
                  {h}
                </div>
              ))}
            </div>

            {rows.map((row: RecordItem, idx: number) => (
              <div key={idx} style={{
                display: "grid",
                gridTemplateColumns: "28px 100px 1fr 90px 80px 32px",
                gap: 8,
                padding: "7px 16px",
                borderBottom: "1px solid var(--line)",
                alignItems: "center",
              }}>
                <span style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "JetBrains Mono, monospace" }}>{idx + 1}</span>
                <input
                  className="input"
                  value={row.record_id}
                  maxLength={20}
                  placeholder="ID"
                  onChange={e => { const c=[...rows]; c[idx]={...c[idx],record_id:e.target.value}; setRows(c); }}
                />
                <input
                  className="input"
                  value={row.text}
                  maxLength={80}
                  placeholder="ASCII text (1–80 chars)"
                  onChange={e => { const c=[...rows]; c[idx]={...c[idx],text:e.target.value}; setRows(c); }}
                />
                <select
                  className="select-field"
                  value={row.repeat}
                  onChange={e => { const c=[...rows]; c[idx]={...c[idx],repeat:parseInt(e.target.value)}; setRows(c); }}
                >
                  <option value={1}>× 1</option>
                  <option value={2}>× 2</option>
                  <option value={3}>× 3</option>
                </select>
                <select
                  className="select-field"
                  value={row.mode}
                  onChange={e => { const c=[...rows]; c[idx]={...c[idx],mode:e.target.value as "UPPER"|"LOWER"}; setRows(c); }}
                >
                  <option value="UPPER">UPPER</option>
                  <option value="LOWER">LOWER</option>
                </select>
                <button
                  style={{ background: "none", border: "none", cursor: rows.length > 1 ? "pointer" : "not-allowed", opacity: rows.length > 1 ? 0.5 : 0.2, color: "var(--brick-600)", display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 4 }}
                  onClick={() => rows.length > 1 && setRows(rows.filter((_: any, i: number) => i !== idx))}
                >
                  <Icons.X />
                </button>
              </div>
            ))}

            <div style={{ padding: "10px 16px" }}>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  if (rows.length < 10) setRows([...rows, { record_id: `R${String(rows.length+1).padStart(2,"0")}`, text: "", repeat: 1, mode: "UPPER" }]);
                }}
                disabled={rows.length >= 10 || sub?.role === "Viewer"}
                style={{ gap: 6, color: "var(--verdigris-700)", fontWeight: 600 }}
              >
                <Icons.Plus /> Add row {rows.length < 10 ? `(${rows.length}/10)` : "(max)"}
              </button>
            </div>
          </div>

          {/* Submit bar */}
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--paper-2)" }}>
            <span style={{ fontSize: 11.5, color: "var(--ink-3)", fontFamily: "JetBrains Mono, monospace" }}>
              {sub?.role === "Viewer" ? "Viewer role — read only" :
               sub?.status === "Suspended" ? "Workspace suspended" :
               (sub?.remaining ?? 1) <= 0 ? "Quota exhausted — resets at 00:00 UTC" :
               `Idempotency-Key auto-generated · ${rows.length} row${rows.length !== 1 ? "s" : ""}`}
            </span>
            <button
              className="btn btn-md btn-primary"
              onClick={onSubmit}
              disabled={isDisabled}
              style={{ minWidth: 120, gap: 7 }}
            >
              {loading ? <><Icons.Spinner /> Running…</> : <><Icons.Play /> Run {operation}</>}
            </button>
          </div>
        </div>

        {/* Proof Result */}
        {activeResult && activeResult.result && (
          <div className="card animate-slide-in">
            <div className="card-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: "var(--ochre-500)", fontSize: 18, lineHeight: 1 }}>▌</span>
                <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 17, fontWeight: 400, margin: 0 }}>Proof Result</h2>
              </div>
              <StatusChip status={activeResult.status} />
            </div>

            <div style={{ padding: "16px 18px" }}>
              {activeResult.result.operation === "validate" && (
                <ValidateResult result={activeResult.result} />
              )}
              {activeResult.result.operation === "process" && (
                <ProcessResult result={activeResult.result} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN — Reference panel */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Plan & Quota card */}
        {sub && (
          <div className="card">
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "JetBrains Mono, monospace", marginBottom: 10 }}>Plan & Quota</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <PlanChip plan={sub.plan} />
                <StatusChip status={sub.status} />
              </div>
              <QuotaMeter used={sub.used_today} limit={sub.daily_limit} />
              <div style={{ marginTop: 6, fontSize: 11, color: "var(--ink-3)", fontFamily: "JetBrains Mono, monospace" }}>
                Resets 00:00 UTC
              </div>
            </div>
            {sub.plan === "Basic" && sub.role === "Operator" && (
              <div style={{ padding: "10px 16px" }}>
                <button className="btn btn-sm btn-primary" onClick={onUpgrade} style={{ width: "100%", justifyContent: "center" }}>
                  Upgrade to Pro
                </button>
              </div>
            )}
          </div>
        )}

        {/* Rules reference */}
        <div className="card">
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "JetBrains Mono, monospace" }}>
              Rules R1–R4
            </div>
          </div>
          <div style={{ padding: "12px 16px" }}>
            {[
              ["R1", "record_id", "≤ 20 chars · unique per batch · case-sensitive"],
              ["R2", "text", "1–80 ASCII chars · trimmed"],
              ["R3", "repeat", "int 1–3 · no bools or strings"],
              ["R4", "mode", "UPPER or LOWER exactly"],
            ].map(([id, field, rule]) => (
              <div key={id} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 2 }}>
                  <span style={{ fontSize: 10, padding: "1px 5px", background: "var(--paper-2)", border: "1px solid var(--line)", borderRadius: 3, fontFamily: "JetBrains Mono, monospace", fontWeight: 600, color: "var(--ink-2)" }}>{id}</span>
                  <span style={{ fontSize: 12, fontFamily: "JetBrains Mono, monospace", fontWeight: 600, color: "var(--verdigris-700)" }}>{field}</span>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--ink-3)", paddingLeft: 2, lineHeight: 1.5 }}>{rule}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────
   VALIDATE RESULT
──────────────────────────────────────────── */
function ValidateResult({ result }: { result: any }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 20, marginBottom: 14 }}>
        <div style={{ textAlign: "center", padding: "10px 18px", background: "var(--moss-100)", borderRadius: "var(--radius)", border: "1px solid rgba(85,112,58,.15)" }}>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "var(--moss-600)", lineHeight: 1 }}>{result.valid_rows ?? 0}</div>
          <div style={{ fontSize: 11, color: "var(--moss-600)", marginTop: 4, fontWeight: 600 }}>Valid</div>
        </div>
        <div style={{ textAlign: "center", padding: "10px 18px", background: result.invalid_rows > 0 ? "var(--brick-100)" : "var(--paper-2)", borderRadius: "var(--radius)", border: "1px solid rgba(164,57,43,.15)" }}>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: result.invalid_rows > 0 ? "var(--brick-600)" : "var(--ink-3)", lineHeight: 1 }}>{result.invalid_rows ?? 0}</div>
          <div style={{ fontSize: 11, color: result.invalid_rows > 0 ? "var(--brick-600)" : "var(--ink-3)", marginTop: 4, fontWeight: 600 }}>Invalid</div>
        </div>
      </div>

      {result.issues && result.issues.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "JetBrains Mono, monospace", marginBottom: 8 }}>
            Rule Violations
          </div>
          <div style={{ border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "60px 90px 1fr", background: "var(--paper-2)", padding: "6px 12px", gap: 12 }}>
              {["Row", "Field", "Rule ID"].map(h => (
                <div key={h} style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)", fontFamily: "JetBrains Mono, monospace", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</div>
              ))}
            </div>
            {result.issues.map((iss: any, i: number) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "60px 90px 1fr", padding: "8px 12px", gap: 12, borderTop: "1px solid var(--line)", background: i % 2 === 1 ? "rgba(0,0,0,0.01)" : undefined }}>
                <div style={{ fontSize: 12, fontFamily: "JetBrains Mono, monospace", color: "var(--ink-2)" }}>#{iss.row_index}</div>
                <div style={{ fontSize: 12, fontFamily: "JetBrains Mono, monospace", color: "var(--verdigris-700)", fontWeight: 600 }}>{iss.field}</div>
                <div style={{ fontSize: 12, fontFamily: "JetBrains Mono, monospace" }}>
                  <span style={{ padding: "1px 6px", background: "var(--brick-100)", color: "var(--brick-600)", borderRadius: 3, fontWeight: 700 }}>{iss.rule_id}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────
   PROCESS RESULT (Proof Block)
──────────────────────────────────────────── */
function ProcessResult({ result }: { result: any }) {
  return (
    <div>
      {result.summary && (
        <div style={{ display: "flex", gap: 16, marginBottom: 14, fontSize: 12, fontFamily: "JetBrains Mono, monospace", color: "var(--ink-2)" }}>
          <span>{result.summary.input_rows} rows processed</span>
          <span style={{ color: "var(--line)" }}>·</span>
          <span>{result.summary.output_characters} characters total</span>
        </div>
      )}
      <div style={{ background: "var(--night)", borderRadius: "var(--radius-lg)", padding: "16px 20px", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <span style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Proof Block</span>
          <span className="chip chip-moss" style={{ fontSize: 10.5 }}>Succeeded</span>
        </div>
        {result.rows?.map((r: any, i: number) => (
          <div key={i} className="proof-line" style={{ color: "rgba(255,255,255,0.9)" }}>
            <span style={{ color: "var(--ochre-500)", width: 10 }}>▌</span>
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 13.5, fontWeight: 600, flex: 1 }}>{r.output}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "JetBrains Mono, monospace" }}>len {r.length}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────
   HISTORY SCREEN
──────────────────────────────────────────── */
function HistoryScreen({ runs, selectedRunId, activeResult, onSelectRun }: {
  runs: RunSummary[];
  selectedRunId: string | null;
  activeResult: RunResultResponse | null;
  onSelectRun: (id: string) => void;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 20, height: "100%" }}>
      {/* Runs list */}
      <div className="card" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="card-header" style={{ flexShrink: 0 }}>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 17, fontWeight: 400, margin: 0 }}>
            Execution History
          </h2>
          <span style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "JetBrains Mono, monospace" }}>
            {runs.length} run{runs.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Table header */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 80px 80px 120px 28px", gap: 12, padding: "8px 16px", background: "var(--paper-2)", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
          {["Run ID", "Op", "Status", "Time", ""].map(h => (
            <div key={h} style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)", fontFamily: "JetBrains Mono, monospace", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</div>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {runs.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--ink-3)" }}>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, marginBottom: 8 }}>No runs yet</div>
              <div style={{ fontSize: 13 }}>Submit a batch from Run tools and it will appear here.</div>
            </div>
          ) : runs.map(r => (
            <div
              key={r.run_id}
              onClick={() => onSelectRun(r.run_id)}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 80px 80px 120px 28px",
                gap: 12,
                padding: "10px 16px",
                borderBottom: "1px solid var(--line)",
                cursor: "pointer",
                alignItems: "center",
                background: selectedRunId === r.run_id ? "var(--verdigris-50)" : undefined,
                transition: "background 0.1s",
              }}
              onMouseEnter={e => { if (selectedRunId !== r.run_id) (e.currentTarget as HTMLDivElement).style.background = "var(--paper-2)"; }}
              onMouseLeave={e => { if (selectedRunId !== r.run_id) (e.currentTarget as HTMLDivElement).style.background = ""; }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12, fontFamily: "JetBrains Mono, monospace", color: "var(--ink)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.run_id.substring(0, 14)}…
                </span>
                <span style={{ fontSize: 10.5, color: "var(--ink-3)", fontFamily: "JetBrains Mono, monospace" }}>
                  {r.row_count} row{r.row_count !== 1 ? "s" : ""}
                  {r.valid_rows !== undefined && ` · ${r.valid_rows}✓ ${r.invalid_rows}✗`}
                </span>
              </div>
              <span style={{ fontSize: 11.5, fontFamily: "JetBrains Mono, monospace", color: "var(--verdigris-700)", fontWeight: 600, textTransform: "uppercase" }}>
                {r.operation.slice(0, 3)}
              </span>
              <StatusChip status={r.status} />
              <span style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "JetBrains Mono, monospace" }}>
                {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <button
                onClick={e => copyId(r.run_id, e)}
                style={{ background: "none", border: "none", cursor: "pointer", color: copiedId === r.run_id ? "var(--moss-600)" : "var(--ink-3)", padding: 4, borderRadius: 3, display: "flex", alignItems: "center" }}
                title="Copy run ID"
              >
                {copiedId === r.run_id ? <Icons.Check /> : <Icons.Copy />}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      <div className="card" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="card-header" style={{ flexShrink: 0 }}>
          <div>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 17, fontWeight: 400, margin: 0 }}>Result Viewer</h2>
            {activeResult && (
              <div style={{ fontSize: 10.5, fontFamily: "JetBrains Mono, monospace", color: "var(--ink-3)", marginTop: 2 }}>
                {activeResult.run_id}
              </div>
            )}
          </div>
          {activeResult && <StatusChip status={activeResult.status} />}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
          {!activeResult ? (
            <div style={{ padding: "32px 0", textAlign: "center", color: "var(--ink-3)" }}>
              <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.3 }}>▌</div>
              <div style={{ fontSize: 13 }}>Select a run to view its result.</div>
            </div>
          ) : activeResult.result?.operation === "validate" ? (
            <ValidateResult result={activeResult.result} />
          ) : activeResult.result?.operation === "process" ? (
            <ProcessResult result={activeResult.result} />
          ) : activeResult.error ? (
            <Banner type="error">
              <strong>{activeResult.error.code}</strong> — {activeResult.error.message}
            </Banner>
          ) : (
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12 }}>
              <pre style={{ background: "var(--paper-2)", padding: 16, borderRadius: "var(--radius)", border: "1px solid var(--line)", overflowX: "auto" }}>
                {JSON.stringify(activeResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────
   MAIN APP
──────────────────────────────────────────── */
export function App() {
  const [view, setView] = useState<"landing" | "login" | "app">("landing");
  const [tab, setTab] = useState<"tools" | "history" | "billing">("tools");

  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [operation, setOperation] = useState<"validate" | "process">("validate");
  const [rows, setRows] = useState<RecordItem[]>(SAMPLE_VALID_ROWS);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [replayBanner, setReplayBanner] = useState<string | null>(null);
  const [activeResult, setActiveResult] = useState<RunResultResponse | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const [historyRuns, setHistoryRuns] = useState<RunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const loadSubscription = useCallback(async () => {
    try { setSub(await fetchSubscription()); } catch {}
  }, []);

  const loadHistory = useCallback(async () => {
    try { setHistoryRuns((await fetchRuns()).runs ?? []); } catch {}
  }, []);

  useEffect(() => {
    fetchSubscription().then(d => { setSub(d); loadHistory(); setView("app"); }).catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!sub || sub.role === "Viewer" || sub.status === "Suspended") return;
    setLoading(true); setErrorBanner(null); setReplayBanner(null); setActiveResult(null);
    try {
      const res = await submitRun({ operation, records: rows });
      if (res.replayed) setReplayBanner("Same request detected — showing original run. No quota debited.");
      setActiveResult(await fetchRunResult(res.run_id));
      await loadSubscription(); await loadHistory();
    } catch (err: any) {
      setErrorBanner(err.data?.error?.message || err.message || "Submission failed.");
    } finally { setLoading(false); }
  };

  const handleSelectHistory = async (runId: string) => {
    setSelectedRunId(runId);
    try { setActiveResult(await fetchRunResult(runId)); } catch {}
  };

  const handleSignOut = async () => {
    try { await fetch("/auth/logout", { method: "POST" }); } catch {}
    setSub(null); setView("landing");
  };

  // Routing
  if (view === "landing") {
    return <LandingPage onSignIn={() => setView("login")} onOpenWorkspace={() => sub ? setView("app") : setView("login")} />;
  }
  if (view === "login") {
    return <LoginPage onLoginSuccess={async () => { await loadSubscription(); await loadHistory(); setView("app"); }} onCancel={() => setView("landing")} />;
  }

  // App shell
  const tabTitles: Record<string, string> = { tools: "Run tools", history: "History", billing: "Billing" };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--paper)" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <Sidebar tab={tab} setTab={setTab} sub={sub} onSignOut={handleSignOut} billingEnabled={false} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <TopBar title={tabTitles[tab]} sub={sub} onUpgrade={() => setShowUpgradeModal(true)} />

        <main style={{ flex: 1, padding: "24px 28px", overflowY: "auto" }}>
          {tab === "tools" && (
            <RunToolsScreen
              sub={sub} operation={operation} setOperation={setOperation}
              rows={rows} setRows={setRows} loading={loading}
              errorBanner={errorBanner} replayBanner={replayBanner} activeResult={activeResult}
              onSubmit={handleSubmit}
              onClearError={() => setErrorBanner(null)}
              onClearReplay={() => setReplayBanner(null)}
              onUpgrade={() => setShowUpgradeModal(true)}
            />
          )}
          {tab === "history" && (
            <HistoryScreen
              runs={historyRuns} selectedRunId={selectedRunId}
              activeResult={activeResult} onSelectRun={handleSelectHistory}
            />
          )}
        </main>
      </div>

      {showUpgradeModal && (
        <UpgradeModal
          onClose={() => setShowUpgradeModal(false)}
          onSuccess={async () => {
            await loadSubscription();
          }}
          currentPlan={sub?.plan}
          userRole={sub?.role}
          tenantName={sub?.tenant?.name}
          userEmail={sub?.role === "Operator" ? "operator@textforge.test" : "viewer@textforge.test"}
        />
      )}
    </div>
  );
}

export default App;
