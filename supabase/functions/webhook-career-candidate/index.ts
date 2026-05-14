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
    console.log('📨 Received career page webhook');

    // Validate API key for security
    const apiKey = req.headers.get('x-api-key');
    const expectedKey = Deno.env.get('CAREER_PAGE_KEY');

    if (!apiKey || apiKey !== expectedKey) {
      console.error('❌ Invalid or missing API key');
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get candidate data from webhook payload
    const payload = await req.json();
    const candidate = payload.record || payload;

    console.log('👤 New candidate:', candidate.email);

    // Check if candidate already exists
    const { data: existing } = await supabase
      .from('candidates')
      .select('email')
      .eq('email', candidate.email.toLowerCase())
      .single();

    if (existing) {
      console.log('⏭️  Candidate already exists:', candidate.email);
      return new Response(JSON.stringify({
        message: 'Candidate already exists',
        skipped: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Map career page data to dashboard format
    const candidateData = {
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone || null,
      applied_role: candidate.applied_role,
      experience: 'Not Specified',
      location: 'Not Specified',
      skills: [],
      resume_url: candidate.resume_url || null,
      resume_text: candidate.resume_text || null,
      status: candidate.resume_text ? 'text_extracted' : 'uploaded',
      assessment_status: 'pending',
      ats_score: candidate.ats_score || 0,
      match_percentage: candidate.ats_score || 0,
      ats_notes: candidate.ats_notes || null,
      applied_date: candidate.created_at,
    };

    // Insert candidate
    const { data: insertedCandidate, error: insertError } = await supabase
      .from('candidates')
      .insert([candidateData])
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error inserting candidate:', insertError);
      throw insertError;
    }

    console.log('✅ Synced candidate in real-time:', candidate.email);

    // Auto-trigger text extraction if resume_url exists but no resume_text
    if (insertedCandidate && insertedCandidate.resume_url && !insertedCandidate.resume_text) {
      console.log('📄 Triggering automatic text extraction for:', insertedCandidate.id);

      // Fire-and-forget: directly call extract-resume-text via fetch using the service role key
      (async () => {
        try {
          const extractUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/extract-resume-text`;
          const res = await fetch(extractUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              resumeUrl: insertedCandidate.resume_url,
              candidateId: insertedCandidate.id
            })
          });
          const result = await res.json();
          if (res.ok) {
            console.log('✅ Text extraction successful for:', insertedCandidate.email, '| chars:', result.textLength);
          } else {
            console.error('❌ Text extraction failed:', result.error);
          }
        } catch (err: any) {
          console.error('❌ Error in background extraction trigger:', err.message);
        }
      })();
    }

    return new Response(JSON.stringify({
      message: 'Candidate synced successfully',
      email: candidate.email,
      textExtractionTriggered: !!(insertedCandidate?.resume_url && !insertedCandidate?.resume_text)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
