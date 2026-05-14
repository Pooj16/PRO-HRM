import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
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
        const { test_email } = await req.json()
        const gmailUser = Deno.env.get('GMAIL_USER')
        const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD')

        if (!gmailUser || !gmailAppPassword) {
            throw new Error("GMAIL_USER or GMAIL_APP_PASSWORD secrets are not set in Supabase.")
        }

        console.log(`🧪 Starting nodemailer test for: ${test_email}`)
        console.log(`🔧 Using sender: ${gmailUser}`)

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: gmailUser,
                pass: gmailAppPassword,
            },
        });

        const mailOptions = {
            from: gmailUser,
            to: test_email,
            subject: "🧪 HireSpark NodeMailer Test",
            text: "This is a test email from HireSpark using NodeMailer in Supabase Edge Functions.",
            html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #4CAF50;">✅ SMTP Test Successful (NodeMailer)</h2>
          <p>Your Supabase Edge Function successfully connected to Gmail using NodeMailer.</p>
          <hr/>
          <p style="font-size: 12px; color: #666;">Timestamp: ${new Date().toISOString()}</p>
        </div>
      `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Test email sent successfully:', info.messageId);

        return new Response(
            JSON.stringify({ success: true, message: `Test email sent to ${test_email}`, messageId: info.messageId }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('❌ SMTP Test Failed:', error)
        return new Response(
            JSON.stringify({ success: false, error: (error as Error).message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
