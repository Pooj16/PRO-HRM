import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // @ts-ignore
  try {
    console.log('🔄 Starting career page candidate sync...');

    // Connect to main dashboard database using service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Connect to external career page database
    const careerPageUrl = Deno.env.get('CAREER_PAGE_URL')?.trim();
    const careerPageKey = Deno.env.get('CAREER_PAGE_KEY')?.trim();

    console.log('🔍 Career Page URL:', careerPageUrl ? `${careerPageUrl.substring(0, 30)}...` : 'NOT SET');
    console.log('🔍 Career Page Key:', careerPageKey ? 'SET' : 'NOT SET');

    if (!careerPageUrl || !careerPageKey) {
      throw new Error('Career page credentials not configured');
    }

    // Validate URL format
    if (!careerPageUrl.startsWith('https://') && !careerPageUrl.startsWith('http://')) {
      throw new Error(`Invalid CAREER_PAGE_URL format. Must start with https:// or http://. Got: ${careerPageUrl.substring(0, 30)}...`);
    }

    const careerPageDb = createClient(careerPageUrl, careerPageKey);

    // Fetch candidates from career page
    const { data: careerCandidates, error: fetchError } = await careerPageDb
      .from('candidates')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching career page candidates:', fetchError);
      throw fetchError;
    }

    console.log(`📥 Found ${careerCandidates?.length || 0} candidates from career page`);

    if (!careerCandidates || careerCandidates.length === 0) {
      return new Response(JSON.stringify({
        synced: 0,
        skipped: 0,
        errors: 0,
        message: 'No candidates to sync'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch existing emails to check for duplicates
    const { data: existingCandidates } = await supabase
      .from('candidates')
      .select('email');

    const existingEmails = new Set(
      existingCandidates?.map(c => c.email.toLowerCase()) || []
    );

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    // Process each candidate
    for (const candidate of careerCandidates) {
      try {
        if (existingEmails.has(candidate.email.toLowerCase())) {
          console.log(`⏭️  Skipping duplicate: ${candidate.email}`);
          skipped++;
          continue;
        }

        // Handle resume file transfer
        let hrProjectResumeUrl = null;

        if (candidate.resume_url) {
          try {
            console.log(`📥 Downloading resume from career project: ${candidate.resume_url}`);

            // Extract file path from the resume_url stored in career DB
            // It should be just the filename like "1700000-resume.pdf"
            let resumePath = candidate.resume_url;

            // If it's a full URL, extract the path
            if (resumePath.includes('/resumes/')) {
              resumePath = resumePath.split('/resumes/')[1];
            }

            console.log(`📄 Resume path: ${resumePath}`);

            // Download resume from career project's storage
            const { data: resumeFile, error: downloadError } = await careerPageDb.storage
              .from('resumes')
              .download(resumePath);

            if (downloadError) {
              console.warn(`⚠️  Could not download resume: ${downloadError.message}`);
            } else if (resumeFile) {
              // Upload to HR project's storage
              const { data: uploadedFile, error: uploadError } = await supabase.storage
                .from('resumes')
                .upload(resumePath, resumeFile, {
                  upsert: true,
                  contentType: 'application/pdf'
                });

              if (uploadError) {
                console.warn(`⚠️  Could not upload resume to HR project: ${uploadError.message}`);
              } else {
                // Generate public URL for HR project
                const { data: publicUrl } = supabase.storage
                  .from('resumes')
                  .getPublicUrl(resumePath);

                hrProjectResumeUrl = publicUrl?.publicUrl || null;
                console.log(`✅ Resume transferred to HR project: ${resumePath}`);
              }
            }
          } catch (resumeError: any) {
            console.warn(`⚠️  Resume transfer error: ${resumeError.message}`);
          }
        }

        // Map career page data to dashboard format (column names now match)
        const candidateData = {
          name: candidate.name,
          email: candidate.email,
          phone: candidate.phone || null,
          applied_role: candidate.applied_role,
          experience: 'Not Specified',
          location: 'Not Specified',
          skills: [],
          resume_url: hrProjectResumeUrl || candidate.resume_url || null,  // Use HR project URL if available
          resume_text: candidate.resume_text || null,
          status: candidate.resume_text ? 'text_extracted' : 'uploaded',
          assessment_status: 'pending',
          ats_score: candidate.ats_score || 0,
          match_percentage: candidate.ats_score || 0,
          ats_notes: candidate.ats_notes || null,
          applied_date: candidate.created_at,
        };

        // Insert using service role to bypass RLS
        const { data: insertedCandidates, error: insertError } = await supabase
          .from('candidates')
          .insert([candidateData])
          .select()
          .single();

        if (insertError) {
          console.error(`❌ Error inserting ${candidate.email}:`, insertError);
          errors++;
        } else {
          console.log(`✅ Synced: ${candidate.email}`);
          synced++;
          existingEmails.add(candidate.email.toLowerCase());

          // Trigger text extraction if resume_url exists
          if (insertedCandidates && hrProjectResumeUrl && !candidateData.resume_text) {
            console.log(`📄 Triggering text extraction for: ${candidate.email}`);
            try {
              // Call the extract-resume-text-openai function
              const { error: extractError } = await supabase.functions.invoke('extract-resume-text-openai', {
                body: {
                  resumeUrl: hrProjectResumeUrl,
                  candidateId: insertedCandidates.id
                }
              });

              if (extractError) {
                console.warn(`⚠️  Text extraction queued (may process in background): ${extractError.message}`);
              } else {
                console.log(`✅ Text extraction completed for: ${candidate.email}`);
              }
            } catch (extractErr: any) {
              console.warn(`⚠️  Could not trigger text extraction: ${extractErr.message}`);
              // Don't fail the sync if extraction fails - it can be retried later
            }
          }
        }
      } catch (error: any) {
        console.error(`❌ Exception processing ${candidate.email}:`, error);
        errors++;
      }
    }

    const result = { synced, skipped, errors };
    console.log('✨ Sync complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ Sync error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      synced: 0,
      skipped: 0,
      errors: 1
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
