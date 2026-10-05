import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Pipeline status constants
const PIPELINE_STATUS = {
  APPLIED: 'applied',
  AI_SCREENED: 'ai_screened',
  ASSESSMENT: 'assessment',
  INTERVIEW: 'interview',
  OFFER: 'offer',
  HIRED: 'hired',
  REJECTED: 'rejected',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 Route candidate function triggered');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { candidate_id, role_applied_for } = await req.json()
    
    console.log('Routing candidate:', candidate_id, 'for role:', role_applied_for);

    if (!candidate_id) {
      throw new Error('candidate_id is required');
    }

    // Get candidate details
    const { data: candidate, error: candidateError } = await supabaseClient
      .from('candidates')
      .select('*')
      .eq('id', candidate_id)
      .single()

    if (candidateError || !candidate) {
      console.error('Candidate not found:', candidateError);
      throw new Error('Candidate not found')
    }

    const appliedRole = role_applied_for || candidate.applied_role;
    const atsScore = candidate.ats_score || 0;
    
    console.log(`Candidate ${candidate.name} has ATS score: ${atsScore}, applied for: ${appliedRole}`);

    // Get role threshold for the applied role
    const { data: roleThreshold, error: thresholdError } = await supabaseClient
      .from('role_thresholds')
      .select(`
        *,
        team_leads:team_lead_id (
          id,
          name,
          email,
          department
        )
      `)
      .eq('role_name', appliedRole)
      .eq('is_active', true)
      .maybeSingle()

    if (thresholdError) {
      console.error('Error fetching threshold:', thresholdError);
    }

    // Determine if candidate meets threshold for auto-assessment
    const minAtsScore = roleThreshold?.min_ats_score || 0;
    const maxAtsScore = roleThreshold?.max_ats_score || 100;
    const meetsThreshold = atsScore >= minAtsScore && atsScore <= maxAtsScore;
    
    console.log(`Threshold check: score ${atsScore}, range ${minAtsScore}-${maxAtsScore}, meets: ${meetsThreshold}`);

    // Generate recommendation based on score
    let recommendation: 'auto_assessment' | 'suggest_review' | 'below_threshold';
    let recommendationMessage: string;
    let newStatus: string;
    let pipelineStatus: string;

    if (meetsThreshold && roleThreshold?.auto_shortlist) {
      // Auto-progress to assessment round
      recommendation = 'auto_assessment';
      recommendationMessage = `Score ${atsScore} meets threshold (${minAtsScore}-${maxAtsScore}) - automatically moving to assessment round`;
      newStatus = 'assessment_pending';
      pipelineStatus = PIPELINE_STATUS.ASSESSMENT;
    } else if (meetsThreshold) {
      // Meets threshold but requires manual review
      recommendation = 'suggest_review';
      recommendationMessage = `Score ${atsScore} meets threshold - recommend for assessment (auto-shortlist disabled)`;
      newStatus = 'analyzed';
      pipelineStatus = PIPELINE_STATUS.AI_SCREENED;
    } else {
      // Below threshold
      recommendation = 'below_threshold';
      recommendationMessage = `Score ${atsScore} below threshold (${minAtsScore}) - manual review required`;
      newStatus = 'analyzed';
      pipelineStatus = PIPELINE_STATUS.AI_SCREENED;
    }

    // Prepare ATS notes
    const atsNotes = [
      `[AI Analysis - ${new Date().toISOString()}]`,
      `Score: ${atsScore}`,
      `Recommendation: ${recommendation}`,
      `Message: ${recommendationMessage}`,
      `Applied Role: ${appliedRole}`,
      roleThreshold ? `Role Threshold: ${minAtsScore}-${maxAtsScore}` : 'No role threshold configured',
      roleThreshold ? `Auto-shortlist: ${roleThreshold.auto_shortlist ? 'Enabled' : 'Disabled'}` : '',
      roleThreshold ? `Min Assessment Score Required: ${roleThreshold.min_assessment_score || 0}` : '',
    ].filter(Boolean).join('\n');

    // Update candidate status
    const updateData: Record<string, unknown> = {
      status: newStatus,
      pipeline_status: pipelineStatus,
      match_percentage: atsScore,
      ats_notes: candidate.ats_notes 
        ? `${candidate.ats_notes}\n\n${atsNotes}` 
        : atsNotes,
      last_status_change_at: new Date().toISOString(),
      last_status_changed_by_role: 'ai',
    };

    // Assign to team lead if configured
    if (roleThreshold?.team_leads) {
      updateData.assigned_team_lead_id = roleThreshold.team_leads.id;
    }

    await supabaseClient
      .from('candidates')
      .update(updateData)
      .eq('id', candidate.id)

    console.log(`✅ Candidate ${candidate.name} - Status: ${newStatus}, Pipeline: ${pipelineStatus}`);

    // Create audit log entry
    await supabaseClient
      .from('audit_logs')
      .insert({
        organization_id: candidate.organization_id,
        entity_type: 'candidate',
        entity_id: candidate.id,
        action: 'ai_screening',
        new_value: {
          status: newStatus,
          pipeline_status: pipelineStatus,
          ats_score: atsScore,
          recommendation,
          meetsThreshold,
        },
        changed_by_role: 'ai',
        notes: recommendationMessage,
      })

    // If auto-assessment is enabled and candidate meets threshold, trigger assessment email
    let assessmentTriggered = false;
    let assessmentId = null;
    let assessmentToken = null;

    if (recommendation === 'auto_assessment') {
      console.log('🎯 Auto-assessment triggered for candidate');
      
      // Find or create assessment for this role
      const { data: existingAssessment } = await supabaseClient
        .from('assessments')
        .select('id')
        .eq('status', 'active')
        .limit(1)
        .single()

      if (existingAssessment) {
        assessmentId = existingAssessment.id;
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        
        try {
          // Step 1: Create assessment session with secure token
          console.log('🔐 Creating assessment session with secure token');
          const sessionResponse = await fetch(`${supabaseUrl}/functions/v1/create-assessment-session`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              candidate_id: candidate.id,
              assessment_id: assessmentId,
            }),
          });

          if (!sessionResponse.ok) {
            throw new Error(`Failed to create assessment session: ${sessionResponse.statusText}`);
          }

          const sessionData = await sessionResponse.json();
          if (!sessionData.success || !sessionData.token) {
            throw new Error('Failed to create assessment session token');
          }

          assessmentToken = sessionData.token;
          console.log('✅ Assessment session created with token');

          // Step 2: Trigger assessment email (now with token embedded)
          const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-assessment-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              candidate_id: candidate.id,
              assessment_id: assessmentId,
            }),
          });

          const emailResult = await emailResponse.json();
          
          if (emailResult.success) {
            assessmentTriggered = true;
            console.log('✅ Assessment email triggered successfully with secure link');
          } else {
            console.warn('Assessment email failed:', emailResult.error);
          }
        } catch (emailError) {
          console.error('Error triggering assessment email:', emailError);
        }
      } else {
        console.warn('No active assessment found - cannot auto-send assessment');
      }
    }

    // Create team lead assignment if configured
    if (roleThreshold?.team_leads) {
      const { error: assignmentError } = await supabaseClient
        .from('candidate_assignments')
        .upsert({
          organization_id: candidate.organization_id,
          candidate_id: candidate.id,
          team_lead_id: roleThreshold.team_leads.id,
          status: recommendation === 'auto_assessment' ? 'assessment_in_progress' : 'pending_review',
          notes: recommendationMessage
        }, {
          onConflict: 'candidate_id,team_lead_id'
        })

      if (assignmentError) {
        console.warn('Error creating assignment:', assignmentError);
      } else {
        console.log(`✅ Assigned to team lead: ${roleThreshold.team_leads.name}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        action: recommendation,
        ats_score: atsScore,
        message: recommendationMessage,
        meetsThreshold,
        assessmentTriggered,
        assessmentId,
        assessmentToken: assessmentToken || null,
        team_lead: roleThreshold?.team_leads?.name || null,
        threshold: roleThreshold ? { 
          min: minAtsScore, 
          max: maxAtsScore,
          minAssessment: roleThreshold.min_assessment_score,
          autoShortlist: roleThreshold.auto_shortlist
        } : null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error routing candidate:', error)
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
