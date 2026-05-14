-- Migration: Create assessment sessions, responses, and evaluation results
-- Timestamped: 2026-02-20

BEGIN;

-- assessment_sessions: tracks per-candidate assessment sessions and token metadata
CREATE TABLE IF NOT EXISTS assessment_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  token_salt text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  started_at timestamptz NULL,
  submitted_at timestamptz NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | in_progress | submitted | expired | revoked
  ip_address text NULL,
  user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessment_sessions_candidate_id ON assessment_sessions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_assessment_id ON assessment_sessions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_token_hash ON assessment_sessions(token_hash);

-- responses: per-question responses saved incrementally
CREATE TABLE IF NOT EXISTS responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES assessment_questions(id) ON DELETE CASCADE,
  response_text text NULL,
  selected_option jsonb NULL,
  response_json jsonb NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  ip_address text NULL,
  user_agent text NULL
);

CREATE INDEX IF NOT EXISTS idx_responses_session_id ON responses(session_id);
CREATE INDEX IF NOT EXISTS idx_responses_question_id ON responses(question_id);

-- evaluation_results: final evaluation artifacts and scores
CREATE TABLE IF NOT EXISTS evaluation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE UNIQUE,
  overall_score numeric(5,2) NOT NULL DEFAULT 0,
  total_possible numeric(8,2) NULL,
  per_skill jsonb NULL,
  breakdown jsonb NULL,
  ai_explanation jsonb NULL,
  raw_ai_response jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evaluation_session_id ON evaluation_results(session_id);

-- View for HR dashboard to read aggregated candidate assessment info without raw responses
CREATE OR REPLACE VIEW hr_candidate_assessments AS
SELECT
  c.id AS candidate_id,
  c.name,
  c.email,
  c.applied_role,
  c.ats_score,
  er.overall_score AS assessment_score,
  -- final weighted score can be computed here if weighting is static; default weights: 0.4 ATS + 0.6 assessment
  CASE WHEN er.overall_score IS NOT NULL THEN round((COALESCE(c.ats_score,0) * 0.4 + er.overall_score * 0.6)::numeric,2) ELSE COALESCE(c.ats_score,0) END as final_weighted_score,
  er.per_skill,
  er.ai_explanation,
  s.status as session_status,
  s.token_expires_at,
  s.started_at,
  s.submitted_at
FROM candidates c
LEFT JOIN assessment_sessions s ON s.candidate_id = c.id
LEFT JOIN evaluation_results er ON er.session_id = s.id;

COMMIT;

-- Notes:
-- * Tokens should be generated server-side and only the raw token sent in email; store only token_hash + salt in DB.
-- * Consider adding triggers to expire sessions (cron or background job) and to populate updated_at on row changes.
