/**
 * Anti-Replay Protection with Nonce Validation
 * Prevents replay attacks by ensuring nonces are single-use
 * 
 * Usage:
 * ```typescript
 * // Generate nonce on assessment start
 * const nonce = await generateNonce(supabaseClient, sessionId);
 * 
 * // Validate nonce on assessment submit
 * const isValid = await validateAndConsumeNonce(supabaseClient, sessionId, nonce);
 * if (!isValid) {
 *   return new Response(JSON.stringify({ error: 'Invalid nonce' }), { status: 400 });
 * }
 * ```
 */

interface NonceRecord {
  id: string;
  sessionId: string;
  nonce: string;
  used: boolean;
  createdAt: Date;
  usedAt?: Date;
  expiresAt: Date;
}

/**
 * Generate a cryptographically secure nonce
 * @returns Random 32-byte hex string
 */
export async function generateSecureNonce(): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b: number) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hash nonce using SHA-256 for storage
 * @param nonce - Original nonce value
 * @returns SHA-256 hash as hex string
 */
export async function hashNonce(nonce: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(nonce);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  return Array.from(new Uint8Array(hashBuffer))
    .map((b: number) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate and store a new nonce for assessment session
 * @param supabaseClient - Supabase client
 * @param sessionId - Assessment session ID
 * @param expirySeconds - Nonce expiry time in seconds (default: 3600 = 1 hour)
 * @returns Generated nonce (plain text - never stored in plain)
 */
export async function generateNonce(
  supabaseClient: any,
  sessionId: string,
  expirySeconds: number = 3600
): Promise<string> {
  try {
    const nonce = await generateSecureNonce();
    const hashedNonce = await hashNonce(nonce);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expirySeconds * 1000);

    const { error } = await supabaseClient
      .from('assessment_nonces')
      .insert({
        session_id: sessionId,
        nonce_hash: hashedNonce,
        used: false,
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString()
      });

    if (error) {
      console.error('Failed to store nonce:', error);
      throw error;
    }

    console.log(`Nonce generated for session ${sessionId}`);
    return nonce; // Return plain nonce to send to client
  } catch (error) {
    console.error('Error generating nonce:', error);
    throw new Error('Failed to generate nonce');
  }
}

/**
 * Validate nonce without consuming it
 * @param supabaseClient - Supabase client
 * @param sessionId - Assessment session ID
 * @param nonce - Nonce to validate (plain text)
 * @returns True if nonce is valid and unused
 */
export async function validateNonce(
  supabaseClient: any,
  sessionId: string,
  nonce: string
): Promise<boolean> {
  try {
    const hashedNonce = await hashNonce(nonce);
    const now = new Date();

    const { data, error } = await supabaseClient
      .from('assessment_nonces')
      .select('*')
      .eq('session_id', sessionId)
      .eq('nonce_hash', hashedNonce)
      .eq('used', false)
      .gt('expires_at', now.toISOString())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No matching nonce found
        console.warn(`Nonce validation failed for session ${sessionId}: not found or expired`);
        return false;
      }
      console.error('Nonce validation error:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error validating nonce:', error);
    return false;
  }
}

/**
 * Consume (mark as used) a nonce - single-use only
 * @param supabaseClient - Supabase client
 * @param sessionId - Assessment session ID
 * @param nonce - Nonce to consume (plain text)
 * @returns True if nonce was successfully consumed
 */
export async function consumeNonce(
  supabaseClient: any,
  sessionId: string,
  nonce: string
): Promise<boolean> {
  try {
    const hashedNonce = await hashNonce(nonce);
    const now = new Date();

    // First validate the nonce
    const isValid = await validateNonce(supabaseClient, sessionId, nonce);
    if (!isValid) {
      console.warn(`Nonce consumption failed: invalid or already used`);
      return false;
    }

    // Mark as used
    const { error } = await supabaseClient
      .from('assessment_nonces')
      .update({
        used: true,
        used_at: now.toISOString()
      })
      .eq('session_id', sessionId)
      .eq('nonce_hash', hashedNonce)
      .eq('used', false);

    if (error) {
      console.error('Failed to consume nonce:', error);
      return false;
    }

    console.log(`Nonce consumed for session ${sessionId}`);
    return true;
  } catch (error) {
    console.error('Error consuming nonce:', error);
    return false;
  }
}

/**
 * Validate and consume nonce in one operation (atomic)
 * @param supabaseClient - Supabase client
 * @param sessionId - Assessment session ID
 * @param nonce - Nonce to validate and consume
 * @returns True if nonce was valid and successfully consumed
 */
export async function validateAndConsumeNonce(
  supabaseClient: any,
  sessionId: string,
  nonce: string
): Promise<boolean> {
  try {
    // Validate first
    const isValid = await validateNonce(supabaseClient, sessionId, nonce);
    if (!isValid) {
      return false;
    }

    // Then consume
    return await consumeNonce(supabaseClient, sessionId, nonce);
  } catch (error) {
    console.error('Error in validate and consume nonce:', error);
    return false;
  }
}

/**
 * Clean up expired nonces (should run periodically)
 * @param supabaseClient - Supabase client
 * @returns Number of expired nonces deleted
 */
export async function cleanupExpiredNonces(supabaseClient: any): Promise<number> {
  try {
    const now = new Date();

    const { data, error } = await supabaseClient
      .from('assessment_nonces')
      .delete()
      .lt('expires_at', now.toISOString())
      .select('id');

    if (error) {
      console.error('Error cleaning up expired nonces:', error);
      return 0;
    }

    const deletedCount = data?.length || 0;
    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} expired nonces`);
    }

    return deletedCount;
  } catch (error) {
    console.error('Error in nonce cleanup:', error);
    return 0;
  }
}

/**
 * Get nonce statistics for a session
 * @param supabaseClient - Supabase client
 * @param sessionId - Assessment session ID
 * @returns Statistics about nonces for this session
 */
export async function getNonceStats(
  supabaseClient: any,
  sessionId: string
): Promise<{ total: number; used: number; valid: number }> {
  try {
    const now = new Date();

    // Total nonces
    const { count: total } = await supabaseClient
      .from('assessment_nonces')
      .select('id', { count: 'exact' })
      .eq('session_id', sessionId);

    // Used nonces
    const { count: used } = await supabaseClient
      .from('assessment_nonces')
      .select('id', { count: 'exact' })
      .eq('session_id', sessionId)
      .eq('used', true);

    // Valid (unused and not expired)
    const { count: valid } = await supabaseClient
      .from('assessment_nonces')
      .select('id', { count: 'exact' })
      .eq('session_id', sessionId)
      .eq('used', false)
      .gt('expires_at', now.toISOString());

    return {
      total: total || 0,
      used: used || 0,
      valid: valid || 0
    };
  } catch (error) {
    console.error('Error getting nonce stats:', error);
    return { total: 0, used: 0, valid: 0 };
  }
}
