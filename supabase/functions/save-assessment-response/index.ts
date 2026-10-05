import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { token, question_id, response_text, selected_option } = await req.json().catch(() => ({}));
    if (!token || !question_id) return new Response(JSON.stringify({ error: 'token and question_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find session by raw token
    const { data: session, error: sessionError } = await supabase
      .from('assessment_sessions')
      .select('id, assessment_id, organization_id, status, token_expires_at, expires_at')
      .eq('token', token)
      .maybeSingle();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'invalid token' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const now = new Date();
    const expiresAt = session.token_expires_at || session.expires_at;
    if ((expiresAt && new Date(expiresAt) <= now) || session.status !== 'in_progress') {
      return new Response(JSON.stringify({ error: 'session invalid or expired' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check if question belongs to this assessment
    const { data: question, error: qError } = await supabase
      .from('assessment_questions')
      .select('id')
      .eq('id', question_id)
      .eq('assessment_id', session.assessment_id)
      .maybeSingle();

    if (qError || !question) {
      return new Response(JSON.stringify({ error: 'question not found or not part of assessment' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Try candidate_responses table first, then fall back to responses table
    let result: any = null;

    // Try saving to candidate_responses (newer schema)
    const { data: existing } = await supabase
      .from('candidate_responses')
      .select('id')
      .eq('session_id', session.id)
      .eq('question_id', question_id)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from('candidate_responses')
        .update({ answer_text: response_text || selected_option?.value || selected_option || null })
        .eq('id', existing.id)
        .select()
        .single();
      result = { data, error };
    } else {
      const { data, error } = await supabase
        .from('candidate_responses')
        .insert({
          organization_id: session.organization_id,
          session_id: session.id,
          question_id: question_id,
          answer_text: response_text || selected_option?.value || selected_option || null
        })
        .select()
        .single();
      result = { data, error };
    }

    // If candidate_responses failed, try legacy responses table
    if (result.error) {
      console.warn('candidate_responses failed, trying responses table:', result.error);
      const { data: legacyExisting } = await supabase
        .from('responses')
        .select('id')
        .eq('session_id', session.id)
        .eq('question_id', question_id)
        .maybeSingle();

      if (legacyExisting) {
        const { data, error } = await supabase
          .from('responses')
          .update({ response_text: response_text || null, selected_option: selected_option || null, saved_at: new Date().toISOString() })
          .eq('id', legacyExisting.id)
          .select()
          .single();
        result = { data, error };
      } else {
        const { data, error } = await supabase
          .from('responses')
        .insert({ organization_id: session.organization_id, session_id: session.id, question_id, response_text: response_text || null, selected_option: selected_option || null })
          .select()
          .single();
        result = { data, error };
      }
    }

    if (result.error) {
      return new Response(JSON.stringify({ error: String(result.error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, response: result.data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('save-assessment-response error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
