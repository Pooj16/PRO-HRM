import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  CheckCircle,
  XCircle,
  Eye,
  Send,
  AlertCircle,
  Loader2,
  Copy,
  BrainCircuit
} from 'lucide-react';

interface AssessmentActionsProps {
  candidateId: string;
  candidateName: string;
  assessmentId?: string | null;
  assessmentStatus?: string;
  onActionComplete?: () => void;
}

/**
 * AssessmentActions Component — FIXED (no RBAC blocking)
 * 
 * All buttons work directly without permission checks.
 * Actions: Progress to Interview, Manual Review, Send Assessment, Reject
 */
export function AssessmentActions({
  candidateId,
  candidateName,
  assessmentId,
  assessmentStatus,
  onActionComplete
}: AssessmentActionsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const handleProgressToInterview = async () => {
    setLoading('interview');
    try {
      const { error } = await supabase
        .from('candidates')
        .update({
          status: 'interview_scheduled',
          pipeline_status: 'interview',
        })
        .eq('id', candidateId);

      if (error) throw error;

      toast({
        title: '✅ Moved to Interview',
        description: `${candidateName} advanced to interview stage`,
      });
      onActionComplete?.();
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'Failed to progress candidate',
        variant: 'destructive'
      });
    } finally {
      setLoading(null);
    }
  };

  const handleManualReview = async () => {
    setLoading('review');
    try {
      const { error } = await supabase
        .from('candidates')
        .update({
          status: 'reviewing',
          pipeline_status: 'ai_screened',
        })
        .eq('id', candidateId);

      if (error) throw error;

      toast({
        title: '👁️ Flagged for Review',
        description: `${candidateName} marked for manual review`,
      });
      onActionComplete?.();
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'Failed to flag for review',
        variant: 'destructive'
      });
    } finally {
      setLoading(null);
    }
  };

  const handleSendAssessment = async () => {
    setLoading('send');
    try {
      // Step 1: Find or create an assessment for this candidate's role
      let targetAssessmentId = assessmentId;

      if (!targetAssessmentId) {
        // Get candidate's role
        const { data: candidate } = await supabase
          .from('candidates')
          .select('applied_role, email')
          .eq('id', candidateId)
          .single();

        const role = candidate?.applied_role || 'General';

        // Find existing assessment for this role
        const { data: existingAssessment } = await supabase
          .from('assessments')
          .select('id')
          .ilike('title', `%${role}%`)
          .limit(1)
          .single();

        if (existingAssessment) {
          targetAssessmentId = existingAssessment.id;
        } else {
          // Create a new assessment for this role
          const { data: newAssessment, error: createError } = await supabase
            .from('assessments')
            .insert({
              title: `${role} Assessment`,
              description: `Technical assessment for ${role} candidates`,
              duration: 30,
              questions: 5,
              type: 'technical',
              difficulty: 'medium',
              status: 'active',
              candidates_assigned: 0,
              completion_rate: 0,
              created_by: null,
            })
            .select()
            .single();

          if (createError) throw createError;
          targetAssessmentId = newAssessment.id;
        }
      }

      // Step 2: Check for existing assignment before creating a new one
      const { data: existingAssignment } = await supabase
        .from('assessment_assignments')
        .select('id, status')
        .eq('candidate_id', candidateId)
        .eq('assessment_id', targetAssessmentId)
        .maybeSingle();

      let assignment: any;

      if (existingAssignment) {
        // Reuse existing assignment instead of duplicating
        assignment = existingAssignment;
        toast({
          title: '📝 Assessment Already Assigned',
          description: `Re-sharing the existing assessment link for ${candidateName}`,
        });
      } else {
        const { data: newAssignment, error: assignError } = await supabase
          .from('assessment_assignments')
          .insert({
            candidate_id: candidateId,
            assessment_id: targetAssessmentId,
            status: 'assigned',
          })
          .select()
          .single();

        if (assignError) throw assignError;
        assignment = newAssignment;
      }

      // Step 3: Update candidate status
      await supabase
        .from('candidates')
        .update({
          assessment_status: 'assigned',
          status: 'shortlisted',
        })
        .eq('id', candidateId);

      // Step 4: Generate assessment link
      const assessmentLink = `${window.location.origin}/assessment/${assignment.id}`;

      // Step 5: Send the actual email via Edge Function
      const { error: emailError } = await supabase.functions.invoke('send-assessment-email', {
        body: {
          candidate_id: candidateId,
          assessment_id: targetAssessmentId
        }
      });

      if (emailError) {
        console.warn('Failed to trigger email notification:', emailError);
        toast({
          title: '⚠️ Email Delayed',
          description: 'Assessment assigned and link copied, but email notification failed.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: '📧 Email Sent',
          description: `Assessment link sent to ${candidateName}`,
        });
      }

      onActionComplete?.();
    } catch (error) {
      console.error('Error sending assessment:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign assessment',
        variant: 'destructive'
      });
    } finally {
      setLoading(null);
    }
  };

  const handleEvaluateAI = async () => {
    setLoading('evaluate');
    try {
      // 1. Get the session for candidate
      const { data: sessionData, error: sessionErr } = await (supabase as any)
        .from('assessment_sessions')
        .select('*')
        .eq('candidate_id', candidateId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessionErr) throw sessionErr;
      if (!sessionData) throw new Error('No completed assessment session found for this candidate. Please ensure they have submitted their test.');

      toast({
        title: "🧠 AI Grader",
        description: "Triggering secure server-side evaluation..."
      });

      // 2. Invoke the Supabase Edge Function
      const { data: evalData, error: invokeErr } = await supabase.functions.invoke('evaluate-assessment', {
        body: { session_id: sessionData.id }
      });

      if (invokeErr) throw invokeErr;
      if (!evalData?.success) throw new Error(evalData?.error || 'Evaluation failed');

      const scorePercentage = evalData.score;

      toast({
        title: scorePercentage >= 70 ? '🎊 Passed Assessment' : '❌ Failed Assessment',
        description: `Candidate graded with score: ${scorePercentage}%. Status updated.`,
        variant: scorePercentage >= 70 ? 'default' : 'destructive'
      });

      onActionComplete?.();
    } catch (err: any) {
      console.error('Evaluation Error:', err);
      toast({
        title: 'Evaluation Failed',
        description: err.message || 'Check connection to Supabase functions.',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    if (!window.confirm(`Are you sure you want to reject ${candidateName}?`)) return;

    setLoading('reject');
    try {
      const { error } = await supabase
        .from('candidates')
        .update({
          status: 'rejected',
          pipeline_status: 'rejected',
        })
        .eq('id', candidateId);

      if (error) throw error;

      toast({
        title: '❌ Candidate Rejected',
        description: `${candidateName} has been rejected`,
      });
      onActionComplete?.();
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject candidate',
        variant: 'destructive'
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">Actions</p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={handleProgressToInterview}
          disabled={loading !== null}
          className="bg-green-600 hover:bg-green-700"
          size="sm"
        >
          {loading === 'interview' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
          Interview
        </Button>
        <Button
          onClick={handleManualReview}
          disabled={loading !== null}
          variant="outline"
          size="sm"
        >
          {loading === 'review' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
          Review
        </Button>
        <Button
          onClick={handleSendAssessment}
          disabled={loading !== null}
          className="bg-cyan-600 hover:bg-blue-700"
          size="sm"
        >
          {loading === 'send' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Send Test
        </Button>
        <Button
          onClick={handleReject}
          disabled={loading !== null}
          variant="destructive"
          size="sm"
        >
          {loading === 'reject' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
          Reject
        </Button>
      </div>
      {assessmentStatus === 'assigned' && (
        <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <span className="text-xs text-yellow-800">
            Assessment assigned — waiting for candidate to complete
          </span>
        </div>
      )}
      {assessmentStatus === 'completed' && (
        <div className="flex flex-col gap-2 p-3 bg-green-50 rounded-lg border border-green-100">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm font-semibold text-green-800">
              Assessment completed
            </span>
          </div>
          <Button
            onClick={handleEvaluateAI}
            disabled={loading !== null}
            className="w-full bg-slate-900 hover:bg-slate-800 mt-1"
            size="sm"
          >
            {loading === 'evaluate' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BrainCircuit className="h-4 w-4 mr-2" />}
            Trigger AI Evaluation
          </Button>
        </div>
      )}
      {assessmentStatus === 'evaluated' && (
        <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg border border-purple-100">
          <BrainCircuit className="h-4 w-4 text-purple-600" />
          <span className="text-sm font-semibold text-purple-800">
            AI Evaluation Finished
          </span>
        </div>
      )}
    </div>
  );
}
