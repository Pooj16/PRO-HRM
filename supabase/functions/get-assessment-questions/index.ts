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

    const now = new Date();
    const expiresAt = session.token_expires_at || session.expires_at;
    if ((expiresAt && new Date(expiresAt) <= now) || (session.status !== 'in_progress' && session.status !== 'pending')) {
      return new Response(JSON.stringify({ error: 'session invalid or expired' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch assessment questions (without correct_answer for security)
    const { data: questions, error: questionsError } = await supabase
      .from('assessment_questions')
      .select('id, question_text, question_type, options, points')
      .eq('assessment_id', session.assessment_id)
      .order('id', { ascending: true });

    if (questionsError) {
      return new Response(JSON.stringify({ error: String(questionsError) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Helper to normalize options
    const normalizeOptions = (opts: any) => {
      if (!opts) return undefined;
      const parsed = typeof opts === 'string' ? JSON.parse(opts) : opts;

      if (Array.isArray(parsed)) {
        if (typeof parsed[0] === 'string') {
          return parsed.map(p => ({ value: p, label: p }));
        }
        return parsed;
      }

      // Object format: { "A": "Label" } -> [ { "value": "A", "label": "Label" } ]
      return Object.entries(parsed).map(([key, val]) => ({
        value: key,
        label: val
      }));
    };

    // Fetch any existing responses for this session
    const { data: responses } = await supabase
      .from('candidate_responses')
      .select('question_id, answer_text')
      .eq('session_id', session.id);

    const responseMap = (responses || []).reduce((acc: any, r: any) => {
      acc[r.question_id] = { response_text: r.answer_text, selected_option: { value: r.answer_text, label: r.answer_text } };
      return acc;
    }, {});

    const assessmentDuration = session.duration || 30;

    return new Response(JSON.stringify({
      session_id: session.id,
      assessment_id: session.assessment_id,
      duration_minutes: assessmentDuration,
      questions: questions?.map((q: any) => ({
        ...q,
        options: normalizeOptions(q.options),
        saved_response: responseMap[q.id] || null
      })) || [],
      total_questions: questions?.length || 0
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('get-assessment-questions error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
