import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sha256 } from "../shared/tenantUtils.ts";

declare const Deno: any;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const acceptedTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-160);
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const siteSlug =
      typeof body.siteSlug === "string" ? body.siteSlug : "careers";
    const { data: site } = await supabase
      .from("career_sites")
      .select("organization_id")
      .eq("slug", siteSlug)
      .eq("is_published", true)
      .maybeSingle();
    if (!site?.organization_id)
      return json({ error: "Unknown careers site" }, 404);
    const organizationId = site.organization_id;
    if (body.action === "create_upload") {
      if (!body.fileName || !body.contentType || !body.fileSize)
        return json({ error: "File metadata is required" }, 400);
      if (body.fileSize > 10 * 1024 * 1024 || body.fileSize < 1)
        return json({ error: "Resume file must be smaller than 10 MB" }, 400);
      if (!acceptedTypes.has(body.contentType))
        return json(
          { error: "Only PDF, DOC, and DOCX resumes are allowed" },
          400,
        );
      const path = `${organizationId}/applications/${crypto.randomUUID()}/${safeName(body.fileName)}`;
      const { data, error } = await supabase.storage
        .from("resumes")
        .createSignedUploadUrl(path);
      if (error || !data)
        return json(
          { error: error?.message ?? "Could not prepare upload" },
          500,
        );
      return json({ path, token: data.token, signedUrl: data.signedUrl });
    }

    if (body.action !== "submit") return json({ error: "Unknown action" }, 400);
    const { name, email, phone, position, resumePath } = body;
    if (
      ![name, email, position, resumePath].every(
        (value) => typeof value === "string" && value.trim(),
      )
    )
      return json(
        { error: "Name, email, position, and resume are required" },
        400,
      );
    if (!resumePath.startsWith(`${organizationId}/applications/`))
      return json({ error: "Invalid resume upload" }, 400);
    const { data: object, error: objectError } = await supabase.storage
      .from("resumes")
      .list(resumePath.split("/").slice(0, -1).join("/"), {
        search: resumePath.split("/").pop(),
        limit: 1,
      });
    if (objectError || !object?.length)
      return json({ error: "Resume upload could not be verified" }, 400);

    const normalizedEmail = email.trim().toLowerCase();
    const { data: existing } = await supabase
      .from("candidates")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("email", normalizedEmail)
      .eq("is_deleted", false)
      .maybeSingle();
    if (existing)
      return json(
        { error: "An application with this email already exists" },
        409,
      );

    const processingToken = crypto.randomUUID();
    const { data: candidate, error: insertError } = await supabase
      .from("candidates")
      .insert({
        organization_id: organizationId,
        name: name.trim(),
        email: normalizedEmail,
        phone: phone?.trim() || null,
        applied_role: position.trim(),
        resume_url: resumePath,
        resume_text: null,
        status: "uploaded",
        assessment_status: "pending",
        experience: "Not Specified",
        location: "Not Specified",
        skills: [],
        ats_score: 0,
        match_percentage: 0,
        is_deleted: false,
        applied_date: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (insertError || !candidate)
      return json(
        { error: insertError?.message ?? "Could not create application" },
        500,
      );
    const { error: capabilityError } = await supabase
      .from("resume_processing_capabilities")
      .insert({
        organization_id: organizationId,
        candidate_id: candidate.id,
        token_hash: await sha256(processingToken),
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      });
    if (capabilityError) {
      await supabase.from("candidates").delete().eq("id", candidate.id);
      return json({ error: "Could not authorize resume processing" }, 500);
    }
    return json({ candidateId: candidate.id, processingToken });
  } catch (error) {
    console.error("career-application", error);
    return json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      500,
    );
  }
});
