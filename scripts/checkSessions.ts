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
    const { data: sessions, error } = await supabase.from('assessment_sessions').select('id, candidate_id, token, status, created_at');
    if (error) {
        console.error("Error fetching sessions:", error);
        return;
    }

    console.log(`Total Sessions: ${sessions.length}`);
    sessions.forEach(s => {
        console.log(`Candidate: ${s.candidate_id} | Token: ${s.token} | Status: ${s.status} | Link: http://localhost:5173/assessment/${s.token}`);
    });
}
check();
