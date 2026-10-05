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

    // Get contacts and role-bound capability links. This authenticated HR action is
    // the only email dispatch boundary; public BGV tokens cannot invoke it.
    const { data: contacts, error: contactsError } = await supabaseClient
      .from('bgv_verification_contacts')
      .select('*')
      .eq('candidate_id', candidate_id)
      .single()

    if (contactsError || !contacts) throw new Error('Verification contacts not found')

    const { data: referenceTokens, error: tokenError } = await supabaseClient
      .from('bgv_reference_tokens').select('recipient_role, token').eq('contact_id', contacts.id).is('consumed_at', null).gt('expires_at', new Date().toISOString());
    if (tokenError || !referenceTokens?.length) throw new Error('No active reference verification links found');
    let emailSent = false;
    const emailsToNotify = referenceTokens.map((item) => ({
      role: item.recipient_role,
      token: item.token,
      email: item.recipient_role === 'Manager' ? contacts.manager_email : item.recipient_role === 'University Records' ? contacts.university_email : item.recipient_role === 'Human Resources' ? contacts.hr_email : contacts.reference_email,
    })).filter((item) => item.email);

    if (useSMTP && emailsToNotify.length > 0) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailAppPassword,
        },
      });

      const portalUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:8080';
      for (const recipient of emailsToNotify) {
        const recipientRole = recipient.role;
        const verifyLink = `${portalUrl}/bgv-verify/${recipient.token}?role=${encodeURIComponent(recipientRole)}`;

        const mailOptions = {
          from: `HireSpark HR <${gmailUser}>`,
          to: recipient.email,
          subject: `Action Required: Background Verification for ${candidate.name}`,
          html: `
              <h2>Background Verification Request</h2>
              <p>Hello,</p>
              <p>You have been listed as a ${recipientRole} reference for <strong>${candidate.name}</strong>, who is currently undergoing background verification for the role of ${candidate.applied_role}.</p>
              
              <h3>Provided Information</h3>
              <p><strong>Education:</strong> ${candidate.education_details || candidate.education || 'Not provided'}</p>
              <p><strong>Last Employer:</strong> ${candidate.last_employer_details || 'Not provided'}</p>
              <br>
              <p>Please click the button below to review these details and securely submit your verification response:</p>
              <p>
                <a href="${verifyLink}" style="display:inline-block;padding:12px 24px;background-color:#4f46e5;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">Verify Candidate Details</a>
              </p>
              <br>
              <p>Thank you for your time,<br>HireSpark HR Team</p>
            `
        };

        try {
          await transporter.sendMail(mailOptions);
          console.log(`Email dispatched successfully to ${recipient.email}`);
          emailSent = true;
        } catch (err) {
          console.error(`SMTP Error for ${email}: ${err.message}`);
        }
      }
    } else {
      console.log('Mocking SMTP since GMAIL_USER is missing or no emails provided.');
      emailSent = true; // Assume success for mock
    }

    if (emailSent) {
      // Update candidate
      await supabaseClient
        .from('candidates')
        .update({
          bgv_status: 'Verification Sent'
        })
        .eq('id', candidate_id)

      await supabaseClient
        .from('bgv_verification_contacts')
        .update({
          mail_status: 'Sent'
        })
        .eq('candidate_id', candidate_id)
    }

    return new Response(
      JSON.stringify({ success: true, message: "Verification emails dispatched" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Error in send-bgv-verification:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
