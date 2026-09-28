import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
declare const Deno: any;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
const roleColumn = (role: string) =>
  ({
    Manager: "manager_status",
    "University Records": "university_status",
    "Human Resources": "hr_status",
    Reference: "reference_status",
  })[role];

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const db = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    if (
      body.action === "reference_start" ||
      body.action === "reference_submit"
    ) {
      const { data: referenceToken } = await db
        .from("bgv_reference_tokens")
        .select(
          "*, contact:bgv_verification_contacts(*, candidate:candidates(id,name,applied_role,education_details,last_employer_details,bgv_status))",
        )
        .eq("token", body.token)
        .is("consumed_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      const contact = referenceToken?.contact;
      if (
        !contact?.candidate ||
        !roleColumn(body.role) ||
        referenceToken.recipient_role !== body.role
      )
        return response({ error: "Invalid verification link" }, 404);
      const column = roleColumn(body.role)!;
      if (body.action === "reference_start") {
        if (contact[column] !== "Pending")
          return response(
            { error: "This verification request has already been completed." },
            409,
          );
        return response({ candidate: contact.candidate });
      }
      if (!["Verified", "Flagged"].includes(body.status))
        return response({ error: "Invalid verification status" }, 400);
      const { error } = await db
        .from("bgv_verification_contacts")
        .update({ [column]: body.status })
        .eq("id", contact.id)
        .eq(column, "Pending");
      if (error) return response({ error: error.message }, 409);
      await db
        .from("candidates")
        .update({
          bgv_status: body.status === "Flagged" ? "Issue Flagged" : "Verified",
        })
        .eq("id", contact.candidate.id);
      await db
        .from("bgv_reference_tokens")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", referenceToken.id);
      return response({ success: true });
    }
    const { data: candidate } = await db
      .from("candidates")
      .select("id,name,bgv_status,token_expiry,organization_id")
      .eq("upload_token", body.token)
      .maybeSingle();
    if (
      !candidate ||
      !candidate.token_expiry ||
      new Date(candidate.token_expiry) <= new Date() ||
      ["Submitted", "Verified"].includes(candidate.bgv_status)
    )
      return response({ error: "Invalid or expired link" }, 403);
    if (body.action === "start")
      return response({
        candidate: {
          id: candidate.id,
          name: candidate.name,
          bgv_status: candidate.bgv_status,
        },
      });
    if (body.action === "create_upload") {
      if (
        !allowedTypes.has(body.contentType) ||
        !body.fileName ||
        body.fileSize > 10 * 1024 * 1024
      )
        return response(
          { error: "Only PDF, JPG, and PNG documents under 10 MB are allowed" },
          400,
        );
      const name = String(body.fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${candidate.organization_id}/${candidate.id}/${crypto.randomUUID()}-${name}`;
      const { data, error } = await db.storage
        .from("bgv-documents")
        .createSignedUploadUrl(path);
      if (error || !data)
        return response(
          { error: error?.message ?? "Could not prepare upload" },
          500,
        );
      return response({ path, token: data.token });
    }
    if (body.action === "submit") {
      const fields = body.fields ?? {};
      const uploadedDocuments = Array.isArray(body.uploadedDocuments)
        ? body.uploadedDocuments.filter(
            (path: unknown): path is string => typeof path === "string",
          )
        : [];

      if (uploadedDocuments.length === 0) {
        return response(
          { error: "Please upload at least one BGV document" },
          400,
        );
      }

      const allowedPrefix = `${candidate.organization_id}/${candidate.id}/`;

      if (uploadedDocuments.some((path) => !path.startsWith(allowedPrefix))) {
        return response({ error: "Invalid BGV document path" }, 400);
      }

      for (const path of uploadedDocuments) {
        const parts = path.split("/");
        const directory = parts.slice(0, -1).join("/");
        const filename = parts.at(-1);

        if (!filename) {
          return response({ error: "Invalid BGV document path" }, 400);
        }

        const { data: objects, error: listError } = await db.storage
          .from("bgv-documents")
          .list(directory, {
            search: filename,
            limit: 1,
          });

        if (listError || !objects?.some((object) => object.name === filename)) {
          return response(
            { error: "One or more uploaded documents could not be verified" },
            400,
          );
        }
      }
      if (!fields.education_details || !fields.university_email)
        return response(
          { error: "Education details and university email are required" },
          400,
        );
      if (!body.isFresher && !fields.manager_email)
        return response({ error: "Manager email is required" }, 400);
      const { error: candidateError } = await db
        .from("candidates")
        .update({
          education_details: fields.education_details,
          last_employer_details: fields.last_employer_details || null,
          bgv_status: "Submitted",
        })
        .eq("id", candidate.id);
      if (candidateError)
        return response({ error: candidateError.message }, 500);
      const contactPayload = {
        organization_id: candidate.organization_id,
        candidate_id: candidate.id,
        hr_email: fields.hr_email || null,
        manager_email: fields.manager_email || null,
        university_email: fields.university_email,
        reference_email: fields.reference_email || null,
        mail_status: "Ready to Send",
      };
      const { data: existingContact } = await db
        .from("bgv_verification_contacts")
        .select("id")
        .eq("candidate_id", candidate.id)
        .maybeSingle();
      const { error: contactError } = existingContact
        ? await db
            .from("bgv_verification_contacts")
            .update(contactPayload)
            .eq("id", existingContact.id)
        : await db.from("bgv_verification_contacts").insert(contactPayload);
      if (contactError) return response({ error: contactError.message }, 500);
      const contactId =
        existingContact?.id ??
        (
          await db
            .from("bgv_verification_contacts")
            .select("id")
            .eq("candidate_id", candidate.id)
            .single()
        ).data?.id;
      if (!contactId)
        return response(
          { error: "Could not create verification contacts" },
          500,
        );
      const recipientRoles = [
        fields.manager_email ? "Manager" : null,
        fields.university_email ? "University Records" : null,
        fields.hr_email ? "Human Resources" : null,
        fields.reference_email ? "Reference" : null,
      ].filter(Boolean);
      await db
        .from("bgv_reference_tokens")
        .delete()
        .eq("contact_id", contactId);
      const { error: tokenError } = await db
        .from("bgv_reference_tokens")
        .insert(
          recipientRoles.map((recipient_role) => ({
            organization_id: candidate.organization_id,
            contact_id: contactId,
            recipient_role,
            token: crypto.randomUUID(),
            expires_at: candidate.token_expiry,
          })),
        );
      if (tokenError) return response({ error: tokenError.message }, 500);
      return response({ success: true });
    }
    return response({ error: "Unknown action" }, 400);
  } catch (error) {
    return response(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      500,
    );
  }
});
