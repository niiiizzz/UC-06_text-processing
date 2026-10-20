import React, { useState } from "react";

interface UpgradeModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const TEST_VOUCHERS = [
  { code: "BENCH-CLEAR", label: "Clear & Settle (Upgrade immediately)", outcome: "settled" },
  { code: "BENCH-DECLINE", label: "Decline (Insufficient funds)", outcome: "declined" },
  { code: "BENCH-HOLD", label: "Hold (Manual review)", outcome: "held" },
  { code: "BENCH-EXPIRE", label: "Expire (Expired voucher)", outcome: "expired" },
];

export function UpgradeModal({ onClose, onSuccess }: UpgradeModalProps) {
  const [step, setStep] = useState<"pledge" | "settle" | "receipt">("pledge");
  const [pledgeId, setPledgeId] = useState<string | null>(null);
  const [voucher, setVoucher] = useState("BENCH-CLEAR");
  const [receipt, setReceipt] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreatePledge = async () => {
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
      setStep("settle");
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSettlePledge = async () => {
    if (!pledgeId) return;
    setLoading(true);
    setErrorMsg(null);
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
        setErrorMsg(
          data.reason || data.message || `Pledge ended in status: ${data.status}`
        );
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-night/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-line rounded-lg max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-pop">
        <div className="flex justify-between items-start border-b border-line pb-4">
          <div>
            <span className="text-xs font-mono tracking-wider uppercase text-ochre-500 font-semibold">
              TextForge Settle · Checkout
            </span>
            <h3 className="font-serif text-2xl font-semibold text-ink">Upgrade to Pro</h3>
          </div>
          <button
            onClick={onClose}
            className="text-ink-3 hover:text-ink font-mono text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-brick-100 border border-brick-600/40 text-brick-600 text-xs rounded font-medium flex items-center space-x-2">
            <span>✕</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {step === "pledge" && (
          <div className="space-y-6">
            <div className="p-4 bg-paper-2 border border-line rounded space-y-3 font-mono text-sm">
              <div className="flex justify-between">
                <span className="text-ink-2">Target Plan:</span>
                <span className="font-bold text-ink">Pro (10 daily runs)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-2">Price:</span>
                <span className="font-bold text-ink">₹499 / month</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-2">Environment:</span>
                <span className="text-ochre-500 font-bold">Azure Sandbox (Simulated)</span>
              </div>
            </div>

            <p className="text-xs text-ink-2 leading-relaxed">
              Upgrading raises your workspace's daily allowance from 3 to 10 runs and unlocks the
              <strong> Process</strong> tool with private blob storage persistence. Runs used earlier
              today still count toward today's total.
            </p>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium border border-line bg-card hover:bg-paper-2 rounded text-ink"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePledge}
                disabled={loading}
                className="px-5 py-2 text-sm font-medium bg-verdigris-700 hover:bg-verdigris-800 disabled:opacity-50 text-card rounded shadow-sm"
              >
                {loading ? "Creating pledge…" : "Continue to Settle →"}
              </button>
            </div>
          </div>
        )}

        {step === "settle" && (
          <div className="space-y-6">
            <div className="space-y-1">
              <span className="text-xs font-mono text-ink-3 uppercase">Pledge ID</span>
              <div className="text-xs font-mono font-semibold text-ink bg-paper-2 p-2 rounded border border-line">
                {pledgeId}
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-mono font-medium text-ink uppercase tracking-wider">
                Select Test Voucher
              </label>
              <div className="space-y-2">
                {TEST_VOUCHERS.map((v) => (
                  <label
                    key={v.code}
                    className={`flex items-start space-x-3 p-3 border rounded cursor-pointer transition-colors text-xs font-mono ${
                      voucher === v.code
                        ? "border-verdigris-700 bg-verdigris-100/40"
                        : "border-line bg-card hover:bg-paper-2"
                    }`}
                  >
                    <input
                      type="radio"
                      name="voucher"
                      value={v.code}
                      checked={voucher === v.code}
                      onChange={(e) => setVoucher(e.target.value)}
                      className="mt-0.5 text-verdigris-700"
                    />
                    <div>
                      <div className="font-bold text-ink">{v.code}</div>
                      <div className="text-ink-2 font-sans">{v.label}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => setStep("pledge")}
                className="text-xs font-mono text-ink-2 hover:text-ink underline"
              >
                ← Back
              </button>
              <button
                onClick={handleSettlePledge}
                disabled={loading}
                className="px-5 py-2 text-sm font-medium bg-verdigris-700 hover:bg-verdigris-800 disabled:opacity-50 text-card rounded shadow-sm"
              >
                {loading ? "Settling…" : "Settle Voucher"}
              </button>
            </div>
          </div>
        )}

        {step === "receipt" && receipt && (
          <div className="space-y-6">
            <div className="p-4 bg-moss-100/60 border border-moss-600/40 rounded space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center text-moss-600 font-bold border-b border-moss-600/20 pb-2">
                <span>✓ SETTLEMENT CONFIRMED</span>
                <span>PRO ACTIVATED</span>
              </div>
              <div className="space-y-1.5 text-ink">
                <div className="flex justify-between">
                  <span className="text-ink-2">Receipt No:</span>
                  <span className="font-bold">{receipt.receipt_no}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-2">Plan:</span>
                  <span className="font-bold">{receipt.plan}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-2">Amount:</span>
                  <span>₹{(receipt.amount_minor / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-2">Settled At:</span>
                  <span>{new Date(receipt.settled_at).toLocaleTimeString()}</span>
                </div>
                <div className="flex flex-col pt-1">
                  <span className="text-ink-2">HMAC Signature:</span>
                  <span className="text-[10px] text-ink-3 break-all">{receipt.signature}</span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 text-sm font-medium bg-verdigris-700 hover:bg-verdigris-800 text-card rounded shadow-sm"
            >
              Return to Workspace
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
