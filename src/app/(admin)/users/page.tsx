'use client';

/** SC-08 User search.  Text filter against mobile / email / name (debounced). */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ApiError, listUsers, type AdminUserRowDto } from '@/lib/admin-api';
import {
  Badge,
  type BadgeTone,
  EmptyState,
  ErrorBanner,
  PageHeader,
  SkeletonRow,
  Toolbar,
} from '@/components/ui';

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [rows, setRows] = useState<AdminUserRowDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setRows(await listUsers(debounced || undefined, 0, 100));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load users');
      } finally {
        setLoading(false);
      }
    })();
  }, [debounced]);

  return (
    <>
      <PageHeader
        eyebrow="Directory"
        title="Users"
        subtitle="Search by mobile, email, or name."
        actions={<span className="text-xs text-muted"><span className="font-numeric font-semibold text-ink">{rows.length}</span> result{rows.length === 1 ? '' : 's'}</span>}
      />

      <Toolbar>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">Search</span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Mobile, email, or name…"
          className="input flex-1 max-w-md"
          aria-label="Search users"
        />
      </Toolbar>

      {error && <div className="mb-4"><ErrorBanner>{error}</ErrorBanner></div>}

      {!loading && rows.length === 0 && (
        <EmptyState
          icon="?"
          title={debounced ? 'No matches' : 'Start searching'}
          description={debounced ? 'No users match this query — try a different search term.' : 'Type a mobile number, email, or name to find a user.'}
        />
      )}

      {(loading || rows.length > 0) && (
        <div className="card-raised overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Mobile</th>
                <th>Name</th>
                <th>Email</th>
                <th>KYC</th>
                <th>Status</th>
                <th className="text-right">Joined</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} />)}
              {!loading && rows.map((r) => (
                <tr key={r.id} className={r.isActive ? '' : 'opacity-60'}>
                  <td>
                    <Link href={`/users/${r.id}`} className="font-mono text-sm text-accent-lo hover:text-accent-hi font-semibold">
                      {r.mobileNumber}
                    </Link>
                  </td>
                  <td className="font-medium text-ink">{r.fullName ?? '—'}</td>
                  <td className="text-muted">{r.email ?? '—'}</td>
                  <td><Badge tone={kycTone(r.kycStatus)}>{r.kycStatus}</Badge></td>
                  <td>
                    {r.isActive
                      ? <Badge tone="success" dot>Active</Badge>
                      : <Badge tone="neutral">Inactive</Badge>}
                  </td>
                  <td className="text-right text-xs text-muted font-numeric tabular-nums">
                    {new Date(r.createdAtUtc).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
