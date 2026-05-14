/**
 * Rate Limiting Utilities for Edge Functions
 * Prevents API abuse with per-user per-endpoint rate limiting
 * 
 * Usage:
 * ```typescript
 * const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
 * const userId = user.id;
 * const endpoint = 'create-assessment-session';
 * 
 * const result = await checkRateLimit(supabaseClient, userId, endpoint, clientIp, 100, 3600);
 * if (!result.allowed) {
 *   return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 });
 * }
 * ```
 */

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

/**
 * Check if a user has exceeded rate limit for an endpoint
 * @param supabaseClient - Supabase client instance
 * @param userId - Unique user identifier
 * @param endpoint - API endpoint name
 * @param clientIp - Client IP address (for logging)
 * @param maxRequests - Maximum requests allowed in window
 * @param windowSeconds - Time window in seconds (default: 3600 = 1 hour)
 * @returns RateLimitResult with allow/deny decision
 */
export async function checkRateLimit(
  supabaseClient: any,
  userId: string,
  endpoint: string,
  clientIp: string,
  maxRequests: number = 100,
  windowSeconds: number = 3600
): Promise<RateLimitResult> {
  // EXEMPTION: service-account (used for automated backend-to-backend flows) is never rate limited
  if (userId === 'service-account') {
    return {
      allowed: true,
      remaining: 999,
      resetAt: new Date(Date.now() + 3600000)
    };
  }

  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowSeconds * 1000);

    // Get existing rate limit record
    const { data: existing, error: fetchError } = await supabaseClient
      .from('rate_limit_tracking')
      .select('*')
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
      .gt('window_start', windowStart.toISOString())
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = no rows found (expected)
      console.error('Rate limit fetch error:', fetchError);
      // On error, allow the request (fail open)
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: new Date(now.getTime() + windowSeconds * 1000)
      };
    }

    if (!existing) {
      // First request in window - create new record
      const { error: insertError } = await supabaseClient
        .from('rate_limit_tracking')
        .insert({
          user_id: userId,
          endpoint: endpoint,
          request_count: 1,
          window_start: now.toISOString(),
          last_request_at: now.toISOString(),
          created_at: now.toISOString()
        });

      if (insertError) {
        console.error('Rate limit insert error:', insertError);
        // Fail open
        return {
          allowed: true,
          remaining: maxRequests - 1,
          resetAt: new Date(now.getTime() + windowSeconds * 1000)
        };
      }

      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: new Date(now.getTime() + windowSeconds * 1000)
      };
    }

    // Existing record - check if limit exceeded
    const newCount = existing.request_count + 1;
    const isAllowed = newCount <= maxRequests;
    const remaining = Math.max(0, maxRequests - newCount);
    const resetAt = new Date(existing.window_start);
    resetAt.setSeconds(resetAt.getSeconds() + windowSeconds);

    // Update the record
    const { error: updateError } = await supabaseClient
      .from('rate_limit_tracking')
      .update({
        request_count: newCount,
        last_request_at: now.toISOString()
      })
      .eq('id', existing.id);

    if (updateError) {
      console.error('Rate limit update error:', updateError);
      // Fail open
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt
      };
    }

    return {
      allowed: isAllowed,
      remaining,
      resetAt,
      retryAfter: !isAllowed ? Math.ceil((resetAt.getTime() - now.getTime()) / 1000) : undefined
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // Fail open - allow the request on error
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: new Date(Date.now() + 3600000)
    };
  }
}

/**
 * Get pre-configured rate limits by endpoint
 * @param endpoint - Endpoint name
 * @returns Rate limit configuration
 */
export function getRateLimitConfig(endpoint: string): RateLimitConfig {
  const limits: Record<string, RateLimitConfig> = {
    // Assessment endpoints - stricter limits
    'create-assessment-session': { maxRequests: 10, windowSeconds: 3600 }, // 10/hour
    'validate-assessment-token': { maxRequests: 30, windowSeconds: 3600 }, // 30/hour
    'submit-assessment': { maxRequests: 5, windowSeconds: 3600 }, // 5/hour
    'save-assessment-response': { maxRequests: 100, windowSeconds: 60 }, // 100/minute for rapid responses

    // Admin endpoints - moderate limits
    'get-candidate-assessment': { maxRequests: 100, windowSeconds: 3600 }, // 100/hour
    'generate-assessment': { maxRequests: 20, windowSeconds: 3600 }, // 20/hour

    // Default - conservative
    'default': { maxRequests: 100, windowSeconds: 3600 } // 100/hour
  };

  return limits[endpoint] || limits['default'];
}

/**
 * Format rate limit headers for response
 * @param result - RateLimitResult from checkRateLimit
 * @returns Headers object
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.floor(result.resetAt.getTime() / 1000))
  };

  if (result.retryAfter !== undefined) {
    headers['Retry-After'] = String(result.retryAfter);
  }

  return headers;
}

/**
 * Create a rate limited response
 * @param result - RateLimitResult
 * @param message - Optional custom message
 * @returns Response with 429 status
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  message: string = 'Rate limit exceeded. Please try again later.'
): Response {
  return new Response(
    JSON.stringify({
      error: message,
      resetAt: result.resetAt.toISOString(),
      retryAfter: result.retryAfter
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        ...getRateLimitHeaders(result)
      }
    }
  );
}
