import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL as string,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY as string
);

async function check() {
    const { data: assignments, error } = await supabase.from('assessment_assignments').select('id, candidate_id, session_id, status');
    if (error) {
        console.error("Error fetching assignments:", error);
        return;
    }

    console.log(`Total Assignments: ${assignments.length}`);
    assignments.forEach(a => {
        console.log(`- ID: ${a.id} | Candidate: ${a.candidate_id} | SessionID: ${a.session_id} | Link (FRONTEND LOG): http://localhost:5173/assessment/${a.id}`);
    });
}
check();
