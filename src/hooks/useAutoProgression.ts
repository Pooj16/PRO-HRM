import { useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

interface AutoProgressionResult {
  success: boolean;
  message: string;
  processed: number;
  auto_shortlisted: number;
  candidates: Array<{
    candidate_id: string;
    candidate_name: string;
    candidate_email: string;
    assessment_score: number;
    new_status: string;
    auto_shortlisted: boolean;
  }>;
}

/**
 * Hook for triggering auto-progression of candidates who passed assessments
 * Automatically moves qualified candidates from assessment_completed to interview_scheduled
 */
export const useAutoProgression = () => {
  const { toast } = useToast();

  const triggerAutoProgression = useCallback(
    async (): Promise<AutoProgressionResult | null> => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-progress-qualified-candidates`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("supabase.auth.token")}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Auto-progression failed with status ${response.status}`);
        }

        const result = await response.json();

        if (result.processed > 0) {
          toast({
            title: "Auto-Progression Complete",
            description: `${result.auto_shortlisted} candidates moved to interview scheduling`,
            variant: "default",
          });
        }

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";

        toast({
          title: "Auto-Progression Error",
          description: errorMessage,
          variant: "destructive",
        });

        console.error("Auto-progression error:", error);
        return null;
      }
    },
    [toast]
  );

  return { triggerAutoProgression };
};
