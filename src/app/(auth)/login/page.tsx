'use client';
 
/**
 * SC-01 Platform Admin login.  Two-step: email+password → optional TOTP.
 * The server decides if MFA is required; we render a generic "Invalid
 * credentials" copy on 401 so we don't confirm which factor was wrong.
 */
 
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import {
  adminVerifyMfa,
  ApiError,
  saveSession,
} from '@/lib/admin-api';
import { ErrorBanner } from '@/components/ui';
 
type Step = 'password' | 'mfa';
 
// ─── Validation helpers ──────────────────────────────────────────────────────
 
function validateEmail(value: string): string | null {
  if (!value.trim()) return 'Email address is required.';
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!EMAIL_RE.test(value.trim())) return 'Enter a valid email address.';
  return null;
}
 
function validatePassword(value: string): string | null {
  if (!value) return 'Password is required.';
  if (value.length < 8) return 'Password must be at least 8 characters.';
  return null;
}
 
function validateCode(value: string): string | null {
  if (!value) return 'Authenticator code is required.';
  if (value.length !== 6) return 'Enter the full 6-digit code.';
  if (!/^\d{6}$/.test(value)) return 'Code must contain digits only.';
  return null;
}
 
// ─── API call ────────────────────────────────────────────────────────────────
 
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? '';
 
interface LoginResponseData {
  mfaRequired?: boolean;
  mfaChallengeToken?: string;
  session?: unknown;
  message?: string;
}
 
async function callLoginApi(
  email: string,
  password: string,
): Promise<LoginResponseData> {
  const res = await fetch(`${BASE_URL}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
 
  // Always try to parse JSON — the API should return a body on every status
  let data: LoginResponseData = {};
  try {
    data = await res.json();
  } catch {
    // Non-JSON body; we'll surface a generic message below
  }
 
  if (!res.ok) {
    const msg =
      typeof data?.message === 'string' && data.message
        ? data.message
        : `Request failed (${res.status})`;
    throw new ApiError(msg, res.status);
  }
 
  return data;
}
 
// ─── Error copy ───────────────────────────────────────────────────────────────
 
function loginCopy(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      if (/locked/i.test(err.message)) return err.message;
      return 'Invalid email, password, or 2FA code.';
    }
    if (err.status === 429) return 'Too many attempts. Please wait and try again.';
    if (err.status >= 500) return 'A server error occurred. Please try again later.';
    return err.message;
  }
  if (err instanceof TypeError && /fetch/i.test(String(err))) {
    return 'Network error. Check your connection and try again.';
  }
  return err instanceof Error ? err.message : 'Login failed. Please try again.';
}
 
// ─── Component ────────────────────────────────────────────────────────────────
 
export default function AdminLoginPage() {
  const router = useRouter();
 
  const [step, setStep] = useState<Step>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * Synchronous in-flight guard.
   * React state updates are batched/async, so a fast double-click can still
   * fire `handlePassword` twice before the first `setBusy(true)` re-renders.
   * A ref flips *immediately* and stops the second call at the top of the
   * handler — before any await or setState runs.
   */
  const submittingRef = useRef(false);
 
  // Per-field errors (inline) + server-level error (banner)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; code?: string }>({});
  const [error, setError] = useState<string | null>(null);
 
  // ── Step 1: email + password ─────────────────────────────────────────────
 
  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
 
    // Synchronous guard — stops double-submits before any re-render
    if (submittingRef.current) return;
 
    setError(null);
 
    // Client-side validation — show inline messages and bail early
    const emailErr = validateEmail(email);
    const pwErr = validatePassword(password);
    if (emailErr || pwErr) {
      setFieldErrors({ email: emailErr ?? undefined, password: pwErr ?? undefined });
      return;
    }
    setFieldErrors({});
 
    submittingRef.current = true;
    setBusy(true);
    try {
      // Use the mock path when NEXT_PUBLIC_USE_MOCK is not '0'
      if (process.env.NEXT_PUBLIC_USE_MOCK !== '0') {
        // Demo mode — simulate MFA or direct login without hitting the network
        const mockResult = await import('@/lib/admin-api').then((m) =>
          m.adminLogin(email.trim(), password),
        );
        if (mockResult.mfaRequired && mockResult.mfaChallengeToken) {
          setMfaChallengeToken(mockResult.mfaChallengeToken);
          setStep('mfa');
        } else if (mockResult.session) {
          saveSession(mockResult.session);
          router.replace('/');
        } else {
          setError('Unexpected server response.');
        }
        return;
      }
 
      // Production path — real API
      const result = await callLoginApi(email.trim(), password);
 
      if (result.mfaRequired && result.mfaChallengeToken) {
        setMfaChallengeToken(result.mfaChallengeToken);
        setStep('mfa');
      } else if (result.session) {
        saveSession(result.session);
        router.replace('/');
      } else {
        setError('Unexpected server response.');
      }
    } catch (err) {
      setError(loginCopy(err));
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }
 
  // ── Step 2: TOTP ──────────────────────────────────────────────────────────
 
  async function handleMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaChallengeToken) return;
 
    // Synchronous guard — stops double-submits before any re-render
    if (submittingRef.current) return;
 
    setError(null);
 
    const codeErr = validateCode(code);
    if (codeErr) {
      setFieldErrors({ code: codeErr });
      return;
    }
    setFieldErrors({});
 
    submittingRef.current = true;
    setBusy(true);
    try {
      const session = await adminVerifyMfa(mfaChallengeToken, code.trim());
      saveSession(session);
      router.replace('/');
    } catch (err) {
      setError(loginCopy(err));
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }
 
  // ── Helpers ───────────────────────────────────────────────────────────────
 
  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value);
    if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
  }
 
  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPassword(e.target.value);
    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
  }
 
  function handleCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '');
    setCode(digits);
    if (fieldErrors.code) setFieldErrors((prev) => ({ ...prev, code: undefined }));
  }
 
  function handleBackToPassword() {
    setStep('password');
    setCode('');
    setError(null);
    setFieldErrors({});
  }
 
  // ── Render ────────────────────────────────────────────────────────────────
 
  return (
    <div className="w-full max-w-md">
      {/* Mobile logo */}
      <div className="mb-8 lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-ink flex items-center justify-center text-accent font-display font-semibold">
            S
          </div>
          <div>
            <p className="font-display text-lg leading-tight">SipSave</p>
            <p className="text-[0.65rem] tracking-[0.25em] uppercase text-accent-lo">
              Noir Console
            </p>
          </div>
        </div>
      </div>
 
      {/* Header */}
      <header className="mb-6">
        <p className="text-[0.7rem] font-semibold tracking-[0.22em] uppercase text-accent-lo">
          {step === 'password' ? 'Secure sign-in' : 'Two-factor verification'}
        </p>
        <h1 className="font-display text-4xl text-ink mt-2 leading-tight">
          {step === 'password' ? 'Welcome back.' : 'One last step.'}
        </h1>
        <span className="gold-rule mt-3 mb-3" aria-hidden="true" />
        <p className="text-sm text-muted">
          {step === 'password'
            ? 'Access is restricted to platform operators. All sign-ins are logged.'
            : (
              <>
                Enter the 6-digit code from your authenticator app for{' '}
                <strong className="text-ink">{email}</strong>.
              </>
            )}
        </p>
      </header>
 
      {/* ── Step 1: Password form ── */}
      {step === 'password' && (
        <form onSubmit={handlePassword} className="space-y-4" noValidate>
          {/* Email */}
          <div>
            <label htmlFor="email" className="field-label">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={handleEmailChange}
              required
              autoFocus
              aria-invalid={!!fieldErrors.email || !!error}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              className={`input${fieldErrors.email ? ' input-error' : ''}`}
              placeholder="you@sipsave.in"
            />
            {fieldErrors.email && (
              <p id="email-error" role="alert" className="mt-1.5 text-xs text-red-500">
                {fieldErrors.email}
              </p>
            )}
          </div>
 
          {/* Password */}
          <div>
            <label htmlFor="password" className="field-label">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={handlePasswordChange}
              required
              minLength={8}
              aria-invalid={!!fieldErrors.password || !!error}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              className={`input${fieldErrors.password ? ' input-error' : ''}`}
              placeholder="••••••••"
            />
            {fieldErrors.password && (
              <p id="password-error" role="alert" className="mt-1.5 text-xs text-red-500">
                {fieldErrors.password}
              </p>
            )}
          </div>
 
          {/* Server / network error banner */}
          {error && <ErrorBanner>{error}</ErrorBanner>}
 
          <button
            type="submit"
            disabled={busy}
            aria-busy={busy}
            aria-label={busy ? 'Signing in, please wait…' : 'Continue to next step'}
            className={`btn btn-primary w-full transition-opacity${busy ? ' opacity-70 pointer-events-none cursor-not-allowed' : ''}`}
          >
            {busy ? 'Signing in…' : 'Continue'}
          </button>
 
          {/* Demo mode notice */}
          {process.env.NEXT_PUBLIC_USE_MOCK !== '0' && (
            <div className="mt-4 rounded-md border border-dashed border-strong bg-accent-tint/50 px-3 py-2 text-[0.7rem] text-accent-lo leading-relaxed">
              <strong className="uppercase tracking-wider">Demo mode</strong> — enter any
              email + any password (≥ 8 chars) to sign in. Set{' '}
              <code className="font-mono">NEXT_PUBLIC_USE_MOCK=0</code> to hit the real
              API.
            </div>
          )}
 
          <p className="text-xs text-soft text-center pt-2">
            Trouble signing in? Contact your SuperAdmin.
          </p>
        </form>
      )}
 
      {/* ── Step 2: MFA form ── */}
      {step === 'mfa' && (
        <form onSubmit={handleMfa} className="space-y-4" noValidate>
          <div>
            <label htmlFor="code" className="field-label">
              Authenticator code
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={handleCodeChange}
              autoFocus
              aria-invalid={!!fieldErrors.code || !!error}
              aria-describedby={fieldErrors.code ? 'code-error' : undefined}
              className={`input font-mono text-center text-2xl tracking-[0.5em]${fieldErrors.code ? ' input-error' : ''}`}
              required
              placeholder="— — — — — —"
            />
            {fieldErrors.code && (
              <p id="code-error" role="alert" className="mt-1.5 text-xs text-red-500">
                {fieldErrors.code}
              </p>
            )}
          </div>
 
          {error && <ErrorBanner>{error}</ErrorBanner>}
 
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            aria-busy={busy}
            aria-label={busy ? 'Verifying code, please wait…' : 'Verify and sign in'}
            className={`btn btn-primary w-full transition-opacity${busy || code.length !== 6 ? ' opacity-70 pointer-events-none cursor-not-allowed' : ''}`}
          >
            {busy ? 'Verifying…' : 'Verify & sign in'}
          </button>
 
          <button
            type="button"
            onClick={handleBackToPassword}
            disabled={busy}
            className={`w-full text-xs font-semibold tracking-wide uppercase text-muted hover:text-ink py-1${busy ? ' pointer-events-none opacity-40' : ''}`}
          >
            ← Back to email
          </button>
        </form>
      )}
    </div>
  );
}