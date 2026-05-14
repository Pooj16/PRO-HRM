/**
 * Hugging Face ATS Scoring Service
 * Uses: sentence-transformers/all-MiniLM-L6-v2
 * Model: Sentence similarity (returns 0-1 score)
 * 
 * Input: resume text + job description
 * Output: ATS score (0-100)
 */

const HF_MODEL_URL = "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2";

/**
 * Score a resume against a job description using Hugging Face
 * @param resumeText - Full text of resume
 * @param jobDescription - Job description or role
 * @returns ATS score (0-100)
 */
export async function scoreResumeWithHF(
  resumeText: string,
  jobDescription: string
): Promise<number> {
  const apiKey = import.meta.env.VITE_HF_API_KEY;
  
  if (!apiKey) {
    console.error("❌ VITE_HF_API_KEY not found in environment variables");
    throw new Error("Hugging Face API key not configured");
  }

  if (!resumeText || !jobDescription) {
    console.error("❌ Resume text or job description is empty");
    throw new Error("Resume text and job description are required");
  }

  try {
    console.log("📡 Calling Hugging Face for ATS scoring...");
    
    const response = await fetch(HF_MODEL_URL, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({
        inputs: {
          source_sentence: jobDescription.substring(0, 512), // Limit to 512 chars
          sentences: [resumeText.substring(0, 512)], // Limit to 512 chars
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ HF API error:", errorData);
      throw new Error(`Hugging Face API error: ${response.statusText}`);
    }

    const result = await response.json();
    
    // Result is a single similarity score (0-1)
    // If result is an array, take the first element
    const similarityScore = Array.isArray(result) ? result[0] : result;
    
    // Convert 0-1 to 0-100
    const atsScore = Math.round(similarityScore * 100);
    
    console.log(`✅ ATS Score: ${atsScore}/100`);
    return atsScore;

  } catch (error) {
    console.error("❌ Error calling Hugging Face:", error);
    throw error;
  }
}

/**
 * Score multiple resumes (batch)
 * @param resumes - Array of {id, text, jobDescription}
 * @returns Array of {id, score, error?}
 */
export async function scoreMultipleResumes(
  resumes: Array<{ id: string; text: string; jobDescription: string }>
): Promise<Array<{ id: string; score?: number; error?: string }>> {
  const results = [];

  for (const resume of resumes) {
    try {
      const score = await scoreResumeWithHF(resume.text, resume.jobDescription);
      results.push({ id: resume.id, score });
    } catch (error) {
      results.push({
        id: resume.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

/**
 * Fallback scoring if HF API fails
 * Simple keyword matching for emergencies
 */
export function fallbackATSScore(resumeText: string, jobDescription: string): number {
  const resumeLower = resumeText.toLowerCase();
  const jobLower = jobDescription.toLowerCase();
  
  // Extract keywords from job description
  const jobKeywords = jobLower
    .split(/\s+/)
    .filter(w => w.length > 4); // Words > 4 chars
  
  // Count matches
  let matches = 0;
  for (const keyword of jobKeywords) {
    if (resumeLower.includes(keyword)) {
      matches++;
    }
  }
  
  // Simple score
  const score = Math.min(100, Math.round((matches / jobKeywords.length) * 100 * 1.5));
  console.warn(`⚠️  Using fallback ATS score: ${score}/100`);
  return score;
}
