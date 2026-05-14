ALTER TABLE assessment_assignments
ADD CONSTRAINT assessment_assignments_candidate_id_fkey
FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE;

ALTER TABLE assessment_assignments
ADD CONSTRAINT assessment_assignments_assessment_id_fkey
FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE;
