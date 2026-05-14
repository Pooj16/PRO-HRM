import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key);

async function main() {
    const { data, error } = await supabase.from('candidates').select('*').limit(1);
    if (error) {
        console.log("ERROR:", error.message);
    } else {
        console.log("SUCCESS. Data columns:", data.length > 0 ? Object.keys(data[0]) : 'Empty table');
    }
}
main();
