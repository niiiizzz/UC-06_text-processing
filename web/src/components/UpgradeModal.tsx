import React, { useState } from "react";

interface UpgradeModalProps {
  onClose: () => void;
  onSuccess: () => void;
  currentPlan?: string;
  userRole?: string;
  tenantName?: string;
  userEmail?: string;
}

const TEST_VOUCHERS = [
  {
    code: "BENCH-CLEAR",
    label: "Instant Settlement (Success)",
    desc: "Simulates approved authorization & immediate Pro activation",
    outcome: "settled",
  },
  {
    code: "BENCH-DECLINE",
    label: "Card / Balance Declined",
    desc: "Simulates insufficient funds or failed bank authorization",
    outcome: "declined",
  },
  {
    code: "BENCH-HOLD",
    label: "Security Review Hold",
    desc: "Simulates manual compliance review hold status",
    outcome: "held",
  },
  {
    code: "BENCH-EXPIRE",
    label: "Expired Payment Token",
    desc: "Simulates session/payment token timeout",
    outcome: "expired",
  },
];

export function UpgradeModal({
  onClose,
  onSuccess,
  currentPlan = "Basic",
  userRole = "Operator",
  tenantName = "Workspace",
  userEmail = "operator@textforge.test",
}: UpgradeModalProps) {
  // Page mode: "plan_comparison" (Claude Pro style comparison page) | "checkout" (Razorpay-style modal) | "success"
  const [viewMode, setViewMode] = useState<"plan_comparison" | "checkout" | "success">("plan_comparison");
  const [pledgeId, setPledgeId] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  // Razorpay-style checkout states
  const [paymentTab, setPaymentTab] = useState<"card" | "upi" | "netbanking" | "wallet">("card");
  const [cardNumber, setCardNumber] = useState("4532 •••• •••• 8892");
  const [cardExpiry, setCardExpiry] = useState("08/29");
  const [cardCvv, setCardCvv] = useState("•••");
  const [cardHolder, setCardHolder] = useState("Authorized Operator");
  const [upiId, setUpiId] = useState("operator@oksbi");
  const [selectedBank, setSelectedBank] = useState("HDFC");
  const [selectedVoucher, setSelectedVoucher] = useState("BENCH-CLEAR");
  const [isProcessing, setIsProcessing] = useState(false);
  const [receipt, setReceipt] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isViewer = userRole === "Viewer";
  const amountMinor = 49900; // Rs 499.00
  const amountFormatted = "₹499.00";

  // Step 1 -> Step 2: Initialize pledge with backend
  const handleProceedToCheckout = async () => {
    if (isViewer) {
      setErrorMsg("Your account has the Viewer role. Only workspace Operators can authorize plan subscriptions.");
      return;
    }
    setErrorMsg(null);
    setIsProcessing(true);
    try {
      const res = await fetch("/billing/pledges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_plan: "Pro" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to create subscription pledge");
      }
      setPledgeId(data.pledge_id);
      setViewMode("checkout");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to initialize checkout.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Step 2 -> Step 3: Settle payment simulation (Razorpay style)
  const handlePayNow = async () => {
    if (!pledgeId) return;
    setIsProcessing(true);
    setErrorMsg(null);

    // Realistic Razorpay OTP / 3D Secure simulation delay
    await new Promise((r) => setTimeout(r, 1400));

    try {
      const res = await fetch(`/billing/pledges/${pledgeId}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voucher: selectedVoucher }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Payment authorization failed");
      }

      if (data.status === "settled") {
        setReceipt(data.receipt);
        setViewMode("success");
        onSuccess();
      } else {
        setErrorMsg(
          data.reason || data.message || `Payment declined by bank (${data.status}). Try selecting BENCH-CLEAR.`
        );
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Payment transaction could not be completed.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: viewMode === "plan_comparison" ? "rgba(10, 12, 16, 0.88)" : "rgba(15, 23, 42, 0.78)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        overflowY: "auto",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <style>{`
        @keyframes modalEnter {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes rzpSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* ══════════════════════════════════════════════════════════════════════
          PAGE 1: CLAUDE-STYLE PLAN UPGRADE SUBSCRIPTION PAGE
      ══════════════════════════════════════════════════════════════════════ */}
      {viewMode === "plan_comparison" && (
        <div
          style={{
            width: "100%",
            maxWidth: 920,
            background: "var(--card, #ffffff)",
            borderRadius: 20,
            boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.5)",
            border: "1px solid var(--line, #e2e8f0)",
            overflow: "hidden",
            animation: "modalEnter 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
            position: "relative",
          }}
        >
          {/* Top Bar with Dismiss */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px 28px",
              borderBottom: "1px solid var(--line)",
              background: "var(--paper-2, #fafafa)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  fontFamily: "'DM Serif Display', Georgia, serif",
                  fontSize: 20,
                  color: "var(--ink, #1e293b)",
                  letterSpacing: "-0.02em",
                }}
              >
                textforge
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  fontFamily: "JetBrains Mono, monospace",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  background: "var(--ochre-100, #fef3c7)",
                  color: "var(--ochre-500, #c28a2c)",
                  padding: "2px 7px",
                  borderRadius: 4,
                }}
              >
                Pro Subscription
              </span>
            </div>

            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                fontSize: 18,
                color: "var(--ink-3)",
                cursor: "pointer",
                padding: "6px 10px",
                borderRadius: 6,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-3)")}
            >
              ✕
            </button>
          </div>

          <div style={{ padding: "36px 36px 40px" }}>
            {/* Header / Hero like Claude Pro */}
            <div style={{ textAlign: "center", maxWidth: 580, margin: "0 auto 36px" }}>
              <h2
                style={{
                  fontFamily: "'DM Serif Display', Georgia, serif",
                  fontSize: 34,
                  fontWeight: 400,
                  color: "var(--ink)",
                  margin: "0 0 10px",
                  letterSpacing: "-0.02em",
                }}
              >
                Upgrade to TextForge Pro
              </h2>
              <p style={{ fontSize: 14.5, color: "var(--ink-2)", lineHeight: 1.6, margin: 0 }}>
                Unlock high-throughput deterministic text processing, Azure Blob Storage persistence, and 10 daily runs for your entire workspace.
              </p>

              {/* Billing Cycle Toggle */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  background: "var(--paper-2)",
                  border: "1px solid var(--line)",
                  borderRadius: 999,
                  padding: 3,
                  marginTop: 20,
                  gap: 4,
                }}
              >
                <button
                  type="button"
                  onClick={() => setBillingCycle("monthly")}
                  style={{
                    border: "none",
                    borderRadius: 999,
                    padding: "6px 16px",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    background: billingCycle === "monthly" ? "var(--ink)" : "transparent",
                    color: billingCycle === "monthly" ? "#ffffff" : "var(--ink-2)",
                    transition: "all 0.15s",
                  }}
                >
                  Monthly billing
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle("yearly")}
                  style={{
                    border: "none",
                    borderRadius: 999,
                    padding: "6px 16px",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    background: billingCycle === "yearly" ? "var(--ink)" : "transparent",
                    color: billingCycle === "yearly" ? "#ffffff" : "var(--ink-2)",
                    transition: "all 0.15s",
                  }}
                >
                  Annual (20% off)
                </button>
              </div>
            </div>

            {errorMsg && (
              <div
                style={{
                  maxWidth: 780,
                  margin: "0 auto 24px",
                  padding: "12px 18px",
                  borderRadius: 8,
                  background: "var(--brick-100, #fdf2f2)",
                  border: "1px solid rgba(197, 65, 43, 0.25)",
                  color: "var(--brick-600, #c5412b)",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span>⚠️</span>
                <div>{errorMsg}</div>
              </div>
            )}

            {/* Comparison Cards (Claude-style Side-by-Side) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 24,
                maxWidth: 820,
                margin: "0 auto",
                alignItems: "stretch",
              }}
            >
              {/* CURRENT PLAN: BASIC */}
              <div
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: 16,
                  padding: "28px 24px",
                  background: "var(--paper, #fbfbf9)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "JetBrains Mono, monospace" }}>
                      Basic Plan
                    </span>
                    <span style={{ fontSize: 11, background: "var(--paper-2)", color: "var(--ink-3)", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>
                      Current Plan
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 16 }}>
                    <span style={{ fontSize: 32, fontWeight: 700, color: "var(--ink)", fontFamily: "JetBrains Mono, monospace" }}>
                      ₹0
                    </span>
                    <span style={{ fontSize: 13, color: "var(--ink-3)" }}>/ forever</span>
                  </div>

                  <p style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.5, marginBottom: 20 }}>
                    Core text validation capabilities for exploration and initial unit evaluation.
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12, borderTop: "1px solid var(--line)", paddingTop: 18 }}>
                    {[
                      { text: "3 daily batch runs", included: true },
                      { text: "Validate tool (Rules R1–R4)", included: true },
                      { text: "Full row-level error reporting", included: true },
                      { text: "Replay idempotency safety", included: true },
                      { text: "Process tool (Transform engine)", included: false },
                      { text: "Azure Blob Storage persistence", included: false },
                    ].map((feat, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                        <span
                          style={{
                            color: feat.included ? "var(--verdigris-700)" : "var(--ink-3)",
                            fontWeight: 700,
                            fontSize: feat.included ? 14 : 12,
                            width: 14,
                          }}
                        >
                          {feat.included ? "✓" : "—"}
                        </span>
                        <span style={{ color: feat.included ? "var(--ink-2)" : "var(--ink-3)", textDecoration: feat.included ? "none" : "line-through" }}>
                          {feat.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: 28, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
                  <button
                    disabled
                    style={{
                      width: "100%",
                      padding: "11px",
                      borderRadius: 8,
                      border: "1px solid var(--line)",
                      background: "transparent",
                      color: "var(--ink-3)",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "default",
                    }}
                  >
                    Current Workspace Plan
                  </button>
                </div>
              </div>

              {/* TARGET PLAN: PRO (Highlighted) */}
              <div
                style={{
                  border: "2px solid var(--ochre-500, #c28a2c)",
                  borderRadius: 16,
                  padding: "28px 24px",
                  background: "var(--night, #11141a)",
                  color: "#ffffff",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  position: "relative",
                  boxShadow: "0 12px 30px -10px rgba(194, 138, 44, 0.35)",
                }}
              >
                {/* Popular Badge */}
                <div
                  style={{
                    position: "absolute",
                    top: -12,
                    right: 24,
                    background: "var(--ochre-500, #c28a2c)",
                    color: "#ffffff",
                    fontSize: 10.5,
                    fontFamily: "JetBrains Mono, monospace",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    padding: "3px 10px",
                    borderRadius: 999,
                    letterSpacing: "0.06em",
                  }}
                >
                  Most Popular
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ochre-500)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "JetBrains Mono, monospace" }}>
                      TextForge Pro
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 16 }}>
                    <span style={{ fontSize: 34, fontWeight: 700, color: "#ffffff", fontFamily: "JetBrains Mono, monospace" }}>
                      ₹499
                    </span>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>/ month</span>
                  </div>

                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, marginBottom: 20 }}>
                    High-throughput text transformation with permanent cryptographic proof logging in Azure Blob Storage.
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12, borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 18 }}>
                    {[
                      "10 daily runs (3.3× allowance)",
                      "Full Process transformation unlocked",
                      "Private Azure Blob result persistence",
                      "Audit-grade execution proofs & telemetry",
                      "Priority conditional atomic reservation",
                      "Free unlimited idempotent replays",
                    ].map((feat, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                        <span style={{ color: "var(--ochre-500)", fontWeight: 700, fontSize: 15, width: 14 }}>
                          ✓
                        </span>
                        <span style={{ color: "rgba(255,255,255,0.92)", fontWeight: 500 }}>
                          {feat}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: 28, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
                  <button
                    onClick={handleProceedToCheckout}
                    disabled={isProcessing || isViewer}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: 8,
                      border: "none",
                      background: "var(--ochre-500, #c28a2c)",
                      color: "#ffffff",
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: isViewer ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      transition: "transform 0.15s, opacity 0.15s",
                      opacity: isViewer ? 0.6 : 1,
                    }}
                    onMouseEnter={(e) => (!isViewer && (e.currentTarget.style.transform = "scale(1.02)"))}
                    onMouseLeave={(e) => (!isViewer && (e.currentTarget.style.transform = "scale(1)"))}
                  >
                    {isProcessing ? "Connecting to Gateway…" : "Subscribe to Pro →"}
                  </button>
                  {isViewer && (
                    <div style={{ textAlign: "center", fontSize: 11, color: "var(--ochre-500)", marginTop: 8 }}>
                      Read-only role: Operator access required to upgrade.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PAGE 2: RAZORPAY-STYLE CHECKOUT MODAL SIMULATION
      ══════════════════════════════════════════════════════════════════════ */}
      {viewMode === "checkout" && (
        <div
          style={{
            width: "100%",
            maxWidth: 680,
            background: "#ffffff",
            borderRadius: 16,
            boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.6)",
            overflow: "hidden",
            animation: "modalEnter 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Razorpay-style Gradient Header */}
          <div
            style={{
              background: "linear-gradient(135deg, #0c2340 0%, #173b6c 100%)",
              color: "#ffffff",
              padding: "18px 24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              position: "relative",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    fontFamily: "'DM Serif Display', Georgia, serif",
                  }}
                >
                  textforge
                </span>
                <span style={{ fontSize: 11, opacity: 0.5 }}>|</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.04em", color: "#60a5fa" }}>
                  GATEWAY CHECKOUT
                </span>
              </div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                Subscribing workspace: <strong>{tenantName}</strong>
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>
                {amountFormatted}
              </div>
              <div style={{ fontSize: 11, opacity: 0.75 }}>PLEDGE: {pledgeId?.slice(0, 10)}…</div>
            </div>

            <button
              onClick={() => setViewMode("plan_comparison")}
              style={{
                position: "absolute",
                top: 14,
                right: 14,
                background: "rgba(255,255,255,0.12)",
                border: "none",
                borderRadius: "50%",
                width: 26,
                height: 26,
                color: "#ffffff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
              }}
            >
              ✕
            </button>
          </div>

          {/* Checkout Body Split: Left Tabs, Right Form */}
          <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", minHeight: 380 }}>
            {/* Left Method Tabs (Razorpay Sidebar) */}
            <div
              style={{
                background: "#f8fafc",
                borderRight: "1px solid #e2e8f0",
                display: "flex",
                flexDirection: "column",
                padding: "12px 0",
              }}
            >
              <div style={{ padding: "8px 16px 12px", fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Payment Options
              </div>

              {[
                { id: "card", label: "Card", icon: "💳", sub: "Visa, Mastercard, RuPay" },
                { id: "upi", label: "UPI / QR", icon: "⚡", sub: "Google Pay, PhonePe" },
                { id: "netbanking", label: "NetBanking", icon: "🏦", sub: "All Indian banks" },
                { id: "wallet", label: "Test Voucher", icon: "🎟️", sub: "Evaluation sandbox" },
              ].map((tab) => {
                const isActive = paymentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPaymentTab(tab.id as any)}
                    style={{
                      border: "none",
                      borderLeft: isActive ? "3px solid #2563eb" : "3px solid transparent",
                      background: isActive ? "#ffffff" : "transparent",
                      padding: "12px 16px",
                      textAlign: "left",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? "#0f172a" : "#475569" }}>
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                    </div>
                    <span style={{ fontSize: 10, color: "#94a3b8", paddingLeft: 22 }}>{tab.sub}</span>
                  </button>
                );
              })}

              <div style={{ marginTop: "auto", padding: "16px", borderTop: "1px solid #e2e8f0", fontSize: 11, color: "#64748b" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, color: "#16a34a" }}>
                  <span>🔒</span> 256-bit Encrypted
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>Sandbox Simulation Mode</div>
              </div>
            </div>

            {/* Right Pane: Method Content & Voucher Selector */}
            <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                {/* Method Form: Card */}
                {paymentTab === "card" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 2 }}>
                      Pay via Credit or Debit Card
                    </div>

                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Card Number</label>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          fontFamily: "JetBrains Mono, monospace",
                          fontSize: 13.5,
                          marginTop: 4,
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Valid Thru</label>
                        <input
                          type="text"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: 8,
                            border: "1px solid #cbd5e1",
                            fontFamily: "JetBrains Mono, monospace",
                            fontSize: 13.5,
                            marginTop: 4,
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>CVV</label>
                        <input
                          type="password"
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: 8,
                            border: "1px solid #cbd5e1",
                            fontFamily: "JetBrains Mono, monospace",
                            fontSize: 13.5,
                            marginTop: 4,
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Cardholder Name</label>
                      <input
                        type="text"
                        value={cardHolder}
                        onChange={(e) => setCardHolder(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          fontSize: 13,
                          marginTop: 4,
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Method Form: UPI */}
                {paymentTab === "upi" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>Instant UPI Transfer</div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Virtual Payment Address (VPA)</label>
                      <input
                        type="text"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          fontFamily: "JetBrains Mono, monospace",
                          fontSize: 13.5,
                          marginTop: 4,
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                    <div style={{ background: "#f1f5f9", padding: "12px", borderRadius: 8, fontSize: 11.5, color: "#475569" }}>
                      Scan QR code or approve notification on your UPI app after clicking Pay Now.
                    </div>
                  </div>
                )}

                {/* Method Form: NetBanking */}
                {paymentTab === "netbanking" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>Popular Banks</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {["HDFC", "ICICI", "SBI", "Axis Bank"].map((bank) => (
                        <button
                          key={bank}
                          type="button"
                          onClick={() => setSelectedBank(bank)}
                          style={{
                            padding: "10px",
                            borderRadius: 8,
                            border: selectedBank === bank ? "2px solid #2563eb" : "1px solid #cbd5e1",
                            background: selectedBank === bank ? "#eff6ff" : "#ffffff",
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: "#0f172a",
                            cursor: "pointer",
                            textAlign: "center",
                          }}
                        >
                          {bank}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Method Form: Test Voucher & Scenario */}
                <div style={{ marginTop: 16, borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Settlement Simulation Test Scenario
                    </label>
                    <span style={{ fontSize: 10, color: "#c28a2c", fontWeight: 600 }}>Competition Scenarios</span>
                  </div>

                  <select
                    value={selectedVoucher}
                    onChange={(e) => setSelectedVoucher(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: 12,
                      background: "#f8fafc",
                      color: "#0f172a",
                      cursor: "pointer",
                      boxSizing: "border-box",
                    }}
                  >
                    {TEST_VOUCHERS.map((v) => (
                      <option key={v.code} value={v.code}>
                        {v.code} — {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Submit Payment Bar */}
              <div style={{ marginTop: 24, paddingTop: 14, borderTop: "1px solid #e2e8f0" }}>
                {errorMsg && (
                  <div style={{ fontSize: 11.5, color: "#dc2626", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>⚠️</span> {errorMsg}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handlePayNow}
                  disabled={isProcessing}
                  style={{
                    width: "100%",
                    padding: "13px",
                    borderRadius: 8,
                    border: "none",
                    background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
                  }}
                >
                  {isProcessing ? (
                    <>
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          border: "2px solid rgba(255,255,255,0.4)",
                          borderTopColor: "#ffffff",
                          borderRadius: "50%",
                          animation: "rzpSpin 0.7s linear infinite",
                        }}
                      />
                      <span>Processing Payment…</span>
                    </>
                  ) : (
                    <>
                      <span>Pay {amountFormatted}</span>
                      <span style={{ fontSize: 12, opacity: 0.85 }}>🔒 Razorpay Sim</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PAGE 3: CERTIFIED AUDIT RECEIPT (SUCCESS)
      ══════════════════════════════════════════════════════════════════════ */}
      {viewMode === "success" && receipt && (
        <div
          style={{
            width: "100%",
            maxWidth: 540,
            background: "#ffffff",
            borderRadius: 16,
            boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.5)",
            border: "1px solid #e2e8f0",
            overflow: "hidden",
            animation: "modalEnter 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            padding: "32px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#dcfce7",
              color: "#16a34a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              margin: "0 auto 16px",
            }}
          >
            ✓
          </div>

          <h3
            style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: 26,
              fontWeight: 400,
              color: "#0f172a",
              margin: "0 0 6px",
            }}
          >
            Pro Subscription Activated
          </h3>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 24px" }}>
            Payment simulation settled successfully. Your workspace has been upgraded.
          </p>

          {/* Receipt Card */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "16px 20px",
              textAlign: "left",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 12,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginBottom: 24,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#64748b" }}>RECEIPT NO:</span>
              <span style={{ fontWeight: 700, color: "#0f172a" }}>{receipt.receipt_no}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#64748b" }}>NEW PLAN:</span>
              <span style={{ fontWeight: 700, color: "#16a34a" }}>{receipt.plan} (10 runs / day)</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#64748b" }}>AMOUNT PAID:</span>
              <span style={{ fontWeight: 700, color: "#0f172a" }}>₹{(receipt.amount_minor / 100).toFixed(2)} INR</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#64748b" }}>SETTLED AT:</span>
              <span style={{ color: "#334155" }}>{new Date(receipt.settled_at).toLocaleTimeString()}</span>
            </div>
            <div style={{ paddingTop: 8, borderTop: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 3 }}>HMAC-SHA256 SIGNATURE</div>
              <div style={{ fontSize: 9.5, color: "#475569", wordBreak: "break-all", background: "#ffffff", padding: "6px", borderRadius: 4, border: "1px solid #e2e8f0" }}>
                {receipt.signature}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: 8,
              border: "none",
              background: "#0f172a",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: 13.5,
              cursor: "pointer",
            }}
          >
            Go to Workspace Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
