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
    const { data, error } = await supabase.from('candidates').select('career_id').limit(1);
    if (error) {
        if (error.message.includes('career_id')) {
            console.log("COLUMN MISSING:", error.message);
        } else {
            console.log("ERROR:", error.message);
        }
    } else {
        console.log("COLUMN EXISTS");
    }
}
check();
