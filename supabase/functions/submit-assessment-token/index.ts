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
    const { token } = await req.json().catch(() => ({}));
    if (!token) return new Response(JSON.stringify({ error: 'token required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find session by raw token
    const { data: session, error: sessionError } = await supabase
      .from('assessment_sessions')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'invalid token' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const now = new Date().toISOString();
    const expiresAt = session.token_expires_at || session.expires_at;
    if (expiresAt && new Date(expiresAt) <= new Date()) {
      return new Response(JSON.stringify({ error: 'session expired' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (session.status === 'submitted' || session.status === 'revoked' || session.status === 'completed' || session.status === 'evaluated') {
      return new Response(JSON.stringify({ error: 'session already submitted or revoked' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Atomically update session to submitted
    const { data: updated, error: updateError } = await supabase
      .from('assessment_sessions')
      .update({ status: 'submitted', submitted_at: now })
      .eq('id', session.id)
      .select()
      .single();

    if (updateError || !updated) {
      return new Response(JSON.stringify({ error: 'failed to submit session or already submitted' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Trigger evaluation async
    try {
      await supabase.functions.invoke('evaluate-assessment', {
        body: { session_id: session.id }
      });
    } catch (evalErr: any) {
      console.warn('Error triggering evaluation:', evalErr);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Assessment submitted successfully',
      session_id: session.id
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('submit-assessment-token error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
