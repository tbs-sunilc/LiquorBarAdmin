'use client';

/**
 * SC-13 Admin settings.  Profile + 2FA enrolment + audit log entry point.
 * Save endpoints land in Phase 9; the shell matches the prototype.
 */

import { loadAdmin } from '@/lib/admin-api';
import { useEffect, useState } from 'react';
import { Badge, Card, PageHeader } from '@/components/ui';

export default function AdminSettingsPage() {
  const [profile, setProfile] = useState(loadAdmin());

  useEffect(() => setProfile(loadAdmin()), []);

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Admin settings"
        subtitle="Your account and platform-wide preferences."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Profile" subtitle="Visible on every audit log entry you generate.">
          <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
            <Row label="Name" value={profile?.fullName} />
            <Row label="Email" value={profile?.email} />
            <Row label="Role" value={profile?.role} />
            <Row label="MFA enabled">
              {profile?.mfaEnabled ? <Badge tone="success" dot>Yes</Badge> : <Badge tone="warn" dot>No</Badge>}
            </Row>
          </dl>
          <button disabled title="Profile edit endpoint lands in Phase 9" className="btn btn-primary mt-6">
            Update profile
          </button>
        </Card>

        <Card title="Two-factor authentication" subtitle="Required for sensitive workflows once SuperAdmin enforces the policy.">
          {profile?.mfaEnabled ? (
            <>
              <p className="text-sm text-[color:var(--color-success)] flex items-center gap-1.5">
                <span aria-hidden="true">✓</span> 2FA is active on this account.
              </p>
              <button disabled title="Rotate-2FA endpoint lands in Phase 9" className="btn btn-ghost mt-5">
                Rotate authenticator
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-[color:var(--color-danger)]">
                2FA is not yet enabled on this account. You&apos;ll be blocked from sensitive
                actions once SuperAdmin enforces the policy.
              </p>
              <button disabled title="Enable-2FA endpoint lands in Phase 9" className="btn btn-primary mt-5">
                Set up authenticator
              </button>
            </>
          )}
        </Card>

        <Card title="Audit log" className="lg:col-span-2">
          <p className="text-sm text-muted">
            Detailed admin-action audit log lands with the compliance dashboard in Phase 10.
            Every approve/reject/suspend you perform is already recorded server-side.
          </p>
        </Card>
      </div>
    </>
  );
}

function Row({ label, value, children }: { label: string; value?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div>
      <dt className="field-label mb-1.5">{label}</dt>
      <dd className="text-sm text-ink">{children ?? value ?? '—'}</dd>
    </div>
  );
}
