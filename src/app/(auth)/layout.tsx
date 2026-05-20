import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-ink text-invert">
      {/* Brand panel */}
      <aside className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 10%, #D4A017 0, transparent 40%), radial-gradient(circle at 85% 80%, #D4A017 0, transparent 35%)",
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-accent flex items-center justify-center text-ink font-display font-semibold text-lg">
            S
          </div>
          <div>
            <p className="font-display text-xl leading-tight">SipSave</p>
            <p className="text-[0.65rem] tracking-[0.3em] uppercase text-accent/80">
              Noir Console
            </p>
          </div>
        </div>

        <div className="relative max-w-lg">
          <span className="gold-rule mb-5 block" aria-hidden="true" />
          <h2 className="font-display text-5xl leading-[1.05] text-balance">
            <em className="text-accent-hi not-italic">
              {" "}
              The liquor wallet platform, in capable hands.
            </em>
          </h2>
          <p className="mt-5 text-sm text-white/70 leading-relaxed max-w-md">
            Triage KYC, resolve disputes, track GMV across every bar on the
            network — the operator&rsquo;s console for a platform that handles
            real money every night.
          </p>
        </div>

        <div className="relative flex items-center gap-4 text-xs text-white/50">
          <span className="tracking-[0.2em] uppercase">SOC 2 · PCI-DSS</span>
          <span
            aria-hidden="true"
            className="w-1 h-1 rounded-full bg-white/30"
          />
          <span>v1.0 · {new Date().getFullYear()}</span>
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center p-6 md:p-10 bg-ivory text-ink min-h-screen">
        {children}
      </main>
    </div>
  );
}
