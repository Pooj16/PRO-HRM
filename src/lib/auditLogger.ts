/**
 * Audit Logger Service
 * Tracks all changes to candidates, assignments, and decisions
 */

import { supabase } from '@/integrations/supabase/client';

export interface AuditLogEntry {
  entity_type: 'candidate' | 'assignment' | 'assessment' | 'interview' | 'employee';
  entity_id: string;
  action: string;
  old_value?: Record<string, any>;
  new_value?: Record<string, any>;
  changed_by?: string;
  changed_by_role: 'hr' | 'team_lead' | 'admin' | 'system' | 'ai';
  notes?: string;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current user if available
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        entity_type: entry.entity_type,
        entity_id: entry.entity_id,
        action: entry.action,
        old_value: entry.old_value || null,
        new_value: entry.new_value || null,
        changed_by: entry.changed_by || user?.id || null,
        changed_by_role: entry.changed_by_role,
        notes: entry.notes || null,
      });

    if (error) {
      console.error('Failed to create audit log:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Audit log error:', err);
    return { success: false, error: 'Failed to create audit log' };
  }
}

/**
 * Log a candidate status change
 */
export async function logStatusChange(
  candidateId: string,
  oldStatus: string,
  newStatus: string,
  changedByRole: AuditLogEntry['changed_by_role'],
  notes?: string
): Promise<void> {
  await createAuditLog({
    entity_type: 'candidate',
    entity_id: candidateId,
    action: 'status_change',
    old_value: { status: oldStatus },
    new_value: { status: newStatus },
    changed_by_role: changedByRole,
    notes,
  });
}

/**
 * Log a team lead assignment
 */
export async function logAssignment(
  candidateId: string,
  teamLeadId: string,
  teamLeadName: string,
  changedByRole: AuditLogEntry['changed_by_role'],
  notes?: string
): Promise<void> {
  await createAuditLog({
    entity_type: 'assignment',
    entity_id: candidateId,
    action: 'team_lead_assigned',
    new_value: { team_lead_id: teamLeadId, team_lead_name: teamLeadName },
    changed_by_role: changedByRole,
    notes,
  });
}

/**
 * Log a review decision
 */
export async function logReviewDecision(
  candidateId: string,
  decision: 'approved' | 'rejected',
  reviewerRole: 'hr' | 'team_lead',
  reviewNotes: string
): Promise<void> {
  await createAuditLog({
    entity_type: 'candidate',
    entity_id: candidateId,
    action: 'review_decision',
    new_value: { decision, reviewer_role: reviewerRole },
    changed_by_role: reviewerRole,
    notes: reviewNotes,
  });
}

/**
 * Log AI analysis
 */
export async function logAIAnalysis(
  candidateId: string,
  atsScore: number,
  recommendation: string,
  notes?: string
): Promise<void> {
  await createAuditLog({
    entity_type: 'candidate',
    entity_id: candidateId,
    action: 'ai_analysis',
    new_value: { ats_score: atsScore, recommendation },
    changed_by_role: 'ai',
    notes,
  });
}

/**
 * Log employee conversion
 */
export async function logEmployeeConversion(
  candidateId: string,
  employeeId: string,
  department: string,
  role: string
): Promise<void> {
  await createAuditLog({
    entity_type: 'employee',
    entity_id: employeeId,
    action: 'candidate_converted',
    old_value: { candidate_id: candidateId },
    new_value: { department, role },
    changed_by_role: 'hr',
    notes: `Candidate converted to employee in ${department} as ${role}`,
  });
}

/**
 * Get audit logs for an entity
 */
export async function getAuditLogs(
  entityType: AuditLogEntry['entity_type'],
  entityId: string
): Promise<{ data: any[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: [], error: error.message };
    }

    return { data: data || [] };
  } catch (err) {
    return { data: [], error: 'Failed to fetch audit logs' };
  }
}
