"use client";

import { useEffect, useState } from 'react';
import { Card, PageHeader } from '@/components/ui';
import { getPlatformSettings, savePlatformSettings, type PlatformSettingsDto } from '@/lib/admin-api';

export default function PlatformSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettingsDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getPlatformSettings()
      .then((s) => { if (mounted) setSettings(s); })
      .catch((e) => { console.error(e); if (mounted) setError((e && e.message) || 'Failed to load settings'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await savePlatformSettings(settings);
      setSettings(updated);
      setSuccess('Saved successfully');
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Platform Settings"
        subtitle="Global configuration • Changes apply immediately"
        actions={
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Saving…' : 'Save All Changes'}
          </button>
        }
      />

      {error && <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>}
      {success && <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-700">{success}</div>}
      {loading && <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">Loading…</div>}

      <div className="grid gap-6">
        {/* KYC & Age Verification */}
        <Card title="KYC & Age Verification">
          <div className="space-y-6">
            <Field
              id="min-age"
              label="Minimum Age Requirement"
              description="Set at 18 per India excise law. Cannot be lowered below 18."
              value={String(settings?.minAgeRequirement ?? '')}
              onChange={(v) => setSettings((s) => s ? { ...s, minAgeRequirement: Number(v || 0) } : s)}
            />
            <Toggle
              id="auto-approve-kyc"
              label="Auto-approve KYC if all documents valid"
              description="Uses ML document verification. Still flags edge cases for manual review."
              checked={!!settings?.autoApproveKyc}
              onChange={(v) => setSettings((s) => s ? { ...s, autoApproveKyc: v } : s)}
            />
            <Field
              id="kyc-sla"
              label="KYC Review SLA (hours)"
              value={String(settings?.kycReviewSlaHours ?? '')}
              onChange={(v) => setSettings((s) => s ? { ...s, kycReviewSlaHours: Number(v || 0) } : s)}
            />
          </div>
        </Card>

        {/* Wallet & Transaction Settings */}
        <Card title="Wallet & Transaction Settings">
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-6">
              <Field
                id="commission-rate"
                label="Platform Commission Rate (%)"
                description="Currently 0% — revenue from subscriptions + featured listings only"
                value={String(settings?.platformCommissionRatePct ?? '')}
                onChange={(v) => setSettings((s) => s ? { ...s, platformCommissionRatePct: Number(v || 0) } : s)}
              />
              <Field
                id="max-wallet-value"
                label="Max Single Wallet Value (₹)"
                description="Anti-fraud cap per single transaction"
                value={String(settings?.maxSingleWalletValue ?? '')}
                onChange={(v) => setSettings((s) => s ? { ...s, maxSingleWalletValue: Number(v || 0) } : s)}
              />
            </div>
            
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="expiry-policy" className="block font-semibold text-sm text-ink mb-1.5">
                  Default Wallet Expiry Policy
                </label>
                <select id="expiry-policy" className="select w-full" value={settings?.defaultWalletExpiryPolicy ?? ''} onChange={(e) => setSettings((s) => s ? { ...s, defaultWalletExpiryPolicy: e.target.value || null } : s)}>
                  <option value="">No expiry (bars set their own policy)</option>
                </select>
              </div>
                <Field
                  id="refund-window"
                  label="Gift Wallet Refund Window"
                  description="Auto-refund unclaimed gifts after this many days"
                  value={String(settings?.giftWalletRefundWindowDays ?? '')}
                  onChange={(v) => setSettings((s) => s ? { ...s, giftWalletRefundWindowDays: Number(v || 0) } : s)}
                />
            </div>
          </div>
        </Card>

        {/* Subscription & Payment */}
        <Card title="Subscription & Payment">
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-6">
              <Field
                id="grace-period"
                label="Grace Period After Payment Failure (days)"
                value={String(settings?.gracePeriodAfterPaymentFailureDays ?? '')}
                onChange={(v) => setSettings((s) => s ? { ...s, gracePeriodAfterPaymentFailureDays: Number(v || 0) } : s)}
              />
              <Field
                id="auto-retry"
                label="Auto-retry Attempts"
                value={String(settings?.autoRetryAttempts ?? '')}
                onChange={(v) => setSettings((s) => s ? { ...s, autoRetryAttempts: Number(v || 0) } : s)}
              />
            </div>
            <Toggle
              id="block-purchases"
              label="Block New Wallet Purchases During Grace Period"
              description="Bar stays live for existing customers but hidden from new discovery"
              checked={!!settings?.blockNewWalletPurchasesDuringGrace}
              onChange={(v) => setSettings((s) => s ? { ...s, blockNewWalletPurchasesDuringGrace: v } : s)}
            />
          </div>
        </Card>

        {/* Dispute Resolution */}
        <Card title="Dispute Resolution">
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-6">
              <Field
                id="dispute-sla"
                label="Dispute Resolution SLA (hours)"
                value={String(settings?.disputeResolutionSlaHours ?? '')}
                onChange={(v) => setSettings((s) => s ? { ...s, disputeResolutionSlaHours: Number(v || 0) } : s)}
              />
              <Field
                id="auto-escalate"
                label="Auto-escalate after breach (hours)"
                value={String(settings?.autoEscalateAfterBreachHours ?? '')}
                onChange={(v) => setSettings((s) => s ? { ...s, autoEscalateAfterBreachHours: Number(v || 0) } : s)}
              />
            </div>
            <Toggle
              id="allow-reversal"
              label="Allow Admin Wallet Reversal"
              description="Lets admin reverse wallet deductions without bar owner consent (for clear-cut fraud cases)"
              checked={!!settings?.allowAdminWalletReversal}
              onChange={(v) => setSettings((s) => s ? { ...s, allowAdminWalletReversal: v } : s)}
            />
          </div>
        </Card>
      </div>
    </>
  );
}

// Helper Components

function Field({
  id,
  label,
  description,
  value,
  onChange,
  type = 'number',
}: {
  id: string;
  label: string;
  description?: string;
  value?: string;
  onChange?: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block font-semibold text-sm text-ink mb-1.5">
        {label}
      </label>
      <input
        type={type}
        id={id}
        className="input w-full"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
      {description && (
        <p className="text-xs text-muted mt-1.5">{description}</p>
      )}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
  id,
}: {
  label: string;
  description?: string;
  checked?: boolean;
  onChange?: (v: boolean) => void;
  id: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="font-semibold text-sm text-ink cursor-pointer block">
          {label}
        </label>
        {description && <p className="text-[0.75rem] sm:text-xs text-muted mt-0.5">{description}</p>}
      </div>
      <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
        <input
          type="checkbox"
          id={id}
          className="sr-only peer"
          checked={!!checked}
          onChange={(e) => onChange?.(e.target.checked)}
        />
        <div className="w-11 h-6 bg-[color:var(--color-border-strong)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[color:var(--color-accent-tint)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[color:var(--color-border-strong)] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[color:var(--color-success)] peer-checked:after:border-transparent"></div>
      </label>
    </div>
  );
}
