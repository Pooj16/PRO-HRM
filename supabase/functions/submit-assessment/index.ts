import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, createRateLimitResponse, getRateLimitConfig } from '../shared/rateLimitUtils.ts'
import { checkIpChange, logAntiCheatEvent } from '../shared/ipValidationUtils.ts'
import { validateAndConsumeNonce } from '../shared/antiReplayUtils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('📝 Submit assessment function triggered')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { assignment_id, answers, nonce } = await req.json()
    console.log('Processing assessment submission:', assignment_id)

    if (!assignment_id || !answers) {
      throw new Error('assignment_id and answers are required')
    }

    // Get assignment details
    const { data: assignment, error: assignmentError } = await supabaseClient
      .from('assessment_assignments')
      .select(`
        *,
        candidates!assessment_assignments_candidate_id_fkey (
          id,
          name,
          email,
          applied_role
        ),
        assessments!assessment_assignments_assessment_id_fkey (
          id,
          title
        )
      `)
      .eq('id', assignment_id)
      .single()

    if (assignmentError || !assignment) {
      console.error('Assignment not found:', assignmentError)
      throw new Error('Assessment assignment not found')
    }

    // Rate limiting check (strict limit for submissions)
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
    const userId = assignment.candidate_id || 'anonymous';
    const config = getRateLimitConfig('submit-assessment');
    const rateLimitResult = await checkRateLimit(supabaseClient, userId, 'submit-assessment', clientIp, config.maxRequests, config.windowSeconds);
    if (!rateLimitResult.allowed) return createRateLimitResponse(rateLimitResult, 'Too many assessment submission attempts. Please try again later.');

    // IP validation check - detect suspicious IP changes during submission
    const ipChangeEvent = await checkIpChange(supabaseClient, assignment.id, clientIp);
    if (ipChangeEvent) {
      await logAntiCheatEvent(supabaseClient, assignment.id, 'ip_change', { 
        previousIp: ipChangeEvent.previousIp,
        currentIp: ipChangeEvent.currentIp,
        changeCount: ipChangeEvent.changeCount
      }, 'critical');
    }

    // Nonce validation check - prevent replay attacks
    if (nonce) {
      const nonceValid = await validateAndConsumeNonce(supabaseClient, assignment.id, nonce);
      if (!nonceValid) {
        throw new Error('Invalid or expired submission nonce. Possible replay attack detected.');
      }
    }

    if (assignment.status === 'completed') {
      throw new Error('This assessment has already been completed')
    }

    // Get assessment questions
    const { data: questions, error: questionsError } = await supabaseClient
      .from('assessment_questions')
      .select('*')
      .eq('assessment_id', assignment.assessment_id)

    if (questionsError) {
      console.error('Error fetching questions:', questionsError)
      throw new Error('Failed to fetch assessment questions')
    }

    // Calculate score
    let correctAnswers = 0
    let totalPoints = 0
    const answersDetail: Record<string, { 
      question: string, 
      userAnswer: string, 
      correctAnswer: string, 
      isCorrect: boolean,
      points: number 
    }> = {}

    for (const question of questions) {
      const points = question.points || 1
      totalPoints += points
      
      const userAnswer = answers[question.id]
      const isCorrect = userAnswer === question.correct_answer
      
      if (isCorrect) {
        correctAnswers += points
      }

      answersDetail[question.id] = {
        question: question.question_text,
        userAnswer: userAnswer || 'Not answered',
        correctAnswer: question.correct_answer,
        isCorrect,
        points: isCorrect ? points : 0
      }
    }

    const scorePercentage = totalPoints > 0 ? Math.round((correctAnswers / totalPoints) * 100) : 0

    console.log(`📊 Assessment Score: ${scorePercentage}% (${correctAnswers}/${totalPoints} points)`)

    // Update assignment with score
    await supabaseClient
      .from('assessment_assignments')
      .update({
        status: 'completed',
        score: scorePercentage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', assignment_id)

    // Get role threshold to check for auto-shortlist to interview
    const candidateId = assignment.candidates?.id
    const appliedRole = assignment.candidates?.applied_role

    if (candidateId && appliedRole) {
      const { data: roleThreshold } = await supabaseClient
        .from('role_thresholds')
        .select('*')
        .eq('role_name', appliedRole)
        .eq('is_active', true)
        .maybeSingle()

      const minAssessmentScore = roleThreshold?.min_assessment_score || 70
      const meetsAssessmentThreshold = scorePercentage >= minAssessmentScore

      console.log(`Threshold check: score ${scorePercentage}%, required ${minAssessmentScore}%, meets: ${meetsAssessmentThreshold}`)

      // Determine next status based on score
      let newStatus: string
      let pipelineStatus: string
      let statusMessage: string

      if (meetsAssessmentThreshold && roleThreshold?.auto_shortlist) {
        // Auto-shortlist for interview
        newStatus = 'interview_scheduled'
        pipelineStatus = 'interview'
        statusMessage = `Assessment score ${scorePercentage}% meets threshold (${minAssessmentScore}%) - auto-shortlisted for interview`
      } else if (meetsAssessmentThreshold) {
        // Meets threshold but needs manual review
        newStatus = 'assessment_completed'
        pipelineStatus = 'assessment'
        statusMessage = `Assessment score ${scorePercentage}% meets threshold - pending HR review for interview`
      } else {
        // Below threshold
        newStatus = 'assessment_failed'
        pipelineStatus = 'assessment'
        statusMessage = `Assessment score ${scorePercentage}% below threshold (${minAssessmentScore}%) - requires review`
      }

      // Update candidate status
      await supabaseClient
        .from('candidates')
        .update({
          status: newStatus,
          pipeline_status: pipelineStatus,
          assessment_status: 'completed',
          last_status_change_at: new Date().toISOString(),
          last_status_changed_by_role: 'system',
          ats_notes: `${assignment.candidates?.name || 'Candidate'}'s current notes\n\n[Assessment Result - ${new Date().toISOString()}]\nScore: ${scorePercentage}%\nStatus: ${statusMessage}`,
        })
        .eq('id', candidateId)

      // Create audit log
      await supabaseClient
        .from('audit_logs')
        .insert({
          entity_type: 'candidate',
          entity_id: candidateId,
          action: 'assessment_completed',
          new_value: {
            score: scorePercentage,
            passed: meetsAssessmentThreshold,
            status: newStatus,
            pipeline_status: pipelineStatus,
          },
          changed_by_role: 'system',
          notes: statusMessage,
        })

      // Update candidate assignment if exists
      if (roleThreshold?.team_lead_id) {
        await supabaseClient
          .from('candidate_assignments')
          .update({
            status: meetsAssessmentThreshold ? 'interview_ready' : 'assessment_failed',
            notes: statusMessage,
          })
          .eq('candidate_id', candidateId)
          .eq('team_lead_id', roleThreshold.team_lead_id)
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          score: scorePercentage,
          totalQuestions: questions.length,
          correctAnswers,
          totalPoints,
          passed: meetsAssessmentThreshold,
          nextStep: newStatus,
          message: statusMessage,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fallback response if no candidate/role info
    return new Response(
      JSON.stringify({ 
        success: true,
        score: scorePercentage,
        totalQuestions: questions.length,
        correctAnswers,
        totalPoints,
        message: 'Assessment submitted successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error submitting assessment:', error)
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
