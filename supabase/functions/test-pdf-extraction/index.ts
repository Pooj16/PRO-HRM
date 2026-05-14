import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log(`🧪 PDF Extraction Test Function triggered - ${req.method}`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { testUrl } = await req.json();
    console.log(`🔗 Testing PDF extraction with URL: ${testUrl}`);

    if (!testUrl) {
      throw new Error('testUrl is required');
    }

    // Test the extraction by calling our extract-resume-text function
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🚀 Invoking extract-resume-text function...');
    
    const { data: extractionResult, error: extractionError } = await supabase.functions.invoke('extract-resume-text', {
      body: {
        resumeUrl: testUrl,
        candidateId: 'test-candidate-id'
      }
    });

    if (extractionError) {
      throw new Error(`Extraction function error: ${extractionError.message}`);
    }

    console.log('✅ Extraction test completed:', extractionResult);

    return new Response(JSON.stringify({
      success: true,
      message: 'PDF extraction test completed',
      result: extractionResult,
      testUrl: testUrl
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ PDF extraction test error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});