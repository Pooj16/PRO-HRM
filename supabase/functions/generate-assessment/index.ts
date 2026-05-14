
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { checkRateLimit, createRateLimitResponse, getRateLimitConfig } from '../shared/rateLimitUtils.ts';

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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { title, description, difficulty, duration, requiredSkills } = await req.json();

    // Rate limiting check (strict limit for AI generation)
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
    const config = getRateLimitConfig('generate-assessment');
    const rateLimitResult = await checkRateLimit(supabaseClient, 'service-account', 'generate-assessment', clientIp, config.maxRequests, config.windowSeconds);
    if (!rateLimitResult.allowed) return createRateLimitResponse(rateLimitResult, 'Too many assessment generation requests. Please try again later.');

    // Invoke the central ai-assistant function so the same prompt templates and
    // parsing logic are used. ai-assistant supports an action 'generate_assessment'
    // which returns a structured JSON object. We pass role/requirements fields
    // through jobRequirements so the assistant can ground the assessment.
    const invokePayload = {
      action: 'generate_assessment',
      title: title || 'Technical & Aptitude Evaluation',
      description: (description || '') + ' Include exactly 30 questions: 15 General Programming and 15 Hard-level Aptitude questions. All questions must be MCQ.',
      difficulty: difficulty || 'hard',
      duration: duration || 20,
      jobRequirements: Array.isArray(requiredSkills) ? requiredSkills.join(', ') : (requiredSkills || '')
    };

    const fnResponse = await supabaseClient.functions.invoke('ai-assistant', {
      body: invokePayload
    });

    if (fnResponse.error) {
      throw new Error(fnResponse.error.message || 'AI assistant error');
    }

    // The ai-assistant returns parsed JSON under data.result in the edge function
    // response. Support both legacy Gemini-like objects (questions array) and the
    // assistant's newer 'tasks' schema.
    const assistantResult = (fnResponse.data && (fnResponse.data.result || fnResponse.data)) || {};

    // Normalize into an array of question-like objects
    let questionsArray: any[] = [];

    if (Array.isArray(assistantResult.questions) && assistantResult.questions.length > 0) {
      // Legacy / Gemini shape
      questionsArray = assistantResult.questions.map((q: any) => ({
        questionText: q.questionText || q.question || q.prompt || '',
        questionType: q.questionType || 'multiple_choice',
        options: q.options || null,
        correctAnswer: q.correctAnswer || q.correct || null,
        points: q.points || 5,
        explanation: q.explanation || ''
      }));
    } else if (Array.isArray(assistantResult.tasks) && assistantResult.tasks.length > 0) {
      // New assistant 'tasks' schema
      questionsArray = assistantResult.tasks.map((t: any, idx: number) => ({
        questionText: t.prompt || t.question || t.text || (`Task ${idx + 1}`),
        questionType: t.options ? 'multiple_choice' : 'open_ended',
        options: t.options || null,
        correctAnswer: t.correctAnswer || null,
        points: t.points || t.score || 5,
        explanation: t.explanation || ''
      }));
    } else if (assistantResult.assessment && Array.isArray(assistantResult.assessment.questions)) {
      // Another possible nesting
      questionsArray = assistantResult.assessment.questions.map((q: any) => ({
        questionText: q.questionText || q.prompt || '',
        questionType: q.questionType || 'open_ended',
        options: q.options || null,
        correctAnswer: q.correctAnswer || null,
        points: q.points || 5,
        explanation: q.explanation || ''
      }));
    } else {
      // Fallback: if assistant returned a single text blob, create one open-ended item
      const asText = typeof assistantResult === 'string' ? assistantResult : JSON.stringify(assistantResult || {});
      questionsArray = [{ questionText: asText.slice(0, 2000), questionType: 'open_ended', points: 5 }];
    }

    // Persist assessment record
    const { data: assessment, error: assessmentError } = await supabaseClient
      .from('assessments')
      .insert({
        title,
        description,
        difficulty,
        duration,
        required_skills: requiredSkills,
        questions: questionsArray.length,
        status: 'active'
      })
      .select()
      .single();

    if (assessmentError) throw assessmentError;

    // Insert questions
    const questionsToInsert = questionsArray.map(q => ({
      assessment_id: assessment.id,
      question_text: q.questionText,
      question_type: q.questionType,
      options: q.options,
      correct_answer: q.correctAnswer,
      points: q.points || 5,
      explanation: q.explanation || null
    }));

    const { error: questionsError } = await supabaseClient
      .from('assessment_questions')
      .insert(questionsToInsert);

    if (questionsError) throw questionsError;

    return new Response(JSON.stringify({
      success: true,
      assessment: assessment,
      questionsGenerated: questionsArray.length,
      assistantRaw: assistantResult
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error generating assessment:', error);
    return new Response(JSON.stringify({
      error: String(error),
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
