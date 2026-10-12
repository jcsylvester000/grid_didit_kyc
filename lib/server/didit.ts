import "server-only";
import { env, isMockMode } from "./env";

// Didit Verification API v3 (docs.didit.me, checked 2026-10-12)
//   POST /v3/session/                     create session  -> { session_id, session_number, url, status, ... }
//   GET  /v3/session/{id}/decision/       retrieve decision
//   Auth header: x-api-key. Bad key -> 403. No credit -> 400. Rate limit -> 429.

export type DiditFeature = {
  status?: string;
  node_id?: string;
  warnings?: { risk?: string; short_description?: string; log_type?: string }[];
};

export type DiditIdVerification = DiditFeature & {
  document_type?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  date_of_birth?: string | null;
  expiration_date?: string | null;
  issuing_state?: string | null;
};

export type DiditDecision = {
  session_id?: string;
  session_number?: number;
  status: string; // Not Started | In Progress | In Review | Approved | Declined | Resubmitted | Awaiting User | Abandoned | Expired | Kyc Expired
  vendor_data?: string | null;
  metadata?: Record<string, unknown> | null;
  id_verifications?: DiditIdVerification[] | null;
  liveness_checks?: DiditFeature[] | null;
  face_matches?: DiditFeature[] | null;
  ip_analyses?: DiditFeature[] | null;
};

export type CreatedSession = { sessionId: string; sessionNumber: number | null; url: string; status: string; workflowId: string };

/** Didit could not take the request right now (network, outage, rate limit, no credit). Show "Verification pending". */
export class DiditUnavailableError extends Error {
  constructor(public reason: string, message: string) {
    super(message);
  }
}
/** Our configuration is wrong (bad key, bad workflow). Needs a developer, not a retry. */
export class DiditConfigError extends Error {}

async function call(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(env.diditApiBase() + path, {
      ...init,
      headers: { "x-api-key": env.diditApiKey(), "content-type": "application/json", accept: "application/json", ...init.headers },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch (e) {
    throw new DiditUnavailableError("network", `Didit unreachable: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function failFrom(res: Response, what: string): Promise<never> {
  const text = (await res.text().catch(() => "")).slice(0, 300);
  if (res.status === 429) throw new DiditUnavailableError("rate_limited", `${what}: Didit rate limit (429)`);
  if (res.status >= 500) throw new DiditUnavailableError("didit_down", `${what}: Didit ${res.status}`);
  if (res.status === 400 && /credit|balance|insufficient/i.test(text))
    throw new DiditUnavailableError("no_credit", `${what}: Didit credit balance too low`);
  if (res.status === 401 || res.status === 403) throw new DiditConfigError(`${what}: Didit rejected the API key (${res.status})`);
  throw new DiditConfigError(`${what}: Didit ${res.status} ${text}`);
}

export async function createDiditSession(input: {
  vendorData: string;
  callback: string;
  metadata: Record<string, unknown>;
}): Promise<CreatedSession> {
  const workflowId = env.diditWorkflowId();
  if (!workflowId) throw new DiditConfigError("DIDIT_WORKFLOW_ID is not set");
  const res = await call("/v3/session/", {
    method: "POST",
    body: JSON.stringify({
      workflow_id: workflowId,
      vendor_data: input.vendorData,
      callback: input.callback,
      metadata: input.metadata,
      language: "en",
    }),
  });
  if (!res.ok) await failFrom(res, "Create session");
  const j = (await res.json()) as { session_id: string; session_number?: number; url: string; status?: string; workflow_id?: string };
  return { sessionId: j.session_id, sessionNumber: j.session_number ?? null, url: j.url, status: j.status ?? "Not Started", workflowId: j.workflow_id ?? workflowId };
}

export async function getDiditDecision(sessionId: string): Promise<DiditDecision> {
  const res = await call(`/v3/session/${encodeURIComponent(sessionId)}/decision/`, { method: "GET" });
  if (!res.ok) await failFrom(res, "Get decision");
  return (await res.json()) as DiditDecision;
}

export { isMockMode };

/* ---------------------------------------------------------------- Biometric Authentication (signing re-check) */

// docs.didit.me/core-technology/biometric-auth/overview (checked 2026-10-12): session-only, workflow_type
// BIOMETRIC_AUTHENTICATION. Same vendor_data as the user's KYC so Didit reuses the stored face. US$0.10, always paid.
// Fails with 400 if Didit has no face for this vendor_data (e.g. accounts verified with sample data).
export async function createBiometricSession(input: { vendorData: string; callback: string; metadata: Record<string, unknown> }): Promise<CreatedSession> {
  const workflowId = env.diditBiometricWorkflowId();
  if (!workflowId) throw new DiditConfigError("DIDIT_BIOMETRIC_WORKFLOW_ID is not set");
  const res = await call("/v3/session/", {
    method: "POST",
    body: JSON.stringify({ workflow_id: workflowId, vendor_data: input.vendorData, callback: input.callback, metadata: input.metadata, language: "en" }),
  });
  if (!res.ok) await failFrom(res, "Create biometric session");
  const j = (await res.json()) as { session_id: string; session_number?: number; url: string; status?: string; workflow_id?: string };
  return { sessionId: j.session_id, sessionNumber: j.session_number ?? null, url: j.url, status: j.status ?? "Not Started", workflowId: j.workflow_id ?? workflowId };
}

/* ---------------------------------------------------------------- Document AI (title copy check) */

// docs.didit.me/standalone-apis/document-ai (checked 2026-10-12): POST /v3/document-ai/ multipart.
// Extracts the fields we define, fuzzy-matches the name, runs PDF/EXIF tamper checks. US$0.20, no free tier;
// sandbox keys return mock responses. It does NOT confirm the title with the Registry of Deeds.
export type DocumentAiResult = {
  status: "Approved" | "Declined" | "In Review";
  extracted: Record<string, string | number | null>;
  nameOnDocument: string | null;
  nameMatchScore: number | null;
  warnings: { risk?: string; short_description?: string; log_type?: string }[];
  requestId: string | null;
};

export async function runDocumentAi(input: {
  file: File;
  fields: { key: string; name: string; instruction: string; type: "text" | "number" | "date"; required: boolean; is_full_name?: boolean }[];
  expectedFirstName: string;
  expectedLastName: string;
  vendorData: string;
}): Promise<DocumentAiResult> {
  const form = new FormData();
  form.append("document", input.file, input.file.name || "title-copy");
  form.append("fields", JSON.stringify(input.fields));
  form.append("expected_first_name", input.expectedFirstName);
  form.append("expected_last_name", input.expectedLastName);
  form.append("vendor_data", input.vendorData);
  let res: Response;
  try {
    res = await fetch(env.diditApiBase() + "/v3/document-ai/", {
      method: "POST",
      headers: { "x-api-key": env.diditApiKey(), accept: "application/json" },
      body: form,
      signal: AbortSignal.timeout(45_000),
      cache: "no-store",
    });
  } catch (e) {
    throw new DiditUnavailableError("network", `Didit unreachable: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok) await failFrom(res, "Document AI");
  const j = (await res.json()) as {
    request_id?: string;
    document_ai?: { status?: string; extracted_data?: Record<string, string | number | null>; name_on_document?: string | null; name_match_score?: number | null; warnings?: DocumentAiResult["warnings"] };
  };
  const d = j.document_ai ?? {};
  const status = d.status === "Approved" || d.status === "Declined" ? d.status : "In Review";
  return { status, extracted: d.extracted_data ?? {}, nameOnDocument: d.name_on_document ?? null, nameMatchScore: d.name_match_score ?? null, warnings: d.warnings ?? [], requestId: j.request_id ?? null };
}
