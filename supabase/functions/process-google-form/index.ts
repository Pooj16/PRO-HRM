import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🔥 Google Form processing function triggered');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    console.log('📝 Form submission received:', JSON.stringify(requestBody, null, 2));

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Handle different request formats - check if this is a candidateId update or new form submission
    let candidateData;
    
    if (requestBody.candidateId) {
      // This is an existing candidate with a resume URL to process
      console.log('📋 Processing existing candidate:', requestBody.candidateId);
      
      candidateData = {
        candidateId: requestBody.candidateId,
        resume_url: requestBody.resumeUrl || requestBody.resume_url,
        isUpdate: true
      };
    } else {
      // This is a new form submission
      candidateData = {
        name: requestBody.name || requestBody['Name'] || requestBody['Full Name'] || requestBody['Candidate Name'],
        email: requestBody.email || requestBody['Email'] || requestBody['Email Address'] || requestBody['Contact Email'],
        phone: requestBody.phone || requestBody['Phone'] || requestBody['Phone Number'] || requestBody.phone_number,
        dob: requestBody.dob || requestBody['Date of Birth'] || requestBody.date_of_birth,
        position: requestBody.position || requestBody['Position'] || requestBody['Job Role'] || 'Not specified',
        resume_url: requestBody.resumeUrl || requestBody['Resume URL'] || requestBody.resume_url || requestBody['Resume Link'],
        experience: requestBody.experience || requestBody['Experience'] || requestBody['Years of Experience'] || 'Not specified',
        location: requestBody.location || requestBody['Location'] || requestBody['Current Location'] || 'Not specified',
        skills: requestBody.skills || requestBody['Skills'] || requestBody['Technical Skills'] || 'Not specified',
        education: requestBody.education || requestBody['Education'] || requestBody['Educational Background'] || 'Not specified',
        isUpdate: false
      };
    }

    console.log('Extracted candidate data:', candidateData);

    let candidate;
    
    if (candidateData.isUpdate) {
      // Update existing candidate with resume URL
      console.log('🔄 Updating existing candidate...');
      
      const { data: updatedCandidate, error: updateError } = await supabase
        .from('candidates')
        .update({ 
          resume_url: candidateData.resume_url,
          status: 'uploaded'
        })
        .eq('id', candidateData.candidateId)
        .select()
        .single();
        
      if (updateError) {
        console.error('❌ Error updating candidate:', updateError);
        throw updateError;
      }
      
      candidate = updatedCandidate;
      console.log('✅ Candidate updated successfully:', candidate.id);
    } else {
      // Validate required fields for new candidates
      if (!candidateData.name || !candidateData.email) {
        console.error('Missing required fields:', { name: candidateData.name, email: candidateData.email });
        throw new Error('Missing required fields: name and email are required');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(candidateData.email)) {
        throw new Error('Invalid email format provided');
      }

      // Insert new candidate into database
      const { data: newCandidate, error: candidateError } = await supabase
        .from('candidates')
        .insert({
          name: candidateData.name,
          email: candidateData.email,
          phone: candidateData.phone,
          dob: candidateData.dob,
          position: candidateData.position,
          resume_url: candidateData.resume_url,
          experience: candidateData.experience,
          location: candidateData.location,
          skills: candidateData.skills,
          education: candidateData.education,
          status: 'uploaded',
          assessment_status: 'pending',
          applied_date: new Date().toISOString(),
          ai_score: 0,
          match_percentage: 0
        })
        .select()
        .single();

      if (candidateError) {
        console.error('❌ Error creating candidate:', candidateError);
        throw candidateError;
      }

      candidate = newCandidate;
      console.log('✅ Candidate created successfully with ID:', candidate.id);
    }

    // IMMEDIATE synchronous resume text extraction if resume URL exists
    if (candidateData.resume_url && candidateData.resume_url.trim() !== '') {
      console.log('🚀 STARTING IMMEDIATE SYNCHRONOUS RESUME TEXT EXTRACTION...');
      
      // Set status to extracting first
      await supabase
        .from('candidates')
        .update({ status: 'extracting_text' })
        .eq('id', candidate.id);

      // Extract text immediately with retry logic
      try {
        const extractionResult = await extractResumeTextWithRetries(candidateData.resume_url, candidate.id, supabase);
        console.log('✅ Text extraction completed successfully:', extractionResult);
      } catch (error) {
        console.error('❌ Text extraction failed:', error);
        await supabase
          .from('candidates')
          .update({ 
            status: 'extraction_failed',
            resume_text: `Text extraction failed: ${error.message}`
          })
          .eq('id', candidate.id);
      }
    } else {
      console.log('⚠️ No resume URL provided');
      await supabase
        .from('candidates')
        .update({ 
          status: 'no_resume',
          resume_text: 'No resume URL provided'
        })
        .eq('id', candidate.id);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Candidate processed successfully - resume extraction in progress',
      candidateId: candidate.id,
      status: candidateData.resume_url ? 'extracting_text' : 'no_resume',
      hasResume: !!candidateData.resume_url
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Form processing error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function extractResumeTextWithRetries(resumeUrl: string, candidateId: string, supabase: any) {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      console.log(`🔄 Starting text extraction attempt ${attempt + 1}/${maxRetries} for candidate ${candidateId}`);
      console.log(`📄 Resume URL: ${resumeUrl}`);
      
      const { data, error } = await supabase.functions.invoke('extract-resume-text-openai', {
        body: {
          resumeUrl: resumeUrl,
          candidateId: candidateId
        }
      });

      if (error) {
        throw new Error(error.message || 'Function invocation failed');
      }

      if (!data || !data.success) {
        throw new Error(data?.error || 'Text extraction failed');
      }

      console.log(`✅ Text extraction completed for candidate ${candidateId}`);
      console.log('Extraction result:', data);
      return data; // Success - return result

    } catch (error) {
      attempt++;
      console.error(`❌ Extraction attempt ${attempt} failed:`, error);
      
      if (attempt >= maxRetries) {
        console.error(`❌ All ${maxRetries} attempts failed for candidate ${candidateId}`);
        throw error;
      } else {
        // Wait before retry with exponential backoff
        const waitTime = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
        console.log(`⏳ Waiting ${waitTime}ms before retry ${attempt + 1}...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
}
