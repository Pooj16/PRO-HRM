import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from "npm:nodemailer";

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('📧 Send assessment email function triggered')

    const gmailUser = Deno.env.get('GMAIL_USER');
    const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD');
    let useSMTP = false;
    if (gmailUser && gmailAppPassword) {
      useSMTP = true;
    } else {
      console.log('⚠️ GMAIL_USER or GMAIL_APP_PASSWORD not configured. Email dispatch will be safely mocked.');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { candidate_id, assessment_id } = await req.json()
    console.log('Sending assessment email for candidate:', candidate_id, 'assessment:', assessment_id)

    // Get candidate details
    const { data: candidate, error: candidateError } = await supabaseClient
      .from('candidates')
      .select('*')
      .eq('id', candidate_id)
      .single()

    if (candidateError || !candidate) {
      console.error('Candidate fetch error:', candidateError)
      throw new Error(`Candidate not found: ${candidateError?.message || 'No candidate returned'}`)
    }

    // Get assessment details
    const { data: assessment, error: assessmentError } = await supabaseClient
      .from('assessments')
      .select('*')
      .eq('id', assessment_id)
      .single()

    if (assessmentError || !assessment) {
      throw new Error('Assessment not found')
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(candidate.email)) {
      console.log('❌ Invalid email format:', candidate.email)

      await supabaseClient
        .from('candidates')
        .update({
          status: 'invalid_email',
          ats_notes: (candidate.ats_notes || '') + '\n\n[System] Invalid email format detected - candidate removed from pipeline'
        })
        .eq('id', candidate_id)

      throw new Error('Invalid email format - candidate marked for removal')
    }

    // Create assessment session with secure token
    console.log('🔐 Creating assessment session with secure token');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? serviceKey;

    // Generate raw token and hash it (Directly here to avoid inter-function issues)
    const buf = new Uint8Array(48);
    crypto.getRandomValues(buf);
    const rawToken = btoa(String.fromCharCode(...Array.from(buf)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const expiresInMinutes = 72 * 60; // 72 hours
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();

    console.log(`🔨 Handling session/assignment for candidate: ${candidate_id}, assessment: ${assessment_id}`);

    // 1. Handle assessment_sessions using robust upsert
    console.log(`🔨 Upserting session for candidate: ${candidate_id}, assessment: ${assessment_id}`);
    const { data: session, error: sessionError } = await supabaseClient
      .from('assessment_sessions')
      .upsert({
        candidate_id: candidate_id,
        assessment_id: assessment_id,
        token: rawToken,
        expires_at: expiresAt,
        status: 'pending',
        updated_at: new Date().toISOString()
      }, { onConflict: 'candidate_id,assessment_id' })
      .select()
      .single();

    if (sessionError || !session) {
      console.error('❌ Session upsert failed:', sessionError);
      throw new Error(`Failed to create/update assessment session: ${sessionError?.message}`);
    }

    console.log(`✅ Session handled: ${session.id}`);

    // 2. Handle assessment_assignments
    const { data: existingAssignment } = await supabaseClient
      .from('assessment_assignments')
      .select('id')
      .eq('candidate_id', candidate_id)
      .eq('assessment_id', assessment_id)
      .maybeSingle();

    let assignment;
    if (existingAssignment) {
      console.log(`🔄 Updating existing assignment: ${existingAssignment.id}`);
      const { data, error } = await supabaseClient
        .from('assessment_assignments')
        .update({
          status: 'assigned',
          session_id: session.id,
          // Not updating score or completed_at
        })
        .eq('id', existingAssignment.id)
        .select()
        .single();
      if (error) throw error;
      assignment = data;
    } else {
      console.log(`➕ Inserting new assignment`);
      const { data, error } = await supabaseClient
        .from('assessment_assignments')
        .insert({
          candidate_id: candidate_id,
          assessment_id: assessment_id,
          status: 'assigned',
          session_id: session.id,
        })
        .select()
        .single();
      if (error) throw error;
      assignment = data;
    }

    const assignmentId = assignment.id;

    const assessmentPortalUrl = Deno.env.get('ASSESSMENT_PORTAL_URL') || 'http://localhost:8081';
    const assessmentLink = `${assessmentPortalUrl}/assessment/start?token=${rawToken}`;

    // Send email via NodeMailer
    let emailResponse: any = { id: 'mock_email_transmission' };

    if (useSMTP) {
      console.log(`📤 Attempting to send REAL email to: ${candidate.email} via NodeMailer`);

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailAppPassword,
        },
      });

      const mailOptions = {
        from: `HireSpark Recruitment <${gmailUser}>`,
        to: candidate.email,
        subject: `Action Required: Technical Assessment for ${candidate.applied_role || 'Position'} at HireSpark`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .details-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
              .details-item:last-child { border-bottom: none; }
              .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white !important; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
              .instructions { background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; }
              .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎉 Congratulations!</h1>
                <p>Your application is progressing to the next stage</p>
              </div>
              <div class="content">
                <p>Dear ${candidate.name},</p>
                <p>We are pleased to inform you that you have been shortlisted for the <strong>${candidate.applied_role || 'position'}</strong> role. Your qualifications have impressed us, and we would like you to complete a technical assessment.</p>
                
                <div class="details">
                  <h3>📋 Assessment Details</h3>
                  <div class="details-item"><span>Title:</span><strong>${assessment.title}</strong></div>
                  <div class="details-item"><span>Duration:</span><strong>${assessment.duration || 30} minutes</strong></div>
                  <div class="details-item"><span>Questions:</span><strong>${assessment.questions || 10}</strong></div>
                  <div class="details-item"><span>Difficulty:</span><strong>${assessment.difficulty || 'Intermediate'}</strong></div>
                </div>
                
                <div style="text-align: center;">
                  <a href="${assessmentLink}" class="cta-button">Start Your Assessment</a>
                </div>
                
                <div class="instructions">
                  <h4>📌 Important Instructions:</h4>
                  <ul>
                    <li>Complete the assessment within ${assessment.duration || 30} minutes</li>
                    <li>Ensure you have a stable internet connection</li>
                    <li>Answer all questions to the best of your ability</li>
                    <li>You have only one attempt, so prepare accordingly</li>
                  </ul>
                </div>
                
                <p>If you encounter any technical difficulties, please contact our HR team immediately.</p>
                <p>Best of luck!</p>
                <p><strong>HR Team</strong></p>
              </div>
              <div class="footer">
                <p>This is an automated message. Please do not reply directly to this email.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

      try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ NodeMailer Success: ${info.messageId}`);
        emailResponse = { id: info.messageId };
      } catch (err: any) {
        console.error("❌ NodeMailer error:", err);
        throw new Error(`Gmail SMTP Transmission Error: ${err.message}`);
      }
    } else {
      console.log(`✉️ [MOCK EMAIL DISPATCHED TO ${candidate.email}]`);
    }

    // Update candidate status
    await supabaseClient
      .from('candidates')
      .update({
        assessment_status: 'assessment_sent',
        status: 'assessment_pending',
        pipeline_status: 'assessment',
        last_status_change_at: new Date().toISOString(),
        last_status_changed_by_role: 'system',
      })
      .eq('id', candidate_id)

    // Create audit log
    await supabaseClient
      .from('audit_logs')
      .insert({
        entity_type: 'candidate',
        entity_id: candidate_id,
        action: 'assessment_email_sent',
        new_value: {
          assessment_id,
          assignment_id: assignmentId,
          email: candidate.email,
        },
        changed_by_role: 'system',
        notes: `Assessment email sent to ${candidate.email}`,
      })

    return new Response(
      JSON.stringify({
        success: true,
        assignment_id: assignmentId,
        assessment_link: assessmentLink,
        message: 'Assessment email sent successfully',
        email_id: emailResponse?.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error in send-assessment-email:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
