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
    const { session_id } = await req.json().catch(() => ({}));
    if (!session_id) return new Response(JSON.stringify({ error: 'session_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch responses and related question metadata
    const { data: responses, error: responsesError } = await supabase
      .from('candidate_responses')
      .select('*, assessment_questions(question_text, question_type, options, correct_answer, points)')
      .eq('session_id', session_id);

    if (responsesError) {
      console.error('Error fetching responses:', responsesError);
      return new Response(JSON.stringify({ error: 'Failed to fetch candidate responses', detail: responsesError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!responses || responses.length === 0) {
      return new Response(JSON.stringify({ error: 'No responses found for this session' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Scoring algorithm
    let totalScore = 0;
    let totalPossible = 0;
    const scoreBreakdown: any = [];

    for (const response of responses) {
      const question = response.assessment_questions;
      if (!question) continue;

      const points = question.points || 5;
      totalPossible += points;

      let isCorrect = false;
      let earnedPoints = 0;

      if (question.question_type === 'mcq' || question.question_type === 'multiple_choice') {
        const candidateChoice = (response.answer_text || '').toString().trim().toLowerCase();
        const correctAnswer = (question.correct_answer || '').toString().trim().toLowerCase();

        isCorrect = candidateChoice !== '' && candidateChoice === correctAnswer;
        earnedPoints = isCorrect ? points : 0;
      } else {
        // Short answers require manual review or AI scoring; default to 0
        isCorrect = false;
        earnedPoints = 0;
      }

      totalScore += earnedPoints;
      scoreBreakdown.push({
        question_id: response.question_id,
        type: question.question_type,
        earned: earnedPoints,
        possible: points,
        is_correct: isCorrect,
        candidate_choice: response.answer_text,
        correct_answer: question.correct_answer
      });

      // Update individual response score
      await supabase.from('candidate_responses')
        .update({ is_correct: isCorrect, points_awarded: earnedPoints })
        .eq('id', response.id);
    }

    const percentageScore = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;

    // 1. Save to evaluation_results
    const { data: evaluation, error: evalError } = await supabase
      .from('evaluation_results')
      .upsert({
        session_id,
        overall_score: percentageScore,
        total_possible: totalPossible,
        breakdown: scoreBreakdown,
        ai_explanation: {
          summary: `Assessment evaluated. Score: ${percentageScore}%.`,
          details: 'MCQ questions graded automatically. Short answers require review.',
          confidence: 1.0
        }
      }, { onConflict: 'session_id' })
      .select()
      .single();

    if (evalError) throw evalError;

    // 2. Cross-table status synchronization
    const { data: session } = await supabase
      .from('assessment_sessions')
      .select('candidate_id, assessment_id')
      .eq('id', session_id)
      .single();

    if (session) {
      const isPassed = percentageScore >= 70;

      // Update assessment_assignments
      await supabase.from('assessment_assignments')
        .update({
          score: percentageScore,
          status: 'evaluated',
          completed_at: new Date().toISOString()
        })
        .match({ candidate_id: session.candidate_id, assessment_id: session.assessment_id });

      // Update assessment_sessions
      await supabase.from('assessment_sessions')
        .update({ status: 'evaluated', score: percentageScore })
        .eq('id', session_id);

      // Update candidates
      await supabase.from('candidates')
        .update({
          assessment_status: 'evaluated',
          status: isPassed ? 'interview_scheduled' : 'rejected',
          pipeline_status: isPassed ? 'interview' : 'rejected'
        })
        .eq('id', session.candidate_id);
    }

    return new Response(JSON.stringify({ success: true, evaluation, score: percentageScore }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('Evaluation Error:', err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
