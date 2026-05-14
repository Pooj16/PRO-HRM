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
        console.log('📧 Send interview invite function triggered')

        const gmailUser = Deno.env.get('GMAIL_USER');
        const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD');
        let useSMTP = false;
        if (gmailUser && gmailAppPassword) {
            useSMTP = true;
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { candidate_id, interview_id } = await req.json()
        console.log('Sending interview invite for candidate:', candidate_id, 'interview_schedule:', interview_id)

        // Get candidate details
        const { data: candidate, error: candidateError } = await supabaseClient
            .from('candidates')
            .select('*')
            .eq('id', candidate_id)
            .single()

        if (candidateError || !candidate) {
            throw new Error(`Candidate not found: ${candidateError?.message}`)
        }

        // Get interview details
        const { data: interview, error: interviewError } = await supabaseClient
            .from('interview_schedule')
            .select('*')
            .eq('id', interview_id)
            .single()

        if (interviewError || !interview) {
            throw new Error('Interview details not found')
        }

        const scheduledTime = new Date(interview.scheduled_time);
        const dateStr = scheduledTime.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const timeStr = scheduledTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        });

        let emailResponse: any = { id: 'mock_email_transmission' };

        if (useSMTP) {
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
                subject: `Interview Invitation: ${interview.interview_type || 'Technical Round'} at HireSpark`,
                html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb; }
              .details-item { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f3f4f6; }
              .details-item:last-child { border-bottom: none; }
              .cta-button { display: inline-block; background: #4f46e5; color: white !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
              .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Interview Invitation</h1>
                <p>Great news! You've been selected for an interview.</p>
              </div>
              <div class="content">
                <p>Hi ${candidate.name},</p>
                <p>We've reviewed your assessment results and are excited to move forward with your application for the <strong>${candidate.applied_role || 'Position'}</strong> role. We have scheduled an interview for you.</p>
                
                <div class="details">
                  <h3>🗓️ Interview Details</h3>
                  <div class="details-item"><span>Type:</span><strong>${interview.interview_type}</strong></div>
                  <div class="details-item"><span>Date:</span><strong>${dateStr}</strong></div>
                  <div class="details-item"><span>Time:</span><strong>${timeStr}</strong></div>
                  <div class="details-item"><span>Duration:</span><strong>${interview.duration_minutes || 45} mins</strong></div>
                </div>
                
                ${interview.meeting_link ? `
                <div style="text-align: center;">
                  <a href="${interview.meeting_link}" class="cta-button">Join Interview (Video Call)</a>
                </div>
                ` : '<p>The meeting link will be shared shortly before the interview.</p>'}
                
                <p>Please make sure to be available 5 minutes before the scheduled time. If you need to reschedule, please let us know at least 24 hours in advance.</p>
                
                <p>Best regards,<br><strong>HireSpark Talent Acquisition</strong></p>
              </div>
              <div class="footer">
                <p>This is an automated message from HireSpark Smart Recruitment System.</p>
              </div>
            </div>
          </body>
          </html>
        `,
            };

            const info = await transporter.sendMail(mailOptions);
            emailResponse = { id: info.messageId };
        } else {
            console.log(`✉️ [MOCK INTERVIEW EMAIL DISPATCHED TO ${candidate.email}]`);
        }

        // Log the event (Non-blocking)
        try {
            await supabaseClient
                .from('audit_logs')
                .insert({
                    entity_type: 'candidate',
                    entity_id: candidate_id,
                    action: 'interview_invite_sent',
                    new_value: { interview_id, scheduled_time: interview.scheduled_time },
                    changed_by_role: 'system',
                    notes: `Interview invite email sent for ${interview.interview_type}`,
                })
        } catch (logErr) {
            console.warn('⚠️ Shared audit log failed but email was dispatched:', logErr);
        }

        return new Response(
            JSON.stringify({ success: true, message: 'Interview invite sent successfully' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('❌ Error in send-interview-invite:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
