'use client';

import { Card, PageHeader } from '@/components/ui';

export default function PlatformSettingsPage() {
  return (
    <>
      <PageHeader
        title="Platform Settings"
        subtitle="Global configuration • Changes apply immediately"
        actions={
          <button type="button" className="btn btn-primary">
            Save All Changes
          </button>
        }
      />

      <div className="grid gap-6">
        {/* KYC & Age Verification */}
        <Card title="KYC & Age Verification">
          <div className="space-y-6">
            <Field
              id="min-age"
              label="Minimum Age Requirement"
              description="Set at 18 per India excise law. Cannot be lowered below 18."
              defaultValue="18"
            />
            <Toggle
              id="auto-approve-kyc"
              label="Auto-approve KYC if all documents valid"
              description="Uses ML document verification. Still flags edge cases for manual review."
              checked={false}
            />
            <Field
              id="kyc-sla"
              label="KYC Review SLA (hours)"
              defaultValue="48"
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
                defaultValue="0"
              />
              <Field
                id="max-wallet-value"
                label="Max Single Wallet Value (₹)"
                description="Anti-fraud cap per single transaction"
                defaultValue="20000"
              />
            </div>
            
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="expiry-policy" className="block font-semibold text-sm text-ink mb-1.5">
                  Default Wallet Expiry Policy
                </label>
                <select id="expiry-policy" className="select w-full">
                  <option>No expiry (bars set their own policy)</option>
                </select>
              </div>
              <Field
                id="refund-window"
                label="Gift Wallet Refund Window"
                description="Auto-refund unclaimed gifts after this many days"
                defaultValue="30"
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
                defaultValue="5"
              />
              <Field
                id="auto-retry"
                label="Auto-retry Attempts"
                defaultValue="3"
              />
            </div>
            <Toggle
              id="block-purchases"
              label="Block New Wallet Purchases During Grace Period"
              description="Bar stays live for existing customers but hidden from new discovery"
              checked={true}
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
                defaultValue="48"
              />
              <Field
                id="auto-escalate"
                label="Auto-escalate after breach (hours)"
                defaultValue="72"
              />
            </div>
            <Toggle
              id="allow-reversal"
              label="Allow Admin Wallet Reversal"
              description="Lets admin reverse wallet deductions without bar owner consent (for clear-cut fraud cases)"
              checked={true}
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
  defaultValue,
  type = "number"
}: { 
  id: string; 
  label: string; 
  description?: string; 
  defaultValue?: string;
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
        defaultValue={defaultValue} 
      />
      {description && (
        <p className="text-xs text-muted mt-1.5">
          {description}
        </p>
      )}
    </div>
  );
}

function Toggle({ 
  label, 
  description, 
  checked, 
  id 
}: { 
  label: string; 
  description?: string; 
  checked?: boolean; 
  id: string 
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="font-semibold text-sm text-ink cursor-pointer block">
          {label}
        </label>
        {description && (
          <p className="text-[0.75rem] sm:text-xs text-muted mt-0.5">
            {description}
          </p>
        )}
      </div>
      <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
        <input 
          type="checkbox" 
          id={id} 
          className="sr-only peer" 
          defaultChecked={checked} 
        />
        <div className="w-11 h-6 bg-[color:var(--color-border-strong)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[color:var(--color-accent-tint)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[color:var(--color-border-strong)] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[color:var(--color-success)] peer-checked:after:border-transparent"></div>
      </label>
    </div>
  );
}
