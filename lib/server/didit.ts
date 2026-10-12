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
