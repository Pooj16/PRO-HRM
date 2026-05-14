/**
 * Email Notification Service for Auto-Progression
 * Handles sending emails to HR when candidates are auto-shortlisted
 */

import { supabase } from "@/integrations/supabase/client";

export interface AutoProgressionEmailData {
  candidateName: string;
  candidateEmail: string;
  role: string;
  assessmentScore: number;
  threshold: number;
  recipientEmail: string;
}

/**
 * Send auto-progression notification email to HR
 * @param data Email data including candidate info and recipient
 */
export const sendAutoProgressionEmail = async (
  data: AutoProgressionEmailData
): Promise<boolean> => {
  try {
    // Call the send-auto-progression-email edge function
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-auto-progression-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("supabase.auth.token")}`,
        },
        body: JSON.stringify({
          candidate_name: data.candidateName,
          candidate_email: data.candidateEmail,
          role: data.role,
          assessment_score: data.assessmentScore,
          threshold: data.threshold,
          recipient_email: data.recipientEmail,
        }),
      }
    );

    if (!response.ok) {
      console.error(`Failed to send email: ${response.statusText}`);
      return false;
    }

    const result = await response.json();
    console.log("Email sent successfully:", result);
    return true;
  } catch (error) {
    console.error("Error sending auto-progression email:", error);
    return false;
  }
};

/**
 * Send batch emails for multiple auto-shortlisted candidates
 * @param candidates Array of candidates
 * @param hrEmail HR email address to notify
 */
export const sendBatchAutoProgressionEmails = async (
  candidates: Array<{
    candidate_id: string;
    candidate_name: string;
    candidate_email: string;
    assessment_score: number;
    new_status: string;
  }>,
  hrEmail: string,
  threshold: number,
  role: string
): Promise<{ success: number; failed: number }> => {
  let successCount = 0;
  let failedCount = 0;

  for (const candidate of candidates) {
    const result = await sendAutoProgressionEmail({
      candidateName: candidate.candidate_name,
      candidateEmail: candidate.candidate_email,
      role: role,
      assessmentScore: candidate.assessment_score,
      threshold: threshold,
      recipientEmail: hrEmail,
    });

    if (result) {
      successCount++;
    } else {
      failedCount++;
    }
  }

  return { success: successCount, failed: failedCount };
};

/**
 * Get HR email for a specific role
 * @param role The role name
 */
export const getHREmailForRole = async (role: string): Promise<string | null> => {
  try {
    // Query the database for HR user associated with this role
    const { data, error } = await supabase
      .from("user_roles")
      .select("user:profiles(email)")
      .eq("role", "hr")
      .limit(1)
      .single();

    if (error) {
      console.error(`Error fetching HR email for role ${role}:`, error);
      return null;
    }

    // Extract email from nested structure
    if (data?.user?.email) {
      return data.user.email;
    }

    return null;
  } catch (error) {
    console.error("Error getting HR email:", error);
    return null;
  }
};

/**
 * Log email sending event
 * @param candidateId Candidate ID
 * @param hrEmail HR email that received notification
 * @param status Email status
 */
export const logEmailEvent = async (
  candidateId: string,
  hrEmail: string,
  status: "sent" | "failed"
): Promise<void> => {
  try {
    await supabase.from("audit_logs").insert({
      action: "auto_progression_email_sent",
      entity_type: "candidate",
      entity_id: candidateId,
      changed_by: "system",
      changed_by_role: "system",
      old_value: JSON.stringify({}),
      new_value: JSON.stringify({ recipient_email: hrEmail, status }),
      notes: `Auto-progression notification email ${status} for role assignment`,
    });
  } catch (error) {
    console.error("Error logging email event:", error);
  }
};
