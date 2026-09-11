import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_DIFFICULTIES = new Set(["Easy", "Mixed", "Hard"]);
const ALLOWED_TYPES = new Set(["Mixed", "MCQ", "Short Answer", "Long Answer"]);
const ALLOWED_TIME_LIMITS = new Set([null, 10, 15, 20, 30, 45, 60]);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalise(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function validateAndNormaliseTest(test: any, count: number, requestedType: string) {
  if (!test || typeof test !== "object" || !Array.isArray(test.questions)) {
    throw new Error("The AI returned an incomplete test.");
  }

  if (test.questions.length !== count) {
    throw new Error("The AI did not generate the requested number of questions.");
  }

  const seen = new Set<string>();
  const questions = test.questions.map((raw: any, index: number) => {
    const question = cleanString(raw?.question, 1200);
    const answer = cleanString(raw?.answer, 1200);
    let type = cleanString(raw?.type, 30);

    if (!question || !answer) throw new Error(`Question ${index + 1} is missing its question or answer.`);

    if (!["MCQ", "Short Answer", "Long Answer"].includes(type)) {
      type = requestedType === "MCQ" ? "MCQ" : requestedType === "Short Answer" ? "Short Answer" : requestedType === "Long Answer" ? "Long Answer" : "Short Answer";
    }

    const key = normalise(question);
    if (seen.has(key)) throw new Error("The AI generated duplicate questions.");
    seen.add(key);

    if (type === "MCQ") {
      if (!Array.isArray(raw?.options) || raw.options.length !== 4) {
        throw new Error(`Question ${index + 1} must have exactly 4 MCQ options.`);
      }

      const options = raw.options.map((option: unknown) => cleanString(option, 400));
      if (options.some((option: string) => !option)) {
        throw new Error(`Question ${index + 1} contains an empty MCQ option.`);
      }
      if (new Set(options.map(normalise)).size !== 4) {
        throw new Error(`Question ${index + 1} contains duplicate MCQ options.`);
      }
      if (!options.some((option: string) => normalise(option) === normalise(answer))) {
        throw new Error(`Question ${index + 1} has an answer that does not match an option.`);
      }

      return {
        id: index + 1,
        type,
        question,
        options,
        answer,
        explanation: cleanString(raw?.explanation, 800),
      };
    }

    return {
      id: index + 1,
      type,
      question,
      options: [],
      answer,
      explanation: cleanString(raw?.explanation, 800),
    };
  });

  return {
    title: cleanString(test.title, 160) || "Custom Test",
    questions,
  };
}

serve(async (req) => {
  console.log("DIVYAM.AI generate-test received a request");

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  try {
    const body = await req.json();

    const subject = cleanString(body?.subject, 100);
    const classLevel = cleanString(body?.classLevel, 50);
    const topic = cleanString(body?.topic, 500);
    const difficulty = cleanString(body?.difficulty, 30) || "Mixed";
    const questionType = cleanString(body?.questionType, 30) || "Mixed";
    const count = Number(body?.count);
    const timeLimit = body?.timeLimit === "none" || body?.timeLimit === null || body?.timeLimit === undefined
      ? null
      : Number(body?.timeLimit);

    if (!subject || !classLevel || !topic) {
      return jsonResponse({ error: "Subject, class and chapter/topic are required." }, 400);
    }

    if (!ALLOWED_DIFFICULTIES.has(difficulty)) {
      return jsonResponse({ error: "Invalid difficulty selected." }, 400);
    }

    if (!ALLOWED_TYPES.has(questionType)) {
      return jsonResponse({ error: "Invalid question type selected." }, 400);
    }

    if (!Number.isInteger(count) || count < 1 || count > 30) {
      return jsonResponse({ error: "Number of questions must be between 1 and 30." }, 400);
    }

    if (!ALLOWED_TIME_LIMITS.has(timeLimit)) {
      return jsonResponse({ error: "Invalid time limit selected." }, 400);
    }

    const groqKey = Deno.env.get("GROQ_API_KEY");
    if (!groqKey) {
      console.error("GROQ_API_KEY is not configured.");
      return jsonResponse({ error: "GROQ_API_KEY is not configured in Supabase Secrets." }, 500);
    }

    const prompt = `Create a fresh, academically useful school practice test for ${classLevel}.

Subject: ${subject}
Chapter/topic: ${topic}
Difficulty: ${difficulty}
Question type: ${questionType}
Number of questions: ${count}
Time limit: ${timeLimit === null ? "No time limit" : `${timeLimit} minutes`}

Return ONLY valid JSON. Never return Markdown, code fences, comments, or text outside the JSON object.

Return exactly this schema:
{
  "title": "short test title",
  "questions": [
    {
      "id": 1,
      "type": "MCQ",
      "question": "question text",
      "options": ["option A", "option B", "option C", "option D"],
      "answer": "option A",
      "explanation": "brief explanation"
    }
  ]
}

Rules:
- Generate exactly ${count} questions.
- Question IDs must be 1 through ${count}.
- ${questionType === "Mixed" ? "Use a sensible mixture of MCQ, Short Answer and Long Answer questions." : `Every question must be ${questionType}.`}
- Every MCQ must have exactly four distinct options and the answer must exactly match one option.
- Short Answer and Long Answer questions must have an empty options array and a concise model answer.
- Keep every question appropriate for ${classLevel} and tightly focused on ${topic}.
- Avoid duplicate or near-duplicate questions.
- Do not invent facts. Prefer textbook-aligned concepts and exam-useful questions.
- Include a concise explanation for every question.
- Do not reveal the correct answer in the question text or explanation wording in a way that makes the answer obvious.`;

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [
          {
            role: "system",
            content: "You generate accurate school practice tests. Follow the requested schema exactly and return JSON only.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.45,
        max_tokens: 6500,
        response_format: { type: "json_object" },
      }),
    });

    const data = await groqResponse.json();
    console.log("Groq test generation status:", groqResponse.status);

    if (!groqResponse.ok) {
      console.error("Groq API error:", data);
      return jsonResponse({ error: data?.error?.message || "Groq API request failed." }, groqResponse.status);
    }

    const raw = data?.choices?.[0]?.message?.content;
    if (!raw || typeof raw !== "string") {
      return jsonResponse({ error: "Groq returned no test." }, 502);
    }

    let generated;
    try {
      generated = JSON.parse(raw);
    } catch (parseError) {
      console.error("Invalid JSON from Groq:", raw);
      return jsonResponse({ error: "The AI returned an invalid test format. Please try again." }, 502);
    }

    let test;
    try {
      const validated = validateAndNormaliseTest(generated, count, questionType);
      test = {
        title: validated.title,
        subject,
        classLevel,
        topic,
        difficulty,
        questionType,
        timeLimit,
        questions: validated.questions,
      };
    } catch (validationError) {
      console.error("Generated test validation failed:", validationError);
      return jsonResponse({ error: validationError instanceof Error ? validationError.message : "The AI generated an invalid test. Please try again." }, 502);
    }

    return jsonResponse({ test }, 200);
  } catch (error) {
    console.error("DIVYAM.AI generate-test ERROR:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
