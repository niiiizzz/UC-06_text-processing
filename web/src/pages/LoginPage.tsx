import React, { useState } from "react";
import { BRAND_NAME, BRAND_TAGLINE } from "../brand";

interface LoginPageProps {
  onLoginSuccess: (user: any) => void;
  onCancel: () => void;
}

const DEMO_ACCOUNTS = [
  {
    label: "Northwind · Operator",
    email: "op.a@lathe.test",
    desc: "Tenant A · Pro Plan · Can submit runs & upgrade",
  },
  {
    label: "Northwind · Viewer",
    email: "view.a@lathe.test",
    desc: "Tenant A · Pro Plan · Read-only access to runs",
  },
  {
    label: "Harbor · Operator",
    email: "op.b@lathe.test",
    desc: "Tenant B · Basic Plan · Can submit Validate runs",
  },
  {
    label: "Harbor · Viewer",
    email: "view.b@lathe.test",
    desc: "Tenant B · Basic Plan · Read-only access to runs",
  },
];

export function LoginPage({ onLoginSuccess, onCancel }: LoginPageProps) {
  const [activeTab, setActiveTab] = useState<"signin" | "create">("signin");
  const [email, setEmail] = useState("op.a@lathe.test");
  const [password, setPassword] = useState("LatheDemo2026!");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSelectDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("LatheDemo2026!");
    setErrorMsg(null);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Email or password is incorrect.");
      }

      onLoginSuccess(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Email or password is incorrect.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col md:flex-row font-sans selection:bg-verdigris-100">
      {/* Left · Night Panel (Desktop >= 900px) */}
      <div className="w-full md:w-5/12 bg-night text-paper p-8 sm:p-12 lg:p-16 flex flex-col justify-between border-b md:border-b-0 md:border-r border-line/40">
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <button
              onClick={onCancel}
              className="font-serif text-3xl font-bold tracking-tight text-paper hover:opacity-80 transition-opacity"
            >
              {BRAND_NAME.toLowerCase()}
            </button>
          </div>

          <div className="space-y-3">
            <h1 className="font-serif text-3xl sm:text-4xl font-normal leading-tight text-paper">
              {BRAND_TAGLINE}
            </h1>
            <p className="text-paper/70 text-sm sm:text-base leading-relaxed">
              Validate batches against four clear rules. On Pro, transform and keep results.
            </p>
          </div>

          {/* Proof block preview */}
          <div className="border border-paper/20 bg-night-2 p-4 rounded font-mono text-xs space-y-2 border-l-4 border-l-ochre-500">
            <div className="flex justify-between items-center text-paper/90">
              <span className="font-bold">▌HELLO HELLO</span>
              <span className="text-paper/50">len 11</span>
            </div>
            <div className="flex justify-between items-center text-paper/90">
              <span className="font-bold">▌world</span>
              <span className="text-paper/50">len 5</span>
            </div>
          </div>

          {/* 3 typographic facts */}
          <div className="space-y-3 font-mono text-xs text-paper/80 pt-2">
            <div className="flex items-center space-x-2">
              <span className="text-ochre-500">◦</span>
              <span>Isolated workspaces & tenant boundaries</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-ochre-500">◦</span>
              <span>Safe retries with zero duplicate cost</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-ochre-500">◦</span>
              <span>Shared daily allowance enforced in SQL</span>
            </div>
          </div>
        </div>

        <div className="pt-8 text-xs font-mono text-paper/40">
          Sandbox environment · Synthetic data only
        </div>
      </div>

      {/* Right · Paper Panel (Auth box) */}
      <div className="w-full md:w-7/12 p-8 sm:p-12 lg:p-16 flex items-center justify-center bg-paper">
        <div className="w-full max-w-[420px] bg-card border border-line rounded shadow-raised p-6 sm:p-8 space-y-6">
          <div className="space-y-1">
            <h2 className="font-serif text-2xl font-semibold text-ink">Welcome back</h2>
            <p className="text-xs text-ink-2">Sign in to your team's text processing workspace.</p>
          </div>

          {/* Tabs: Sign in / Create account */}
          <div className="flex border-b border-line text-sm font-medium">
            <button
              onClick={() => setActiveTab("signin")}
              className={`pb-2 px-3 border-b-2 transition-colors ${
                activeTab === "signin"
                  ? "border-verdigris-700 text-verdigris-700 font-semibold"
                  : "border-transparent text-ink-3 hover:text-ink"
              }`}
            >
              Sign in
            </button>
            <button
              onClick={() => setActiveTab("create")}
              className={`pb-2 px-3 border-b-2 transition-colors ${
                activeTab === "create"
                  ? "border-verdigris-700 text-verdigris-700 font-semibold"
                  : "border-transparent text-ink-3 hover:text-ink"
              }`}
            >
              Create account
            </button>
          </div>

          {activeTab === "signin" ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              {errorBanner(errorMsg)}

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-ink-2 uppercase tracking-wider font-mono">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm bg-card border border-line rounded focus:outline-none focus:ring-1 focus:ring-verdigris-700 font-mono"
                  placeholder="operator@lathe.test"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-medium text-ink-2 uppercase tracking-wider font-mono">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-xs font-mono text-ink-3 hover:text-ink"
                  >
                    {showPassword ? "hide" : "show"}
                  </button>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm bg-card border border-line rounded focus:outline-none focus:ring-1 focus:ring-verdigris-700 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 text-sm font-medium bg-verdigris-700 hover:bg-verdigris-800 disabled:opacity-50 text-card rounded transition-colors shadow-sm"
              >
                {loading ? "Authenticating…" : "Continue"}
              </button>
            </form>
          ) : (
            <div className="space-y-4 py-2">
              <div className="p-3.5 bg-paper-2 border border-line rounded text-xs text-ink-2 leading-relaxed">
                This workspace is invite-only in the sandbox. Use one of the pre-seeded demo
                accounts below to explore Operator and Viewer privileges.
              </div>
            </div>
          )}

          {/* Sandbox Demo Accounts */}
          <div className="border-t border-line pt-5 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono font-medium uppercase tracking-wider text-ink-3">
                Sandbox demo accounts
              </span>
              <span className="text-xs font-mono text-ink-3">Click to autofill</span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {DEMO_ACCOUNTS.map((acc, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectDemo(acc.email)}
                  className={`p-2.5 text-left border rounded transition-all text-xs font-mono flex flex-col space-y-0.5 ${
                    email === acc.email
                      ? "border-verdigris-700 bg-verdigris-100/40"
                      : "border-line bg-paper-2 hover:bg-paper"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-ink">{acc.label}</span>
                    <span className="text-ink-3 text-[11px]">{acc.email}</span>
                  </div>
                  <span className="text-ink-2 font-sans text-[11px]">{acc.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 text-center text-xs font-mono text-ink-3">
            Sandbox · synthetic data only · Terms · Privacy
          </div>
        </div>
      </div>
    </div>
  );
}

function errorBanner(msg: string | null) {
  if (!msg) return null;
  return (
    <div className="p-3 bg-brick-100 border border-brick-600/40 text-brick-600 text-xs rounded font-medium flex items-center space-x-2">
      <span>✕</span>
      <span>{msg}</span>
    </div>
  );
}
