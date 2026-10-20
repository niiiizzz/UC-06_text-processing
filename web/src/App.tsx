import React, { useState, useEffect } from "react";
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
  { record_id: "T02", text: "WORLD", repeat: 1, mode: "LOWER" },
];

const SAMPLE_INVALID_ROWS: RecordItem[] = [
  { record_id: "T01", text: "Hello", repeat: 2, mode: "UPPER" },
  { record_id: "T01", text: "Duplicate", repeat: 1, mode: "LOWER" }, // R1 failure
  { record_id: "T03", text: "", repeat: 1, mode: "UPPER" }, // R2 failure
  { record_id: "T04", text: "Valid text", repeat: 5, mode: "UPPER" }, // R3 failure
];

export function App() {
  // Navigation: landing | login | app
  const [view, setView] = useState<"landing" | "login" | "app">("landing");
  const [tab, setTab] = useState<"tools" | "history">("tools");

  // State
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [operation, setOperation] = useState<"validate" | "process">("validate");
  const [rows, setRows] = useState<RecordItem[]>(SAMPLE_VALID_ROWS);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [replayBanner, setReplayBanner] = useState<string | null>(null);
  const [activeResult, setActiveResult] = useState<RunResultResponse | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState<boolean>(false);

  // History state
  const [historyRuns, setHistoryRuns] = useState<RunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  useEffect(() => {
    // Check if session exists on boot
    fetchSubscription()
      .then((data) => {
        setSub(data);
        loadHistory();
      })
      .catch(() => {
        // Unauthenticated, stay on landing
      });
  }, []);

  async function loadSubscription() {
    try {
      const data = await fetchSubscription();
      setSub(data);
    } catch (e) {
      // Demo placeholder if network fails
    }
  }

  async function loadHistory() {
    try {
      const data = await fetchRuns();
      setHistoryRuns(data.runs || []);
    } catch (e) {
      // fallback
    }
  }

  async function handleSignOut() {
    try {
      await fetch("/auth/logout", { method: "POST" });
    } catch (e) {
      // ignore
    }
    setSub(null);
    setView("landing");
  }

  async function handleSubmit() {
    if (!sub || sub.role === "Viewer" || sub.status === "Suspended") return;
    setLoading(true);
    setErrorBanner(null);
    setReplayBanner(null);
    setActiveResult(null);

    try {
      const res = await submitRun({ operation, records: rows });
      if (res.replayed) {
        setReplayBanner("Same request detected. Showing the original run — no quota used.");
      }
      const detailed = await fetchRunResult(res.run_id);
      setActiveResult(detailed);
      await loadSubscription();
      await loadHistory();
    } catch (err: any) {
      const msg = err.data?.error?.message || err.message;
      setErrorBanner(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectHistory(runId: string) {
    setSelectedRunId(runId);
    try {
      const res = await fetchRunResult(runId);
      setActiveResult(res);
    } catch (e) {
      // fallback
    }
  }

  // View routing
  if (view === "landing") {
    return (
      <LandingPage
        onSignIn={() => setView("login")}
        onOpenWorkspace={() => {
          if (sub) setView("app");
          else setView("login");
        }}
      />
    );
  }

  if (view === "login") {
    return (
      <LoginPage
        onLoginSuccess={async () => {
          await loadSubscription();
          await loadHistory();
          setView("app");
        }}
        onCancel={() => setView("landing")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col font-sans selection:bg-verdigris-100">
      {/* Top bar */}
      <header className="border-b border-line bg-card px-6 sm:px-10 py-3.5 flex justify-between items-center shadow-raised">
        <div className="flex items-center space-x-6 sm:space-x-8">
          <button
            onClick={() => setView("landing")}
            className="font-serif text-2xl font-bold tracking-tight text-ink hover:opacity-80 transition-opacity"
          >
            {BRAND_NAME.toLowerCase()}
          </button>
          <nav className="flex space-x-4 text-sm font-medium">
            <button
              onClick={() => {
                setTab("tools");
                setActiveResult(null);
              }}
              className={`pb-1 border-b-2 transition-colors ${
                tab === "tools"
                  ? "border-verdigris-700 text-ink font-semibold"
                  : "border-transparent text-ink-2 hover:text-ink"
              }`}
            >
              Run tools
            </button>
            <button
              onClick={() => {
                setTab("history");
              }}
              className={`pb-1 border-b-2 transition-colors ${
                tab === "history"
                  ? "border-verdigris-700 text-ink font-semibold"
                  : "border-transparent text-ink-2 hover:text-ink"
              }`}
            >
              History
            </button>
          </nav>
        </div>

        {sub && (
          <div className="flex items-center space-x-3 sm:space-x-4 text-xs font-mono">
            <div className="hidden sm:flex items-center space-x-2 bg-paper-2 border border-line px-2.5 py-1 rounded">
              <span className="font-semibold text-ink">{sub.tenant.name}</span>
              <span className="text-ink-3">·</span>
              <span className="text-ink-2">{sub.role}</span>
            </div>

            {/* Plan chip with upgrade CTA */}
            <div className="flex items-center space-x-1.5">
              <span
                className={`px-2 py-0.5 rounded font-bold ${
                  sub.plan === "Pro"
                    ? "bg-ochre-100 text-ink border border-ochre-500/30"
                    : "bg-paper-2 text-ink-2 border border-line"
                }`}
              >
                {sub.plan}
              </span>
              {sub.plan === "Basic" && sub.role === "Operator" && (
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="px-2 py-0.5 bg-verdigris-700 hover:bg-verdigris-800 text-card rounded text-[11px] font-sans font-medium transition-colors"
                >
                  Upgrade
                </button>
              )}
            </div>

            {/* Quota meter */}
            <div className="hidden md:flex items-center space-x-2 border border-line px-2.5 py-1 rounded bg-card">
              <span className="text-ink-2">
                Quota: <strong>{sub.remaining}</strong> of {sub.daily_limit} left
              </span>
              <div className="flex space-x-0.5">
                {Array.from({ length: sub.daily_limit }).map((_, i) => (
                  <span
                    key={i}
                    className={`w-1.5 h-3 rounded-[1px] ${
                      i < sub.daily_limit - sub.remaining
                        ? "bg-ink"
                        : sub.remaining <= 1
                        ? "bg-ochre-500"
                        : "bg-line"
                    }`}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="text-ink-3 hover:text-brick-600 font-sans text-xs underline decoration-line"
            >
              Sign out
            </button>
          </div>
        )}
      </header>

      {/* Global Suspended or Low Quota Banner */}
      {sub?.status === "Suspended" && (
        <div className="bg-brick-600 text-card px-6 py-2 text-xs font-mono text-center">
          This workspace is suspended. You can inspect past runs in History, but new submissions are
          blocked.
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 sm:p-10 space-y-6">
        {errorBanner && (
          <div className="p-3 bg-brick-100 border border-brick-600/40 text-brick-600 rounded text-xs font-mono font-medium flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span>✕</span>
              <span>{errorBanner}</span>
            </div>
            <button onClick={() => setErrorBanner(null)} className="hover:opacity-80">
              ✕
            </button>
          </div>
        )}

        {replayBanner && (
          <div className="p-3 bg-ochre-100 border border-ochre-500/40 text-ink rounded text-xs font-mono font-medium flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-ochre-500">ℹ</span>
              <span>{replayBanner}</span>
            </div>
            <button onClick={() => setReplayBanner(null)} className="hover:opacity-80">
              ✕
            </button>
          </div>
        )}

        {tab === "tools" ? (
          <div className="space-y-8">
            {/* Header / Operation selector */}
            <div className="flex flex-wrap justify-between items-center gap-4 border-b border-line pb-4">
              <div className="flex items-center space-x-3">
                <span className="text-xs font-mono font-medium uppercase text-ink-3">Operation:</span>
                <div className="inline-flex rounded border border-line bg-card p-0.5">
                  <button
                    type="button"
                    onClick={() => setOperation("validate")}
                    className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                      operation === "validate"
                        ? "bg-verdigris-700 text-card font-bold"
                        : "text-ink hover:text-ink-2"
                    }`}
                  >
                    validate
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (sub?.plan === "Pro") {
                        setOperation("process");
                      } else {
                        setShowUpgradeModal(true);
                      }
                    }}
                    className={`px-3 py-1 text-xs font-mono rounded flex items-center space-x-1 transition-colors ${
                      operation === "process"
                        ? "bg-verdigris-700 text-card font-bold"
                        : "text-ink hover:text-ink-2"
                    }`}
                  >
                    <span>process</span>
                    {sub?.plan !== "Pro" && <span className="text-[10px] text-ochre-500">🔒 Pro</span>}
                  </button>
                </div>
              </div>

              {/* Fixture buttons */}
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono text-ink-3">Load sample:</span>
                <button
                  type="button"
                  onClick={() => setRows(SAMPLE_VALID_ROWS)}
                  className="px-2.5 py-1 text-xs font-mono border border-line bg-card hover:bg-paper-2 rounded text-ink"
                >
                  Valid fixture
                </button>
                <button
                  type="button"
                  onClick={() => setRows(SAMPLE_INVALID_ROWS)}
                  className="px-2.5 py-1 text-xs font-mono border border-line bg-card hover:bg-paper-2 rounded text-ink"
                >
                  Invalid fixture
                </button>
              </div>
            </div>

            {/* Batch Table Editor */}
            <div className="bg-card border border-line rounded shadow-raised overflow-hidden">
              <div className="bg-paper-2 border-b border-line px-4 py-2.5 flex justify-between items-center text-xs font-mono text-ink-2">
                <span className="font-semibold text-ink">Batch Records ({rows.length}/10 rows)</span>
                <button
                  onClick={() => {
                    if (rows.length < 10) {
                      setRows([
                        ...rows,
                        {
                          record_id: `T0${rows.length + 1}`,
                          text: "Sample text",
                          repeat: 1,
                          mode: "UPPER",
                        },
                      ]);
                    }
                  }}
                  disabled={rows.length >= 10 || sub?.role === "Viewer" || sub?.status === "Suspended"}
                  className="hover:text-ink disabled:opacity-40 font-semibold"
                >
                  + Add Row
                </button>
              </div>

              <div className="p-4 space-y-2.5">
                {rows.map((row, idx) => (
                  <div key={idx} className="flex space-x-2 items-center text-xs font-mono">
                    <span className="text-ink-3 w-6">{idx + 1}.</span>
                    <input
                      type="text"
                      value={row.record_id}
                      onChange={(e) => {
                        const copy = [...rows];
                        copy[idx].record_id = e.target.value;
                        setRows(copy);
                      }}
                      className="w-24 p-1.5 border border-line rounded bg-paper focus:outline-none focus:ring-1 focus:ring-verdigris-700"
                      placeholder="record_id"
                      maxLength={20}
                    />
                    <input
                      type="text"
                      value={row.text}
                      onChange={(e) => {
                        const copy = [...rows];
                        copy[idx].text = e.target.value;
                        setRows(copy);
                      }}
                      className="flex-1 p-1.5 border border-line rounded bg-paper focus:outline-none focus:ring-1 focus:ring-verdigris-700"
                      placeholder="text (1–80 ASCII)"
                      maxLength={80}
                    />
                    <select
                      value={row.repeat}
                      onChange={(e) => {
                        const copy = [...rows];
                        copy[idx].repeat = parseInt(e.target.value);
                        setRows(copy);
                      }}
                      className="p-1.5 border border-line rounded bg-paper focus:outline-none"
                    >
                      <option value={1}>repeat 1</option>
                      <option value={2}>repeat 2</option>
                      <option value={3}>repeat 3</option>
                    </select>
                    <select
                      value={row.mode}
                      onChange={(e) => {
                        const copy = [...rows];
                        copy[idx].mode = e.target.value as "UPPER" | "LOWER";
                        setRows(copy);
                      }}
                      className="p-1.5 border border-line rounded bg-paper focus:outline-none"
                    >
                      <option value="UPPER">UPPER</option>
                      <option value="LOWER">LOWER</option>
                    </select>
                    {rows.length > 1 && (
                      <button
                        onClick={() => setRows(rows.filter((_, i) => i !== idx))}
                        className="text-brick-600 hover:opacity-80 px-2 py-1 font-bold"
                        title="Delete row"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="text-xs font-mono text-ink-3">
                {sub?.role === "Viewer"
                  ? "Viewer role is read-only. Run button disabled."
                  : sub?.status === "Suspended"
                  ? "Workspace suspended. Submissions disabled."
                  : sub && sub.remaining <= 0
                  ? "Daily quota exhausted. Runs reset at 00:00 UTC."
                  : "Automatic Idempotency-Key generated per draft."}
              </div>
              <button
                onClick={handleSubmit}
                disabled={
                  loading ||
                  sub?.role === "Viewer" ||
                  sub?.status === "Suspended" ||
                  (sub ? sub.remaining <= 0 : false)
                }
                className="w-full sm:w-auto px-6 py-2.5 bg-verdigris-700 hover:bg-verdigris-800 disabled:opacity-50 text-card rounded text-sm font-semibold transition-colors shadow-sm"
              >
                {loading ? "Executing…" : `Run ${operation}`}
              </button>
            </div>

            {/* Proof Result Display */}
            {activeResult && activeResult.result && (
              <div className="p-6 bg-card border border-line rounded shadow-raised space-y-4">
                <div className="flex justify-between items-center border-b border-line pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-ochre-500 font-bold">▌</span>
                    <h3 className="font-serif text-lg font-bold text-ink">Proof Result</h3>
                  </div>
                  <span className="text-xs font-mono text-moss-600 font-semibold bg-moss-100 px-2.5 py-0.5 rounded border border-moss-600/30">
                    {activeResult.status}
                  </span>
                </div>

                {activeResult.result.operation === "validate" && (
                  <div className="font-mono text-xs space-y-3">
                    <div className="flex space-x-6 text-ink-2">
                      <div>
                        Valid rows: <strong className="text-ink">{activeResult.result.valid_rows}</strong>
                      </div>
                      <div>
                        Invalid rows:{" "}
                        <strong className="text-brick-600">
                          {activeResult.result.invalid_rows}
                        </strong>
                      </div>
                    </div>

                    {activeResult.result.issues && activeResult.result.issues.length > 0 && (
                      <div className="mt-3 p-3 bg-brick-100/50 border border-brick-600/30 rounded space-y-1.5 text-brick-600">
                        <div className="font-bold uppercase tracking-wider text-[11px]">
                          Reported Rule Issues:
                        </div>
                        {activeResult.result.issues.map((iss, i) => (
                          <div key={i} className="flex space-x-2">
                            <span>Row {iss.row_index}:</span>
                            <span>field '{iss.field}'</span>
                            <span className="font-bold">[{iss.rule_id}]</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeResult.result.operation === "process" && (
                  <div className="font-mono text-xs space-y-4">
                    <div className="text-ink-2">
                      Summary: {activeResult.result.summary?.input_rows} rows in,{" "}
                      {activeResult.result.summary?.output_characters} characters transformed.
                    </div>
                    <div className="space-y-1.5 bg-paper-2 p-3.5 rounded border border-line">
                      {activeResult.result.rows?.map((r, i) => (
                        <div key={i} className="flex justify-between items-center">
                          <span className="font-bold text-ink">{r.record_id}:</span>
                          <span className="text-verdigris-800 font-semibold">"{r.output}"</span>
                          <span className="text-ink-3">len {r.length}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* History Tab */
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-line pb-3">
              <h2 className="font-serif text-2xl font-bold text-ink">Execution History</h2>
              <span className="text-xs font-mono text-ink-3">
                {historyRuns.length} runs recorded
              </span>
            </div>

            <div className="bg-card border border-line rounded shadow-raised divide-y divide-line text-xs font-mono overflow-hidden">
              {historyRuns.length === 0 ? (
                <div className="p-6 text-center text-ink-3">
                  No runs yet for this workspace. Submit a batch from Run tools to see it here.
                </div>
              ) : (
                historyRuns.map((r) => (
                  <div
                    key={r.run_id}
                    onClick={() => handleSelectHistory(r.run_id)}
                    className={`p-3.5 flex justify-between items-center cursor-pointer hover:bg-paper transition-colors ${
                      selectedRunId === r.run_id ? "bg-verdigris-100/50" : ""
                    }`}
                  >
                    <div className="space-x-2">
                      <span className="font-bold uppercase text-ink">{r.operation}</span>
                      <span className="text-ink-3">·</span>
                      <span className="text-ink-2">{r.run_id.substring(0, 8)}…</span>
                      <span className="text-ink-3">({r.row_count} rows)</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span
                        className={`px-2 py-0.5 rounded font-bold ${
                          r.status === "Succeeded"
                            ? "bg-moss-100 text-moss-600"
                            : r.status === "Running"
                            ? "bg-slate-100 text-slate-500"
                            : "bg-brick-100 text-brick-600"
                        }`}
                      >
                        {r.status}
                      </span>
                      <span className="text-ink-3">
                        {new Date(r.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* History Details */}
            {activeResult && activeResult.result && (
              <div className="p-6 bg-card border border-line rounded shadow-raised font-mono text-xs space-y-3">
                <div className="flex justify-between items-center border-b border-line pb-2">
                  <div className="font-bold text-ink">Run Details: {activeResult.run_id}</div>
                  <span className="text-moss-600 font-bold bg-moss-100 px-2 py-0.5 rounded">
                    {activeResult.status}
                  </span>
                </div>
                <pre className="bg-paper-2 p-4 rounded border border-line overflow-x-auto text-ink">
                  {JSON.stringify(activeResult.result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Tier 2 Upgrade Modal */}
      {showUpgradeModal && (
        <UpgradeModal
          onClose={() => setShowUpgradeModal(false)}
          onSuccess={async () => {
            await loadSubscription();
          }}
        />
      )}
    </div>
  );
}

export default App;
