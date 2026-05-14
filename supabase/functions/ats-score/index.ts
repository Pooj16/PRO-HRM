/**
 * Backend API for ATS Scoring
 * Supabase Edge Function
 * 
 * This endpoint:
 * 1. Receives resume + job description from frontend
 * 2. Calls Hugging Face Inference API with YOUR API key (kept safe on backend)
 * 3. Returns the score to frontend
 * 4. Frontend never sees the API key
 */

const HF_API_KEY = process.env.HF_API_KEY;
const HF_MODEL_URL =
  "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2";

/**
 * POST /api/ats-score
 * 
 * Body:
 * {
 *   "resumeText": "...",
 *   "jobDescription": "..."
 * }
 * 
 * Response:
 * {
 *   "score": 85,
 *   "similarity": 0.85,
 *   "timestamp": "2024-01-01T00:00:00Z"
 * }
 */
export async function handleATSScore(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { resumeText, jobDescription } = (await req.json()) as {
      resumeText: string;
      jobDescription: string;
    };

    if (!resumeText || !jobDescription) {
      return new Response(
        JSON.stringify({ error: "resumeText and jobDescription required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!HF_API_KEY) {
      return new Response(
        JSON.stringify({ error: "HF_API_KEY not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Call HF API
    const response = await fetch(HF_MODEL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: {
          source_sentence: jobDescription.substring(0, 512),
          sentences: [resumeText.substring(0, 512)],
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HF API error: ${response.status}`);
    }

    const result = (await response.json()) as number[] | { error?: string };

    if (Array.isArray(result)) {
      const similarity = result[0];
      const score = Math.round(similarity * 100);

      return new Response(
        JSON.stringify({
          score,
          similarity,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } else {
      throw new Error("Unexpected response from HF API");
    }
  } catch (error) {
    console.error("ATS Score Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
