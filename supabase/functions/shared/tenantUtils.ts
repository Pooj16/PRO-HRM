import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

export function serviceClient() {
  return createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
}

export async function candidateOrganization(db: any, candidateId: string): Promise<string> {
  const { data, error } = await db.from("candidates").select("organization_id").eq("id", candidateId).single();
  if (error || !data?.organization_id) throw new Error("Candidate organization not found");
  return data.organization_id;
}

export async function sessionOrganization(db: any, sessionId: string): Promise<string> {
  const { data, error } = await db.from("assessment_sessions").select("organization_id").eq("id", sessionId).single();
  if (error || !data?.organization_id) throw new Error("Assessment session organization not found");
  return data.organization_id;
}

export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
