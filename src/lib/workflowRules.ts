/**
 * Workflow Rules Engine
 * Enforces hiring pipeline logic and role-based transitions
 */

// Pipeline status definitions
export const PIPELINE_STATUS = {
  APPLIED: 'applied',
  AI_SCREENED: 'ai_screened',
  ASSESSMENT: 'assessment',
  LEAD_REVIEW: 'lead_review',
  INTERVIEW: 'interview',
  OFFER: 'offer',
  HIRED: 'hired',
  REJECTED: 'rejected',
} as const;

export type PipelineStatus = typeof PIPELINE_STATUS[keyof typeof PIPELINE_STATUS];

// Role definitions
export const USER_ROLE = {
  HR: 'hr',
  ADMIN: 'admin',
  TEAM_LEAD: 'team_lead',
  AI: 'ai',
  SYSTEM: 'system',
} as const;

export type UserRole = typeof USER_ROLE[keyof typeof USER_ROLE];

// Status to pipeline mapping (for backwards compatibility with existing statuses)
export const STATUS_TO_PIPELINE: Record<string, PipelineStatus> = {
  'uploaded': PIPELINE_STATUS.APPLIED,
  'text_extracted': PIPELINE_STATUS.APPLIED,
  'analyzing': PIPELINE_STATUS.AI_SCREENED,
  'analyzed': PIPELINE_STATUS.AI_SCREENED,
  'assessment_pending': PIPELINE_STATUS.ASSESSMENT,
  'assessment_completed': PIPELINE_STATUS.ASSESSMENT,
  'assessment_failed': PIPELINE_STATUS.ASSESSMENT,
  'pending_review': PIPELINE_STATUS.LEAD_REVIEW,
  'shortlisted': PIPELINE_STATUS.LEAD_REVIEW,
  'reviewing': PIPELINE_STATUS.LEAD_REVIEW,
  'approved': PIPELINE_STATUS.INTERVIEW,
  'interview_scheduled': PIPELINE_STATUS.INTERVIEW,
  'offer_extended': PIPELINE_STATUS.OFFER,
  'background_verification': PIPELINE_STATUS.OFFER,
  'hired': PIPELINE_STATUS.HIRED,
  'rejected': PIPELINE_STATUS.REJECTED,
};

// Pipeline to database status mapping
export const PIPELINE_TO_DB_STATUS: Record<PipelineStatus, string> = {
  [PIPELINE_STATUS.APPLIED]: 'uploaded',
  [PIPELINE_STATUS.AI_SCREENED]: 'analyzed',
  [PIPELINE_STATUS.ASSESSMENT]: 'assessment_pending',
  [PIPELINE_STATUS.LEAD_REVIEW]: 'shortlisted',
  [PIPELINE_STATUS.INTERVIEW]: 'interview_scheduled',
  [PIPELINE_STATUS.OFFER]: 'offer_extended',
  [PIPELINE_STATUS.HIRED]: 'hired',
  [PIPELINE_STATUS.REJECTED]: 'rejected',
};

// Valid transitions by role
interface TransitionRule {
  from: PipelineStatus[];
  to: PipelineStatus[];
  requiresNotes: boolean;
  description: string;
}

export const TRANSITION_RULES: Record<UserRole, TransitionRule[]> = {
  [USER_ROLE.AI]: [
    {
      from: [PIPELINE_STATUS.APPLIED],
      to: [PIPELINE_STATUS.AI_SCREENED],
      requiresNotes: false,
      description: 'AI can only move candidates from Applied to AI Screened',
    },
  ],
  [USER_ROLE.TEAM_LEAD]: [
    {
      from: [PIPELINE_STATUS.AI_SCREENED, PIPELINE_STATUS.LEAD_REVIEW],
      to: [PIPELINE_STATUS.LEAD_REVIEW, PIPELINE_STATUS.INTERVIEW, PIPELINE_STATUS.REJECTED],
      requiresNotes: true,
      description: 'Team Lead can approve/reject candidates in AI Screened or Lead Review stages',
    },
  ],
  [USER_ROLE.HR]: [
    {
      from: [PIPELINE_STATUS.APPLIED],
      to: [PIPELINE_STATUS.AI_SCREENED, PIPELINE_STATUS.REJECTED],
      requiresNotes: false,
      description: 'HR can trigger AI screening or reject early',
    },
    {
      from: [PIPELINE_STATUS.AI_SCREENED],
      to: [PIPELINE_STATUS.LEAD_REVIEW, PIPELINE_STATUS.REJECTED],
      requiresNotes: false,
      description: 'HR can move to lead review or reject',
    },
    {
      from: [PIPELINE_STATUS.LEAD_REVIEW],
      to: [PIPELINE_STATUS.INTERVIEW, PIPELINE_STATUS.REJECTED],
      requiresNotes: false,
      description: 'HR can schedule interviews or reject',
    },
    {
      from: [PIPELINE_STATUS.INTERVIEW],
      to: [PIPELINE_STATUS.OFFER, PIPELINE_STATUS.REJECTED],
      requiresNotes: false,
      description: 'HR can extend offers or reject after interview',
    },
    {
      from: [PIPELINE_STATUS.OFFER],
      to: [PIPELINE_STATUS.HIRED, PIPELINE_STATUS.REJECTED],
      requiresNotes: false,
      description: 'HR can mark as hired or rejected',
    },
  ],
  [USER_ROLE.ADMIN]: [
    // Admin has all HR permissions plus more
    {
      from: Object.values(PIPELINE_STATUS),
      to: Object.values(PIPELINE_STATUS),
      requiresNotes: false,
      description: 'Admin can perform any transition',
    },
  ],
  [USER_ROLE.SYSTEM]: [
    // System has limited permissions for automated processes
    {
      from: [PIPELINE_STATUS.APPLIED],
      to: [PIPELINE_STATUS.AI_SCREENED],
      requiresNotes: false,
      description: 'System can trigger AI screening',
    },
  ],
};

/**
 * Check if a transition is valid for a given role
 */
export function isValidTransition(
  fromStatus: string,
  toStatus: PipelineStatus,
  role: UserRole
): { valid: boolean; reason?: string; requiresNotes: boolean } {
  const fromPipeline = STATUS_TO_PIPELINE[fromStatus] || fromStatus as PipelineStatus;
  const rules = TRANSITION_RULES[role];

  if (!rules || rules.length === 0) {
    return { valid: false, reason: 'No transition rules defined for this role', requiresNotes: false };
  }

  for (const rule of rules) {
    if (rule.from.includes(fromPipeline) && rule.to.includes(toStatus)) {
      return { valid: true, requiresNotes: rule.requiresNotes };
    }
  }

  return {
    valid: false,
    reason: `${role} cannot move candidates from ${fromPipeline} to ${toStatus}`,
    requiresNotes: false,
  };
}

/**
 * Get allowed next statuses for a candidate based on their current status and user role
 */
export function getAllowedNextStatuses(currentStatus: string, role: UserRole): PipelineStatus[] {
  const currentPipeline = STATUS_TO_PIPELINE[currentStatus] || currentStatus as PipelineStatus;
  const rules = TRANSITION_RULES[role];
  const allowedStatuses: Set<PipelineStatus> = new Set();

  if (!rules) return [];

  for (const rule of rules) {
    if (rule.from.includes(currentPipeline)) {
      rule.to.forEach(status => allowedStatuses.add(status));
    }
  }

  return Array.from(allowedStatuses);
}

/**
 * Validate that background verification is only enabled after Offer stage
 */
export function canStartBackgroundVerification(status: string): boolean {
  const pipeline = STATUS_TO_PIPELINE[status] || status as PipelineStatus;
  return pipeline === PIPELINE_STATUS.OFFER || pipeline === PIPELINE_STATUS.HIRED;
}

/**
 * Check if a candidate can be converted to employee
 */
export function canConvertToEmployee(status: string): boolean {
  const pipeline = STATUS_TO_PIPELINE[status] || status as PipelineStatus;
  return pipeline === PIPELINE_STATUS.HIRED;
}

/**
 * Get ATS score recommendation based on score
 * ATS score is advisory only - never makes final decisions
 */
export function getATSRecommendation(score: number): {
  recommendation: 'suggest_shortlist' | 'suggest_review' | 'suggest_reject';
  confidence: 'high' | 'medium' | 'low';
  message: string;
} {
  if (score >= 80) {
    return {
      recommendation: 'suggest_shortlist',
      confidence: 'high',
      message: 'Strong match - recommend for team lead review',
    };
  } else if (score >= 60) {
    return {
      recommendation: 'suggest_shortlist',
      confidence: 'medium',
      message: 'Good match - recommend for team lead review',
    };
  } else if (score >= 40) {
    return {
      recommendation: 'suggest_review',
      confidence: 'medium',
      message: 'Moderate match - manual review recommended',
    };
  } else {
    return {
      recommendation: 'suggest_reject',
      confidence: 'low',
      message: 'Low match - review recommended before rejection',
    };
  }
}

/**
 * Rate limit safeguard - track AI calls
 */
const aiCallTracker: Map<string, { count: number; resetAt: number }> = new Map();
const MAX_AI_CALLS_PER_MINUTE = 10;
const RATE_LIMIT_WINDOW_MS = 60000;

export function canMakeAICall(candidateId: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const tracker = aiCallTracker.get(candidateId);

  if (!tracker || now > tracker.resetAt) {
    aiCallTracker.set(candidateId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (tracker.count >= MAX_AI_CALLS_PER_MINUTE) {
    return { allowed: false, retryAfterMs: tracker.resetAt - now };
  }

  tracker.count++;
  return { allowed: true };
}

/**
 * Reset rate limiter for a candidate
 */
export function resetAICallLimit(candidateId: string): void {
  aiCallTracker.delete(candidateId);
}

/**
 * Workflow validation helpers
 */
export const WorkflowValidation = {
  /**
   * Prevent infinite loops in status changes
   */
  maxStatusChangesPerSession: 10,
  statusChangeCounter: new Map<string, number>(),

  trackStatusChange(candidateId: string): boolean {
    const count = this.statusChangeCounter.get(candidateId) || 0;
    if (count >= this.maxStatusChangesPerSession) {
      console.warn(`Max status changes reached for candidate ${candidateId}`);
      return false;
    }
    this.statusChangeCounter.set(candidateId, count + 1);
    return true;
  },

  resetSession(): void {
    this.statusChangeCounter.clear();
  },
};
