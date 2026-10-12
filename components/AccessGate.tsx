"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { LockKeyhole } from "lucide-react";
import { unlockAction, type UnlockState } from "@/app/actions";
import { GATE_PHOTO } from "@/lib/photos";

function UnlockButton({ done }: { done: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending || done}>
      {done ? "Opening…" : pending ? "Checking…" : "Unlock"}
    </button>
  );
}

export function AccessGate({ secretMissing }: { secretMissing: boolean }) {
  const [state, action] = useActionState<UnlockState, FormData>(unlockAction, { error: null });
  const next = useRef<HTMLInputElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (next.current) next.current.value = window.location.pathname + window.location.search;
    input.current?.focus();
  }, []);

  useEffect(() => {
    if (state.ok) {
      const dest = next.current?.value || "/";
      window.location.replace(dest.startsWith("/") && !dest.startsWith("//") ? dest : "/");
      return;
    }
    if (state.error && input.current) {
      input.current.value = "";
      input.current.focus();
    }
  }, [state]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <Image src={GATE_PHOTO.src} alt="" fill priority sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 bg-midnight/80 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gate-title"
        aria-describedby="gate-desc"
        className="relative w-full max-w-sm rounded-[22px] bg-white shadow-2xl overflow-hidden"
      >
        <div className="bg-midnight px-6 pt-6 pb-5">
          <Image src="/brand/grid-logo-dark.png" alt="GRID Property Ventures" width={150} height={39} priority />
        </div>
        <div className="brand-rule" />
        <form action={action} className="p-6 space-y-5">
          <input ref={next} type="hidden" name="next" defaultValue="/" />
          <div className="flex items-start gap-3">
            <span className="grid place-items-center size-10 rounded-full bg-muesli-soft text-muesli-text shrink-0">
              <LockKeyhole size={18} aria-hidden />
            </span>
            <div>
              <h1 id="gate-title" className="text-2xl text-nile">GRID Verified</h1>
              <p id="gate-desc" className="text-sm text-muted mt-1">
                Internal prototype. Please provide your access code to continue.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="access-code" className="text-sm font-medium">Access code</label>
            <input
              ref={input}
              id="access-code"
              name="code"
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={12}
              required
              aria-invalid={Boolean(state.error)}
              aria-describedby={state.error ? "gate-error" : undefined}
              className="input text-center text-2xl tracking-[0.5em] font-medium"
              placeholder="••••••"
            />
            {state.error && (
              <p id="gate-error" role="alert" className="text-sm text-bad">{state.error}</p>
            )}
            {secretMissing && (
              <p role="alert" className="text-sm text-bad">SESSION_SECRET is not set on the server, so access cannot be remembered. Add it to the environment variables.</p>
            )}
          </div>
          <UnlockButton done={Boolean(state.ok)} />
          <p className="text-xs text-muted text-center">Access lasts 12 hours on this browser.</p>
        </form>
      </div>
    </div>
  );
}
