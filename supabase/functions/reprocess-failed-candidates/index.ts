import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Reprocessing failed candidates...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find candidates that need reprocessing (Supabase Storage paths only)
    const { data: candidates, error } = await supabase
      .from('candidates')
      .select('id, name, email, resume_url, resume_text, status')
      .in('status', ['uploaded', 'extraction_failed'])
      .not('resume_url', 'is', null)
      .like('resume_url', 'resumes/%'); // Only process Supabase Storage files

    if (error) {
      throw new Error(`Error fetching candidates: ${String((error as any)?.message || error)}`);
    }

    console.log(`Found ${candidates?.length || 0} candidates to reprocess`);

    const results = [];
    
    for (const candidate of candidates || []) {
      try {
        console.log(`🔄 Processing candidate: ${candidate.name} (${candidate.id})`);
        
        // Call the ai-assistant analyze function for this candidate
        const response = await supabase.functions.invoke('ai-assistant', {
          body: {
            candidateId: candidate.id,
            resumeText: candidate.resume_text || '',
            resumeUrl: candidate.resume_url
          }
        });

        if (response.error) {
          console.error(`Error processing ${candidate.name}:`, response.error);
          results.push({
            id: candidate.id,
            name: candidate.name,
            status: 'failed',
            error: String((response.error as any)?.message || response.error)
          });
        } else {
          console.log(`✅ Successfully processed ${candidate.name}`);
          results.push({
            id: candidate.id,
            name: candidate.name,
            status: 'success',
            data: response.data
          });
        }
      } catch (e) {
        console.error(`Error processing candidate ${candidate.name}:`, e);
        results.push({
          id: candidate.id,
          name: candidate.name,
          status: 'failed',
          error: String((e as any)?.message || e)
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: results.length,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ Error in reprocess-failed-candidates:', error);
    return new Response(JSON.stringify({ 
      error: String(error),
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});