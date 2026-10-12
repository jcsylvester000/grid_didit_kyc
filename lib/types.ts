export type Outcome = "in_progress" | "verified" | "retry" | "review" | "pending" | "declined";

export type VerificationRow = {
  id: string;
  user_id: string;
  consent_id: string | null;
  trigger_action: string;
  listing_id: string | null;
  id_type_chosen: string | null;
  mode: "live" | "mock" | "seed";
  didit_session_id: string | null;
  didit_session_number: number | null;
  didit_status: string | null;
  outcome: Outcome;
  verified_name: string | null;
  date_of_birth: string | null;
  document_type: string | null;
  document_expiry: string | null;
  issuing_state: string | null;
  failure_reason: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  decided_at: string | null;
};

export const FINAL_OUTCOMES: Outcome[] = ["verified", "declined"];
