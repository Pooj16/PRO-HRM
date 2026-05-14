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
    const { data, error } = await supabase.from('candidates').select('id, name, applied_role, resume_url, resume_text, ai_score');
    if (error) {
        console.error("Error fetching candidates:", error);
        return;
    }

    console.log(`Total Candidates: ${data.length}`);
    data.forEach(c => {
        const textLen = c.resume_text ? c.resume_text.length : 0;
        const score = c.ai_score || 0;
        console.log(`- ${c.name} [Role: ${c.applied_role}] | Text Len: ${textLen} | Score: ${score}`);
    });
}
check();
