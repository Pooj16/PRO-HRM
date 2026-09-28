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
    const { token, action } = await req.json().catch(() => ({}));
    if (!token) return new Response(JSON.stringify({ valid: false, error: 'token required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Look up session by raw token (the actual column in the DB)
    const { data: session, error } = await supabase
      .from('assessment_sessions')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (error) {
      console.error('Error querying session:', error);
      return new Response(JSON.stringify({ valid: false, error: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!session) return new Response(JSON.stringify({ valid: false, error: 'Invalid or expired assessment link' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Check expiration
    const expiresAt = session.token_expires_at || session.expires_at;
    if (expiresAt && new Date(expiresAt) <= new Date()) {
      return new Response(JSON.stringify({ valid: false, error: 'expired' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (session.status === 'revoked' || session.status === 'submitted' || session.status === 'expired') {
      return new Response(JSON.stringify({ valid: false, error: `session ${session.status}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Optionally mark session as started atomically
    if (action === 'start' && !session.started_at) {
      const { error: updErr } = await supabase
        .from('assessment_sessions')
        .update({ started_at: new Date().toISOString(), status: 'in_progress' })
        .eq('id', session.id);

      if (updErr) console.warn('Failed to mark session started:', updErr);
      session.started_at = new Date().toISOString();
      session.status = 'in_progress';
    }

    const { data: assessment, error: assessmentError } = await supabase
      .from('assessments')
      .select('id, title, description, duration, questions')
      .eq('id', session.assessment_id)
      .maybeSingle();
    if (assessmentError || !assessment) return new Response(JSON.stringify({ valid: false, error: 'assessment unavailable' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Do not disclose raw capability tokens, candidate IDs, or organization IDs to the browser.
    const safeSession = { id: session.id, assessment_id: session.assessment_id, status: session.status, started_at: session.started_at, token_expires_at: expiresAt };
    return new Response(JSON.stringify({ valid: true, session: safeSession, assessment }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('validate-assessment-token error:', err);
    return new Response(JSON.stringify({ valid: false, error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
