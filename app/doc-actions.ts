"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getListing } from "@/lib/data";
import { hasAccess, requireUser } from "@/lib/server/session";
import {
  cancelDocument,
  checkTitleCopy,
  completeSimulatedFaceCheck,
  createAts,
  getDocument,
  getFaceCheck,
  sendToOwner,
  signDocument,
  startFaceCheck,
  TITLE_SCENARIOS,
  type TitleScenario,
} from "@/lib/server/documents";

export type DocFormState = { error: string | null };
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const msg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

async function guard(next: string) {
  if (!(await hasAccess())) redirect("/");
  return requireUser(next);
}
async function loadDoc(form: FormData) {
  const doc = await getDocument(str(form, "documentId"));
  if (!doc) redirect("/documents");
  return doc;
}

export async function createAtsAction(_prev: DocFormState, form: FormData): Promise<DocFormState> {
  const user = await guard("/documents/new");
  const listingId = str(form, "listingId");
  const price = Number(str(form, "salePricePhp").replace(/[^\d]/g, ""));
  const commission = Number(str(form, "commissionPct"));
  const termMonths = Number(str(form, "termMonths"));
  const start = str(form, "startDate");
  if (!getListing(listingId)) return { error: "Choose a property." };
  if (!Number.isFinite(price) || price < 100_000) return { error: "Enter the asking price in pesos." };
  if (!(commission > 0 && commission <= 10)) return { error: "Commission should be between 0.5% and 10%." };
  if (![3, 6, 12].includes(termMonths)) return { error: "Choose a validity period." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return { error: "Choose a start date." };
  const end = new Date(start + "T00:00:00Z");
  end.setUTCMonth(end.getUTCMonth() + termMonths);
  let id: string;
  try {
    id = await createAts(user, {
      listingId,
      ownerEmail: str(form, "ownerEmail"),
      terms: { salePricePhp: price, commissionPct: commission, exclusive: form.get("exclusive") === "yes", termMonths, startDate: start, endDate: end.toISOString().slice(0, 10) },
    });
  } catch (e) {
    return { error: msg(e) };
  }
  redirect(`/documents/${id}`);
}

export async function sendAtsAction(form: FormData) {
  const doc = await loadDoc(form);
  const user = await guard(`/documents/${doc.id}`);
  await sendToOwner(doc, user).catch(() => null);
  redirect(`/documents/${doc.id}?sent=1`);
}

export async function cancelAtsAction(form: FormData) {
  const doc = await loadDoc(form);
  const user = await guard(`/documents/${doc.id}`);
  await cancelDocument(doc, user).catch(() => null);
  redirect(`/documents/${doc.id}`);
}

export async function titleCheckAction(_prev: DocFormState, form: FormData): Promise<DocFormState> {
  const doc = await loadDoc(form);
  const user = await guard(`/documents/${doc.id}`);
  const file = form.get("titleCopy");
  const f = file instanceof File && file.size > 0 ? file : null;
  if (f && f.size > 10 * 1024 * 1024) return { error: "The file is larger than 10 MB." };
  if (f && !/\.(pdf|jpe?g|png|webp|tiff?)$/i.test(f.name)) return { error: "Upload a PDF, JPG, PNG, WEBP or TIFF file." };
  const scenario = (str(form, "scenario") || "clean") as TitleScenario;
  if (!(scenario in TITLE_SCENARIOS)) return { error: "Unknown option." };
  try {
    await checkTitleCopy(doc, user, { file: f, scenario });
  } catch (e) {
    return { error: msg(e) };
  }
  redirect(`/documents/${doc.id}?title=${Date.now().toString(36)}#title`);
}

export async function startFaceCheckAction(form: FormData) {
  const doc = await loadDoc(form);
  const user = await guard(`/documents/${doc.id}/sign`);
  let url: string;
  try {
    url = await startFaceCheck(doc, user);
  } catch (e) {
    redirect(`/documents/${doc.id}/sign?error=${encodeURIComponent(msg(e))}`);
  }
  redirect(url);
}

export async function simulatedFaceCheckAction(form: FormData) {
  const fc = await getFaceCheck(str(form, "faceCheckId"));
  if (!fc) redirect("/documents");
  const user = await guard(`/documents/${fc.document_id}/sign`);
  await completeSimulatedFaceCheck(fc, user, form.get("result") === "pass").catch(() => null);
  redirect(`/documents/${fc.document_id}/sign?fc=${fc.id}`);
}

export async function signAction(_prev: DocFormState, form: FormData): Promise<DocFormState> {
  const doc = await loadDoc(form);
  const user = await guard(`/documents/${doc.id}/sign`);
  let result: string;
  try {
    result = await signDocument(doc, user, {
      faceCheckId: str(form, "faceCheckId"),
      signatureSvg: str(form, "signature"),
      consent: form.get("consent") === "on",
      userAgent: (await headers()).get("user-agent"),
    });
  } catch (e) {
    return { error: msg(e) };
  }
  redirect(`/documents/${doc.id}?signed=${result}`);
}
