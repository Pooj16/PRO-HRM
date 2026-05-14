/**
 * Workflow Hook
 * Provides workflow operations with proper validation and audit logging
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  PIPELINE_STATUS,
  PipelineStatus,
  USER_ROLE,
  UserRole,
  isValidTransition,
  getAllowedNextStatuses,
  PIPELINE_TO_DB_STATUS,
  canMakeAICall,
  WorkflowValidation,
  canConvertToEmployee,
  canStartBackgroundVerification,
} from '@/lib/workflowRules';
import {
  logStatusChange,
  logAssignment,
  logReviewDecision,
  logAIAnalysis,
  logEmployeeConversion,
} from '@/lib/auditLogger';

interface WorkflowResult {
  success: boolean;
  message: string;
  data?: any;
}

export function useWorkflow() {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  /**
   * Change candidate pipeline status with validation and audit logging
   */
  const changePipelineStatus = useCallback(async (
    candidateId: string,
    currentStatus: string,
    newPipelineStatus: PipelineStatus,
    userRole: UserRole,
    notes?: string
  ): Promise<WorkflowResult> => {
    // Validate transition
    const validation = isValidTransition(currentStatus, newPipelineStatus, userRole);
    
    if (!validation.valid) {
      toast({
        title: 'Invalid Transition',
        description: validation.reason,
        variant: 'destructive',
      });
      return { success: false, message: validation.reason || 'Invalid transition' };
    }

    // Check if notes are required
    if (validation.requiresNotes && !notes?.trim()) {
      toast({
        title: 'Notes Required',
        description: 'Please provide review notes for this status change',
        variant: 'destructive',
      });
      return { success: false, message: 'Notes required for this transition' };
    }

    // Prevent infinite loops
    if (!WorkflowValidation.trackStatusChange(candidateId)) {
      toast({
        title: 'Too Many Changes',
        description: 'Maximum status changes reached for this session',
        variant: 'destructive',
      });
      return { success: false, message: 'Max status changes reached' };
    }

    setIsProcessing(true);
    try {
      const dbStatus = PIPELINE_TO_DB_STATUS[newPipelineStatus];
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('candidates')
        .update({
          status: dbStatus,
          pipeline_status: newPipelineStatus,
          review_notes: notes || null,
          last_status_change_at: new Date().toISOString(),
          last_status_changed_by: user?.id || null,
          last_status_changed_by_role: userRole,
          updated_at: new Date().toISOString(),
        })
        .eq('id', candidateId);

      if (error) throw error;

      // Log the change
      await logStatusChange(candidateId, currentStatus, newPipelineStatus, userRole, notes);

      toast({
        title: 'Status Updated',
        description: `Candidate moved to ${newPipelineStatus.replace('_', ' ')}`,
      });

      return { success: true, message: 'Status updated successfully' };
    } catch (error) {
      console.error('Failed to update status:', error);
      toast({
        title: 'Update Failed',
        description: 'Failed to update candidate status',
        variant: 'destructive',
      });
      return { success: false, message: 'Failed to update status' };
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  /**
   * Assign candidate to team lead
   */
  const assignToTeamLead = useCallback(async (
    candidateId: string,
    teamLeadId: string,
    teamLeadName: string,
    userRole: UserRole,
    notes?: string
  ): Promise<WorkflowResult> => {
    if (userRole !== USER_ROLE.HR && userRole !== USER_ROLE.ADMIN) {
      toast({
        title: 'Permission Denied',
        description: 'Only HR can assign candidates to team leads',
        variant: 'destructive',
      });
      return { success: false, message: 'Permission denied' };
    }

    setIsProcessing(true);
    try {
      // Update candidate with assigned team lead
      const { error: updateError } = await supabase
        .from('candidates')
        .update({
          assigned_team_lead_id: teamLeadId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', candidateId);

      if (updateError) throw updateError;

      // Create assignment record
      const { error: assignError } = await supabase
        .from('candidate_assignments')
        .insert({
          candidate_id: candidateId,
          team_lead_id: teamLeadId,
          status: 'assigned',
          notes: notes || `Assigned to ${teamLeadName}`,
        });

      if (assignError) {
        console.warn('Assignment record creation failed:', assignError);
        // Don't fail the whole operation if assignment record fails
      }

      // Log the assignment
      await logAssignment(candidateId, teamLeadId, teamLeadName, userRole, notes);

      toast({
        title: 'Candidate Assigned',
        description: `Assigned to ${teamLeadName} for review`,
      });

      return { success: true, message: 'Assignment successful' };
    } catch (error) {
      console.error('Failed to assign candidate:', error);
      toast({
        title: 'Assignment Failed',
        description: 'Failed to assign candidate to team lead',
        variant: 'destructive',
      });
      return { success: false, message: 'Failed to assign candidate' };
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  /**
   * Team lead review with mandatory notes
   */
  const submitTeamLeadReview = useCallback(async (
    candidateId: string,
    currentStatus: string,
    decision: 'approve' | 'reject',
    reviewNotes: string
  ): Promise<WorkflowResult> => {
    if (!reviewNotes?.trim()) {
      toast({
        title: 'Notes Required',
        description: 'Team lead reviews require mandatory notes',
        variant: 'destructive',
      });
      return { success: false, message: 'Notes required' };
    }

    const newStatus = decision === 'approve' ? PIPELINE_STATUS.INTERVIEW : PIPELINE_STATUS.REJECTED;
    
    const result = await changePipelineStatus(
      candidateId,
      currentStatus,
      newStatus,
      USER_ROLE.TEAM_LEAD,
      reviewNotes
    );

    if (result.success) {
      await logReviewDecision(
        candidateId,
        decision === 'approve' ? 'approved' : 'rejected',
        'team_lead',
        reviewNotes
      );
    }

    return result;
  }, [changePipelineStatus, toast]);

  /**
   * Trigger AI analysis with rate limiting
   */
  const triggerAIAnalysis = useCallback(async (
    candidateId: string,
    resumeText: string,
    jobRequirements: string
  ): Promise<WorkflowResult> => {
    // Check rate limit
    const rateCheck = canMakeAICall(candidateId);
    if (!rateCheck.allowed) {
      const waitSeconds = Math.ceil((rateCheck.retryAfterMs || 0) / 1000);
      toast({
        title: 'Rate Limited',
        description: `Please wait ${waitSeconds} seconds before retrying`,
        variant: 'destructive',
      });
      return { success: false, message: 'Rate limited' };
    }

    setIsProcessing(true);
    try {
  // Use our internal AI assistant function (legacy Gemini removed)
  const aiFunctionName = 'ai-assistant';
      const { data, error } = await supabase.functions.invoke(aiFunctionName, {
        body: {
          candidateId,
          resumeText,
          jobRequirements,
          action: 'analyze'
        },
      });

      if (error) throw error;

      // Log AI analysis
      await logAIAnalysis(
        candidateId,
        data?.atsScore || 0,
        data?.recommendation || 'analyzed',
        `AI analysis completed. Score: ${data?.atsScore}`
      );

      toast({
        title: 'Analysis Complete',
        description: `ATS Score: ${data?.atsScore}`,
      });

      return { success: true, message: 'Analysis complete', data };
    } catch (error) {
      console.error('AI analysis failed:', error);
      toast({
        title: 'Analysis Failed',
        description: 'Failed to complete AI analysis',
        variant: 'destructive',
      });
      return { success: false, message: 'Analysis failed' };
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  /**
   * Convert hired candidate to employee
   */
  const convertToEmployee = useCallback(async (
    candidateId: string,
    candidateStatus: string,
    employeeData: {
      department: string;
      role: string;
      start_date?: string;
      salary?: number;
      manager_id?: string;
    }
  ): Promise<WorkflowResult> => {
    if (!canConvertToEmployee(candidateStatus)) {
      toast({
        title: 'Cannot Convert',
        description: 'Only hired candidates can be converted to employees',
        variant: 'destructive',
      });
      return { success: false, message: 'Candidate must be hired first' };
    }

    setIsProcessing(true);
    try {
      // Get candidate details
      const { data: candidate, error: fetchError } = await supabase
        .from('candidates')
        .select('*')
        .eq('id', candidateId)
        .single();

      if (fetchError || !candidate) throw new Error('Candidate not found');

      // Create employee record
      const { data: employee, error: createError } = await supabase
        .from('employees')
        .insert({
          candidate_id: candidateId,
          name: candidate.name,
          email: candidate.email,
          phone: candidate.phone,
          department: employeeData.department,
          role: employeeData.role,
          start_date: employeeData.start_date || null,
          salary: employeeData.salary || null,
          manager_id: employeeData.manager_id || null,
          status: 'active',
        })
        .select()
        .single();

      if (createError) throw createError;

      // Log conversion
      await logEmployeeConversion(
        candidateId,
        employee.id,
        employeeData.department,
        employeeData.role
      );

      toast({
        title: 'Employee Created',
        description: `${candidate.name} has been added as an employee`,
      });

      return { success: true, message: 'Employee created', data: employee };
    } catch (error) {
      console.error('Failed to convert to employee:', error);
      toast({
        title: 'Conversion Failed',
        description: 'Failed to convert candidate to employee',
        variant: 'destructive',
      });
      return { success: false, message: 'Conversion failed' };
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  /**
   * Get allowed next statuses for current user
   */
  const getNextStatuses = useCallback((currentStatus: string, userRole: UserRole): PipelineStatus[] => {
    return getAllowedNextStatuses(currentStatus, userRole);
  }, []);

  /**
   * Check if background verification can start
   */
  const canStartBgVerification = useCallback((status: string): boolean => {
    return canStartBackgroundVerification(status);
  }, []);

  return {
    isProcessing,
    changePipelineStatus,
    assignToTeamLead,
    submitTeamLeadReview,
    triggerAIAnalysis,
    convertToEmployee,
    getNextStatuses,
    canStartBgVerification,
    PIPELINE_STATUS,
    USER_ROLE,
  };
}
