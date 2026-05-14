
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
    const requestBody = await req.text();
    console.log('Raw request body:', requestBody);
    
    let parsedBody;
    try {
      parsedBody = requestBody ? JSON.parse(requestBody) : {};
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      parsedBody = { role: 'General Position', requirements: 'General aptitude assessment' };
    }

    const { role = 'General Position', requirements = 'General aptitude assessment' } = parsedBody;
    
    console.log('Creating AI-generated aptitude assessment for role:', role);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const invokePayload = {
      action: 'generate_assessment',
      role,
      jobRequirements: requirements,
      config: {
        type: 'Aptitude',
        questions: 15,
        categories: ['Logical Reasoning','Numerical Ability','Verbal Reasoning','Abstract/Pattern Recognition','Problem Solving']
      }
    };

    const fnResponse = await supabase.functions.invoke('ai-assistant', { body: invokePayload });
    if (fnResponse.error) {
      throw new Error(fnResponse.error.message || 'AI assistant error');
    }

    const assistantResult = (fnResponse.data && (fnResponse.data.result || fnResponse.data)) || {};

    // Normalize assistant result into assessmentData shape
    let assessmentData: any = {};
    if (assistantResult.assessmentTitle || assistantResult.assessment) {
      assessmentData = assistantResult.assessment || {
        assessmentTitle: assistantResult.assessmentTitle,
        description: assistantResult.description,
        questions: assistantResult.questions || assistantResult.tasks || []
      };
    } else if (Array.isArray(assistantResult.questions)) {
      assessmentData = { assessmentTitle: `Aptitude Assessment - ${role}`, description: assistantResult.description || '', questions: assistantResult.questions };
    } else if (Array.isArray(assistantResult.tasks)) {
      assessmentData = { assessmentTitle: `Aptitude Assessment - ${role}`, description: assistantResult.description || '', questions: assistantResult.tasks.map((t: any) => ({ questionText: t.prompt || t.question || t.text, options: t.options, correctAnswer: t.correctAnswer, points: t.points })) };
    } else if (typeof assistantResult === 'string') {
      // Try to parse JSON blob returned as text
      try {
        const jsonMatch = assistantResult.match(/\{[\s\S]*\}/);
        assessmentData = JSON.parse(jsonMatch ? jsonMatch[0] : assistantResult);
      } catch (e) {
        throw new Error('Failed to parse assistant response for assessment generation');
      }
    } else {
      throw new Error('Assistant returned an unexpected assessment format');
    }

    if (!assessmentData.questions || assessmentData.questions.length === 0) {
      throw new Error('No questions generated in assessment');
    }

    // Create assessment in database
    const { data: assessment, error: assessmentError } = await supabase
      .from('assessments')
      .insert({
        title: assessmentData.assessmentTitle || `Aptitude Assessment - ${role}`,
        description: assessmentData.description || '',
        type: 'Aptitude',
        duration: 45,
        questions: assessmentData.questions.length,
        status: 'active',
        difficulty: 'intermediate'
      })
      .select()
      .single();

    if (assessmentError) throw assessmentError;

    // Create assessment questions
    const questionsToInsert = assessmentData.questions.map((q: any) => ({
      assessment_id: assessment.id,
      question_text: q.questionText || q.question || q.prompt || '',
      question_type: 'multiple_choice',
      options: q.options || null,
      correct_answer: q.correctAnswer || q.correct || null,
      points: q.points || 5
    }));

    const { error: questionsError } = await supabase
      .from('assessment_questions')
      .insert(questionsToInsert);

    if (questionsError) throw questionsError;

    return new Response(JSON.stringify({
      success: true,
      assessmentId: assessment.id,
      title: assessment.title,
      questionsCount: assessmentData.questions.length,
      type: 'Aptitude',
      assistantRaw: assistantResult
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in create-general-assessment function:', error);
    return new Response(JSON.stringify({ 
      error: String(error),
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
