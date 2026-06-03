/**
 * Mock backend — in-memory fake for the admin API.
 *
 * Enabled when NEXT_PUBLIC_USE_MOCK !== '0' (default ON).  Lets the portal
 * be driven end-to-end without a .NET API or SQL Server running.
 *
 * Mutations update the in-memory state, so approve-KYC / resolve-dispute /
 * suspend-user feel real during a single browser session.  Reload the page
 * to reset back to the seeded state.
 */

import type {
  AdminSession,
  AdminUserDetailDto,
  AdminUserRowDto,
  AdminSubscriptionRowDto,
  DisputeDetailDto,
  DisputeRowDto,
  DryDayRowDto,
  KycQueueRowDto,
  KycReviewDetailDto,
  LoginResponse,
  PlatformAnalyticsDto,
  ResolveDisputePayload,
  SubscriptionAnalyticsDto,
} from './admin-api';
import { ApiError } from './admin-api';

const NOW_MS = Date.now();
const hoursAgo = (h: number) => new Date(NOW_MS - h * 3600_000).toISOString();
const hoursAhead = (h: number) => new Date(NOW_MS + h * 3600_000).toISOString();
const daysAgo = (d: number) => new Date(NOW_MS - d * 86_400_000).toISOString();
const daysAhead = (d: number) => new Date(NOW_MS + d * 86_400_000).toISOString();
const ymd = (iso: string) => iso.slice(0, 10);

/* ─── KYC ────────────────────────────────────────── */

type KycRecord = KycReviewDetailDto & { hoursWaiting: number };

const kycState: KycRecord[] = [
  mkKyc(101, '+91 98100 11001', 'Aarav Sharma',   'aarav@example.com',   'PendingReview', 'Aadhaar',  56, true),
  mkKyc(102, '+91 98100 11002', 'Priya Iyer',     'priya@example.com',   'PendingReview', 'PAN',      52, true),
  mkKyc(103, '+91 98100 11003', 'Rohit Mehta',    null,                  'PendingReview', 'Aadhaar',  44, false),
  mkKyc(104, '+91 98100 11004', 'Sneha Kapoor',   'sneha@example.com',   'PendingReview', 'Aadhaar',  38, false),
  mkKyc(105, '+91 98100 11005', 'Ishan Bhatt',    null,                  'PendingReview', 'Passport', 30, false),
  mkKyc(106, '+91 98100 11006', 'Divya Nair',     'divya@example.com',   'PendingReview', 'Aadhaar',  22, false),
  mkKyc(107, '+91 98100 11007', 'Kunal Deshmukh', null,                  'PendingReview', 'PAN',      14, false),
  mkKyc(108, '+91 98100 11008', 'Ananya Rao',     'ananya@example.com',  'PendingReview', 'Aadhaar',   6, false),
  mkKyc(110, '+91 98100 11010', 'Vikram Joshi',   'vikram@example.com',  'Approved',      'Aadhaar', null, false),
  mkKyc(111, '+91 98100 11011', 'Meera Pillai',   'meera@example.com',   'Approved',      'PAN',     null, false),
  mkKyc(112, '+91 98100 11012', 'Shaurya Ghosh',  null,                  'Approved',      'Aadhaar', null, false),
  mkKyc(120, '+91 98100 11020', 'Kabir Shah',     null,                  'Rejected',      'Aadhaar', null, false, 'Photo unreadable.'),
  mkKyc(121, '+91 98100 11021', 'Naina Verma',    null,                  'PermanentlyRejected', 'Aadhaar', null, false, 'Fraudulent document.'),
];

function mkKyc(
  userId: number, mobile: string, name: string | null, email: string | null,
  status: string, docType: string, hoursWaiting: number | null, slaBreached: boolean,
  rejectionReason: string | null = null,
): KycRecord {
  const submittedAt = hoursWaiting != null ? hoursAgo(hoursWaiting) : hoursAgo(72);
  return {
    userId, mobileNumber: mobile, fullName: name, email,
    dateOfBirth: null,
    kycStatus: status, kycDocType: docType,
    kycDocSignedUrl: 'https://images.unsplash.com/photo-1568495248636-6432b97bd949?w=1200&q=70',
    kycSubmittedAtUtc: submittedAt,
    kycReviewedAtUtc: status === 'PendingReview' ? null : hoursAgo(10),
    kycRejectionReason: rejectionReason,
    kycReviewedByAdminId: status === 'PendingReview' ? null : 1,
    slaBreached,
    hoursWaiting: hoursWaiting ?? 0,
  };
}

const kycList = (status: string): KycQueueRowDto[] =>
  kycState
    .filter((k) => k.kycStatus === status)
    .map((k) => ({
      userId: k.userId,
      mobileNumber: k.mobileNumber,
      barId: 0,
      fullName: k.fullName,
      email: k.email,
      kycStatus: k.kycStatus,
      kycDocType: k.kycDocType,
      kycSubmittedAtUtc: k.kycSubmittedAtUtc,
      hoursWaiting: k.hoursWaiting,
      slaBreached: k.slaBreached,
    }));

const kycGet = (userId: number): KycReviewDetailDto => {
  const k = kycState.find((x) => x.userId === userId);
  if (!k) throw new ApiError(404, 'Not found', null);
  return k;
};

const kycMutate = (userId: number, next: Partial<KycRecord>): KycReviewDetailDto => {
  const k = kycState.find((x) => x.userId === userId);
  if (!k) throw new ApiError(404, 'Not found', null);
  Object.assign(k, next, {
    kycReviewedAtUtc: new Date().toISOString(),
    kycReviewedByAdminId: 1,
    slaBreached: false,
    hoursWaiting: 0,
  });
  return k;
};

/* ─── Disputes ───────────────────────────────────── */

type DisputeRecord = DisputeDetailDto;

const disputesState: DisputeRecord[] = [
  mkDispute(1001, 101, '+91 98100 11001', 501, 'The Gilded Pour — Bandra', 'WalletDeduction',
    'Charged for a pour I never received. Bartender said it was a technical glitch.', 'Open', -54),
  mkDispute(1002, 102, '+91 98100 11002', 502, 'Moonlight Tavern — Koramangala', 'QualityIssue',
    'Whiskey had a strange aftertaste — tasted watered-down.', 'Open', -40),
  mkDispute(1003, 104, '+91 98100 11004', 503, 'The Copper Barrel — Gomti Nagar', 'SessionDispute',
    'Session timed out with 240ml remaining but balance not credited.', 'UnderReview', -30),
  mkDispute(1004, 106, '+91 98100 11006', 501, 'The Gilded Pour — Bandra', 'WalletDeduction',
    'Double-charged on 2026-04-11.', 'UnderReview', -20),
  mkDispute(1005, 108, '+91 98100 11008', 504, 'Nebula Speakeasy — Park Street', 'RefundRequest',
    'Moving out of the city, requesting refund for unused ml.', 'Escalated', -14),
  mkDispute(1006, 110, '+91 98100 11010', 502, 'Moonlight Tavern — Koramangala', 'WalletDeduction',
    'Balance shows 0 after a single pour — expected 500ml to remain.', 'Resolved', -120),
  mkDispute(1007, 111, '+91 98100 11011', 505, 'The Still & Oak — Jubilee Hills', 'QualityIssue',
    'Gin was flat — no tonic fizz.', 'Rejected', -96),
  mkDispute(1008, 112, '+91 98100 11012', 503, 'The Copper Barrel — Gomti Nagar', 'Other',
    'Staff refused to pour from my wallet citing dry day — it was not an official dry day.', 'Resolved', -72),
];

function mkDispute(
  id: number, userId: number, userMobile: string, barId: number, barName: string,
  type: string, description: string, status: string, hoursOffset: number,
): DisputeRecord {
  const createdAt = hoursAgo(-hoursOffset);
  const slaDeadline = new Date(new Date(createdAt).getTime() + 48 * 3600_000).toISOString();
  const slaBreached = new Date(slaDeadline).getTime() < NOW_MS && (status === 'Open' || status === 'UnderReview');
  const audit = [{ atUtc: createdAt, event: 'Created by user', actor: userMobile, detail: null as string | null }];
  if (status !== 'Open') audit.push({ atUtc: hoursAgo(-hoursOffset + 4), event: 'Assigned to admin', actor: 'Priya (SuperAdmin)', detail: null });
  if (status === 'Resolved') audit.push({ atUtc: hoursAgo(-hoursOffset + 12), event: 'Resolved — wallet reversed', actor: 'Priya (SuperAdmin)', detail: '400ml refunded to wallet #84.' });
  if (status === 'Rejected') audit.push({ atUtc: hoursAgo(-hoursOffset + 12), event: 'Rejected', actor: 'Priya (SuperAdmin)', detail: 'Bartender video confirmed pour was served.' });
  if (status === 'Escalated') audit.push({ atUtc: hoursAgo(-hoursOffset + 8), event: 'Escalated to senior admin', actor: 'Priya (SuperAdmin)', detail: 'High-value refund — needs SuperAdmin review.' });

  return {
    id, userId, userMobile, userFullName: null,
    barId, barName, walletId: 8000 + id,
    disputedTransactionId: 50000 + id,
    disputedPourRequestId: 7000 + id,
    disputeType: type, description, status,
    createdAtUtc: createdAt, slaDeadlineAtUtc: slaDeadline, slaBreached,
    assignedAdminId: status === 'Open' ? null : 1,
    assignedAtUtc: status === 'Open' ? null : hoursAgo(-hoursOffset + 4),
    resolution: status === 'Resolved' ? 'ApprovedReversal' : status === 'Rejected' ? 'Rejected' : status === 'Escalated' ? 'Escalated' : null,
    resolvedByAdminId: status === 'Resolved' || status === 'Rejected' ? 1 : null,
    resolvedAtUtc: status === 'Resolved' || status === 'Rejected' ? hoursAgo(-hoursOffset + 12) : null,
    reversalWalletTransactionId: status === 'Resolved' ? 60000 + id : null,
    adminNotes: status === 'Open' ? null : 'Reviewed the bar CCTV at 22:14 — consistent with user claim.',
    rejectionReason: status === 'Rejected' ? 'Bartender video confirmed pour was served.' : null,
    supportingDocUrls: [
      'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600',
      'https://images.unsplash.com/photo-1544148103-0773bf10d330?w=600',
    ],
    auditTrail: audit,
  };
}

const disputeList = (status?: string): DisputeRowDto[] =>
  disputesState
    .filter((d) => !status || d.status === status)
    .map((d) => ({
      id: d.id, userId: d.userId, userMobile: d.userMobile,
      barId: d.barId, barName: d.barName,
      disputeType: d.disputeType, status: d.status,
      createdAtUtc: d.createdAtUtc, slaDeadlineAtUtc: d.slaDeadlineAtUtc, slaBreached: d.slaBreached,
      assignedAdminId: d.assignedAdminId,
      assignedAdminName: d.assignedAdminId ? 'Priya (SuperAdmin)' : null,
    }));

const disputeGet = (id: number): DisputeDetailDto => {
  const d = disputesState.find((x) => x.id === id);
  if (!d) throw new ApiError(404, 'Not found', null);
  return d;
};

const disputeResolve = (id: number, payload: ResolveDisputePayload): DisputeDetailDto => {
  const d = disputesState.find((x) => x.id === id);
  if (!d) throw new ApiError(404, 'Not found', null);
  d.status = payload.resolution === 'Escalated' ? 'Escalated' : payload.resolution === 'Rejected' ? 'Rejected' : 'Resolved';
  d.resolution = payload.resolution;
  d.resolvedByAdminId = 1;
  d.resolvedAtUtc = new Date().toISOString();
  d.adminNotes = payload.adminNotes ?? d.adminNotes;
  d.rejectionReason = payload.rejectionReason ?? null;
  if (payload.resolution === 'ApprovedReversal') {
    d.reversalWalletTransactionId = 90000 + id;
  }
  d.slaBreached = false;
  d.auditTrail.push({
    atUtc: new Date().toISOString(),
    event: `${d.status} by admin`,
    actor: 'Admin (you)',
    detail: payload.adminNotes ?? null,
  });
  return d;
};

/* ─── Users ──────────────────────────────────────── */

type UserRecord = AdminUserDetailDto;

const usersState: UserRecord[] = [
  mkUser(101, '+91 98100 11001', 'Aarav Sharma',   'aarav@example.com',   'PendingReview', true, false, 14, 2),
  mkUser(102, '+91 98100 11002', 'Priya Iyer',     'priya@example.com',   'PendingReview', true, false, 12, 0),
  mkUser(104, '+91 98100 11004', 'Sneha Kapoor',   'sneha@example.com',   'PendingReview', true, false, 8,  1),
  mkUser(110, '+91 98100 11010', 'Vikram Joshi',   'vikram@example.com',  'Approved',      true, false, 120, 3),
  mkUser(111, '+91 98100 11011', 'Meera Pillai',   'meera@example.com',   'Approved',      true, false, 96, 2),
  mkUser(112, '+91 98100 11012', 'Shaurya Ghosh',  null,                  'Approved',      true, false, 60, 1),
  mkUser(113, '+91 98100 11013', 'Rhea Iyengar',   'rhea@example.com',    'Approved',      true, false, 40, 2),
  mkUser(114, '+91 98100 11014', 'Arjun Menon',    'arjun@example.com',   'Approved',      true, false, 30, 1),
  mkUser(115, '+91 98100 11015', 'Saanvi Reddy',   null,                  'Approved',      true, false, 20, 0),
  mkUser(120, '+91 98100 11020', 'Kabir Shah',     null,                  'Rejected',      true, false, 10, 0, 'Photo unreadable.'),
  mkUser(121, '+91 98100 11021', 'Naina Verma',    null,                  'PermanentlyRejected', false, true, 200, 0, 'Fraudulent document.'),
  mkUser(122, '+91 98100 11022', 'Dev Anand',      'dev@example.com',     'Approved',      false, false, 80, 1),
  mkUser(123, '+91 98100 11023', 'Tara Khanna',    null,                  'Approved',      true, false, 15, 0),
  mkUser(124, '+91 98100 11024', 'Vivaan Dutta',   'vivaan@example.com',  'Approved',      true, false, 5,  2),
];

function mkUser(
  id: number, mobile: string, name: string | null, email: string | null,
  kyc: string, isActive: boolean, isBanned: boolean,
  daysSinceJoin: number, walletCount: number,
  kycRejectionReason: string | null = null,
): UserRecord {
  const wallets = Array.from({ length: walletCount }).map((_, i) => ({
    walletId: id * 10 + i,
    barId: 501 + (i % 4),
    barName: ['The Gilded Pour — Bandra', 'Moonlight Tavern — Koramangala', 'The Copper Barrel — Gomti Nagar', 'Nebula Speakeasy — Park Street'][i % 4],
    bottleBrandName: ['Glenfiddich', 'Tanqueray', 'Johnnie Walker', 'Bombay Sapphire'][i % 4],
    bottleProductName: ['12 Year Single Malt', 'No. Ten Gin', 'Black Label', 'Dry Gin'][i % 4],
    purchasedVolumeMl: 750,
    remainingVolumeMl: [600, 320, 180, 750][i % 4],
    status: ['Active', 'Active', 'Active', 'Exhausted'][i % 4],
    createdAtUtc: daysAgo(daysSinceJoin - 1),
  }));
  return {
    id, mobileNumber: mobile, fullName: name, email,
    gender: null, dateOfBirth: null,
    profilePhotoUrl: null,
    kycStatus: kyc, kycDocType: 'Aadhaar', kycDocUrl: null, kycRejectionReason,
    isActive, isBanned,
    lastLoginAtUtc: daysAgo(1),
    createdAtUtc: daysAgo(daysSinceJoin),
    wallets,
    transactions: [
      {
        id: 1000 + id,
        walletId: wallets[0]?.walletId ?? 0,
        barName: wallets[0]?.barName ?? '—',
        transactionType: 'Topup',
        volumeMlDelta: 750,
        balanceAfterMl: 750,
        notes: 'Initial purchase',
        createdAtUtc: daysAgo(daysSinceJoin - 1),
      },
      {
        id: 1001 + id,
        walletId: wallets[0]?.walletId ?? 0,
        barName: wallets[0]?.barName ?? '—',
        transactionType: 'Deduction',
        volumeMlDelta: -60,
        balanceAfterMl: 690,
        notes: 'Double shot pour',
        createdAtUtc: hoursAgo(2),
      },
    ],
  };
}

const usersListFn = (search?: string): AdminUserRowDto[] => {
  const q = search?.toLowerCase() ?? '';
  return usersState
    .filter((u) => !q ||
      u.mobileNumber.toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q) ||
      (u.fullName ?? '').toLowerCase().includes(q))
    .map((u) => ({
      id: u.id, mobileNumber: u.mobileNumber, fullName: u.fullName, email: u.email,
      kycStatus: u.kycStatus, isActive: u.isActive, isBanned: u.isBanned,
      lastLoginAtUtc: u.lastLoginAtUtc, createdAtUtc: u.createdAtUtc,
    }));
};

const userGet = (id: number): AdminUserDetailDto => {
  const u = usersState.find((x) => x.id === id);
  if (!u) throw new ApiError(404, 'Not found', null);
  return u;
};

/* ─── Subscriptions ──────────────────────────────── */

const subsState: AdminSubscriptionRowDto[] = [
  mkSub(1, 501, 'The Gilded Pour — Bandra',          'Active',       'Monthly', 4_999_00,  -20, 9, 0),
  mkSub(2, 502, 'Moonlight Tavern — Koramangala',    'Active',       'Monthly', 4_999_00,  -18, 12, 0),
  mkSub(3, 503, 'The Copper Barrel — Gomti Nagar',   'Active',       'Yearly',  54_999_00, -200, 165, 0),
  mkSub(4, 504, 'Nebula Speakeasy — Park Street',    'Trial',         'Monthly', 0,         -5,  9,  0),
  mkSub(5, 505, 'The Still & Oak — Jubilee Hills',   'PastDue',      'Monthly', 4_999_00,  -35, -2, 2),
  mkSub(6, 506, 'Harbour Club — Worli',              'GracePeriod',  'Monthly', 4_999_00,  -33, -4, 1),
  mkSub(7, 507, 'Whiskey Lane — Indiranagar',        'Active',       'Monthly', 4_999_00,  -12, 18, 0),
  mkSub(8, 508, 'Amber & Rye — Indiranagar',         'Cancelled',    'Monthly', 4_999_00,  -90, -60, 0),
  mkSub(9, 509, 'Smoke & Barrel — Hauz Khas',        'Expired',      'Yearly',  54_999_00, -400, -30, 0),
  mkSub(10,510, 'Pour Decisions — Andheri West',     'Paused',       'Monthly', 4_999_00,  -60, -10, 0),
];

function mkSub(
  id: number, barId: number, barName: string, status: string, cycle: string,
  price: number, startDaysAgo: number, nextBillDays: number, failures: number,
): AdminSubscriptionRowDto {
  const periodStart = daysAgo(-startDaysAgo);
  const periodEnd = cycle === 'Yearly' ? daysAhead(365 + startDaysAgo) : daysAhead(30 + startDaysAgo);
  return {
    id, barId, barName,
    subscriptionPlanId: cycle === 'Yearly' ? 2 : 1,
    status, billingCycle: cycle, priceInPaiseAtSignup: price,
    startedAt: daysAgo(-startDaysAgo),
    currentPeriodStart: periodStart, currentPeriodEnd: periodEnd,
    nextBillingAtUtc: status === 'Active' || status === 'Trial' ? daysAhead(nextBillDays) : null,
    gracePeriodEndsAtUtc: status === 'GracePeriod' ? daysAhead(3) : null,
    failedPaymentCount: failures,
    lastFailureReason: failures > 0 ? 'Insufficient funds on card ending 4242' : null,
  };
}

/* ─── Analytics ──────────────────────────────────── */

const analyticsFn = (): PlatformAnalyticsDto => ({
  fromDate: ymd(daysAgo(30)),
  toDate:   ymd(new Date().toISOString()),
  gmvInPaise: 184_73_450_00,
  gmvGrowthPercent: 12.4,
  transactionCount: 6_842,
  uniqueCustomerCount: 1_904,
  customerGrowthCount: 142,
  activeBarCount: 47,
  barGrowthCount: 3,
  activeWalletCount: 2_150,
  walletGrowthCount: 88,
  subscriptionMrrInPaise: 2_45_000_00,
  mrrGrowthPercent: 5.2,
  featuredListingRevenueInPaise: 45_000_00,
  activeFeaturedListings: 12,
  openDisputes: 4,
  disputesPastSla: 1,
  kycPendingCount: 8,
  paymentFailureCount: 2,
  dailyGmv: Array.from({ length: 14 }).map((_, i) => ({
    date: daysAgo(13 - i),
    gmvInPaise: 4_00_000_00 + Math.random() * 2_00_000_00,
  })),
  topBars: [
    { barId: 501, barName: 'The Gilded Pour',          city: 'Mumbai',    stateCode: 'MH', gmvInPaise: 28_50_000_00, transactionCount: 642 },
    { barId: 502, barName: 'Moonlight Tavern',         city: 'Bengaluru', stateCode: 'KA', gmvInPaise: 24_10_500_00, transactionCount: 587 },
    { barId: 505, barName: 'The Still & Oak',          city: 'Hyderabad', stateCode: 'TG', gmvInPaise: 18_32_700_00, transactionCount: 514 },
    { barId: 507, barName: 'Whiskey Lane',             city: 'Bengaluru', stateCode: 'KA', gmvInPaise: 16_05_800_00, transactionCount: 476 },
    { barId: 504, barName: 'Nebula Speakeasy',         city: 'Kolkata',   stateCode: 'WB', gmvInPaise: 14_22_100_00, transactionCount: 398 },
    { barId: 503, barName: 'The Copper Barrel',        city: 'Lucknow',   stateCode: 'UP', gmvInPaise: 12_74_400_00, transactionCount: 363 },
    { barId: 506, barName: 'Harbour Club',             city: 'Mumbai',    stateCode: 'MH', gmvInPaise: 11_60_000_00, transactionCount: 298 },
    { barId: 510, barName: 'Pour Decisions',           city: 'Mumbai',    stateCode: 'MH', gmvInPaise: 9_45_300_00,  transactionCount: 251 },
    { barId: 508, barName: 'Amber & Rye',              city: 'Bengaluru', stateCode: 'KA', gmvInPaise: 8_10_200_00,  transactionCount: 219 },
    { barId: 509, barName: 'Smoke & Barrel',           city: 'Delhi',     stateCode: 'DL', gmvInPaise: 6_90_800_00,  transactionCount: 187 },
  ],
  cityMap: [
    { city: 'Mumbai',    stateCode: 'MH', barCount: 14, gmvInPaise: 62_30_000_00, latitude: 19.07, longitude: 72.87 },
    { city: 'Bengaluru', stateCode: 'KA', barCount: 11, gmvInPaise: 48_25_000_00, latitude: 12.97, longitude: 77.59 },
    { city: 'Delhi',     stateCode: 'DL', barCount: 7,  gmvInPaise: 28_40_000_00, latitude: 28.70, longitude: 77.10 },
    { city: 'Hyderabad', stateCode: 'TG', barCount: 5,  gmvInPaise: 18_60_000_00, latitude: 17.38, longitude: 78.49 },
    { city: 'Kolkata',   stateCode: 'WB', barCount: 4,  gmvInPaise: 14_22_000_00, latitude: 22.57, longitude: 88.36 },
    { city: 'Pune',      stateCode: 'MH', barCount: 3,  gmvInPaise: 6_50_000_00,  latitude: 18.52, longitude: 73.85 },
    { city: 'Lucknow',   stateCode: 'UP', barCount: 2,  gmvInPaise: 4_80_000_00,  latitude: 26.85, longitude: 80.95 },
    { city: 'Chennai',   stateCode: 'TN', barCount: 1,  gmvInPaise: 1_66_450_00,  latitude: 13.08, longitude: 80.27 },
  ],
  recentActivity: [
    { timeAgo: '2m ago', event: 'New Bar Joined', actor: 'The Blue Frog', target: 'Mumbai', status: 'Pending', statusColor: 'warn' },
    { timeAgo: '15m ago', event: 'Payment Success', actor: 'Aarav Sharma', target: '₹2,500 Topup', status: 'Captured', statusColor: 'success' },
    { timeAgo: '1h ago', event: 'Dispute Resolved', actor: 'Admin: Priya', target: 'Dispute #1042', status: 'Refunded', statusColor: 'success' },
    { timeAgo: '3h ago', event: 'KYC Approved', actor: 'Admin: Priya', target: 'Rahul Verma', status: 'Verified', statusColor: 'success' },
    { timeAgo: '5h ago', event: 'Payment Failure', actor: 'System', target: '₹1,200 Topup', status: 'Failed', statusColor: 'danger' },
  ],
});

/* ─── Dry days ───────────────────────────────────── */

let dryIdSeq = 100;
const dryDaysState: DryDayRowDto[] = [
  mkDryDay('ALL', '2026-01-26', 'Republic Day', 'National holiday — all states observe.', true, true),
  mkDryDay('ALL', '2026-08-15', 'Independence Day', null, true, true),
  mkDryDay('ALL', '2026-10-02', 'Gandhi Jayanti', null, true, true),
  mkDryDay('MH',  '2026-04-29', 'Maharashtra state election', 'State-notified — 48h before polling.', false, true),
  mkDryDay('KA',  '2026-05-10', 'Karnataka state election', null, false, true),
  mkDryDay('UP',  '2026-06-20', 'Eid-al-Adha',   'Recurring Islamic holiday.', true, true),
  mkDryDay('DL',  '2026-07-14', 'Delhi CM oath ceremony', null, false, false),
];

function mkDryDay(stateCode: string, dryDate: string, title: string, description: string | null, isRecurringYearly: boolean, isActive: boolean): DryDayRowDto {
  return {
    id: dryIdSeq++, stateCode, dryDate, title, description,
    isRecurringYearly, isActive, createdAtUtc: daysAgo(60),
  };
}

/* ─── Auth ───────────────────────────────────────── */

type FeaturedRecord = {
  id: number;
  barId: number;
  barName: string;
  city: string;
  paymentId: number | null;
  slotType: string;
  scopeCity: string | null;
  scopeCategory: string | null;
  priority: number;
  startsAtUtc: string;
  endsAtUtc: string;
  impressionCount: number;
  clickCount: number;
  status: string;
  cancelledAtUtc: string | null;
  cancelledByAdminId: number | null;
  cancellationReason: string | null;
  createdAtUtc: string;
  updatedAtUtc: string | null;
};

let featuredIdSeq = 200;
const featuredState: FeaturedRecord[] = [
  mkFeatured(501, 'Sky Lounge', 'Ahmedabad', 'CityTop', daysAgo(18), daysAhead(12), 8420, 284, 'Active', 10, null, null),
  mkFeatured(506, 'Harbour Bar', 'Mumbai', 'CategoryTop', daysAgo(9), daysAhead(4), 5180, 196, 'Active', 20, null, null),
  mkFeatured(509, 'Neon Nights Club', 'Delhi NCR', 'SearchBoost', daysAgo(14), daysAgo(3), 2840, 98, 'Expired', 30, null, null),
];

function mkFeatured(
  barId: number,
  barName: string,
  city: string,
  slotType: string,
  startsAtUtc: string,
  endsAtUtc: string,
  impressionCount: number,
  clickCount: number,
  status: string,
  priority: number,
  cancelledAtUtc: string | null,
  cancellationReason: string | null,
): FeaturedRecord {
  return {
    id: featuredIdSeq++,
    barId,
    barName,
    city,
    paymentId: null,
    slotType,
    scopeCity: city,
    scopeCategory: slotType === 'CategoryTop' ? 'Whisky' : null,
    priority,
    startsAtUtc,
    endsAtUtc,
    impressionCount,
    clickCount,
    status,
    cancelledAtUtc,
    cancelledByAdminId: cancelledAtUtc ? 1 : null,
    cancellationReason,
    createdAtUtc: startsAtUtc,
    updatedAtUtc: null,
  };
}

const adminProfile = {
  id: 1, fullName: 'SipSave Platform Admin', email: 'admin@sipsave.in',
  role: 'SuperAdmin', mfaEnabled: false,
};

const fakeSession = (): AdminSession => ({
  accessToken: 'mock-access-' + Math.random().toString(36).slice(2),
  accessTokenExpiresAtUtc: hoursAhead(1),
  refreshToken: 'mock-refresh-' + Math.random().toString(36).slice(2),
  refreshTokenExpiresAtUtc: daysAhead(30),
  admin: adminProfile,
});

// Platform settings (mocked in-memory)
const platformSettingsState = {
  minAgeRequirement: 18,
  autoApproveKyc: false,
  kycReviewSlaHours: 48,

  platformCommissionRatePct: 0,
  maxSingleWalletValue: 20000,
  defaultWalletExpiryPolicy: null,
  giftWalletRefundWindowDays: 30,

  gracePeriodAfterPaymentFailureDays: 5,
  autoRetryAttempts: 3,
  blockNewWalletPurchasesDuringGrace: true,

  disputeResolutionSlaHours: 48,
  autoEscalateAfterBreachHours: 72,
  allowAdminWalletReversal: true,
};

/* ─── Dispatcher ─────────────────────────────────── */

const delay = (ms = 180) => new Promise((r) => setTimeout(r, ms));

export async function mockRequest<T>(path: string, init: RequestInit): Promise<T> {
  await delay();
  const method = (init.method ?? 'GET').toUpperCase();
  const [pathname, query = ''] = path.split('?');
  const q = new URLSearchParams(query);
  const body: Record<string, unknown> = init.body ? JSON.parse(init.body as string) : {};

  // Auth
  if (method === 'POST' && pathname === '/api/admin/auth/login') {
    const { email, password } = body as { email: string; password: string };
    if (!email || !password) throw new ApiError(400, 'Missing credentials', null);
    return { mfaRequired: false, mfaChallengeToken: null, session: fakeSession() } as LoginResponse as unknown as T;
  }
  if (method === 'POST' && pathname === '/api/admin/auth/verify-mfa') {
    return fakeSession() as AdminSession as unknown as T;
  }
  if (method === 'POST' && pathname === '/api/admin/auth/logout') {
    return undefined as unknown as T;
  }

  // KYC
  if (method === 'GET' && pathname === '/api/admin/kyc') {
    return kycList(q.get('status') ?? 'PendingReview') as unknown as T;
  }
  const kycMatch = /^\/api\/admin\/kyc\/(\d+)(\/approve|\/reject|\/resubmit)?$/.exec(pathname);
  if (kycMatch) {
    const userId = Number(kycMatch[1]);
    const op = kycMatch[2];
    if (!op && method === 'GET') return kycGet(userId) as unknown as T;
    if (op === '/approve' && method === 'POST')
      return kycMutate(userId, { kycStatus: 'Approved', kycRejectionReason: null, dateOfBirth: (body.dateOfBirth as string) ?? null }) as unknown as T;
    if (op === '/reject' && method === 'POST') {
      const status = body.permanent ? 'PermanentlyRejected' : 'Rejected';
      return kycMutate(userId, { kycStatus: status, kycRejectionReason: body.reason as string }) as unknown as T;
    }
    if (op === '/resubmit' && method === 'POST')
      return kycMutate(userId, { kycStatus: 'Pending', kycRejectionReason: body.reason as string }) as unknown as T;
  }

  // Disputes
  if (method === 'GET' && pathname === '/api/admin/disputes') {
    return disputeList(q.get('status') ?? undefined) as unknown as T;
  }
  const disputeMatch = /^\/api\/admin\/disputes\/(\d+)(\/assign|\/resolve)?$/.exec(pathname);
  if (disputeMatch) {
    const id = Number(disputeMatch[1]);
    const op = disputeMatch[2];
    if (!op && method === 'GET') return disputeGet(id) as unknown as T;
    if (op === '/resolve' && method === 'POST') return disputeResolve(id, body as unknown as ResolveDisputePayload) as unknown as T;
    if (op === '/assign' && method === 'POST') return disputeGet(id) as unknown as T;
  }

  // Users
  if (method === 'GET' && pathname === '/api/admin/users') {
    return usersListFn(q.get('search') ?? undefined) as unknown as T;
  }
  const userMatch = /^\/api\/admin\/users\/(\d+)(\/suspend|\/reactivate|\/ban)?$/.exec(pathname);
  if (userMatch) {
    const id = Number(userMatch[1]);
    const op = userMatch[2];
    if (!op && method === 'GET') return userGet(id) as unknown as T;
    const u = usersState.find((x) => x.id === id);
    if (!u) throw new ApiError(404, 'Not found', null);
    if (op === '/suspend' && method === 'POST') { u.isActive = false; return u as unknown as T; }
    if (op === '/reactivate' && method === 'POST') { u.isActive = true; return u as unknown as T; }
    if (op === '/ban' && method === 'POST') {
      u.isActive = false; u.isBanned = true; u.kycStatus = 'PermanentlyRejected';
      u.kycRejectionReason = (body.reason as string) ?? 'Banned by admin';
      return u as unknown as T;
    }
  }

  // Subscriptions
  if (method === 'GET' && pathname === '/api/admin/subscriptions') {
    const status = q.get('status');
    return (status ? subsState.filter((s) => s.status === status) : subsState) as unknown as T;
  }

  if (method === 'GET' && pathname === '/api/admin/subscriptions/analytics') {
    return {
      monthlyRecurringRevenueInPaise: 16_80_000_00,
      mrrGrowthPercent: 8.5,
      totalActiveBars: 284,
      newBarsThisMonth: 18,
      paymentFailuresCount: 6,
      newFailuresThisWeek: 2,
      churnCount: 3,
      churnDetail: '2 voluntary, 1 non-payment',
      planBreakdown: [
        { planName: 'Growth', monthlyPriceInPaise: 6_999_00, barCount: 162, mrrInPaise: 11_30_000_00 },
        { planName: 'Starter', monthlyPriceInPaise: 2_999_00, barCount: 98, mrrInPaise: 2_90_000_00 },
        { planName: 'Enterprise', monthlyPriceInPaise: 18_000_00, barCount: 24, mrrInPaise: 2_60_000_00 },
      ],
      renewalCalendar: [
        { date: '2026-04-15', barName: 'Sky Lounge', planName: 'Growth', amountInPaise: 6_999_00, status: 'Auto-renew' },
        { date: '2026-04-15', barName: 'The Cellar Wine Bar', planName: 'Growth', amountInPaise: 6_999_00, status: 'Failed - retry' },
        { date: '2026-04-16', barName: 'Harbour Bar', planName: 'Starter', amountInPaise: 2_999_00, status: 'Auto-renew' },
        { date: '2026-04-18', barName: 'Neon Nights Club', planName: 'Enterprise', amountInPaise: 18_000_00, status: 'Auto-renew' },
      ],
      paymentFailures: [
        { subscriptionId: 5, barName: 'The Cellar Wine Bar', city: 'Bengaluru', planName: 'Growth', amountInPaise: 6_999_00, failureDate: '2026-04-13', failureReason: 'Card declined', graceDaysRemaining: 2, retryCount: 1 },
        { subscriptionId: 6, barName: 'Urban Pub', city: 'Mumbai', planName: 'Starter', amountInPaise: 2_999_00, failureDate: '2026-04-12', failureReason: 'Insufficient funds', graceDaysRemaining: 1, retryCount: 1 },
      ],
    } as SubscriptionAnalyticsDto as unknown as T;
  }

  if (method === 'GET' && pathname === '/api/admin/featured-listings') {
    const status = q.get('status');
    return (status ? featuredState.filter((f) => f.status === status) : featuredState) as unknown as T;
  }
  const featuredCreateMatch = /^\/api\/admin\/bars\/(\d+)\/featured-listings$/.exec(pathname);
  if (featuredCreateMatch && method === 'POST') {
    const barId = Number(featuredCreateMatch[1]);
    const sub = subsState.find((s) => s.barId === barId);
    const row: FeaturedRecord = {
      id: featuredIdSeq++,
      barId,
      barName: sub?.barName ?? `Bar #${barId}`,
      city: (body.scopeCity as string) ?? 'Unknown',
      paymentId: null,
      slotType: body.slotType as string,
      scopeCity: (body.scopeCity as string) ?? null,
      scopeCategory: (body.scopeCategory as string) ?? null,
      priority: Number(body.priority ?? 100),
      startsAtUtc: body.startsAtUtc as string,
      endsAtUtc: body.endsAtUtc as string,
      impressionCount: 0,
      clickCount: 0,
      status: (body.status as string) ?? 'Active',
      cancelledAtUtc: null,
      cancelledByAdminId: null,
      cancellationReason: null,
      createdAtUtc: new Date().toISOString(),
      updatedAtUtc: null,
    };
    featuredState.unshift(row);
    return row as unknown as T;
  }
  const featuredUpdateMatch = /^\/api\/v1\/featured-listings\/(\d+)$/.exec(pathname);
  if (featuredUpdateMatch && method === 'PUT') {
    const id = Number(featuredUpdateMatch[1]);
    const row = featuredState.find((f) => f.id === id);
    if (!row) throw new ApiError(404, 'Not found', null);
    row.slotType = body.slotType as string;
    row.scopeCity = (body.scopeCity as string) ?? null;
    row.scopeCategory = (body.scopeCategory as string) ?? null;
    row.priority = Number(body.priority ?? 100);
    row.startsAtUtc = body.startsAtUtc as string;
    row.endsAtUtc = body.endsAtUtc as string;
    row.status = body.status as string;
    row.updatedAtUtc = new Date().toISOString();
    return row as unknown as T;
  }
  const featuredCancelMatch = /^\/api\/admin\/featured-listings\/(\d+)\/cancel$/.exec(pathname);
  if (featuredCancelMatch && method === 'POST') {
    const id = Number(featuredCancelMatch[1]);
    const row = featuredState.find((f) => f.id === id);
    if (!row) throw new ApiError(404, 'Not found', null);
    row.status = 'Cancelled';
    row.cancelledAtUtc = new Date().toISOString();
    row.cancelledByAdminId = 1;
    row.cancellationReason = (body.reason as string) ?? null;
    row.updatedAtUtc = new Date().toISOString();
    return row as unknown as T;
  }
  const featuredRenewMatch = /^\/api\/admin\/featured-listings\/(\d+)\/renew$/.exec(pathname);
  if (featuredRenewMatch && method === 'POST') {
    const id = Number(featuredRenewMatch[1]);
    const row = featuredState.find((f) => f.id === id);
    if (!row) throw new ApiError(404, 'Not found', null);
    const days = Number(body.days ?? 7);
    const start = new Date();
    const end = new Date(start.getTime() + days * 86_400_000);
    row.startsAtUtc = start.toISOString();
    row.endsAtUtc = end.toISOString();
    row.status = 'Active';
    row.cancelledAtUtc = null;
    row.cancelledByAdminId = null;
    row.cancellationReason = null;
    row.updatedAtUtc = new Date().toISOString();
    return row as unknown as T;
  }

  // Analytics
  if (method === 'GET' && pathname === '/api/admin/analytics') {
    return analyticsFn() as unknown as T;
  }

  // Dry days
  if (method === 'GET' && pathname === '/api/admin/dry-days') {
    const state = q.get('stateCode');
    return (state ? dryDaysState.filter((d) => d.stateCode === state) : dryDaysState) as unknown as T;
  }
  if (method === 'POST' && pathname === '/api/admin/dry-days') {
    const row: DryDayRowDto = {
      id: dryIdSeq++,
      stateCode: (body.stateCode as string).toUpperCase(),
      dryDate: body.dryDate as string,
      title: body.title as string,
      description: (body.description as string) ?? null,
      isRecurringYearly: Boolean(body.isRecurringYearly),
      isActive: true,
      createdAtUtc: new Date().toISOString(),
    };
    dryDaysState.unshift(row);
    return row as unknown as T;
  }
  // Platform settings
  if (method === 'GET' && pathname === '/api/admin/platform-settings') {
    return platformSettingsState as unknown as T;
  }
  if ((method === 'PUT' || method === 'POST') && pathname === '/api/admin/platform-settings') {
    Object.assign(platformSettingsState, body as Partial<typeof platformSettingsState>);
    return platformSettingsState as unknown as T;
  }
  const dryActiveMatch = /^\/api\/admin\/dry-days\/(\d+)\/active$/.exec(pathname);
  if (dryActiveMatch && method === 'PUT') {
    const id = Number(dryActiveMatch[1]);
    const row = dryDaysState.find((d) => d.id === id);
    if (!row) throw new ApiError(404, 'Not found', null);
    row.isActive = Boolean(body.isActive);
    return undefined as unknown as T;
  }

  throw new ApiError(404, `Mock: no handler for ${method} ${pathname}`, null);
}
