-- Truncate existing candidate data
TRUNCATE TABLE candidates CASCADE;

-- Rename position to applied_role
ALTER TABLE candidates RENAME COLUMN position TO applied_role;

-- Rename ai_score to ats_score
ALTER TABLE candidates RENAME COLUMN ai_score TO ats_score;

-- Replace ai_analysis (jsonb) with ats_notes (text)
ALTER TABLE candidates DROP COLUMN ai_analysis;
ALTER TABLE candidates ADD COLUMN ats_notes text;