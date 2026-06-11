'use client';

/**
 * SipSave Noir admin shell — noir sidebar + ivory canvas + thin gold accents.
 *
 * Navigation uses semantic <nav>, aria-current on active link, a skip-to-content
 * anchor for keyboard users, and a mobile sheet for < md viewports.
 */

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  adminLogout,
  hasAdminToken,
  loadAdmin,
  type AdminProfile,
} from '@/lib/admin-api';

type NavItem = {
  href: string;
  icon: ReactNode;
  label: string;
  exact?: boolean;
  group: 'primary' | 'platform' | 'system';
};

const NAV: ReadonlyArray<NavItem> = [
  { href: '/', icon: <IconDashboard />, label: 'Dashboard', exact: true, group: 'primary' },
  { href: '/users', icon: <IconUsers />, label: 'Users', group: 'primary' },
  { href: '/kyc', icon: <IconId />, label: ' User KYC Queue', group: 'primary' },
  { href: '/bar-kyc', icon: <IconId />, label: 'Bar Kyc Queue', group: 'primary' },
  { href: '/disputes', icon: <IconScale />, label: 'Disputes', group: 'primary' },
  { href: '/subscriptions', icon: <IconCard />, label: 'Subscriptions', group: 'platform' },
  { href: '/featured', icon: <IconStar />, label: 'Featured', group: 'platform' },
  { href: '/dry-days', icon: <IconCalendar />, label: 'Dry Days', group: 'platform' },
  { href: '/master-categories', icon: <IconStar />, label: 'Master Categories', group: 'platform' },
  { href: '/bottle-catalogue', icon: <IconBottle />, label: 'Bottle Catalogue', group: 'platform' },
  { href: '/analytics', icon: <IconChart />, label: 'Analytics', group: 'platform' },
  { href: '/settings', icon: <IconGear />, label: 'Admin Settings', group: 'system' },
  { href: '/email-templates', icon: <IconMail />, label: 'Email Templates', group: 'system' },
  { href: '/platform-settings', icon: <IconGear />, label: 'Platform Settings', group: 'system' },

];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!hasAdminToken()) {
      router.replace('/login');
      return;
    }
    setAdmin(loadAdmin());
    setHydrated(true);
  }, [router]);

  useEffect(() => setMobileOpen(false), [pathname]);

  if (!hydrated) return null;

  async function handleSignOut() {
    await adminLogout();
    router.replace('/login');
  }

  const currentItem = NAV.find((n) => (n.exact ? pathname === n.href : pathname?.startsWith(n.href) && n.href !== '/'))
    ?? NAV[0];

  return (
    <div className="min-h-screen flex bg-ivory text-ink">
      <a href="#main" className="skip-link">Skip to content</a>

      {/* Sidebar */}
      <Sidebar
        pathname={pathname ?? '/'}
        admin={admin}
        onSignOut={handleSignOut}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top header */}
        <header className="h-16 bg-surface border-b border-hairline flex items-center gap-4 px-4 md:px-8 sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="md:hidden btn btn-ghost btn-sm"
          >
            <IconMenu />
          </button>

          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted min-w-0">
            <span className="tracking-[0.2em] uppercase text-soft">SipSave</span>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-ink truncate">{currentItem.label}</span>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden sm:inline-flex badge badge-success badge-dot">Live</span>
            <div className="hidden sm:flex flex-col text-right leading-tight">
              <span className="text-sm font-semibold text-ink truncate max-w-[14rem]">{admin?.fullName ?? '—'}</span>
              <span className="text-[0.65rem] tracking-[0.18em] uppercase text-soft">{admin?.role ?? 'Admin'}</span>
            </div>
            <div
              aria-hidden="true"
              className="w-9 h-9 rounded-full bg-ink flex items-center justify-center text-accent font-display text-base ring-2 ring-accent/40"
            >
              {initials(admin?.fullName)}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main id="main" className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-7xl px-4 md:px-8 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

/* ───────── Sidebar ───────── */
function Sidebar({
  pathname,
  admin,
  onSignOut,
  mobileOpen,
  onCloseMobile,
}: {
  pathname: string;
  admin: AdminProfile | null;
  onSignOut: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const groups: Array<{ heading: string; group: NavItem['group'] }> = [
    { heading: 'Operations', group: 'primary' },
    { heading: 'Platform', group: 'platform' },
    { heading: 'System', group: 'system' },
  ];

  return (
    <>
      {/* Backdrop (mobile) */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onCloseMobile}
          className="fixed inset-0 z-20 bg-ink/60 md:hidden"
        />
      )}
      <aside
        className={[
          'fixed md:sticky top-0 left-0 z-30 h-screen w-64 shrink-0',
          'bg-ink text-invert flex flex-col',
          'border-r border-ink-3',
          'transition-transform duration-300',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        {/* Brand */}
        <div className="px-5 pt-6 pb-5 border-b border-ink-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center text-ink font-display font-semibold">
              S
            </div>
            <div>
              <p className="font-display text-lg leading-tight">SipSave</p>
              <p className="text-[0.65rem] tracking-[0.25em] uppercase text-accent/80">Noir Console</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav aria-label="Admin sections" className="flex-1 overflow-y-auto py-4">
          {groups.map(({ heading, group }) => {
            const items = NAV.filter((n) => n.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="px-3 mb-5">
                <p className="px-3 mb-2 text-[0.625rem] font-semibold tracking-[0.25em] uppercase text-white/35">
                  {heading}
                </p>
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const active = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          className={[
                            'group relative flex items-center gap-3 px-3 py-2 rounded-md text-sm',
                            'transition-colors duration-150',
                            active
                              ? 'bg-ink-3 text-invert font-semibold'
                              : 'text-white/70 hover:text-invert hover:bg-ink-2',
                          ].join(' ')}
                        >
                          {active && (
                            <span
                              aria-hidden="true"
                              className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-accent"
                            />
                          )}
                          <span className={`shrink-0 ${active ? 'text-accent' : 'text-white/55 group-hover:text-accent'}`}>
                            {item.icon}
                          </span>
                          <span className="truncate">{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* Footer: account + sign out */}
        <div className="border-t border-ink-3 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div
              aria-hidden="true"
              className="w-9 h-9 rounded-full bg-ink-3 flex items-center justify-center text-accent font-display text-sm"
            >
              {initials(admin?.fullName)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{admin?.fullName ?? '—'}</p>
              <p className="text-[0.65rem] tracking-[0.18em] uppercase text-white/40">{admin?.role ?? 'Admin'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="w-full text-sm font-semibold py-2 rounded-md border border-ink-3 text-white/80 hover:text-invert hover:border-accent hover:bg-ink-2 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

function initials(name?: string | null): string {
  if (!name) return 'SA';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || 'SA';
}

/* ───────── Icons (stroke-based, currentColor) ───────── */
function Base({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
function IconDashboard() { return <Base><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></Base>; }
function IconId() { return <Base><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="12" r="2.5" /><path d="M14 10h5M14 14h5" /></Base>; }
function IconScale() { return <Base><path d="M12 3v18M6 7h12" /><path d="M6 7l-3 6a4 4 0 0 0 6 0z" /><path d="M18 7l-3 6a4 4 0 0 0 6 0z" /></Base>; }
function IconUsers() { return <Base><circle cx="9" cy="8" r="3.5" /><path d="M2 20c.8-3.5 4-5.5 7-5.5s6.2 2 7 5.5" /><circle cx="17" cy="7" r="2.5" /><path d="M22 17.5c-.5-2.2-2.2-3.5-4.5-3.5" /></Base>; }
function IconCard() { return <Base><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M2.5 10h19M6 15h4" /></Base>; }
function IconStar() { return <Base><path d="M12 3l2.7 5.7 6.3.9-4.6 4.3 1.1 6.2L12 17.3 6.5 20.1l1.1-6.2L3 9.6l6.3-.9z" /></Base>; }
function IconCalendar() { return <Base><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /><path d="M8 15l2 2 4-4" /></Base>; }
function IconChart() { return <Base><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" /></Base>; }
function IconGear() { return <Base><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></Base>; }
function IconMail() { return <Base><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M4 7l8 6 8-6" /></Base>; }
function IconMenu() { return <Base><path d="M4 6h16M4 12h16M4 18h16" /></Base>; }
function IconBottle() { return <Base><path d="M10 3h4v3l1 1v2l-1 1v11a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2V10l-1-1V7l1-1V3z" /><path d="M10 12h4" /></Base>; }
