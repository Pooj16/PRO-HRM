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
    const token = "8QqnSfR0b-AUIfRLN2huGktya1CVG-5NJR1ob5Edpt98enLuar7utElUSttejP16";
    console.log(`Checking token as ANON: ${token}`);

    const { data, error } = await supabase
        .from('assessment_sessions')
        .select(`
      *,
      candidates!inner ( id, name, email ),
      assessments!inner ( id, title, description, duration, difficulty )
    ` as any)
        .eq('token', token)
        .maybeSingle();

    if (error) {
        console.error("Query Error:", error);
        return;
    }

    if (data) {
        console.log("✅ SESSION FOUND:", data.id);
        console.log("Candidate:", (data as any).candidates?.name);
        console.log("Assessment:", (data as any).assessments?.title);
    } else {
        console.log("❌ SESSION NOT FOUND (as ANON). RLS might be blocking it.");
    }
}
check();
