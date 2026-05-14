
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, candidateId, interviewData, accessToken } = await req.json();
    
    if (action === 'schedule') {
      const { startTime, endTime, candidateEmail, candidateName, jobRole, interviewerEmail } = interviewData;
      
      const event = {
        summary: `Interview with ${candidateName} - ${jobRole}`,
        description: `Interview scheduled for ${candidateName} (${candidateEmail}) for the position of ${jobRole}`,
        start: {
          dateTime: startTime,
          timeZone: 'UTC'
        },
        end: {
          dateTime: endTime,
          timeZone: 'UTC'
        },
        attendees: [
          { email: candidateEmail },
          { email: interviewerEmail }
        ],
        conferenceData: {
          createRequest: {
            requestId: `interview_${candidateId}_${Date.now()}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet'
            }
          }
        }
      };

      const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        throw new Error(`Google Calendar API error: ${response.statusText}`);
      }

      const eventData = await response.json();
      
      // Save interview to database
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { data: interview, error } = await supabase
        .from('scheduled_interviews')
        .insert({
          candidate_id: candidateId,
          interviewer_email: interviewerEmail,
          job_role: jobRole,
          start_time: startTime,
          end_time: endTime,
          meet_link: eventData.conferenceData?.entryPoints?.[0]?.uri || eventData.hangoutLink,
          calendar_event_id: eventData.id,
          status: 'scheduled'
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving interview:', error);
        throw new Error('Failed to save interview to database');
      }

      return new Response(JSON.stringify({ 
        success: true, 
        eventId: eventData.id,
        meetLink: eventData.conferenceData?.entryPoints?.[0]?.uri || eventData.hangoutLink,
        interview
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in google-calendar-integration:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
