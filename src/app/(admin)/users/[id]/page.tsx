'use client';

/**
 * SC-09 User detail — profile header, wallet balances, and
 * suspend/reactivate/ban action stack.  Ban requires typing "BAN".
 */

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ApiError,
  banUser,
  getUser,
  reactivateUser,
  suspendUser,
  type AdminUserDetailDto,
} from '@/lib/admin-api';
import {
  BackLink,
  Badge,
  type BadgeTone,
  Card,
  ErrorBanner,
  Modal,
  ModalActions,
} from '@/components/ui';

type ModalState = 'suspend' | 'ban' | null;

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const userId = Number(params.id);

  const [u, setU] = useState<AdminUserDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalState>(null);
  const [reason, setReason] = useState('');
  const [banConfirmation, setBanConfirmation] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(userId)) return;
    (async () => {
      try { setU(await getUser(userId)); }
      catch (err) { setError(err instanceof ApiError ? err.message : 'Failed to load'); }
      finally { setLoading(false); }
    })();
  }, [userId]);

  async function refreshAfter(action: () => Promise<AdminUserDetailDto>) {
    setBusy(true); setError(null);
    try {
      const updated = await action();
      setU(updated);
      setModal(null); setReason(''); setBanConfirmation('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-muted">Loading…</p>;
  if (error || !u) {
    return (
      <>
        <BackLink href="/users">Back to users</BackLink>
        <ErrorBanner>{error ?? 'Not found'}</ErrorBanner>
      </>
    );
  }

  return (
    <>
      <BackLink href="/users">Back to users</BackLink>

      <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[0.7rem] font-semibold tracking-[0.22em] uppercase text-accent-lo mb-1.5">Profile</p>
          <h1 className="font-display text-4xl text-ink leading-tight">{u.fullName ?? 'Unnamed'}</h1>
          <p className="text-sm text-muted mt-2 font-mono">{u.mobileNumber} · {u.email ?? 'no email'}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge tone={kycTone(u.kycStatus)}>{u.kycStatus}</Badge>
            {u.isBanned && <Badge tone="danger" dot>Banned</Badge>}
            {!u.isActive && !u.isBanned && <Badge tone="neutral" dot>Suspended</Badge>}
            {u.isActive && !u.isBanned && <Badge tone="success" dot>Active</Badge>}
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-[1fr_20rem] gap-6">
        <Card title="Wallet balances" subtitle={`${u.wallets.length} active wallet${u.wallets.length === 1 ? '' : 's'}`}>
          {u.wallets.length === 0 ? (
            <p className="text-sm text-muted py-4">No active wallets.</p>
          ) : (
            <div className="-mx-5 overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Bar</th>
                    <th>Bottle</th>
                    <th className="text-right">Remaining</th>
                    <th className="text-right">Purchased</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {u.wallets.map((w) => (
                    <tr key={w.walletId}>
                      <td className="text-ink">{w.barName}</td>
                      <td className="text-muted">{w.bottleBrandName} {w.bottleProductName}</td>
                      <td className="text-right font-numeric tabular-nums font-semibold text-ink">{w.remainingVolumeMl} ml</td>
                      <td className="text-right font-numeric tabular-nums text-muted">{w.purchasedVolumeMl} ml</td>
                      <td><Badge tone={walletTone(w.status)}>{w.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Actions">
          {u.kycRejectionReason && (
            <div className="rounded-md border border-[color:rgb(154_46_42/0.3)] bg-[color:var(--color-danger-tint)] text-[color:var(--color-danger)] p-3 text-xs mb-4">
              <strong>Rejection note:</strong> {u.kycRejectionReason}
            </div>
          )}

          <div className="space-y-2">
            {u.isBanned ? (
              <p className="text-sm text-[color:var(--color-danger)]">Banned — no reactivation possible.</p>
            ) : u.isActive ? (
              <>
                <button onClick={() => setModal('suspend')} className="btn btn-ghost w-full">
                  Suspend account
                </button>
                <button onClick={() => setModal('ban')} className="btn w-full" style={{ background: 'var(--color-danger)', color: 'white' }}>
                  Ban permanently
                </button>
              </>
            ) : (
              <>
                <button onClick={() => refreshAfter(() => reactivateUser(u.id))} disabled={busy}
                        className="btn w-full" style={{ background: 'var(--color-success)', color: 'white' }}>
                  Reactivate
                </button>
                <button onClick={() => setModal('ban')} className="btn w-full" style={{ background: 'var(--color-danger)', color: 'white' }}>
                  Ban permanently
                </button>
              </>
            )}
          </div>
        </Card>
      </div>

      {modal === 'suspend' && (
        <Modal title={`Suspend ${u.mobileNumber}?`} onClose={() => setModal(null)}>
          <p className="text-sm text-muted">
            They&apos;ll be signed out and blocked until reactivated. Existing wallet balances are preserved.
          </p>
          <div className="mt-4">
            <label htmlFor="suspend-reason" className="field-label">Reason (internal)</label>
            <textarea
              id="suspend-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              className="input"
            />
          </div>
          {error && <div className="mt-3"><ErrorBanner>{error}</ErrorBanner></div>}
          <ModalActions
            busy={busy || reason.trim().length < 4}
            onCancel={() => setModal(null)}
            onConfirm={() => refreshAfter(() => suspendUser(u.id, reason.trim()))}
            confirmLabel="Suspend"
            tone="warn"
          />
        </Modal>
      )}

      {modal === 'ban' && (
        <Modal title={`Ban ${u.mobileNumber}?`} onClose={() => setModal(null)}>
          <div className="text-sm text-ink space-y-2">
            <p className="font-semibold text-[color:var(--color-danger)]">This is permanent.</p>
            <p className="text-muted">Their KYC will be marked PermanentlyRejected — re-registration with the same document is blocked.</p>
          </div>
          <div className="mt-4">
            <label htmlFor="ban-reason" className="field-label">Reason (internal audit)</label>
            <textarea id="ban-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className="input" />
          </div>
          <div className="mt-3">
            <label htmlFor="ban-confirm" className="field-label">
              Type <span className="font-mono text-[color:var(--color-danger)]">BAN</span> to confirm
            </label>
            <input id="ban-confirm" value={banConfirmation} onChange={(e) => setBanConfirmation(e.target.value)} className="input font-mono" />
          </div>
          {error && <div className="mt-3"><ErrorBanner>{error}</ErrorBanner></div>}
          <ModalActions
            busy={busy || banConfirmation !== 'BAN' || reason.trim().length < 4}
            onCancel={() => setModal(null)}
            onConfirm={() => refreshAfter(() => banUser(u.id, reason.trim()))}
            confirmLabel="Ban permanently"
            tone="danger"
          />
        </Modal>
      )}
    </>
  );
}

function kycTone(status: string): BadgeTone {
  switch (status) {
    case 'Approved':            return 'success';
    case 'PendingReview':       return 'warn';
    case 'Rejected':
    case 'PermanentlyRejected': return 'danger';
    default:                    return 'neutral';
  }
}

function walletTone(status: string): BadgeTone {
  switch (status) {
    case 'Active':    return 'success';
    case 'Expired':   return 'neutral';
    case 'Refunded':  return 'info';
    case 'Exhausted': return 'warn';
    default:          return 'neutral';
  }
}
