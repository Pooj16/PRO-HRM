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
    const authorization = req.headers.get('Authorization');
    if (!authorization) throw new Error('Authentication is required');
    const userClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

    const { candidate_id } = await req.json()

    // Get candidate
    const { data: candidate, error: candidateError } = await supabaseClient
      .from('candidates')
      .select('*')
      .eq('id', candidate_id)
      .single()

    if (candidateError || !candidate) throw new Error('Candidate not found')

    const { data: membership } = await supabaseClient.from('organization_memberships')
      .select('role').eq('organization_id', candidate.organization_id).eq('user_id', user.id).in('role', ['admin', 'hr']).maybeSingle();
    if (!membership) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Generate token
    const rawToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Update candidate
    const { error: updateError } = await supabaseClient
      .from('candidates')
      .update({
        upload_token: rawToken,
        token_expiry: expiresAt.toISOString(),
        bgv_status: 'Link Sent'
      })
      .eq('id', candidate_id)

    if (updateError) throw updateError;

    const portalUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:8080';
    const uploadLink = `${portalUrl}/bgv-upload/${rawToken}`;

    if (useSMTP) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailAppPassword,
        },
      });

      const mailOptions = {
        from: `HireSpark HR <${gmailUser}>`,
        to: candidate.email,
        subject: 'Action Required: Background Verification Document Upload',
        html: `
            <h2>Background Verification Request</h2>
            <p>Dear ${candidate.name},</p>
            <p>Please upload your background verification documents securely using the link below:</p>
            <a href="${uploadLink}" style="padding: 10px 20px; background: #4f46e5; color: white; text-decoration: none; border-radius: 5px; display: inline-block;">Upload Documents</a>
            <p>This link will expire in 7 days.</p>
            <p>Thank you,<br>HR Team</p>
          `
      };

      await transporter.sendMail(mailOptions);
    } else {
      console.log('Mocking SMTP since GMAIL_USER is missing. Link:', uploadLink);
    }

    return new Response(
      JSON.stringify({ success: true, uploadLink }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Error in send-bgv-link:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
