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
  lastLoginAtUtc: string | null;
  createdAtUtc: string;
};
export type AdminUserDetailDto = {
  id: number;
  mobileNumber: string;
  fullName: string | null;
  email: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  kycStatus: string;
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
export const listSubscriptions = (status?: string, skip = 0, take = 50) => {
  const q = new URLSearchParams({ skip: String(skip), take: String(take) });
  if (status) q.set('status', status);
  return request<AdminSubscriptionRowDto[]>(`/api/admin/subscriptions?${q.toString()}`);
};



export const getSubscription = (id: number) =>
  request<AdminSubscriptionRowDto>(`/api/admin/subscriptions/${id}`);

// ---- Analytics ----

export type PlatformAnalyticsDto = {
  fromDate: string;
  toDate: string;
  gmvInPaise: number;
  transactionCount: number;
  uniqueCustomerCount: number;
  activeBarCount: number;
  topBars: {
    barId: number; barName: string; city: string; stateCode: string;
    gmvInPaise: number; transactionCount: number;
  }[];
  cityMap: {
    city: string; stateCode: string; barCount: number; gmvInPaise: number;
    latitude: number | null; longitude: number | null;
  }[];
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
export const setDryDayActive = (id: number, isActive: boolean) =>
  request<void>(`/api/admin/dry-days/${id}/active`, { method: 'PUT', body: JSON.stringify({ isActive }) });
