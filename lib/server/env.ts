import "server-only";

// Read env lazily so `next build` never fails when secrets are absent (agency rule W20 §3).
export const env = {
  databaseUrl: () => process.env.DATABASE_URL ?? "",
  diditApiKey: () => process.env.DIDIT_API_KEY ?? "",
  diditWorkflowId: () => process.env.DIDIT_WORKFLOW_ID ?? "",
  diditBiometricWorkflowId: () => process.env.DIDIT_BIOMETRIC_WORKFLOW_ID ?? "",
  diditWebhookSecret: () => process.env.DIDIT_WEBHOOK_SECRET ?? "",
  diditApiBase: () => (process.env.DIDIT_API_BASE || "https://verification.didit.me").replace(/\/+$/, ""),
  appUrl: () => (process.env.APP_URL || process.env.URL || "http://localhost:3000").replace(/\/+$/, ""),
  adminCode: () => process.env.ADMIN_ACCESS_CODE || (process.env.NODE_ENV !== "production" ? "grid-admin-dev" : ""),
  sessionSecret: () =>
    process.env.SESSION_SECRET || (process.env.NODE_ENV !== "production" ? "dev-only-insecure-secret" : ""),
};

/** Mock mode = no Didit API key configured. The app simulates Didit's hosted screen. */
export const isMockMode = () => !env.diditApiKey();
