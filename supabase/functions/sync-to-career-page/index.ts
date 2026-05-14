import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Syncing dashboard updates to career page...');

    const payload = await req.json();
    const { candidateId, updates } = payload;

    // Connect to dashboard database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const dashboardDb = createClient(supabaseUrl, supabaseServiceKey);

    // Connect to career page database
    const careerPageUrl = Deno.env.get('CAREER_PAGE_URL')!;
    const careerPageKey = Deno.env.get('CAREER_PAGE_KEY')!;
    
    if (!careerPageUrl || !careerPageKey) {
      throw new Error('Career page credentials not configured');
    }

    const careerPageDb = createClient(careerPageUrl, careerPageKey);

    // Get candidate from dashboard
    const { data: candidate, error: fetchError } = await dashboardDb
      .from('candidates')
      .select('*')
      .eq('id', candidateId)
      .single();

    if (fetchError || !candidate) {
      console.error('Error fetching candidate:', fetchError);
      throw new Error('Candidate not found');
    }

    // Sync relevant fields back to career page
    const careerPageUpdates = {
      status: candidate.status,
      assessment_status: candidate.assessment_status,
      ats_score: candidate.ats_score,
      ats_notes: candidate.ats_notes,
      match_percentage: candidate.match_percentage,
      resume_text: candidate.resume_text,
      updated_at: new Date().toISOString(),
    };

    // Update in career page by email (since ID might differ)
    const { error: updateError } = await careerPageDb
      .from('candidates')
      .update(careerPageUpdates)
      .eq('email', candidate.email);

    if (updateError) {
      console.error('❌ Error updating career page:', updateError);
      throw updateError;
    }

    console.log('✅ Synced to career page:', candidate.email);

    return new Response(JSON.stringify({ 
      success: true,
      email: candidate.email 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Sync error:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
