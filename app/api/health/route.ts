import { NextResponse } from "next/server";
import { dbConfigured, q1 } from "@/lib/server/db";
import { env, isMockMode } from "@/lib/server/env";

export const dynamic = "force-dynamic";

export async function GET() {
  let db = "not_configured";
  if (dbConfigured()) {
    try {
      await q1("SELECT 1");
      db = "ok";
    } catch (e) {
      db = "error: " + (e instanceof Error ? e.message.slice(0, 120) : "unknown");
    }
  }
  return NextResponse.json({
    db,
    didit: isMockMode() ? "mock" : "live",
    workflowConfigured: Boolean(env.diditWorkflowId()),
    webhookSecretConfigured: Boolean(env.diditWebhookSecret()),
  });
}
