import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
    const sql = `
    DO $$ 
    BEGIN
      IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'assessment_assignments_candidate_id_fkey'
      ) THEN
          ALTER TABLE assessment_assignments
          ADD CONSTRAINT assessment_assignments_candidate_id_fkey
          FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE;
      END IF;

      IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'assessment_assignments_assessment_id_fkey'
      ) THEN
          ALTER TABLE assessment_assignments
          ADD CONSTRAINT assessment_assignments_assessment_id_fkey
          FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE;
      END IF;
    END $$;
  `;
    // There is no query method on the JS client, need to use rpc or fetch directly.
    // wait, to execute arbitrary sql we can't do it via postgrest.
}
fix();
