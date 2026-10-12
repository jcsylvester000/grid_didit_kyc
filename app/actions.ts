"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getListing, isIdType } from "@/lib/data";
import { audit } from "@/lib/server/audit";
import { checkAccessCode, checkAdminCode, currentUser, grantAccess, hasAccess, isAdmin, requireUser, revokeAccess, setAdmin, setCurrentUser, signOutUser } from "@/lib/server/session";
import { authenticate, createUser, normalizePhMobile } from "@/lib/server/auth";
import {
  applyDecision,
  bookViewing,
  deleteRegisteredAccounts,
  buildMockDecision,
  getVerification,
  getVerificationBySession,
  MOCK_SCENARIOS,
  recordConsent,
  resetDemoData,
  setSetting,
  staffDecide,
  startVerification,
  type MockScenario,
  type ReviewAction,
} from "@/lib/server/kyc";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Every action except unlocking requires the internal access code. */
async function requireAccess() {
  if (!(await hasAccess())) redirect("/");
}

/* ---------------------------------------------------------------- access gate */

export type UnlockState = { error: string | null; ok?: boolean };

export async function unlockAction(_prev: UnlockState, form: FormData): Promise<UnlockState> {
  // Slow down guessing a little; a 6-digit code is a convenience lock, not real authentication.
  await new Promise((r) => setTimeout(r, 400));
  if (!checkAccessCode(str(form, "code"))) {
    await audit("visitor", "access.denied");
    return { error: "That code didn't work. Check it and try again." };
  }
  await grantAccess();
  await audit("visitor", "access.granted");
  // The client reloads the page itself: the root layout switches from the gate to the full app.
  return { error: null, ok: true };
}

export async function lockAction() {
  await revokeAccess();
  redirect("/");
}

/** Only allow same-site relative paths as redirect targets. */
const safeNext = (p: string) => (p.startsWith("/") && !p.startsWith("//") ? p : "/");

/* ---------------------------------------------------------------- accounts */

export type AuthState = { error: string | null; fields?: Record<string, string> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function registerAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  await requireAccess();
  const name = str(form, "name").replace(/\s+/g, " ");
  const email = str(form, "email");
  const phoneRaw = str(form, "phone");
  const password = String(form.get("password") ?? "");
  const fields = { name, email, phone: phoneRaw };
  if (name.length < 2) return { error: "Please enter your full name.", fields };
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address.", fields };
  const phone = phoneRaw ? normalizePhMobile(phoneRaw) : null;
  if (phoneRaw && !phone) return { error: "Mobile number should look like 0917 123 4567.", fields };
  if (password.length < 8) return { error: "Password must be at least 8 characters.", fields };
  if (form.get("terms") !== "on") return { error: "Please agree to the Terms and Privacy Notice.", fields };

  const roleRaw = str(form, "role");
  const role = roleRaw === "owner" || roleRaw === "broker" ? roleRaw : "tenant";
  const user = await createUser({ name, email, phone, password, role });
  if (!user) return { error: "An account with this email already exists. Sign in instead.", fields };
  await setCurrentUser(user.id);
  await audit(`user:${user.id}`, "user.registered", { userId: user.id }); // no email/phone in the audit log
  const next = safeNext(str(form, "next"));
  redirect(next === "/" ? "/?welcome=1" : next);
}

export async function loginAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  await requireAccess();
  const email = str(form, "email");
  const user = await authenticate(email, String(form.get("password") ?? ""));
  if (!user) {
    await audit("visitor", "user.login_failed");
    return { error: "Email or password is incorrect.", fields: { email } };
  }
  await setCurrentUser(user.id);
  await audit(`user:${user.id}`, "user.login", { userId: user.id });
  redirect(safeNext(str(form, "next")));
}

export async function logoutAction() {
  const user = await currentUser();
  await signOutUser();
  if (user) await audit(`user:${user.id}`, "user.logout", { userId: user.id });
  redirect("/");
}

export async function startVerificationAction(form: FormData) {
  await requireAccess();
  const listingId = getListing(str(form, "listingId"))?.id ?? null;
  const user = await requireUser(`/verify?listing=${listingId ?? ""}`);
  const idType = str(form, "idType");
  if (form.get("consent") !== "yes") redirect(`/verify?listing=${listingId ?? ""}&error=consent`);
  if (!isIdType(idType)) redirect(`/verify?listing=${listingId ?? ""}&error=id`);

  const ua = (await headers()).get("user-agent");
  const consentId = await recordConsent(user.id, listingId, ua);
  const result = await startVerification({ user, listingId, idType, consentId, resumeId: str(form, "resumeId") || null });

  if (result.kind === "redirect") redirect(result.url);
  if (result.kind === "reused") redirect(`/listings/${listingId ?? ""}?reused=1`);
  redirect(`/verify/result?v=${result.verificationId}`);
}

export async function bookViewingAction(form: FormData) {
  await requireAccess();
  const listing = getListing(str(form, "listingId"));
  const slot = str(form, "slot");
  if (!listing || !listing.slots.includes(slot)) redirect("/");
  const user = await requireUser(`/listings/${listing.id}`);
  await bookViewing(user.id, listing.id, slot);
  redirect(`/listings/${listing.id}?booked=1`);
}

export async function requestErasureAction() {
  await requireAccess();
  const user = await requireUser("/account");
  // Prototype: log the request for the DPO. Production: delete Grid rows + call Didit "privacy erasure".
  await audit(`user:${user.id}`, "privacy.erasure_requested", { userId: user.id });
  redirect("/account?erasure=1");
}

/* ---------------------------------------------------------------- mock Didit screen */

export async function mockCompleteAction(form: FormData) {
  await requireAccess();
  const sessionId = str(form, "sessionId");
  const scenario = str(form, "scenario") as MockScenario;
  const v = sessionId.startsWith("mock_") ? await getVerificationBySession(sessionId) : null;
  if (!v || v.mode !== "mock" || !(scenario in MOCK_SCENARIOS)) redirect("/");
  const user = await requireUser("/account");
  if (v.user_id !== user.id) redirect("/");
  await applyDecision(v, buildMockDecision(v, scenario, user.name), "didit:mock");
  redirect(`/verify/result?v=${v.id}`);
}

/* ---------------------------------------------------------------- admin */

async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin");
}

export async function adminLoginAction(form: FormData) {
  await requireAccess();
  if (checkAdminCode(str(form, "code"))) {
    await setAdmin(true);
    await audit("admin", "admin.login");
    redirect("/admin");
  }
  redirect("/admin?error=1");
}

export async function adminLogoutAction() {
  await requireAccess();
  await setAdmin(false);
  redirect("/admin");
}

export async function adminDecideAction(form: FormData) {
  await requireAccess();
  await requireAdmin();
  const id = str(form, "id");
  const action = str(form, "action") as ReviewAction;
  if (!["approve", "decline", "request_retry"].includes(action)) redirect("/admin");
  const v = await getVerification(id);
  if (!v) redirect("/admin");
  await staffDecide(id, action, str(form, "note"));
  revalidatePath("/admin");
  redirect("/admin#review");
}

export async function adminToggleOutageAction(form: FormData) {
  await requireAccess();
  await requireAdmin();
  const on = form.get("on") === "1";
  await setSetting("simulate_outage", on);
  await audit("admin", on ? "settings.outage_simulated" : "settings.outage_cleared");
  revalidatePath("/admin");
  redirect("/admin");
}

export async function adminDeleteAccountsAction() {
  await requireAccess();
  await requireAdmin();
  await deleteRegisteredAccounts();
  revalidatePath("/admin");
  redirect("/admin?accounts=1");
}

export async function adminResetDemoAction() {
  await requireAccess();
  await requireAdmin();
  await resetDemoData();
  revalidatePath("/admin");
  redirect("/admin?reset=1");
}
