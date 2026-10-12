import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Didit webhook signatures (docs.didit.me/integration/webhooks, checked 2026-10-12):
//   X-Signature     HMAC-SHA256(secret, raw request bytes)            — hex
//   X-Signature-V2  HMAC-SHA256(secret, canonical JSON of the body)   — hex (recommended)
//   X-Timestamp     unix seconds; reject if more than 300 s from now
// Canonical JSON: keys sorted recursively, compact separators, Unicode not escaped,
// whole-number floats written as integers (JavaScript's JSON.stringify already does the last two).

const TOLERANCE_SECONDS = 300;

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.keys(v as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortKeys((v as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  return v;
}

export const canonicalJson = (body: unknown) => JSON.stringify(sortKeys(body));

const hmacHex = (secret: string, data: string) => createHmac("sha256", secret).update(data, "utf8").digest("hex");

function equalHex(a: string, b: string) {
  const ab = Buffer.from(a.trim().toLowerCase());
  const bb = Buffer.from(b.trim().toLowerCase());
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export type SignatureResult =
  | { ok: true; method: "v2" | "raw" }
  | { ok: false; reason: "no_secret" | "stale_timestamp" | "missing_signature" | "bad_signature" | "bad_json" };

export function verifyDiditWebhook(
  rawBody: string,
  headers: Headers,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): SignatureResult {
  if (!secret) return { ok: false, reason: "no_secret" };
  const ts = Number(headers.get("x-timestamp"));
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > TOLERANCE_SECONDS) return { ok: false, reason: "stale_timestamp" };

  const v2 = headers.get("x-signature-v2");
  const raw = headers.get("x-signature");
  if (!v2 && !raw) return { ok: false, reason: "missing_signature" };

  if (v2) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return { ok: false, reason: "bad_json" };
    }
    if (equalHex(v2, hmacHex(secret, canonicalJson(parsed)))) return { ok: true, method: "v2" };
  }
  if (raw && equalHex(raw, hmacHex(secret, rawBody))) return { ok: true, method: "raw" };
  return { ok: false, reason: "bad_signature" };
}
