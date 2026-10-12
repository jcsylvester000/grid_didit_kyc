"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDemoUser, getListing, isIdType } from "@/lib/data";
import { audit } from "@/lib/server/audit";
import { checkAdminCode, currentUser, isAdmin, setAdmin, setCurrentUser } from "@/lib/server/session";
import {
  applyDecision,
  bookViewing,
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

/** Only allow same-site relative paths as redirect targets. */
const safeNext = (p: string) => (p.startsWith("/") && !p.startsWith("//") ? p : "/");

export async function switchUserAction(form: FormData) {
  const id = str(form, "userId");
  if (getDemoUser(id)) await setCurrentUser(id);
  redirect(safeNext(str(form, "next")));
}

export async function startVerificationAction(form: FormData) {
  const user = await currentUser();
  const listingId = getListing(str(form, "listingId"))?.id ?? null;
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
  const user = await currentUser();
  const listing = getListing(str(form, "listingId"));
  const slot = str(form, "slot");
  if (!listing || !listing.slots.includes(slot)) redirect("/");
  await bookViewing(user.id, listing.id, slot);
  redirect(`/listings/${listing.id}?booked=1`);
}

export async function requestErasureAction() {
  const user = await currentUser();
  // Prototype: log the request for the DPO. Production: delete Grid rows + call Didit "privacy erasure".
  await audit(`user:${user.id}`, "privacy.erasure_requested", { userId: user.id });
  redirect("/account?erasure=1");
}

/* ---------------------------------------------------------------- mock Didit screen */

export async function mockCompleteAction(form: FormData) {
  const sessionId = str(form, "sessionId");
  const scenario = str(form, "scenario") as MockScenario;
  const v = sessionId.startsWith("mock_") ? await getVerificationBySession(sessionId) : null;
  if (!v || v.mode !== "mock" || !(scenario in MOCK_SCENARIOS)) redirect("/");
  const user = await currentUser();
  if (v.user_id !== user.id) redirect("/");
  await applyDecision(v, buildMockDecision(v, scenario), "didit:mock");
  redirect(`/verify/result?v=${v.id}`);
}

/* ---------------------------------------------------------------- admin */

async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin");
}

export async function adminLoginAction(form: FormData) {
  if (checkAdminCode(str(form, "code"))) {
    await setAdmin(true);
    await audit("admin", "admin.login");
    redirect("/admin");
  }
  redirect("/admin?error=1");
}

export async function adminLogoutAction() {
  await setAdmin(false);
  redirect("/admin");
}

export async function adminDecideAction(form: FormData) {
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
  await requireAdmin();
  const on = form.get("on") === "1";
  await setSetting("simulate_outage", on);
  await audit("admin", on ? "settings.outage_simulated" : "settings.outage_cleared");
  revalidatePath("/admin");
  redirect("/admin");
}

export async function adminResetDemoAction() {
  await requireAdmin();
  await resetDemoData();
  revalidatePath("/admin");
  redirect("/admin?reset=1");
}
