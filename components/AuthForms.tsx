"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff } from "lucide-react";
import { loginAction, registerAction, type AuthState } from "@/app/actions";

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending}>
      {pending ? busy : label}
    </button>
  );
}

function PasswordField({ autoComplete, hint }: { autoComplete: string; hint?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label htmlFor="password" className="text-sm font-medium">Password</label>
      <div className="relative">
        <input id="password" name="password" type={show ? "text" : "password"} autoComplete={autoComplete} required minLength={8} className="input pr-12" aria-describedby={hint ? "pw-hint" : undefined} />
        <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-1 top-1/2 -translate-y-1/2 grid place-items-center size-10 text-muted hover:text-nile" aria-label={show ? "Hide password" : "Show password"}>
          {show ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
        </button>
      </div>
      {hint && <p id="pw-hint" className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? <p role="alert" className="rounded-xl bg-bad-soft text-bad text-sm px-4 py-3">{error}</p> : null;
}

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<AuthState, FormData>(loginAction, { error: null });
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <ErrorLine error={state.error} />
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.fields?.email} className="input" />
      </div>
      <PasswordField autoComplete="current-password" />
      <Submit label="Sign in" busy="Signing in…" />
      <p className="text-sm text-center text-muted">
        New to Grid? <Link href={`/register?next=${encodeURIComponent(next)}`} className="text-nile font-medium underline">Create an account</Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const [state, action] = useActionState<AuthState, FormData>(registerAction, { error: null });
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <ErrorLine error={state.error} />
      <div className="space-y-1.5">
        <label htmlFor="name" className="text-sm font-medium">Full name</label>
        <input id="name" name="name" autoComplete="name" required defaultValue={state.fields?.name} className="input" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.fields?.email} className="input" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="phone" className="text-sm font-medium">Mobile number <span className="text-muted font-normal">(optional, for viewing reminders)</span></label>
        <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0917 123 4567" defaultValue={state.fields?.phone} className="input" />
      </div>
      <PasswordField autoComplete="new-password" hint="At least 8 characters." />
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="terms" className="mt-1 size-4 accent-[#1c335e]" required />
        <span>I agree to Grid&apos;s Terms and Privacy Notice.</span>
      </label>
      <Submit label="Create account" busy="Creating account…" />
      <p className="text-sm text-center text-muted">
        Already have an account? <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-nile font-medium underline">Sign in</Link>
      </p>
    </form>
  );
}
