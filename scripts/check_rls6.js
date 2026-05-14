import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function test() {
    const { data, error } = await supabase.from('assessment_sessions').select(`
          *,
          candidates!inner ( id, name, email ),
          assessments!inner ( id, title, description, duration, difficulty )
        `)
        .limit(1);
    console.log('sessions join error test:', data, error);
}
test();
