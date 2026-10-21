import React, { useState } from "react";
import { BRAND_NAME, BRAND_TAGLINE } from "../brand";

interface LoginPageProps {
  onLoginSuccess: (user: any) => void;
  onCancel: () => void;
}

const DEMO_ACCOUNTS = [
  { label: "Northwind · Operator", email: "op.a@lathe.test",   plan: "Pro",   role: "Operator", color: "var(--verdigris-700)" },
  { label: "Northwind · Viewer",   email: "view.a@lathe.test", plan: "Pro",   role: "Viewer",   color: "var(--verdigris-700)" },
  { label: "Harbor · Operator",    email: "op.b@lathe.test",   plan: "Basic", role: "Operator", color: "var(--ochre-500)" },
  { label: "Harbor · Viewer",      email: "view.b@lathe.test", plan: "Basic", role: "Viewer",   color: "var(--ochre-500)" },
];

export function LoginPage({ onLoginSuccess, onCancel }: LoginPageProps) {
  const [activeTab, setActiveTab] = useState<"signin" | "create">("signin");
  const [email, setEmail] = useState("op.a@lathe.test");
  const [password, setPassword] = useState("LatheDemo2026!");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDemo, setSelectedDemo] = useState(0);

  const handleSelectDemo = (idx: number) => {
    setSelectedDemo(idx);
    setEmail(DEMO_ACCOUNTS[idx].email);
    setPassword("LatheDemo2026!");
    setErrorMsg(null);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErrorMsg(null);
    try {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Email or password is incorrect.");
      onLoginSuccess(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Email or password is incorrect.");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* LEFT — Night panel */}
      <div style={{
        width: "44%", minWidth: 400,
        background: "var(--night)",
        display: "flex", flexDirection: "column",
        padding: "40px 52px",
        borderRight: "1px solid rgba(255,255,255,0.05)",
        position: "relative", overflow: "hidden",
      }}>
        {/* Subtle grid pattern */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.03,
          backgroundImage: "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          pointerEvents: "none",
        }} />

        {/* Brand */}
        <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", marginBottom: 56, padding: 0 }}>
          <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 26, color: "white", letterSpacing: "-0.02em" }}>
            {BRAND_NAME.toLowerCase()}
          </div>
          <div style={{ fontSize: 10.5, fontFamily: "JetBrains Mono, monospace", color: "rgba(255,255,255,0.3)", marginTop: 2, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Text processing
          </div>
        </button>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <h1 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 36, fontWeight: 400, color: "white", lineHeight: 1.15, margin: "0 0 14px" }}>
            {BRAND_TAGLINE}
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, margin: "0 0 40px", maxWidth: 360 }}>
            Validate batches against four precise rules. On Pro, transform them and keep the results in private storage.
          </p>

          {/* Proof block */}
          <div style={{ borderLeft: "3px solid var(--ochre-500)", paddingLeft: 18, marginBottom: 36 }}>
            {[
              { out: "HELLO HELLO", len: 11 },
              { out: "world", len: 5 },
            ].map(r => (
              <div key={r.out} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
                <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.88)", flex: 1 }}>{r.out}</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "JetBrains Mono, monospace" }}>len {r.len}</span>
              </div>
            ))}
          </div>

          {/* 3 facts */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              "Isolated workspaces & tenant boundaries",
              "Zero-cost idempotent replays",
              "Atomic daily allowance in SQL",
            ].map(f => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                <span style={{ color: "var(--ochre-500)", fontSize: 10 }}>◦</span>
                {f}
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: "rgba(255,255,255,0.2)" }}>
          Sandbox environment · Synthetic data only
        </div>
      </div>

      {/* RIGHT — Auth box */}
      <div style={{ flex: 1, background: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 32px" }}>
        <div style={{ width: "100%", maxWidth: 420 }}>

          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                marginBottom: 16,
                background: "var(--paper-2)",
                border: "1px solid var(--line)",
                borderRadius: 6,
                fontSize: 12.5,
                fontWeight: 500,
                color: "var(--ink-2)",
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--ink-3)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--line)"; }}
            >
              ← Back to home
            </button>
            <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 28, fontWeight: 400, color: "var(--ink)", margin: "0 0 6px" }}>
              Welcome back
            </h2>
            <p style={{ fontSize: 13.5, color: "var(--ink-3)", margin: 0 }}>
              Sign in to your team's text processing workspace.
            </p>
          </div>

          {/* Card */}
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 24px -4px rgba(29,27,23,.1)" }}>

            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid var(--line)" }}>
              {(["signin", "create"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  style={{
                    flex: 1, padding: "12px 0", border: "none", cursor: "pointer",
                    background: activeTab === t ? "var(--card)" : "var(--paper-2)",
                    borderBottom: activeTab === t ? "2px solid var(--verdigris-700)" : "2px solid transparent",
                    fontSize: 13.5, fontWeight: activeTab === t ? 600 : 400,
                    color: activeTab === t ? "var(--verdigris-700)" : "var(--ink-3)",
                    transition: "all 0.15s",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  {t === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            <div style={{ padding: "24px" }}>
              {/* Error */}
              {errorMsg && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "var(--brick-100)", border: "1px solid rgba(164,57,43,.2)", borderRadius: 6, marginBottom: 16, fontSize: 13, color: "var(--brick-600)", fontWeight: 500 }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>!</span>
                  {errorMsg}
                </div>
              )}

              {activeTab === "create" ? (
                <div style={{ padding: "12px 0" }}>
                  <div style={{ padding: "14px 16px", background: "var(--paper-2)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.65 }}>
                    This workspace is invite-only in the sandbox. Use one of the pre-seeded demo accounts below to explore Operator and Viewer roles.
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSignIn} style={{ marginBottom: 20 }}>
                  {/* Email */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "JetBrains Mono, monospace", marginBottom: 6 }}>
                      Email
                    </label>
                    <input
                      className="input"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      placeholder="operator@lathe.test"
                      style={{ height: 40, fontSize: 13.5 }}
                    />
                  </div>

                  {/* Password */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "JetBrains Mono, monospace" }}>
                        Password
                      </label>
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: "var(--ink-3)", background: "none", border: "none", cursor: "pointer" }}>
                        {showPassword ? "hide" : "show"}
                      </button>
                    </div>
                    <input
                      className="input"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      style={{ height: 40, fontSize: 13.5 }}
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-lg btn-primary"
                    disabled={loading}
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    {loading ? "Authenticating…" : "Continue →"}
                  </button>
                </form>
              )}

              {/* Demo accounts */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                  <span style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>
                    Sandbox demo accounts
                  </span>
                  <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {DEMO_ACCOUNTS.map((acc, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => { handleSelectDemo(idx); if (activeTab === "create") setActiveTab("signin"); }}
                      style={{
                        padding: "10px 12px", textAlign: "left", border: "1px solid",
                        borderColor: selectedDemo === idx && email === acc.email ? acc.color : "var(--line)",
                        borderRadius: 8, background: selectedDemo === idx && email === acc.email ? (acc.color === "var(--verdigris-700)" ? "var(--verdigris-50)" : "var(--ochre-50)") : "var(--paper-2)",
                        cursor: "pointer", transition: "all 0.15s",
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 3 }}>{acc.label}</div>
                      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                        <span style={{ fontSize: 10, padding: "1px 5px", background: acc.color, color: "white", borderRadius: 3, fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>{acc.plan}</span>
                        <span style={{ fontSize: 10.5, color: "var(--ink-3)", fontFamily: "JetBrains Mono, monospace" }}>{acc.role}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <p style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "var(--ink-3)", fontFamily: "JetBrains Mono, monospace" }}>
            Sandbox · synthetic data only · Terms · Privacy
          </p>
        </div>
      </div>
    </div>
  );
}
