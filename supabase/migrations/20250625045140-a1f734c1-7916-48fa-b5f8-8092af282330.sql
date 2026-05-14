
-- Clear existing test/dummy data to start fresh
DELETE FROM candidate_assignments;
DELETE FROM candidate_assessments;
DELETE FROM assessment_responses;
DELETE FROM assessment_assignments;
DELETE FROM interview_schedule;
DELETE FROM scheduled_interviews;
DELETE FROM notifications WHERE related_candidate_id IS NOT NULL;
DELETE FROM resumes;
DELETE FROM candidates;
DELETE FROM google_form_responses;

-- Reset any auto-increment sequences if needed
-- This ensures we start with clean IDs
