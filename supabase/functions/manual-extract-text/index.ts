import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log(`🔧 Manual Text Extraction Function triggered - ${req.method}`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { candidateIds, candidate_id, forceReExtract = false } = await req.json();
    
    // Handle both array and single candidate ID formats
    let ids: string[] = [];
    if (candidateIds && Array.isArray(candidateIds)) {
      ids = candidateIds;
    } else if (candidate_id) {
      ids = [candidate_id];
    }
    
    console.log(`📋 Processing ${ids.length} candidates, force re-extract: ${forceReExtract}`);

    if (ids.length === 0) {
      throw new Error('candidateIds array or candidate_id is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch candidate data
    const { data: candidates, error: fetchError } = await supabase
      .from('candidates')
      .select('id, name, email, resume_url, resume_text, status')
      .in('id', ids);

    if (fetchError) {
      throw new Error(`Failed to fetch candidates: ${fetchError.message}`);
    }

    console.log(`📊 Found ${candidates?.length || 0} candidates to process`);

    const results = {
      successful: [] as string[],
      failed: [] as string[],
      skipped: [] as string[]
    };

    // Process each candidate
    for (const candidate of candidates || []) {
      console.log(`\n🔄 Processing candidate: ${candidate.name} (${candidate.email})`);
      
      try {
        // Skip if already has text and not forcing re-extraction
        if (candidate.resume_text && candidate.resume_text.length > 50 && !forceReExtract) {
          console.log(`⏭️ Skipping ${candidate.name} - already has extracted text`);
          results.skipped.push(candidate.name);
          continue;
        }

        // Skip if no resume URL
        if (!candidate.resume_url) {
          console.log(`⚠️ Skipping ${candidate.name} - no resume URL`);
          results.skipped.push(candidate.name);
          continue;
        }

        // Update status to indicate processing
        await supabase
          .from('candidates')
          .update({ status: 'extracting_text' })
          .eq('id', candidate.id);

        console.log(`🚀 Invoking text extraction for ${candidate.name}...`);

        // Call the extract-resume-text-openai function
        const { data: extractionResult, error: extractionError } = await supabase.functions.invoke('extract-resume-text-openai', {
          body: {
            resumeUrl: candidate.resume_url,
            candidateId: candidate.id
          }
        });

        if (extractionError) {
          console.error(`❌ Text extraction failed for ${candidate.name}:`, extractionError);
          
          // Update candidate status to extraction_failed
          await supabase
            .from('candidates')
            .update({ status: 'extraction_failed' })
            .eq('id', candidate.id);
          
          results.failed.push(candidate.name);
          continue;
        }

        console.log(`✅ Text extraction successful for ${candidate.name}`);
        
        // Update candidate status to text_extracted
        await supabase
          .from('candidates')
          .update({ status: 'text_extracted' })
          .eq('id', candidate.id);
        
        results.successful.push(candidate.name);

      } catch (error) {
        console.error(`💥 Processing error for ${candidate.name}:`, error);
        
        // Update candidate status to extraction_failed
        await supabase
          .from('candidates')
          .update({ status: 'extraction_failed' })
          .eq('id', candidate.id);
        
        results.failed.push(candidate.name);
      }
    }

    console.log(`\n📈 Extraction Results:`);
    console.log(`✅ Successful: ${results.successful.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);
    console.log(`⏭️ Skipped: ${results.skipped.length}`);

    return new Response(JSON.stringify({
      success: true,
      message: `Text extraction completed`,
      results: results,
      summary: {
        total: ids.length,
        successful: results.successful.length,
        failed: results.failed.length,
        skipped: results.skipped.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Manual text extraction error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});