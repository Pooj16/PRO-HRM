/**
 * IP Address Validation and Session Security Utilities
 * Detects suspicious IP changes and validates session continuity
 * 
 * Usage:
 * ```typescript
 * const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
 * const sessionId = assessmentSession.id;
 * 
 * // Check if IP has changed during assessment
 * const ipChangeEvent = await checkIpChange(supabaseClient, sessionId, clientIp);
 * if (ipChangeEvent) {
 *   // Log as anti-cheat event
 *   await logAntiCheatEvent(supabaseClient, sessionId, 'ip_change', { 
 *     previousIp: ipChangeEvent.previousIp,
 *     currentIp: ipChangeEvent.currentIp 
 *   });
 * }
 * ```
 */

interface IpChangeEvent {
  previousIp: string;
  currentIp: string;
  detectedAt: Date;
  changeCount: number;
}

interface SessionIpValidation {
  isValid: boolean;
  ipChanged: boolean;
  previousIp: string;
  currentIp: string;
  changeCount: number;
}

/**
 * Get client IP from request headers
 * Checks multiple header sources for proxy scenarios
 * @param req - The incoming request
 * @returns Client IP address
 */
export function getClientIpFromRequest(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  const clientIp = req.headers.get('client-ip');
  if (clientIp) {
    return clientIp;
  }

  return 'unknown';
}

/**
 * Check if assessment session IP has changed
 * @param supabaseClient - Supabase client
 * @param sessionId - Assessment session ID
 * @param currentIp - Current client IP
 * @returns IpChangeEvent if IP has changed, null if unchanged
 */
export async function checkIpChange(
  supabaseClient: any,
  sessionId: string,
  currentIp: string
): Promise<IpChangeEvent | null> {
  try {
    // Get assessment session details
    const { data: session, error: sessionError } = await supabaseClient
      .from('assessment_sessions')
      .select('client_ip, ip_change_count')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      console.error('Failed to fetch assessment session:', sessionError);
      return null;
    }

    if (!session) {
      console.warn('Assessment session not found:', sessionId);
      return null;
    }

    const previousIp = session.client_ip || 'unknown';
    const changeCount = (session.ip_change_count || 0) + 1;

    // Check if IP has changed
    if (previousIp !== 'unknown' && previousIp !== currentIp) {
      return {
        previousIp,
        currentIp,
        detectedAt: new Date(),
        changeCount
      };
    }

    return null;
  } catch (error) {
    console.error('Error checking IP change:', error);
    return null;
  }
}

/**
 * Validate session IP consistency
 * @param supabaseClient - Supabase client
 * @param sessionId - Assessment session ID
 * @param currentIp - Current client IP
 * @returns Validation result
 */
export async function validateSessionIp(
  supabaseClient: any,
  sessionId: string,
  currentIp: string
): Promise<SessionIpValidation> {
  try {
    const ipChangeEvent = await checkIpChange(supabaseClient, sessionId, currentIp);
    
    return {
      isValid: !ipChangeEvent, // Valid if no IP change detected
      ipChanged: !!ipChangeEvent,
      previousIp: ipChangeEvent?.previousIp || 'unknown',
      currentIp,
      changeCount: ipChangeEvent?.changeCount || 0
    };
  } catch (error) {
    console.error('Error validating session IP:', error);
    return {
      isValid: true, // Fail open
      ipChanged: false,
      previousIp: 'unknown',
      currentIp,
      changeCount: 0
    };
  }
}

/**
 * Update session IP address
 * @param supabaseClient - Supabase client
 * @param sessionId - Assessment session ID
 * @param ipAddress - New IP address
 * @returns Success status
 */
export async function updateSessionIp(
  supabaseClient: any,
  sessionId: string,
  ipAddress: string
): Promise<boolean> {
  try {
    const { error } = await supabaseClient
      .from('assessment_sessions')
      .update({
        client_ip: ipAddress,
        last_activity_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (error) {
      console.error('Failed to update session IP:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating session IP:', error);
    return false;
  }
}

/**
 * Log anti-cheat event for suspicious activity
 * @param supabaseClient - Supabase client
 * @param sessionId - Assessment session ID
 * @param eventType - Type of event (ip_change, tab_switch, fullscreen_exit, etc)
 * @param details - Event-specific details
 * @param severity - Event severity (info, warning, critical)
 * @returns Success status
 */
export async function logAntiCheatEvent(
  supabaseClient: any,
  sessionId: string,
  eventType: 'tab_switch' | 'fullscreen_exit' | 'mouse_leave' | 'ip_change' | 'proctoring_start' | 'proctoring_stop',
  details: Record<string, any> = {},
  severity: 'info' | 'warning' | 'critical' = 'warning'
): Promise<boolean> {
  try {
    const { error } = await supabaseClient
      .from('assessment_anti_cheat')
      .insert({
        assessment_session_id: sessionId,
        event_type: eventType,
        details: JSON.stringify(details),
        severity: severity,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Failed to log anti-cheat event:', error);
      return false;
    }

    console.log(`Anti-cheat event logged: ${eventType} for session ${sessionId}`);
    return true;
  } catch (error) {
    console.error('Error logging anti-cheat event:', error);
    return false;
  }
}

/**
 * Get anti-cheat event count for a session
 * @param supabaseClient - Supabase client
 * @param sessionId - Assessment session ID
 * @param eventType - Optional: filter by event type
 * @returns Event count
 */
export async function getAntiCheatEventCount(
  supabaseClient: any,
  sessionId: string,
  eventType?: string
): Promise<number> {
  try {
    let query = supabaseClient
      .from('assessment_anti_cheat')
      .select('id', { count: 'exact' })
      .eq('assessment_session_id', sessionId);

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    const { count, error } = await query;

    if (error) {
      console.error('Failed to get anti-cheat event count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Error getting anti-cheat event count:', error);
    return 0;
  }
}

/**
 * Check if session should be flagged based on anti-cheat events
 * Flags if: multiple IP changes, or excessive suspicious activity
 * @param supabaseClient - Supabase client
 * @param sessionId - Assessment session ID
 * @returns True if session should be flagged for review
 */
export async function shouldFlagSessionForReview(
  supabaseClient: any,
  sessionId: string
): Promise<boolean> {
  try {
    // Get all critical events
    const criticalEventCount = await getAntiCheatEventCount(supabaseClient, sessionId);
    
    // Get IP change events specifically
    const ipChangeCount = await getAntiCheatEventCount(supabaseClient, sessionId, 'ip_change');

    // Flag if:
    // - 3+ IP changes detected
    // - 10+ total anti-cheat events
    const shouldFlag = ipChangeCount >= 3 || criticalEventCount >= 10;

    if (shouldFlag) {
      console.warn(`Session ${sessionId} flagged for review: ${ipChangeCount} IP changes, ${criticalEventCount} total events`);
    }

    return shouldFlag;
  } catch (error) {
    console.error('Error checking if session should be flagged:', error);
    return false;
  }
}
