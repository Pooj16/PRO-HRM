import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // Get all candidates with completed assessments
    const { data: candidates, error: candidatesError } = await supabase
      .from("candidates")
      .select(
        `
        id,
        name,
        email,
        applied_role,
        status,
        assessment_status
      `
      )
      .eq("assessment_status", "completed");

    if (candidatesError) throw candidatesError;

    if (!candidates || candidates.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No candidates with completed assessments",
          processed: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Get role thresholds
    const { data: roleThresholds, error: thresholdError } = await supabase
      .from("role_thresholds")
      .select("role_name, min_assessment_score, auto_shortlist");

    if (thresholdError) throw thresholdError;

    const thresholdMap = new Map(
      roleThresholds?.map((rt) => [
        rt.role_name,
        {
          min_score: rt.min_assessment_score,
          auto_shortlist: rt.auto_shortlist,
        },
      ]) || []
    );

    let processedCount = 0;
    let autoShortlistedCount = 0;
    const progressedCandidates = [];

    // Process each candidate
    for (const candidate of candidates) {
      try {
        // Get candidate's assessment score
        const { data: assessmentData, error: assessmentError } = await supabase
          .from("hr_candidate_assessments")
          .select("assessment_score")
          .eq("candidate_id", candidate.id)
          .single();

        if (assessmentError && assessmentError.code !== "PGRST116") {
          console.error(
            `Error fetching assessment for ${candidate.id}:`,
            assessmentError
          );
          continue;
        }

        const assessmentScore = assessmentData?.assessment_score || 0;
        const threshold = thresholdMap.get(candidate.applied_role);

        if (!threshold) {
          console.log(
            `No threshold found for role: ${candidate.applied_role}`
          );
          continue;
        }

        // Check if candidate passes threshold
        if (assessmentScore >= threshold.min_score) {
          let newStatus = "assessment_completed";

          // If auto_shortlist is true, advance to interview_scheduled
          if (threshold.auto_shortlist) {
            newStatus = "interview_scheduled";
            autoShortlistedCount++;
          }

          // Update candidate status
          const { error: updateError } = await supabase
            .from("candidates")
            .update({
              status: newStatus,
              updated_at: new Date().toISOString(),
            })
            .eq("id", candidate.id);

          if (updateError) throw updateError;

          // Log the action
          await supabase.from("audit_logs").insert({
            user_id: "system",
            action: "auto_progress_assessment",
            resource_type: "candidate",
            resource_id: candidate.id,
            old_value: JSON.stringify({ status: candidate.status }),
            new_value: JSON.stringify({ status: newStatus }),
            context: JSON.stringify({
              assessment_score: assessmentScore,
              threshold: threshold.min_score,
              auto_shortlist: threshold.auto_shortlist,
            }),
            ip_address: "system",
            timestamp: new Date().toISOString(),
          });

          progressedCandidates.push({
            candidate_id: candidate.id,
            candidate_name: candidate.name,
            candidate_email: candidate.email,
            assessment_score: assessmentScore,
            new_status: newStatus,
            auto_shortlisted: threshold.auto_shortlist,
          });

          processedCount++;
        }
      } catch (error) {
        console.error(`Error processing candidate ${candidate.id}:`, error);
        continue;
      }
    }

    // Send HR notification email if candidates were auto-shortlisted
    if (autoShortlistedCount > 0) {
      try {
        // Get HR user emails (assuming team leads or admins)
        const { data: hrUsers } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "hr");

        if (hrUsers && hrUsers.length > 0) {
          // In production, send actual emails via SendGrid/Mailgun
          console.log(
            `Would send notification to ${hrUsers.length} HR users about ${autoShortlistedCount} auto-shortlisted candidates`
          );
        }
      } catch (error) {
        console.error("Error sending HR notifications:", error);
      }
    }

    return new Response(
      JSON.stringify({
        message: "Auto-progression complete",
        processed: processedCount,
        auto_shortlisted: autoShortlistedCount,
        candidates: progressedCandidates,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Auto-progression error:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
