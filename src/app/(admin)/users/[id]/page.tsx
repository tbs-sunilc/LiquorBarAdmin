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
import { getDocumentUrl } from '@/lib/document-url';
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

  if (loading) return <p className="text-muted p-8">Loading user details…</p>;
  if (error || !u) {
    return (
      <div className="p-4">
        <BackLink href="/users">Back to users</BackLink>
        <ErrorBanner className="mt-4">{error ?? 'User not found'}</ErrorBanner>
      </div>
    );
  }

  const joinedDate = u.createdAtUtc ? new Date(u.createdAtUtc).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown';
  const lastLogin = u.lastLoginAtUtc ? new Date(u.lastLoginAtUtc).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never';

  return (
    <div className="pb-12">
      <BackLink href="/users">Back to users</BackLink>

      <header className="mb-8 mt-4 flex items-center justify-between gap-6 flex-wrap">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-accent-lo flex items-center justify-center text-accent-hi text-2xl font-bold border border-accent/10 overflow-hidden shadow-sm">
            {u.profilePhotoUrl ? (
              <img src={getDocumentUrl(u.profilePhotoUrl)} alt={u.fullName ?? ''} className="w-full h-full object-cover" />
            ) : (
              (u.fullName?.[0] ?? u.mobileNumber.slice(-2)).toUpperCase()
            )}
          </div>
          <div>
            <p className="text-[0.65rem] font-bold tracking-[0.2em] uppercase text-accent-hi/60 mb-1">User Profile</p>
            <h1 className="font-display text-3xl text-ink leading-tight mb-1.5">{u.fullName ?? 'Unnamed User'}</h1>
            <div className="flex flex-wrap gap-2 items-center">
              <Badge tone={kycTone(u.kycStatus)}>{u.kycStatus}</Badge>
              {u.isBanned && <Badge tone="danger" dot>Banned</Badge>}
              {!u.isActive && !u.isBanned && <Badge tone="neutral" dot>Suspended</Badge>}
              {u.isActive && !u.isBanned && <Badge tone="success" dot>Active</Badge>}
              <span className="text-xs text-muted font-mono ml-1">{u.mobileNumber}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card title="Personal Information">
              <div className="space-y-4 py-1">
                <DetailRow label="Full Name" value={u.fullName ?? '—'} />
                <DetailRow label="Mobile" value={u.mobileNumber} />
                <DetailRow label="Email" value={u.email ?? '—'} />
                <DetailRow label="Gender" value={u.gender ?? '—'} />
                <DetailRow label="Date of Birth" value={u.dateOfBirth ?? '—'} />
              </div>
            </Card>

            <Card title="Account & KYC">
              <div className="space-y-4 py-1">
                <DetailRow label="Joined On" value={joinedDate} />
                <DetailRow label="Last Active" value={lastLogin} />
                <DetailRow label="KYC Document" value={u.kycDocType ?? 'None'} />
                <div className="flex justify-between items-center py-0.5 border-b border-ink/5 last:border-0">
                  <span className="text-xs text-muted">KYC File</span>
                  {u.kycDocUrl ? (
                    <a href={getDocumentUrl(u.kycDocUrl)} target="_blank" rel="noopener" className="text-xs font-semibold text-accent hover:underline">
                      View Document →
                    </a>
                  ) : (
                    <span className="text-xs text-ink/40 italic">Not available</span>
                  )}
                </div>
              </div>
            </Card>
          </div>

          <Card title="Wallet Balances" subtitle={`${(u.wallets ?? []).length} active wallet${(u.wallets ?? []).length === 1 ? '' : 's'}`}>
            {(u.wallets ?? []).length === 0 ? (
              <p className="text-sm text-muted py-6 text-center italic">No active wallets found for this user.</p>
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
                    {(u.wallets ?? []).map((w) => (
                      <tr key={w.walletId}>
                        <td className="text-ink font-medium">{w.barName}</td>
                        <td className="text-muted text-xs">{w.bottleBrandName} {w.bottleProductName}</td>
                        <td className="text-right font-numeric tabular-nums font-semibold text-ink">{w.remainingVolumeMl} ml</td>
                        <td className="text-right font-numeric tabular-nums text-muted text-xs">{w.purchasedVolumeMl} ml</td>
                        <td><Badge tone={walletTone(w.status)}>{w.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Recent Transactions" subtitle="Last 20 operations">
            {(u.transactions ?? []).length === 0 ? (
              <p className="text-sm text-muted py-6 text-center italic">No transaction history available.</p>
            ) : (
              <div className="-mx-5 overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Bar</th>
                      <th className="text-right">Change</th>
                      <th className="text-right">Balance</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(u.transactions ?? []).map((t) => (
                      <tr key={t.id}>
                        <td className="text-muted text-xs whitespace-nowrap">
                          {new Date(t.createdAtUtc).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </td>
                        <td>
                          <Badge tone={txTone(t.transactionType)} className="text-[0.6rem] uppercase tracking-wider">
                            {t.transactionType}
                          </Badge>
                        </td>
                        <td className="text-ink text-xs truncate max-w-[120px]">{t.barName}</td>
                        <td className={`text-right font-numeric tabular-nums font-medium ${t.volumeMlDelta > 0 ? 'text-[color:var(--color-success)]' : 'text-[color:var(--color-danger)]'}`}>
                          {t.volumeMlDelta > 0 ? '+' : ''}{t.volumeMlDelta} ml
                        </td>
                        <td className="text-right font-numeric tabular-nums text-ink text-xs">{t.balanceAfterMl} ml</td>
                        <td className="text-muted text-[0.7rem] max-w-[150px] truncate" title={t.notes ?? ''}>
                          {t.notes ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column - Actions */}
        <div className="space-y-6">
          <Card title="Administrative Actions">
            {u.kycRejectionReason && (
              <div className="rounded-xl border border-danger/20 bg-danger/5 p-4 text-xs mb-6">
                <div className="font-bold text-danger flex items-center gap-1.5 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
                  Rejection Note
                </div>
                <p className="text-danger/80 leading-relaxed">{u.kycRejectionReason}</p>
              </div>
            )}

            <div className="space-y-3">
              {u.isBanned ? (
                <div className="p-4 rounded-xl bg-ink/5 border border-ink/10 text-center">
                  <p className="text-sm font-semibold text-danger mb-1">Permanently Banned</p>
                  <p className="text-[0.7rem] text-muted leading-tight">No further actions or reactivation possible for this account.</p>
                </div>
              ) : u.isActive ? (
                <>
                  <button onClick={() => setModal('suspend')} className="btn btn-ghost w-full justify-center">
                    Suspend Account
                  </button>
                  <button onClick={() => setModal('ban')} className="btn w-full justify-center bg-danger text-white hover:bg-danger-dark border-none shadow-sm">
                    Ban Permanently
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => refreshAfter(() => reactivateUser(u.id))} 
                    disabled={busy}
                    className="btn w-full justify-center bg-success text-white hover:bg-success-dark border-none shadow-sm"
                  >
                    Reactivate User
                  </button>
                  <button onClick={() => setModal('ban')} className="btn w-full justify-center bg-danger text-white hover:bg-danger-dark border-none shadow-sm">
                    Ban Permanently
                  </button>
                </>
              )}
            </div>
            
            <div className="mt-6 pt-6 border-t border-ink/5">
              <p className="text-[0.65rem] text-muted uppercase font-bold tracking-widest mb-4">Support Tools</p>
              <button className="btn btn-ghost w-full justify-start text-xs opacity-60 hover:opacity-100" disabled>
                View Support Logs
              </button>
              <button className="btn btn-ghost w-full justify-start text-xs opacity-60 hover:opacity-100" disabled>
                Manual Adjustment
              </button>
            </div>
          </Card>
        </div>
      </div>

      {modal === 'suspend' && (
        <Modal title={`Suspend Account?`} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              <p className="font-semibold mb-1">Impact for {u.mobileNumber}:</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs opacity-80">
                <li>Immediate sign-out from all devices</li>
                <li>Access to wallets blocked</li>
                <li>Can be reactivated by any admin</li>
              </ul>
            </div>
            <div>
              <label htmlFor="suspend-reason" className="field-label">Internal Reason for Suspension</label>
              <textarea
                id="suspend-reason"
                rows={3}
                placeholder="Required (min 4 chars)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                className="input"
              />
            </div>
          </div>
          {error && <div className="mt-3"><ErrorBanner>{error}</ErrorBanner></div>}
          <ModalActions
            busy={busy || reason.trim().length < 4}
            onCancel={() => setModal(null)}
            onConfirm={() => refreshAfter(() => suspendUser(u.id, reason.trim()))}
            confirmLabel="Suspend Account"
            tone="warn"
          />
        </Modal>
      )}

      {modal === 'ban' && (
        <Modal title={`Permanent Ban?`} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-danger/5 border border-danger/20 text-danger text-sm">
              <p className="font-bold mb-1">This action is irreversible.</p>
              <p className="text-xs opacity-80">KYC will be marked PermanentlyRejected. Future registration with the same document will be blocked across the platform.</p>
            </div>
            <div>
              <label htmlFor="ban-reason" className="field-label">Audit Reason for Ban</label>
              <textarea id="ban-reason" rows={3} placeholder="Describe violation (min 4 chars)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className="input" />
            </div>
            <div>
              <label htmlFor="ban-confirm" className="field-label uppercase tracking-widest text-[0.6rem] font-bold">
                Type <span className="text-danger">BAN</span> to execute
              </label>
              <input id="ban-confirm" value={banConfirmation} onChange={(e) => setBanConfirmation(e.target.value)} placeholder="Type BAN" className="input font-mono text-center uppercase tracking-widest" />
            </div>
          </div>
          {error && <div className="mt-3"><ErrorBanner>{error}</ErrorBanner></div>}
          <ModalActions
            busy={busy || banConfirmation !== 'BAN' || reason.trim().length < 4}
            onCancel={() => setModal(null)}
            onConfirm={() => refreshAfter(() => banUser(u.id, reason.trim()))}
            confirmLabel="Execute Permanent Ban"
            tone="danger"
          />
        </Modal>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex justify-between items-center py-0.5 border-b border-ink/5 last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-xs font-semibold text-ink">{value}</span>
    </div>
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

function txTone(type: string): BadgeTone {
  switch (type) {
    case 'Topup':
    case 'GiftIn':
    case 'Refund':          return 'success';
    case 'Deduction':
    case 'GiftOut':         return 'danger';
    case 'ExpiryReversal':  return 'warn';
    case 'Adjustment':      return 'info';
    default:                return 'neutral';
  }
}
