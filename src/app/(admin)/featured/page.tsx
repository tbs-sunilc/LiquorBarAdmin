'use client';

/**
 * SC-10 Featured listings overview.  Phase-8 admin surface is read-only —
 * creation is a bar-owner flow.  Ad-ops dashboard lands in Phase 9.
 */

import { EmptyState, PageHeader } from '@/components/ui';

export default function FeaturedListingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Marketing"
        title="Featured listings"
        subtitle="Paid slots on the discover carousel and the city-top leaderboard."
      />
      <EmptyState
        icon="✦"
        title="Ad-ops dashboard arrives in Phase 9"
        description={
          <>
            The <code className="font-mono bg-ivory-2 px-1.5 py-0.5 rounded text-[0.78rem]">FeaturedListings</code> data
            surface — impressions, clicks, and cancellation — ships alongside the subscription-admin panel.
          </>
        }
      />
    </>
  );
}
