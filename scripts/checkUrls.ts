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
    const { data, error } = await supabase.from('candidates').select('name, resume_url, resume_text').order('created_at', { ascending: false }).limit(5);
    console.log("Recent candidates:");
    data?.forEach(d => {
        console.log(d.name, "-> url:", d.resume_url, " | text len:", d.resume_text?.length);
    });
}
check();
