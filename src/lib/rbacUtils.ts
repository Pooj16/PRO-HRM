/**
 * RBAC (Role-Based Access Control) utilities
 * Provides functions to check user permissions across the application
 */

import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'admin' | 'hr' | 'hiring_manager' | 'candidate' | 'guest';

export interface UserPermissions {
  canViewAssessments: boolean;
  canMakeDecisions: boolean;
  canManageCandidates: boolean;
  canViewAuditLogs: boolean;
  canConfigureSystem: boolean;
  roles: UserRole[];
}

/**
 * Get current user's role from JWT token
 */
export const getCurrentUserRole = async (): Promise<UserRole | null> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return null;
    }

    // Get role from user metadata or database
    const role = session.user.user_metadata?.role as UserRole;
    return role || 'guest';
  } catch (error) {
    console.error('Failed to get user role:', error);
    return null;
  }
};

/**
 * Get all permissions for current user
 */
export const getCurrentUserPermissions = async (): Promise<UserPermissions> => {
  const role = await getCurrentUserRole();

  const permissions: UserPermissions = {
    canViewAssessments: false,
    canMakeDecisions: false,
    canManageCandidates: false,
    canViewAuditLogs: false,
    canConfigureSystem: false,
    roles: role ? [role] : []
  };

  // Define permissions by role
  switch (role) {
    case 'admin':
      permissions.canViewAssessments = true;
      permissions.canMakeDecisions = true;
      permissions.canManageCandidates = true;
      permissions.canViewAuditLogs = true;
      permissions.canConfigureSystem = true;
      break;

    case 'hr':
      permissions.canViewAssessments = true;
      permissions.canMakeDecisions = true;
      permissions.canManageCandidates = true;
      permissions.canViewAuditLogs = true;
      break;

    case 'hiring_manager':
      permissions.canViewAssessments = true;
      permissions.canMakeDecisions = true;
      break;

    case 'candidate':
      // Candidates can only take assessments
      break;

    case 'guest':
    default:
      // No permissions
      break;
  }

  return permissions;
};

/**
 * Check if user can perform a specific action
 */
export const canUserPerformAction = async (action: 'view_assessments' | 'make_decisions' | 'manage_candidates' | 'view_audit_logs' | 'configure_system'): Promise<boolean> => {
  const permissions = await getCurrentUserPermissions();

  switch (action) {
    case 'view_assessments':
      return permissions.canViewAssessments;
    case 'make_decisions':
      return permissions.canMakeDecisions;
    case 'manage_candidates':
      return permissions.canManageCandidates;
    case 'view_audit_logs':
      return permissions.canViewAuditLogs;
    case 'configure_system':
      return permissions.canConfigureSystem;
    default:
      return false;
  }
};

/**
 * Require specific permission or throw error
 */
export const requirePermission = async (action: 'view_assessments' | 'make_decisions' | 'manage_candidates' | 'view_audit_logs' | 'configure_system'): Promise<void> => {
  const hasPermission = await canUserPerformAction(action);

  if (!hasPermission) {
    const userId = (await supabase.auth.getSession()).data.session?.user?.id;
    
    // Log unauthorized attempt
    await logAuditEvent({
      action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
      resourceType: 'assessment',
      resourceId: null,
      details: { attemptedAction: action },
      result: 'denied',
      userId: userId || 'unknown',
      ipAddress: await getClientIpAddress(),
      userAgent: navigator.userAgent
    });

    throw new Error(`Permission denied: ${action}`);
  }
};

/**
 * Log audit events for security tracking
 */
export const logAuditEvent = async (event: {
  action: string;
  resourceType: string;
  resourceId: string | null;
  details?: Record<string, any>;
  result: 'success' | 'failed' | 'denied';
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> => {
  try {
    // Note: This will work once the migration is applied
    console.log('Audit event:', {
      action: event.action,
      resource_type: event.resourceType,
      resource_id: event.resourceId,
      details: event.details || {},
      result: event.result,
      user_id: event.userId,
      ip_address: event.ipAddress || 'unknown',
      user_agent: event.userAgent || 'unknown'
    });

    // TODO: Uncomment after migration is applied
    /*
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        action: event.action,
        resource_type: event.resourceType,
        resource_id: event.resourceId,
        details: event.details || {},
        result: event.result,
        user_id: event.userId,
        ip_address: event.ipAddress || 'unknown',
        user_agent: event.userAgent || 'unknown'
      });

    if (error) {
      console.error('Failed to log audit event:', error);
    }
    */
  } catch (error) {
    console.error('Audit logging error:', error);
  }
};

/**
 * Get client IP address (best effort)
 */
export const getClientIpAddress = async (): Promise<string> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip || 'unknown';
  } catch (error) {
    console.warn('Could not determine client IP:', error);
    return 'unknown';
  }
};

/**
 * Check if IP changed during session
 */
export const checkIpSessionValidity = async (sessionStartIp: string): Promise<boolean> => {
  const currentIp = await getClientIpAddress();
  return currentIp === sessionStartIp;
};

/**
 * Validate user session security
 */
export const validateSessionSecurity = async (sessionData: {
  startIp: string;
  startTime: string;
  userId: string;
}): Promise<{
  valid: boolean;
  warnings: string[];
}> => {
  const warnings: string[] = [];
  let valid = true;

  // Check IP consistency
  const ipValid = await checkIpSessionValidity(sessionData.startIp);
  if (!ipValid) {
    warnings.push('IP address changed during session');
    // Don't fail - just warn
  }

  // Check session timeout (15 minutes)
  const sessionDuration = Date.now() - new Date(sessionData.startTime).getTime();
  if (sessionDuration > 15 * 60 * 1000) {
    warnings.push('Session duration exceeded');
    valid = false;
  }

  return { valid, warnings };
};
