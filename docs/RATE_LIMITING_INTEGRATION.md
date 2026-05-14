# Rate Limiting Integration Guide

This guide shows how to integrate the `rateLimitUtils.ts` into edge functions to prevent API abuse.

## Overview

Rate limiting is implemented at the **edge function level** to catch abuse before it reaches the database. Each endpoint has configurable limits (e.g., 10 requests/hour for sensitive operations).

## Pre-Integration Checklist

- ✅ Database table created: `rate_limit_tracking`
- ✅ Utility file created: `supabase/functions/shared/rateLimitUtils.ts`
- ✅ Configuration defined: Built-in limits per endpoint
- ⏳ Integration: Ready to add to edge functions (this guide)

---

## Integration Pattern

### Step 1: Import Rate Limit Utilities

```typescript
import { checkRateLimit, createRateLimitResponse, getRateLimitConfig } from '../shared/rateLimitUtils.ts';
```

### Step 2: Extract Client Info

```typescript
// Get client IP from request headers (try multiple sources)
const clientIp = req.headers.get('x-forwarded-for') || 
                 req.headers.get('cf-connecting-ip') || 
                 'unknown';

// Get user ID from JWT
const { data: { user } } = await supabase.auth.getUser();
const userId = user?.id || 'anonymous';
```

### Step 3: Check Rate Limit

```typescript
// Get pre-configured limits for this endpoint
const config = getRateLimitConfig('create-assessment-session');

// Check if user has exceeded limit
const result = await checkRateLimit(
  supabaseClient,
  userId,
  'create-assessment-session',
  clientIp,
  config.maxRequests,
  config.windowSeconds
);

// If rate limited, return 429 error
if (!result.allowed) {
  return createRateLimitResponse(result, 
    'Too many assessment creation requests. Please try again later.'
  );
}
```

### Step 4: Continue with normal processing

```typescript
// If rate limit check passed, continue with function logic
const response = await createAssessmentSession(...);
return new Response(JSON.stringify(response), { status: 200 });
```

---

## Full Example: create-assessment-session

Here's how to update the `create-assessment-session` edge function:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, createRateLimitResponse, getRateLimitConfig } from '../shared/rateLimitUtils.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ==== RATE LIMITING START ====
    const clientIp = req.headers.get('x-forwarded-for') || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';
    
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || 'anonymous';

    const config = getRateLimitConfig('create-assessment-session');
    const rateLimitResult = await checkRateLimit(
      supabase,
      userId,
      'create-assessment-session',
      clientIp,
      config.maxRequests,
      config.windowSeconds
    );

    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult,
        'Too many assessment creation requests. Please try again later.'
      );
    }
    // ==== RATE LIMITING END ====

    // Parse request body
    const { candidate_id, assessment_id } = await req.json();

    // Validate inputs
    if (!candidate_id || !assessment_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400 }
      );
    }

    // Create assessment session (existing logic)
    const { data, error } = await supabase
      .from('assessment_sessions')
      .insert({
        candidate_id,
        assessment_id,
        status: 'active'
      })
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }

    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
});
```

---

## Edge Functions to Update

### High Priority (Sensitive Operations)

#### 1. **create-assessment-session** 
- Limit: 10/hour
- Impact: Prevent session spam
- Risk: Candidates starting multiple assessments
- Code: See full example above

#### 2. **validate-assessment-token**
- Limit: 30/hour
- Impact: Prevent token enumeration
- Risk: Attackers trying to find valid tokens
- Implementation:
```typescript
const config = getRateLimitConfig('validate-assessment-token');
const result = await checkRateLimit(supabase, userId, 'validate-assessment-token', clientIp, config.maxRequests, config.windowSeconds);
if (!result.allowed) return createRateLimitResponse(result);
```

#### 3. **submit-assessment**
- Limit: 5/hour
- Impact: Prevent spam submissions
- Risk: Repeated assessment attempts
- Implementation: Same pattern, different endpoint name

#### 4. **save-assessment-response**
- Limit: 100/minute
- Impact: Allow rapid saves (normal), block excessive
- Risk: Stress testing the save endpoint
- Implementation: Same pattern, different endpoint name

### Medium Priority (Admin Operations)

#### 5. **get-candidate-assessment**
- Limit: 100/hour
- Impact: Prevent dashboard spam
- Risk: Dashboard query bombs
- Implementation: Same pattern

#### 6. **generate-assessment**
- Limit: 20/hour
- Impact: Prevent AI service overload
- Risk: Generating too many assessments at once
- Implementation: Same pattern

---

## Testing Rate Limits

### Manual Testing (Using curl)

```bash
# Test create-assessment-session rate limit
# Try 11 requests (limit is 10/hour) - should succeed 10 times, fail on 11th

for i in {1..12}; do
  curl -X POST http://localhost:54321/functions/v1/create-assessment-session \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"candidate_id":"test","assessment_id":"test"}' \
    -w "\nAttempt $i: HTTP Status %{http_code}\n"
  
  sleep 1
done

# Expected: First 10 succeed (200), 11th+ fail (429)
```

### Programmatic Testing

```typescript
// In your test file
async function testRateLimit() {
  const userId = 'test-user-id';
  const endpoint = 'create-assessment-session';
  let allowedCount = 0;
  let deniedCount = 0;

  for (let i = 0; i < 15; i++) {
    const result = await checkRateLimit(
      supabase,
      userId,
      endpoint,
      '127.0.0.1',
      10,  // 10 requests
      3600 // per hour
    );

    if (result.allowed) {
      allowedCount++;
    } else {
      deniedCount++;
      console.log(`Denied at request ${i + 1}`);
      console.log(`Remaining: ${result.remaining}`);
      console.log(`Reset at: ${result.resetAt}`);
    }
  }

  console.log(`Allowed: ${allowedCount}, Denied: ${deniedCount}`);
  // Expected: Allowed: 10, Denied: 5
}
```

---

## Configuration

### How to Customize Limits

Edit `supabase/functions/shared/rateLimitUtils.ts`, function `getRateLimitConfig()`:

```typescript
export function getRateLimitConfig(endpoint: string): RateLimitConfig {
  const limits: Record<string, RateLimitConfig> = {
    // Assessment endpoints
    'create-assessment-session': { maxRequests: 10, windowSeconds: 3600 }, // ← Change here
    'validate-assessment-token': { maxRequests: 30, windowSeconds: 3600 },
    
    // ... other endpoints
    
    'default': { maxRequests: 100, windowSeconds: 3600 }
  };

  return limits[endpoint] || limits['default'];
}
```

### Window Size Reference

```
windowSeconds = 60      → Per minute limit
windowSeconds = 300     → Per 5 minutes
windowSeconds = 3600    → Per hour (default)
windowSeconds = 86400   → Per day
```

---

## Response Headers

When rate limit is applied, the response includes helpful headers:

```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1645305600
Retry-After: 3600
Content-Type: application/json

{
  "error": "Rate limit exceeded. Please try again later.",
  "resetAt": "2025-02-21T10:00:00.000Z",
  "retryAfter": 3600
}
```

### Header Meanings
- `X-RateLimit-Remaining` - Requests left in current window
- `X-RateLimit-Reset` - Unix timestamp when limit resets
- `Retry-After` - Seconds to wait before retrying

---

## Database Monitoring

### Check Rate Limit Status

```sql
-- See all rate limit tracking records
SELECT * FROM rate_limit_tracking;

-- See who's being rate limited most
SELECT user_id, endpoint, request_count, window_start
FROM rate_limit_tracking
WHERE request_count > 5
ORDER BY request_count DESC;

-- See requests in current hour for specific endpoint
SELECT user_id, endpoint, request_count
FROM rate_limit_tracking
WHERE endpoint = 'create-assessment-session'
  AND window_start > now() - interval '1 hour'
ORDER BY request_count DESC;

-- Clean up old tracking records (manual)
DELETE FROM rate_limit_tracking
WHERE window_start < now() - interval '24 hours';
```

---

## Error Handling

### When Rate Limit Check Fails

If the rate limit check fails (e.g., database is down), the utility **fails open** - it allows the request to continue.

```typescript
// In rateLimitUtils.ts
catch (error) {
  console.error('Rate limit check error:', error);
  // Fail open - allow the request
  return {
    allowed: true,
    remaining: maxRequests - 1,
    resetAt: new Date(Date.now() + 3600000)
  };
}
```

This ensures users aren't locked out if the rate limit service is unavailable.

---

## Deployment Steps

1. **Update Edge Functions** (estimated: 30 minutes)
   - Add rate limit check to 6 functions (patterns are identical)
   - Copy-paste the code snippet from each section
   - Test locally with `supabase functions serve`

2. **Deploy to Staging**
   ```bash
   supabase functions deploy create-assessment-session
   supabase functions deploy validate-assessment-token
   supabase functions deploy submit-assessment
   supabase functions deploy save-assessment-response
   supabase functions deploy get-candidate-assessment
   supabase functions deploy generate-assessment
   ```

3. **Test in Staging**
   - Use manual testing script (curl loop above)
   - Verify 429 errors on exceeded limits
   - Check Retry-After headers are correct

4. **Monitor in Production**
   ```sql
   -- Watch rate limit hits
   SELECT endpoint, COUNT(*) as denied_requests, MAX(created_at)
   FROM rate_limit_tracking
   WHERE request_count >= (SELECT maxRequests FROM limit_config WHERE endpoint = rate_limit_tracking.endpoint)
   GROUP BY endpoint
   ORDER BY denied_requests DESC;
   ```

---

## Performance Notes

- **Database Calls:** Each rate limit check = 1-2 DB queries
- **Latency Impact:** ~10-50ms per request (minimal)
- **Cache:** Could add Redis caching for 10x speed (optional optimization)
- **Scalability:** Good for 1000s of concurrent users

---

## Troubleshooting

### Issue: Rate limit check always returns `allowed: false`

**Check:**
1. Is `rate_limit_tracking` table created? `SELECT * FROM rate_limit_tracking LIMIT 1;`
2. Does user have permission to insert? Check RLS policies
3. Is window size too small? (60 seconds vs 3600 seconds)

**Fix:**
```sql
-- Verify table exists and is accessible
SELECT * FROM rate_limit_tracking LIMIT 1;

-- If RLS is blocking, temporarily disable (not recommended for production)
-- ALTER TABLE rate_limit_tracking DISABLE ROW LEVEL SECURITY;
```

### Issue: Rate limiting is too strict

**Fix:** Increase `maxRequests` or `windowSeconds` in `getRateLimitConfig()`:
```typescript
'create-assessment-session': { maxRequests: 20, windowSeconds: 3600 }, // Increased from 10
```

### Issue: Need to reset rate limit for specific user

**Manual Reset:**
```sql
DELETE FROM rate_limit_tracking
WHERE user_id = 'specific-user-id'
  AND endpoint = 'create-assessment-session';
```

---

## Best Practices

1. **Monitor Denied Requests** - Set up alerts if denied count > threshold
2. **Tune Limits Gradually** - Start conservative, increase if needed
3. **Log Rate Limit Hits** - Useful for detecting attacks
4. **Test Before Deploy** - Use the curl loop test script
5. **Document Limits** - Keep this guide updated when changing limits

---

**Next Step:** Choose one edge function to start with (recommend `create-assessment-session`), update it following the full example above, test locally, then deploy!
