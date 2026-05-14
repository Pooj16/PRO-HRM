import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function test() {
  const { data, error } = await supabase.from('assessment_assignments').select(`
          *,
          candidates!inner ( id, name, email ),
          assessments!inner ( id, title, description, duration, difficulty )
        `)
    .eq('id', '30c8973e-c513-4835-b6b3-46eb4679238a')
    .single();
  console.log('Anon read assessment_assignment:', data, error);
}
test();
