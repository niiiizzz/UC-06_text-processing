import React, { useState } from "react";

interface UpgradeModalProps {
  onClose: () => void;
  onSuccess: () => void;
  currentPlan?: string;
  userRole?: string;
}

const TEST_VOUCHERS = [
  {
    code: "BENCH-CLEAR",
    label: "Instant Settlement (Success)",
    desc: "Simulates approved authorization & immediate Pro activation",
    outcome: "settled",
    badge: "Recommended",
  },
  {
    code: "BENCH-DECLINE",
    label: "Card / Balance Declined",
    desc: "Simulates insufficient funds or failed bank authorization",
    outcome: "declined",
    badge: "Fail Test",
  },
  {
    code: "BENCH-HOLD",
    label: "Security Review Hold",
    desc: "Simulates manual compliance review hold status",
    outcome: "held",
    badge: "Pending",
  },
  {
    code: "BENCH-EXPIRE",
    label: "Expired Payment Token",
    desc: "Simulates session/payment token timeout",
    outcome: "expired",
    badge: "Timeout",
  },
];

export function UpgradeModal({ onClose, onSuccess, currentPlan = "Basic", userRole = "Operator" }: UpgradeModalProps) {
  const [step, setStep] = useState<"pledge" | "payment" | "processing" | "receipt">("pledge");
  const [pledgeId, setPledgeId] = useState<string | null>(null);
  const [voucher, setVoucher] = useState("BENCH-CLEAR");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "upi" | "netbanking">("card");
  const [cardNumber, setCardNumber] = useState("4242 •••• •••• 4242");
  const [receipt, setReceipt] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isViewer = userRole === "Viewer";

  const handleCreatePledge = async () => {
    if (isViewer) {
      setErrorMsg("Viewers have read-only privileges. Only workspace Operators can authorize plan upgrades.");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/billing/pledges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_plan: "Pro" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to create upgrade pledge");
      }
      setPledgeId(data.pledge_id);
      setStep("payment");
    } catch (err: any) {
      // If billing API is disabled or errored, offer simulation fallback
      setErrorMsg(err.message || "Failed to initiate pledge.");
    } finally {
      setLoading(false);
    }
  };

  const handleExecutePayment = async () => {
    if (!pledgeId) return;
    setLoading(true);
    setErrorMsg(null);
    setStep("processing");

    // Realistic brief payment gateway latency simulation
    await new Promise((r) => setTimeout(r, 1200));

    try {
      const res = await fetch(`/billing/pledges/${pledgeId}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voucher: voucher.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Settlement failed");
      }

      if (data.status === "settled") {
        setReceipt(data.receipt);
        setStep("receipt");
        onSuccess();
      } else {
        setStep("payment");
        setErrorMsg(
          data.reason || data.message || `Payment simulation ended with status: ${data.status}`
        );
      }
    } catch (err: any) {
      setStep("payment");
      setErrorMsg(err.message || "Settlement failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.72)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 620,
          background: "var(--card, #ffffff)",
          border: "1px solid var(--line, #e2e8f0)",
          borderRadius: 16,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "fadeScale 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <style>{`
          @keyframes fadeScale {
            from { opacity: 0; transform: scale(0.97); }
            to { opacity: 1; transform: scale(1); }
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>

        {/* Modal Header */}
        <div
          style={{
            padding: "20px 24px",
            background: "var(--night, #11141a)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "JetBrains Mono, monospace",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: "rgba(194, 138, 44, 0.2)",
                  color: "var(--ochre-500, #c28a2c)",
                }}
              >
                TextForge Commerce
              </span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>• Tier 2 Gateway</span>
            </div>
            <h2
              style={{
                fontFamily: "'DM Serif Display', Georgia, serif",
                fontSize: 22,
                color: "white",
                margin: "4px 0 0",
                fontWeight: 400,
              }}
            >
              {step === "receipt" ? "Payment Confirmed" : "Upgrade to Pro Workspace"}
            </h2>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "none",
              color: "rgba(255,255,255,0.6)",
              cursor: "pointer",
              width: 32,
              height: 32,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.18)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
          >
            ✕
          </button>
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div
            style={{
              margin: "16px 24px 0",
              padding: "12px 16px",
              background: "var(--brick-100, #fdf2f2)",
              border: "1px solid rgba(197, 65, 43, 0.3)",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "var(--brick-600, #c5412b)",
              fontSize: 12.5,
              fontWeight: 500,
            }}
          >
            <span>⚠️</span>
            <div style={{ flex: 1 }}>{errorMsg}</div>
          </div>
        )}

        {/* Modal Body */}
        <div style={{ padding: "24px", overflowY: "auto", maxHeight: "calc(85vh - 120px)" }}>

          {/* ── STEP 1: Plan Summary & Upgrade Pledge ── */}
          {step === "pledge" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Plan Comparison Card */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                  background: "var(--paper-2, #f8fafc)",
                  padding: 16,
                  borderRadius: 12,
                  border: "1px solid var(--line, #e2e8f0)",
                }}
              >
                {/* Current Plan */}
                <div style={{ padding: 12, background: "var(--card, #fff)", borderRadius: 8, border: "1px solid var(--line)" }}>
                  <div style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: "var(--ink-3)", textTransform: "uppercase" }}>Current Plan</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: "4px 0" }}>Basic</div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)" }}>₹0 / month</div>
                  <div style={{ marginTop: 10, fontSize: 12, display: "flex", flexDirection: "column", gap: 5, color: "var(--ink-2)" }}>
                    <div>• <strong>3</strong> runs per day</div>
                    <div>• Validate operation only</div>
                    <div>• Ephemeral run state</div>
                  </div>
                </div>

                {/* Target Plan */}
                <div style={{ padding: 12, background: "var(--night, #11141a)", borderRadius: 8, border: "1px solid var(--ochre-500)", color: "white" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: "var(--ochre-500)", textTransform: "uppercase", fontWeight: 700 }}>Recommended</div>
                    <span style={{ fontSize: 9, padding: "1px 5px", background: "var(--ochre-500)", color: "white", borderRadius: 3, fontWeight: 700 }}>NEW</span>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, margin: "4px 0", color: "white" }}>Pro Workspace</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>₹499 / month</div>
                  <div style={{ marginTop: 10, fontSize: 12, display: "flex", flexDirection: "column", gap: 5, color: "rgba(255,255,255,0.85)" }}>
                    <div>• <strong>10</strong> runs daily allowance</div>
                    <div>• <strong>Process</strong> transform unlocked</div>
                    <div>• Azure Blob Storage persistence</div>
                  </div>
                </div>
              </div>

              {/* Order Breakdown */}
              <div
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  padding: "14px 16px",
                  fontSize: 13,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: "var(--ink-2)" }}>
                  <span>Pro Workspace Subscription (1 Month)</span>
                  <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 600 }}>₹499.00</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: "var(--ink-3)", fontSize: 12 }}>
                  <span>Azure Sandbox Test Discount (100%)</span>
                  <span style={{ color: "var(--moss-600)", fontFamily: "JetBrains Mono, monospace" }}>- ₹499.00</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingTop: 8,
                    borderTop: "1px solid var(--line)",
                    fontWeight: 700,
                    color: "var(--ink)",
                    fontSize: 14,
                  }}
                >
                  <span>Due Today (Sandbox Simulated)</span>
                  <span style={{ fontFamily: "JetBrains Mono, monospace", color: "var(--verdigris-700)" }}>₹0.00 / Test Voucher</span>
                </div>
              </div>

              {isViewer && (
                <div style={{ fontSize: 12, color: "var(--brick-600)", background: "var(--brick-100)", padding: 10, borderRadius: 6 }}>
                  Notice: Your account has the <strong>Viewer</strong> role. Only Operators can commit upgrade pledges.
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 4 }}>
                <button className="btn btn-md btn-secondary" onClick={onClose} disabled={loading}>
                  Cancel
                </button>
                <button
                  className="btn btn-md btn-primary"
                  onClick={handleCreatePledge}
                  disabled={loading || isViewer}
                  style={{ minWidth: 160 }}
                >
                  {loading ? "Initializing..." : "Proceed to Payment →"}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Interactive Payment Simulation ── */}
          {step === "payment" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Pledge Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "var(--paper-2)",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 11.5,
                }}
              >
                <span style={{ color: "var(--ink-3)" }}>PLEDGE ID:</span>
                <span style={{ fontWeight: 700, color: "var(--ink)" }}>{pledgeId}</span>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8, display: "block" }}>
                  Select Payment Method (Sandbox Simulation)
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {[
                    { id: "card", label: "Credit Card", icon: "💳" },
                    { id: "upi", label: "UPI / QR", icon: "📱" },
                    { id: "netbanking", label: "NetBanking", icon: "🏦" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as any)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: paymentMethod === m.id ? "2px solid var(--verdigris-700)" : "1px solid var(--line)",
                        background: paymentMethod === m.id ? "rgba(42, 107, 91, 0.08)" : "var(--card)",
                        color: "var(--ink)",
                        fontWeight: 600,
                        fontSize: 12.5,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      <span>{m.icon}</span> {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Simulated Card Details */}
              {paymentMethod === "card" && (
                <div
                  style={{
                    padding: 16,
                    background: "var(--paper-2)",
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div>
                    <label style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: "var(--ink-3)", display: "block", marginBottom: 4 }}>CARD NUMBER</label>
                    <input
                      type="text"
                      className="input"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 13 }}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: "var(--ink-3)", display: "block", marginBottom: 4 }}>EXPIRY</label>
                      <input type="text" className="input" defaultValue="12/28" style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: "var(--ink-3)", display: "block", marginBottom: 4 }}>CVV / CVC</label>
                      <input type="password" className="input" defaultValue="982" style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 13 }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Test Voucher Selector (The actual backend contract) */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                  <span>Settlement Voucher (Evaluation Harness)</span>
                  <span style={{ fontSize: 11, color: "var(--ochre-500)", fontWeight: 500 }}>Competition Test Scenarios</span>
                </label>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {TEST_VOUCHERS.map((v) => {
                    const isSelected = voucher === v.code;
                    return (
                      <div
                        key={v.code}
                        onClick={() => setVoucher(v.code)}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 8,
                          border: isSelected ? "2px solid var(--verdigris-700)" : "1px solid var(--line)",
                          background: isSelected ? "rgba(42, 107, 91, 0.06)" : "var(--card)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          transition: "all 0.15s",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <input
                            type="radio"
                            name="voucher"
                            checked={isSelected}
                            onChange={() => setVoucher(v.code)}
                            style={{ accentColor: "var(--verdigris-700)", cursor: "pointer" }}
                          />
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>{v.code}</span>
                              <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: isSelected ? "var(--verdigris-700)" : "var(--paper-2)", color: isSelected ? "white" : "var(--ink-2)", fontWeight: 600 }}>{v.badge}</span>
                            </div>
                            <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>{v.desc}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setStep("pledge")}
                  disabled={loading}
                >
                  ← Back
                </button>

                <button
                  type="button"
                  className="btn btn-md btn-primary"
                  onClick={handleExecutePayment}
                  disabled={loading}
                  style={{ minWidth: 180, gap: 8 }}
                >
                  <span>Authorize & Settle</span>
                  <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>₹499</span>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Gateway Processing Loader ── */}
          {step === "processing" && (
            <div style={{ padding: "48px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  border: "3px solid var(--line)",
                  borderTopColor: "var(--verdigris-700)",
                  animation: "spin 0.8s linear infinite",
                  marginBottom: 20,
                }}
              />
              <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: "var(--ink)", margin: "0 0 8px" }}>
                Contacting Banking Gateway...
              </h3>
              <p style={{ fontSize: 13, color: "var(--ink-3)", maxWidth: 360, margin: 0, lineHeight: 1.6 }}>
                Validating cryptographic pledge and executing settlement with test voucher <code style={{ color: "var(--ochre-500)", fontWeight: 700 }}>{voucher}</code>.
              </p>
            </div>
          )}

          {/* ── STEP 4: Certified Receipt ── */}
          {step === "receipt" && receipt && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div
                style={{
                  padding: 20,
                  borderRadius: 12,
                  background: "var(--paper-2)",
                  border: "1px solid var(--moss-600)",
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", pb: 10, paddingBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--moss-600)", fontWeight: 700 }}>
                    <span>✓</span>
                    <span>SETTLEMENT CONFIRMED</span>
                  </div>
                  <span style={{ fontSize: 10, background: "var(--moss-100)", color: "var(--moss-600)", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>PRO ACTIVE</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--ink-3)" }}>RECEIPT NUMBER:</span>
                  <span style={{ fontWeight: 700, color: "var(--ink)" }}>{receipt.receipt_no}</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--ink-3)" }}>WORKSPACE PLAN:</span>
                  <span style={{ fontWeight: 700, color: "var(--verdigris-700)" }}>{receipt.plan} (10 runs / day)</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--ink-3)" }}>SETTLED AMOUNT:</span>
                  <span style={{ fontWeight: 700, color: "var(--ink)" }}>₹{(receipt.amount_minor / 100).toFixed(2)} INR</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--ink-3)" }}>TIMESTAMP:</span>
                  <span style={{ color: "var(--ink-2)" }}>{new Date(receipt.settled_at).toLocaleString()}</span>
                </div>

                <div style={{ paddingTop: 8, borderTop: "1px solid var(--line)" }}>
                  <div style={{ fontSize: 10, color: "var(--ink-3)", marginBottom: 4 }}>HMAC AUDIT SIGNATURE</div>
                  <div style={{ fontSize: 9.5, color: "var(--ink-2)", wordBreak: "break-all", background: "var(--card)", padding: 8, borderRadius: 4, border: "1px solid var(--line)" }}>
                    {receipt.signature}
                  </div>
                </div>
              </div>

              <p style={{ fontSize: 12.5, color: "var(--ink-2)", textAlign: "center", margin: 0 }}>
                Your workspace quota has been increased to <strong>10 runs/day</strong> and the <strong>Process</strong> tool is now active.
              </p>

              <button
                className="btn btn-lg btn-primary"
                onClick={onClose}
                style={{ width: "100%", justifyContent: "center" }}
              >
                Return to Workspace
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
