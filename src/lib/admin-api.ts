/**
 * Platform Admin API client.  All endpoints live under /api/admin and require
 * the admin JWT stored in sessionStorage under 'sipsave-admin-access-token'.
 * Anonymous calls (login, verify-mfa, refresh) skip the Authorization header.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === '1'; // Use mock only when explicitly set to '1', otherwise use real API
const TOKEN_KEY = 'sipsave-admin-access-token';
const REFRESH_KEY = 'sipsave-admin-refresh-token';
const ADMIN_KEY = 'sipsave-admin-profile';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init: RequestInit = {}, anon = false): Promise<T> {
  if (USE_MOCK) {
    const { mockRequest } = await import('./mock-backend');
    return mockRequest<T>(path, init);
  }
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');
  if (!anon && typeof window !== 'undefined') {
    const token = window.sessionStorage.getItem(TOKEN_KEY);
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  
  const url = `${BASE_URL}${path}`;
  console.log(`📡 API Request: ${init.method || 'GET'} ${url}`);
  
  try {
    const res = await fetch(url, { ...init, headers });
    if (res.status === 204) return undefined as unknown as T;
    const text = await res.text();
    const body = text ? safeParse(text) : null;
    if (!res.ok) {
      const title =
        body && typeof body === 'object' && 'title' in (body as Record<string, unknown>)
          ? String((body as Record<string, unknown>).title)
          : res.statusText;
      console.error(`❌ API Error [${res.status}]: ${title}`, body);

      // Handle session expiry (401 Unauthorized)
      if (res.status === 401 && !anon) {
        clearSession();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
          // Return a never-resolving promise to stop execution in the calling component
          return new Promise(() => {});
        }
      }

      throw new ApiError(res.status, title, body);
    }
    console.log(`✅ API Success [${res.status}]`);
    return body as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error(`🔥 Network Error: ${err}`);
    throw new ApiError(0, 'Network error - is the API running at ' + BASE_URL + '?', err);
  }
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}

// ---- Session helpers ----

export type AdminProfile = {
  id: number;
  fullName: string;
  email: string;
  role: string;
  mfaEnabled: boolean;
};

export type AdminSession = {
  accessToken: string;
  accessTokenExpiresAtUtc: string;
  refreshToken: string;
  refreshTokenExpiresAtUtc: string;
  admin: AdminProfile;
};

export function saveSession(s: AdminSession) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(TOKEN_KEY, s.accessToken);
  window.sessionStorage.setItem(REFRESH_KEY, s.refreshToken);
  window.sessionStorage.setItem(ADMIN_KEY, JSON.stringify(s.admin));
  window.localStorage.setItem('session', JSON.stringify(s));
}

export function loadAdmin(): AdminProfile | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(ADMIN_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as AdminProfile; } catch { return null; }
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(TOKEN_KEY);
  window.sessionStorage.removeItem(REFRESH_KEY);
  window.sessionStorage.removeItem(ADMIN_KEY);
  window.localStorage.removeItem('session');
}

export function hasAdminToken(): boolean {
  return typeof window !== 'undefined' && !!window.sessionStorage.getItem(TOKEN_KEY);
}

// ---- Auth ----

export type LoginResponse = {
  mfaRequired: boolean;
  mfaChallengeToken: string | null;
  session: AdminSession | null;
};

export const adminLogin = (email: string, password: string) =>
  request<LoginResponse>('/api/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }, true);

export const adminVerifyMfa = (mfaChallengeToken: string, code: string) =>
  request<AdminSession>('/api/admin/auth/verify-mfa', {
    method: 'POST',
    body: JSON.stringify({ mfaChallengeToken, code }),
  }, true);

export const adminLogout = () => {
  const refresh = typeof window !== 'undefined' ? window.sessionStorage.getItem(REFRESH_KEY) : null;
  const promise = refresh
    ? request<void>('/api/admin/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: refresh }) })
        .catch(() => undefined)
    : Promise.resolve();
  clearSession();
  return promise;
};

// ---- KYC ----

export type KycQueueRowDto = {
  userId: number;
  mobileNumber: string;
  barId: number;
  fullName: string | null;
  email: string | null;
  kycStatus: string;
  kycDocType: string | null;
  kycSubmittedAtUtc: string | null;
  hoursWaiting: number | null;
  slaBreached: boolean;
};

export type KycReviewDetailDto = {
  userId: number;
  mobileNumber: string;
  fullName: string | null;
  email: string | null;
  dateOfBirth: string | null;
  kycStatus: string;
  kycDocType: string | null;
  kycDocSignedUrl: string | null;
  kycSubmittedAtUtc: string | null;
  kycReviewedAtUtc: string | null;
  kycRejectionReason: string | null;
  kycReviewedByAdminId: number | null;
  slaBreached: boolean;
};

export const listKycQueue = (status = 'PendingReview', skip = 0, take = 50) =>
  request<KycQueueRowDto[]>(`/api/admin/kyc?status=${status}&skip=${skip}&take=${take}`);
export const getKycDetail = (userId: number) => request<KycReviewDetailDto>(`/api/admin/kyc/${userId}`);
export const approveKyc = (userId: number, dob: string | null) =>
  request<KycReviewDetailDto>(`/api/admin/kyc/${userId}/approve`, { method: 'POST', body: JSON.stringify({ dateOfBirth: dob }) });
export const rejectKyc = (userId: number, reason: string, permanent: boolean) =>
  request<KycReviewDetailDto>(`/api/admin/kyc/${userId}/reject`, { method: 'POST', body: JSON.stringify({ reason, permanent }) });
export const resubmitKyc = (userId: number, reason: string) =>
  request<KycReviewDetailDto>(`/api/admin/kyc/${userId}/resubmit`, { method: 'POST', body: JSON.stringify({ reason }) });

// ---- Platform settings (global) ----
export type PlatformSettingsDto = {
  minAgeRequirement: number;
  autoApproveKyc: boolean;
  kycReviewSlaHours: number;

  platformCommissionRatePct: number;
  maxSingleWalletValue: number;
  defaultWalletExpiryPolicy: string | null;
  giftWalletRefundWindowDays: number;

  gracePeriodAfterPaymentFailureDays: number;
  autoRetryAttempts: number;
  blockNewWalletPurchasesDuringGrace: boolean;

  disputeResolutionSlaHours: number;
  autoEscalateAfterBreachHours: number;
  allowAdminWalletReversal: boolean;
};

export const getPlatformSettings = () => request<PlatformSettingsDto>(`/api/admin/platform-settings`);
export const savePlatformSettings = (payload: Partial<PlatformSettingsDto>) =>
  request<PlatformSettingsDto>(`/api/admin/platform-settings`, { method: 'PUT', body: JSON.stringify(payload) });

// ---- Email templates ----
export type EmailTemplateRowDto = {
  id: number;
  type: string;
  subject: string;
  text: string;
  createdBy: string | null;
  createdDate: string;
  updatedBy: string | null;
  updatedDate: string | null;
  isDelete: boolean;
  isActive: boolean;
};

export type EmailTemplateUpsertPayload = {
  type: string;
  subject: string;
  text: string;
  isActive: boolean;
};

export const listEmailTemplates = (includeDeleted = true) => {
  const q = new URLSearchParams();
  if (includeDeleted) q.set('includeDeleted', 'true');
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return request<EmailTemplateRowDto[]>(`/api/admin/email-templates${suffix}`);
};

export const createEmailTemplate = (payload: EmailTemplateUpsertPayload) =>
  request<EmailTemplateRowDto>('/api/admin/email-templates', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateEmailTemplate = (id: number, payload: EmailTemplateUpsertPayload) =>
  request<EmailTemplateRowDto>(`/api/admin/email-templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

export const softDeleteEmailTemplate = (id: number) =>
  request<EmailTemplateRowDto>(`/api/admin/email-templates/${id}`, {
    method: 'DELETE',
  });

// ---- Bar KYC ----

export type BarKycQueueRowDto = {
  barId: number;
  businessName: string;
  city: string;
  stateCode: string;
  ownerFullName: string | null;
  contactMobile: string;
  contactEmail: string;
  kycStatus: string;
  docsUploaded: number;
  docsTotal: number;
  hoursWaiting: number;
  slaBreached: boolean;
  verifiedAt: string | null;
  rejectionReason: string | null;
};

export type BarKycReviewDetailDto = {
  barId: number;
  businessName: string;
  legalName: string | null;
  city: string;
  stateCode: string;
  addressLine1: string;
  addressLine2: string | null;
  locality: string | null;
  pincode: string;
  contactMobile: string;
  contactEmail: string;
  gstin: string;
  fssaiLicenceNumber: string;
  liquorLicenceNumber: string;
  openingHoursJson: string | null;
  kycStatus: string;
  rejectionReason: string | null;
  isVerified: boolean;
  verifiedAt: string | null;
  verifiedByAdminId: number | null;
  ownerFullName: string | null;
  ownerEmail: string | null;
  hoursWaiting: number;
  slaBreached: boolean;
  gstinDocSignedUrl: string | null;
  fssaiDocSignedUrl: string | null;
  liquorLicenceDocSignedUrl: string | null;
  photoGallerySignedUrls: string[];
};

export const listBarKycQueue = (status = 'PendingReview', skip = 0, take = 100) =>
  request<BarKycQueueRowDto[]>(`/api/admin/bar-kyc?status=${status}&skip=${skip}&take=${take}`);
export const getBarKycDetail = (barId: number) =>
  request<BarKycReviewDetailDto>(`/api/admin/bar-kyc/${barId}`);
export const approveBarKyc = (barId: number, adminNotes?: string) =>
  request<void>(`/api/admin/bar-kyc/${barId}/approve`, { method: 'POST', body: JSON.stringify({ adminNotes }) });
export const rejectBarKyc = (barId: number, reason: string) =>
  request<void>(`/api/admin/bar-kyc/${barId}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
export const resubmitBarKyc = (barId: number, reason: string) =>
  request<void>(`/api/admin/bar-kyc/${barId}/resubmit`, { method: 'POST', body: JSON.stringify({ reason }) });


// ---- Disputes ----

export type DisputeRowDto = {
  id: number;
  userId: number;
  userMobile: string;
  barId: number;
  barName: string;
  disputeType: string;
  status: string;
  createdAtUtc: string;
  slaDeadlineAtUtc: string;
  slaBreached: boolean;
  assignedAdminId: number | null;
  assignedAdminName: string | null;
};

export type DisputeAuditEntryDto = {
  atUtc: string;
  event: string;
  actor: string | null;
  detail: string | null;
};

export type DisputeDetailDto = {
  id: number;
  userId: number;
  userMobile: string;
  userFullName: string | null;
  barId: number;
  barName: string;
  walletId: number;
  disputedTransactionId: number | null;
  disputedPourRequestId: number | null;
  disputeType: string;
  description: string;
  status: string;
  createdAtUtc: string;
  slaDeadlineAtUtc: string;
  slaBreached: boolean;
  assignedAdminId: number | null;
  assignedAtUtc: string | null;
  resolution: string | null;
  resolvedByAdminId: number | null;
  resolvedAtUtc: string | null;
  reversalWalletTransactionId: number | null;
  adminNotes: string | null;
  rejectionReason: string | null;
  supportingDocUrls: string[];
  auditTrail: DisputeAuditEntryDto[];
};

export const listDisputes = (status?: string, skip = 0, take = 50) => {
  const q = new URLSearchParams({ skip: String(skip), take: String(take) });
  if (status) q.set('status', status);
  return request<DisputeRowDto[]>(`/api/admin/disputes?${q.toString()}`);
};
export const getDispute = (id: number) => request<DisputeDetailDto>(`/api/admin/disputes/${id}`);
export const assignDispute = (id: number, adminUserId: number) =>
  request<DisputeDetailDto>(`/api/admin/disputes/${id}/assign`, { method: 'POST', body: JSON.stringify({ adminUserId }) });

export type ResolveDisputePayload = {
  resolution: 'ApprovedReversal' | 'Rejected' | 'Escalated';
  adminNotes?: string;
  originalWalletTransactionId?: number;
  reversalMl?: number;
  rejectionReason?: string;
};
export const resolveDispute = (id: number, payload: ResolveDisputePayload) =>
  request<DisputeDetailDto>(`/api/admin/disputes/${id}/resolve`, { method: 'POST', body: JSON.stringify(payload) });

// ---- Users ----

export type AdminUserRowDto = {
  id: number;
  mobileNumber: string;
  fullName: string | null;
  email: string | null;
  kycStatus: string;
  isActive: boolean;
  isBanned: boolean;
  lastLoginAtUtc: string | null;
  createdAtUtc: string;
};
export type AdminUserTransactionDto = {
  id: number;
  walletId: number;
  barName: string;
  transactionType: string;
  volumeMlDelta: number;
  balanceAfterMl: number;
  notes: string | null;
  createdAtUtc: string;
};

export type AdminUserDetailDto = {
  id: number;
  mobileNumber: string;
  fullName: string | null;
  email: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  profilePhotoUrl: string | null;
  kycStatus: string;
  kycDocType: string | null;
  kycDocUrl: string | null;
  kycRejectionReason: string | null;
  isActive: boolean;
  isBanned: boolean;
  lastLoginAtUtc: string | null;
  createdAtUtc: string;
  wallets: {
    walletId: number;
    barId: number;
    barName: string;
    bottleBrandName: string;
    bottleProductName: string;
    purchasedVolumeMl: number;
    remainingVolumeMl: number;
    status: string;
    createdAtUtc: string;
  }[];
  transactions: AdminUserTransactionDto[];
};

export const listUsers = (search?: string, skip = 0, take = 50) => {
  const q = new URLSearchParams({ skip: String(skip), take: String(take) });
  if (search) q.set('search', search);
  return request<AdminUserRowDto[]>(`/api/admin/users?${q.toString()}`);
};
export const getUser = (id: number) => request<AdminUserDetailDto>(`/api/admin/users/${id}`);
export const suspendUser = (id: number, reason: string) =>
  request<AdminUserDetailDto>(`/api/admin/users/${id}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) });
export const reactivateUser = (id: number) =>
  request<AdminUserDetailDto>(`/api/admin/users/${id}/reactivate`, { method: 'POST', body: JSON.stringify({}) });
export const banUser = (id: number, reason: string) =>
  request<AdminUserDetailDto>(`/api/admin/users/${id}/ban`, { method: 'POST', body: JSON.stringify({ confirmation: 'BAN', reason }) });

// ---- Subscriptions ----

export type AdminSubscriptionRowDto = {
  id: number;
  barId: number;
  barName: string;
  subscriptionPlanId: number;
  status: string;
  billingCycle: string;
  priceInPaiseAtSignup: number;
  startedAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextBillingAtUtc: string | null;
  gracePeriodEndsAtUtc: string | null;
  failedPaymentCount: number;
  lastFailureReason: string | null;
};

export type PlanBreakdownDto = {
  planName: string;
  monthlyPriceInPaise: number;
  barCount: number;
  mrrInPaise: number;
};

export type RenewalCalendarDto = {
  date: string;
  barName: string;
  planName: string;
  amountInPaise: number;
  status: string;
};

export type FailedSubscriptionDto = {
  subscriptionId: number;
  barName: string;
  city: string;
  planName: string;
  amountInPaise: number;
  failureDate: string;
  failureReason: string;
  graceDaysRemaining: number | null;
  retryCount: number;
};

export type SubscriptionAnalyticsDto = {
  monthlyRecurringRevenueInPaise: number;
  mrrGrowthPercent: number;
  totalActiveBars: number;
  newBarsThisMonth: number;
  paymentFailuresCount: number;
  newFailuresThisWeek: number;
  churnCount: number;
  churnDetail: string;
  planBreakdown: PlanBreakdownDto[];
  renewalCalendar: RenewalCalendarDto[];
  paymentFailures: FailedSubscriptionDto[];
};

export const listSubscriptions = (status?: string, skip = 0, take = 50) => {
  const q = new URLSearchParams({ skip: String(skip), take: String(take) });
  if (status) q.set('status', status);
  return request<AdminSubscriptionRowDto[]>(`/api/admin/subscriptions?${q.toString()}`);
};



export const getSubscription = (id: number) =>
  request<AdminSubscriptionRowDto>(`/api/admin/subscriptions/${id}`);

export const getSubscriptionAnalytics = () =>
  request<SubscriptionAnalyticsDto>('/api/admin/subscriptions/analytics');

// ---- Featured listings ----

export type AdminFeaturedListingRowDto = {
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

export type CreateAdminFeaturedListingRequest = {
  slotType: string;
  scopeCity?: string | null;
  scopeCategory?: string | null;
  priority?: number | null;
  startsAtUtc: string;
  endsAtUtc: string;
  status?: string | null;
};

export type UpdateFeaturedListingRequest = {
  slotType: string;
  scopeCity?: string | null;
  scopeCategory?: string | null;
  priority?: number | null;
  startsAtUtc: string;
  endsAtUtc: string;
  status: string;
};

export type RenewFeaturedListingRequest = {
  days: number;
};

export const listFeaturedListings = (status?: string, skip = 0, take = 50) => {
  const q = new URLSearchParams({ skip: String(skip), take: String(take) });
  if (status) q.set('status', status);
  return request<AdminFeaturedListingRowDto[]>(`/api/admin/featured-listings?${q.toString()}`);
};

export const createFeaturedListing = (barId: number, payload: CreateAdminFeaturedListingRequest) =>
  request<AdminFeaturedListingRowDto>(`/api/admin/bars/${barId}/featured-listings`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateFeaturedListing = (id: number, payload: UpdateFeaturedListingRequest) =>
  request<AdminFeaturedListingRowDto>(`/api/v1/featured-listings/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

export const removeFeaturedListing = (id: number, reason?: string) =>
  request<AdminFeaturedListingRowDto>(`/api/admin/featured-listings/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });

export const renewFeaturedListing = (id: number, payload: RenewFeaturedListingRequest) =>
  request<AdminFeaturedListingRowDto>(`/api/admin/featured-listings/${id}/renew`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

// ---- Analytics ----

export type DailyGmvDto = { date: string; gmvInPaise: number };

export type PlatformActivityDto = {
  timeAgo: string;
  event: string;
  actor: string;
  target: string;
  status: string;
  statusColor: string;
};

export type PlatformAnalyticsDto = {
  fromDate: string;
  toDate: string;
  gmvInPaise: number;
  gmvGrowthPercent: number;
  transactionCount: number;
  uniqueCustomerCount: number;
  customerGrowthCount: number;
  activeBarCount: number;
  barGrowthCount: number;
  activeWalletCount: number;
  walletGrowthCount: number;
  subscriptionMrrInPaise: number;
  mrrGrowthPercent: number;
  featuredListingRevenueInPaise: number;
  activeFeaturedListings: number;
  openDisputes: number;
  disputesPastSla: number;
  kycPendingCount: number;
  paymentFailureCount: number;
  dailyGmv: DailyGmvDto[];
  topBars: {
    barId: number; barName: string; city: string; stateCode: string;
    gmvInPaise: number; transactionCount: number;
  }[];
  cityMap: {
    city: string; stateCode: string; barCount: number; gmvInPaise: number;
    latitude: number | null; longitude: number | null;
  }[];
  recentActivity: PlatformActivityDto[];
};
export const getAnalytics = (from?: string, to?: string) => {
  const q = new URLSearchParams();
  if (from) q.set('from', from);
  if (to) q.set('to', to);
  return request<PlatformAnalyticsDto>(`/api/admin/analytics?${q.toString()}`);
};

// ---- Dry days ----

export type DryDayRowDto = {
  id: number;
  stateCode: string;
  dryDate: string;
  title: string;
  description: string | null;
  isRecurringYearly: boolean;
  isActive: boolean;
  createdAtUtc: string;
};
export const listDryDays = (stateCode?: string, from?: string, to?: string) => {
  const q = new URLSearchParams();
  if (stateCode) q.set('stateCode', stateCode);
  if (from) q.set('from', from);
  if (to) q.set('to', to);
  return request<DryDayRowDto[]>(`/api/admin/dry-days?${q.toString()}`);
};
export const addDryDay = (payload: {
  stateCode: string; dryDate: string; title: string;
  description?: string; isRecurringYearly?: boolean;
}) => request<DryDayRowDto>('/api/admin/dry-days', { method: 'POST', body: JSON.stringify(payload) });

export const updateDryDay = (id: number, payload: {
  stateCode: string; dryDate: string; title: string;
  description?: string; isRecurringYearly?: boolean;
}) => request<void>(`/api/admin/dry-days/${id}`, { method: 'PUT', body: JSON.stringify(payload) });

export const deleteDryDay = (id: number) =>
  request<void>(`/api/admin/dry-days/${id}`, { method: 'DELETE' });

export const setDryDayActive = (id: number, isActive: boolean) =>
  request<void>(`/api/admin/dry-days/${id}/active`, { method: 'PUT', body: JSON.stringify({ isActive }) });

// ---- Master categories ----

export type MasterCategoryDto = {
  id: number;
  name: string;
  isActive: boolean;
  catalogueItemCount: number;
};

export const listMasterCategories = () =>
  request<MasterCategoryDto[]>('/api/admin/master-categories');

export const createMasterCategory = (name: string) =>
  request<MasterCategoryDto>('/api/admin/master-categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });

export const updateMasterCategory = (
  id: number,
  payload: { name: string; isActive: boolean },
) =>
  request<MasterCategoryDto>(`/api/admin/master-categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

export const deleteMasterCategory = (id: number) =>
  request<void>(`/api/admin/master-categories/${id}`, { method: 'DELETE' });
