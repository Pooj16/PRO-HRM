// Utility helpers for token generation and hashing
export async function randomToken(length = 48): Promise<string> {
  // Generate cryptographically secure random bytes and return base64url string
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  // base64url
  const b64 = btoa(String.fromCharCode(...Array.from(buf)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256Hex(message: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(message);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(hash));
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}
