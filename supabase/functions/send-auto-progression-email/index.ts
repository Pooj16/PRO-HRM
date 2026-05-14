import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from "npm:nodemailer";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const gmailUser = Deno.env.get('GMAIL_USER')
    const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD')

    if (!gmailUser || !gmailAppPassword) {
      console.error('GMAIL_USER or GMAIL_APP_PASSWORD not set')
      throw new Error('Email configuration missing')
    }

    const { candidate_id, status } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get candidate details
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .select('*')
      .eq('id', candidate_id)
      .single()

    if (candidateError || !candidate) {
      throw new Error('Candidate not found')
    }

    console.log(`Sending auto-progression email to ${candidate.email} for status: ${status}`)

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    });

    let subject = ''
    let html = ''

    if (status === 'shortlisted') {
      subject = 'Application Update - Shortlisted'
      html = `
        <h1>Congratulations ${candidate.name}!</h1>
        <p>You have been shortlisted for the ${candidate.applied_role || 'position'}.</p>
        <p>We will be in touch shortly regarding the next steps in the interview process.</p>
      `
    } else if (status === 'rejected') {
      subject = 'Application Update'
      html = `
        <p>Dear ${candidate.name},</p>
        <p>Thank you for your interest in the ${candidate.applied_role || 'position'}.</p>
        <p>After careful consideration, we have decided to move forward with other candidates at this time.</p>
        <p>We wish you the best in your job search.</p>
      `
    }

    if (subject && html) {
      const mailOptions = {
        from: `HireSpark Recruitment <${gmailUser}>`,
        to: candidate.email,
        subject: subject,
        html: html,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Auto-progression email sent: ${info.messageId}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in send-auto-progression-email:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
