/**
 * Hugging Face Assessment Generation Service
 * Uses: google/flan-t5-base
 * Model: Text-to-text generation
 * 
 * Input: job role + skills
 * Output: Multiple choice questions (MCQs)
 */

const HF_MODEL_URL = "https://api-inference.huggingface.co/models/google/flan-t5-base";

export interface MCQQuestion {
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer?: string;
  explanation?: string;
}

/**
 * Generate technical questions for a role
 * @param role - Job role (e.g., "Senior Software Engineer")
 * @param skills - Comma-separated skills (e.g., "React, TypeScript, Node.js")
 * @param numQuestions - Number of questions to generate (default: 5)
 * @returns Array of MCQ questions
 */
export async function generateAssessmentWithHF(
  role: string,
  skills: string,
  numQuestions: number = 5
): Promise<MCQQuestion[]> {
  const apiKey = import.meta.env.VITE_HF_API_KEY;
  
  if (!apiKey) {
    console.error("❌ VITE_HF_API_KEY not found in environment variables");
    throw new Error("Hugging Face API key not configured");
  }

  if (!role || !skills) {
    console.error("❌ Role or skills are empty");
    throw new Error("Role and skills are required");
  }

  try {
    console.log(`📡 Generating ${numQuestions} questions for ${role}...`);
    
    const prompt = buildPrompt(role, skills, numQuestions);
    
    const response = await fetch(HF_MODEL_URL, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_length: 1000,
          temperature: 0.7,
          top_p: 0.95,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ HF API error:", errorData);
      throw new Error(`Hugging Face API error: ${response.statusText}`);
    }

    const result = await response.json();
    const generatedText = result[0]?.generated_text || result;
    
    console.log("✅ Generated text received");
    
    // Parse the generated text into structured questions
    const questions = parseGeneratedQuestions(generatedText, numQuestions);
    
    console.log(`✅ Parsed ${questions.length} questions`);
    return questions;

  } catch (error) {
    console.error("❌ Error generating assessment:", error);
    throw error;
  }
}

/**
 * Build the prompt for Flan-T5
 */
function buildPrompt(role: string, skills: string, numQuestions: number): string {
  return `Generate ${numQuestions} multiple choice technical questions for a ${role} position. 
The candidate should have skills in: ${skills}.
For each question, provide 4 options (A, B, C, D) and mark the correct answer.
Format each question as:
Q1: [Question text]
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]
Correct: [A/B/C/D]

Generate questions now:`;
}

/**
 * Parse generated text into structured MCQ questions
 */
function parseGeneratedQuestions(text: string, expectedCount: number): MCQQuestion[] {
  const questions: MCQQuestion[] = [];
  
  // Split by "Q1:", "Q2:", etc.
  const qPattern = /Q(\d+):\s*(.+?)(?=Q\d+:|$)/gs;
  const matches = text.matchAll(qPattern);
  
  for (const match of matches) {
    try {
      const content = match[2];
      const question = parseQuestion(content);
      if (question && question.question) {
        questions.push(question);
      }
    } catch (e) {
      console.warn("⚠️  Failed to parse question:", e);
    }
  }
  
  // If parsing failed or found too few, create fallback questions
  if (questions.length === 0) {
    return generateFallbackQuestions(expectedCount);
  }
  
  return questions.slice(0, expectedCount);
}

/**
 * Parse a single question block
 */
function parseQuestion(content: string): MCQQuestion | null {
  const lines = content.split("\n").filter(l => l.trim());
  
  if (lines.length < 5) return null;
  
  const question = lines[0]?.trim() || "";
  const optionA = lines[1]?.replace(/^A\)\s*/, "").trim() || "";
  const optionB = lines[2]?.replace(/^B\)\s*/, "").trim() || "";
  const optionC = lines[3]?.replace(/^C\)\s*/, "").trim() || "";
  const optionD = lines[4]?.replace(/^D\)\s*/, "").trim() || "";
  
  // Find correct answer line
  let correctAnswer = "A";
  for (const line of lines) {
    if (line.toLowerCase().includes("correct:")) {
      const match = line.match(/[A-D]/);
      if (match) correctAnswer = match[0];
    }
  }
  
  if (!question || !optionA || !optionB || !optionC || !optionD) {
    return null;
  }
  
  return {
    question,
    options: { A: optionA, B: optionB, C: optionC, D: optionD },
    correctAnswer,
    explanation: `This tests knowledge of the required skills. The correct answer is ${correctAnswer}.`,
  };
}

/**
 * Fallback questions if HF generation fails
 */
function generateFallbackQuestions(count: number): MCQQuestion[] {
  const templates = [
    {
      question: "Which design pattern is most appropriate for managing application state?",
      options: {
        A: "Singleton",
        B: "Redux/State Management",
        C: "Factory",
        D: "Observer",
      },
      correctAnswer: "B",
    },
    {
      question: "What is the time complexity of binary search?",
      options: {
        A: "O(n)",
        B: "O(n log n)",
        C: "O(log n)",
        D: "O(1)",
      },
      correctAnswer: "C",
    },
    {
      question: "Which principle advocates for objects being open for extension but closed for modification?",
      options: {
        A: "Single Responsibility",
        B: "Open/Closed",
        C: "Liskov Substitution",
        D: "Dependency Inversion",
      },
      correctAnswer: "B",
    },
    {
      question: "What does REST stand for?",
      options: {
        A: "Representational State Transfer",
        B: "Remote Execution Service Toolkit",
        C: "Resource Extension Security Token",
        D: "Real-time Event Stream Transfer",
      },
      correctAnswer: "A",
    },
    {
      question: "Which of these is NOT a valid HTTP method?",
      options: {
        A: "GET",
        B: "POST",
        C: "RETRIEVE",
        D: "DELETE",
      },
      correctAnswer: "C",
    },
  ];
  
  console.warn(`⚠️  Using fallback questions (HF generation failed)`);
  return templates.slice(0, count);
}

/**
 * Generate questions for a specific assessment
 */
export async function generateAssessmentQuestions(
  candidateId: string,
  role: string,
  skills: string
): Promise<{ candidateId: string; questions: MCQQuestion[] }> {
  try {
    const questions = await generateAssessmentWithHF(role, skills, 5);
    return { candidateId, questions };
  } catch (error) {
    console.error(`Failed to generate assessment for candidate ${candidateId}:`, error);
    // Return fallback
    return {
      candidateId,
      questions: generateFallbackQuestions(5),
    };
  }
}
