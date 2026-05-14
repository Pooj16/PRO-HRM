import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

// Editor helpers: some local TypeScript environments don't include Deno
// globals; declare a lightweight any so editor/typecheck warnings are reduced.
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔥 AI Assistant function triggered');

    const body = await req.json();
    const { candidateId, resumeText: inputResumeText, resumeUrl, jobRequirements, action } = body;

    // candidateId is required for resume analysis flows, but not required for
    // other actions such as assessment generation. Allow it to be optional
    // when action !== 'analyze'.
    if (action === 'analyze' && !candidateId) {
      throw new Error('Missing required parameter: candidateId');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Basic resume text fallback (reuse existing candidate row if available)
    let resumeText = inputResumeText || '';
    let appliedRole = '';
    if (!resumeText || resumeText.length < 50) {
      const { data: candidateData, error: fetchError } = await supabase
        .from('candidates')
        .select('resume_text, resume_url, applied_role')
        .eq('id', candidateId)
        .maybeSingle();

      if (fetchError) {
        console.warn('Could not fetch candidate data:', fetchError.message || fetchError);
      } else {
        resumeText = resumeText || candidateData?.resume_text || '';
        appliedRole = candidateData?.applied_role || '';
      }
    }

    // Build prompt with optional retrieval context (RAG). Retrieval is stubbed —
    // if you have a vector DB or Supabase vector table, wire it here and append context.
    const retrievalContext = await performRetrievalStub(supabase, resumeText, jobRequirements);

    const systemPrompt = Deno.env.get('AI_SYSTEM_PROMPT') || 'You are an expert hiring assistant. Produce structured JSON responses when requested.';

    const userPrompt = buildPrompt({ jobRequirements, resumeText, retrievalContext, action });

    // Call configured provider
    const provider = (Deno.env.get('AI_PROVIDER') || 'openai').toLowerCase();
    const apiKey = Deno.env.get('AI_API_KEY') || '';

    if (!apiKey) {
      console.error('AI_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'AI API key not configured', success: false }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let aiResponseText = '';

    // Handle special actions that require different prompt wiring
    if (action === 'extract_text') {
      // Accept either base64Data + contentType OR a resumeUrl to download
      const { base64Data, contentType, resumeUrl } = body as any;

      if (!base64Data && !resumeUrl) {
        return new Response(JSON.stringify({ error: 'extract_text requires base64Data or resumeUrl', success: false }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Helper to fetch url and convert to base64
      async function fetchUrlAsBase64(url: string) {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Failed to download file: ${resp.status} ${resp.statusText}`);
        const ab = await resp.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(ab);
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
        }
        // deno-lint-ignore no-deprecated-deno-api
        return btoa(binary);
      }

      let payloadBase64 = base64Data;
      let payloadContentType = contentType || 'application/pdf';

      if (!payloadBase64 && resumeUrl) {
        payloadBase64 = await fetchUrlAsBase64(resumeUrl);
        // attempt to guess contentType from URL extension
        if (resumeUrl.endsWith('.txt')) payloadContentType = 'text/plain';
        else if (resumeUrl.endsWith('.html') || resumeUrl.endsWith('.htm')) payloadContentType = 'text/html';
        else if (resumeUrl.endsWith('.pdf')) payloadContentType = 'application/pdf';
      }

      // Use OCR-based extraction for PDFs (custom model)
      console.log('📄 Using OCR model for text extraction...');
      const extractedText = await extractTextWithOCR(payloadBase64, payloadContentType);
      
      // Parse extracted text JSON
      let extractedData;
      try {
        extractedData = typeof extractedText === 'string' ? JSON.parse(extractedText) : extractedText;
      } catch {
        extractedData = { extractedText };
      }
      
      const resumeText = extractedData.extractedText || extractedText || '';
      
      if (!resumeText || resumeText.length < 10) {
        throw new Error('❌ No text extracted from resume');
      }
      
      console.log(`✅ Extracted ${resumeText.length} characters from resume`);
      
      // If analyzing, use trained ATS model to score resume
      if (action === 'analyze') {
        console.log('🤖 Using ATS model for resume scoring...');
        aiResponseText = await callATSService(resumeText, jobRequirements, appliedRole);
      } else {
        aiResponseText = extractedText;
      }

    } else {
      if (provider === 'openai') {
        aiResponseText = await callOpenAI(apiKey, systemPrompt, userPrompt);
      } else if (provider === 'hf' || provider === 'huggingface') {
        aiResponseText = await callHuggingFace(apiKey, Deno.env.get('AI_HF_MODEL') || 'gpt2', systemPrompt, userPrompt);
      } else {
        throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
      }
    }

    // Try to parse JSON from the model output; fallback to raw text
    let parsed;
    let parseError: string | null = null;
    try {
      const jsonMatch = aiResponseText.match(/```json\s*([\s\S]*?)\s*```/) || aiResponseText.match(/```\s*([\s\S]*?)\s*```/) || aiResponseText.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiResponseText;
      parsed = JSON.parse(jsonString.trim());
    } catch (e: any) {
      console.warn('Failed to parse AI response as JSON, returning raw text');
      parseError = String(e?.message || e);
      parsed = { raw: aiResponseText };
    }

    // If action is analyze, update candidate with analysis and also persist raw response + parse error for debugging
    if (action === 'analyze') {
      try {
        const updatePayload: any = {
          ai_raw_response: aiResponseText,
          ai_parse_error: parseError,
          ai_analysis: JSON.stringify(parsed)
        };

        // Only set scores if parsed contains them
        if (parsed && typeof parsed === 'object') {
          if (parsed.ats_score !== undefined) updatePayload.ats_score = parsed.ats_score;
          if (parsed.match_percentage !== undefined) updatePayload.match_percentage = parsed.match_percentage;
          updatePayload.status = 'analyzed';
        }

        await supabase.from('candidates').update(updatePayload).eq('id', candidateId);
      } catch (e: any) {
        console.warn('Failed to update candidate with analysis:', e?.message ? e.message : String(e));
      }
    }

    return new Response(JSON.stringify({ success: true, candidateId, result: parsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ Error in ai-assistant:', error);
    return new Response(JSON.stringify({ error: String(error), success: false }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function performRetrievalStub(supabase: any, resumeText: string, jobRequirements: string | undefined): Promise<string> {
  // Placeholder: optionally implement vector retrieval here (FAISS / Supabase vector / Weaviate).
  // For now, return a short hint based on jobRequirements; this reduces hallucinations and
  // can be replaced later with actual retrieval code.
  if (!jobRequirements) return '';
  return `Context (retrieved docs): ${jobRequirements.slice(0, 800)}`;
}

function buildPrompt({ jobRequirements, resumeText, retrievalContext, action }: any) {
  const roleBlock = jobRequirements ? `ROLE / JOB REQUIREMENTS:\n${jobRequirements}\n\n` : '';
  const resumeBlock = resumeText ? `CANDIDATE RESUME:\n${resumeText}\n\n` : '';

  if (action === 'generate_assessment') {
    return `You are an expert assessment author. Given the role and candidate, generate a structured assessment with questions and a scoring rubric. Respond in JSON with keys: assessment_title, tasks (array of {id, prompt, points}), rubric_notes.` +
      `\n\n${roleBlock}${resumeBlock}${retrievalContext || ''}`;
  }

  // default to analyze
  return `You are a strict, expert ATS analyzer. Provide a JSON object with keys: ats_score (0-100), match_percentage (0-100), strengths (array), improvements (array), matching_skills (array), missing_critical_skills (array), experience_years, education_level, recommendation, detailed_analysis.` +
    `\n\n${roleBlock}${resumeBlock}${retrievalContext || ''}`;
}

async function callOpenAI(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const model = Deno.env.get('AI_OPENAI_MODEL') || 'gpt-4o-mini';
  const url = 'https://api.openai.com/v1/chat/completions';

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], temperature: 0.0, max_tokens: 1500 })
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenAI API error: ${resp.status} ${resp.statusText} - ${text}`);
  }

  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '';
  return String(text);
}

async function callHuggingFace(apiKey: string, model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  // Using Hugging Face Inference API (text generation). Behavior depends on model.
  const url = `https://api-inference.huggingface.co/models/${model}`;
  const prompt = `${systemPrompt}\n\n${userPrompt}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 512, temperature: 0.0 } })
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Hugging Face API error: ${resp.status} ${resp.statusText} - ${text}`);
  }

  const data = await resp.json();
  // HF returns an array of generations or a simple string depending on model
  if (Array.isArray(data) && data[0]?.generated_text) return data[0].generated_text;
  if (Array.isArray(data) && data[0]?.generated_text === undefined && typeof data[0] === 'string') return data[0];
  if (typeof data === 'object' && data.generated_text) return data.generated_text;
  return String(data?.[0]?.generated_text || JSON.stringify(data));
}

// OCR-based text extraction using custom trained model
// This function extracts text from PDFs/images without requiring external APIs
async function extractTextWithOCR(base64Data: string, contentType: string): Promise<string> {
  console.log('🤖 OCR Model: Extracting text from base64-encoded document...');
  
  try {
    // TODO: Replace this with your actual OCR model integration
    // This is the connection point for your custom trained OCR model
    
    // For now, we provide a placeholder that demonstrates how to integrate
    // your custom OCR model. Update this function to:
    // 1. Send base64Data to your OCR model (local service/API/function)
    // 2. Get extracted text back
    // 3. Return it in the format below
    
    // Example placeholder implementation:
    const extractedText = await callCustomOCRModel(base64Data, contentType);
    
    if (!extractedText || extractedText.length < 10) {
      throw new Error('OCR extraction returned empty or very short text');
    }
    
    console.log(`✅ OCR extraction successful. Extracted ${extractedText.length} characters`);
    
    // Return in the expected format
    return JSON.stringify({
      extractedText: extractedText,
      success: true
    });
    
  } catch (error: any) {
    console.error('❌ OCR extraction error:', error?.message || String(error));
    throw error;
  }
}

// Call Python OCR Service for text extraction
// Uses Tesseract OCR (free, open-source, no API keys)
async function callCustomOCRModel(base64Data: string, contentType: string): Promise<string> {
  console.log('📞 Calling OCR Service (Tesseract)...');
  
  const ocrServiceUrl = Deno.env.get('OCR_SERVICE_URL') || 'http://localhost:5002/extract-text';
  
  try {
    console.log(`📤 Sending request to OCR service: ${ocrServiceUrl}`);
    
    const response = await fetch(ocrServiceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        base64_data: base64Data,
        content_type: contentType
      })
    });
  
    if (!response.ok) {
      throw new Error(`OCR service error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    if (!result.success) {
      throw new Error(`OCR extraction failed: ${result.error}`);
    }
    
    console.log(`✅ OCR service returned ${result.length} characters`);
    return result.extracted_text || '';
    
  } catch (error: any) {
    console.error(`❌ OCR service error: ${error?.message || String(error)}`);
    throw error;
  }
}

// Call ATS Scoring Service for resume analysis
// Uses trained ATS model for scoring against job requirements
async function callATSService(resumeText: string, jobRequirements: string | undefined, jobTitle: string | undefined): Promise<string> {
  console.log('📞 Calling ATS Scoring Service...');
  
  const atsServiceUrl = Deno.env.get('ATS_SERVICE_URL') || 'http://localhost:5001/analyze-resume';
  
  try {
    console.log(`📤 Sending resume to ATS service: ${atsServiceUrl}`);
    
    const response = await fetch(atsServiceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        resume_text: resumeText,
        job_requirements: jobRequirements || '',
        role: jobTitle || 'Unknown'
      }),
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
  
    if (!response.ok) {
      console.error(`❌ ATS service returned ${response.status}: ${response.statusText}`);
      // Try fallback analysis
      console.log('⚠️  Using fallback analysis (services may not be running)');
      return generateFallbackAnalysis(resumeText, jobTitle);
    }
    
    const result = await response.json();
    if (!result.success) {
      console.error(`❌ ATS analysis failed: ${result.error}`);
      throw new Error(`ATS analysis failed: ${result.error}`);
    }
    
    console.log(`✅ ATS Analysis complete. Score: ${result.ats_score || 0}%`);
    
    // Return JSON string for parsing
    return JSON.stringify(result);
    
  } catch (error: any) {
    console.error(`❌ ATS service error: ${error?.message || String(error)}`);
    console.log('⚠️  Using fallback analysis (services may not be running)');
    return generateFallbackAnalysis(resumeText, jobTitle);
  }
}

// Fallback analysis when services are not available
// Provides basic scoring based on text analysis
function generateFallbackAnalysis(resumeText: string, jobTitle: string | undefined): string {
  console.log('🔄 Generating fallback ATS analysis...');
  
  const textLength = resumeText.length;
  const hasExperience = /years?.*experience|experience.*years?|worked|employment/i.test(resumeText);
  const hasSkills = /skill|proficient|expertise|capable/i.test(resumeText);
  const hasEducation = /degree|university|college|graduated|bachelor|master/i.test(resumeText);
  const hasAchievements = /led|managed|improved|increased|reduced|built|designed/i.test(resumeText);
  
  let score = 50; // Base score
  if (textLength > 500) score += 10;
  if (textLength > 1000) score += 5;
  if (hasExperience) score += 15;
  if (hasSkills) score += 10;
  if (hasEducation) score += 5;
  if (hasAchievements) score += 10;
  
  score = Math.min(100, Math.max(0, score));
  
  const fallbackResult = {
    ats_score: score,
    match_percentage: score,
    strengths: [
      hasExperience ? 'Has work experience' : 'Resume provided',
      hasSkills ? 'Lists relevant skills' : 'Professional format',
      hasAchievements ? 'Documents achievements' : 'Demonstrates capability'
    ],
    improvements: [
      !hasEducation ? 'Add education details' : undefined,
      textLength < 300 ? 'Resume is too brief - add more details' : undefined,
      !hasAchievements ? 'Include specific achievements and metrics' : undefined
    ].filter(Boolean),
    matching_skills: ['Professional experience', 'Technical knowledge'],
    missing_critical_skills: [],
    experience_years: hasExperience ? 3 : 1,
    education_level: hasEducation ? 'Bachelor\'s Degree' : 'Not specified',
    recommendation: score >= 70 ? 'Recommended' : score >= 50 ? 'Consider' : 'Review manually',
    detailed_analysis: `Fallback analysis (services unavailable). Resume shows ${score}% match potential. Please start OCR and ATS services for full analysis.`
  };
  
  return JSON.stringify(fallbackResult);
}

