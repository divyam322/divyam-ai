import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  console.log("DIVYAM.AI generate-test received a request");

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  try {
    const body = await req.json();
    const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
    const classLevel = typeof body?.classLevel === "string" ? body.classLevel.trim() : "";
    const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
    const difficulty = typeof body?.difficulty === "string" ? body.difficulty : "Mixed";
    const questionType = typeof body?.questionType === "string" ? body.questionType : "Mixed";
    const count = Number(body?.count);
    const timeLimit = body?.timeLimit === "none" ? null : Number(body?.timeLimit);

    if (!subject || !classLevel || !topic) {
      return jsonResponse({ error: "Subject, class and chapter/topic are required." }, 400);
    }

    if (!Number.isInteger(count) || count < 1 || count > 30) {
      return jsonResponse({ error: "Number of questions must be between 1 and 30." }, 400);
    }

    const groqKey = Deno.env.get("GROQ_API_KEY");
    if (!groqKey) {
      console.error("GROQ_API_KEY is not configured.");
      return jsonResponse({ error: "GROQ_API_KEY is not configured in Supabase Secrets." }, 500);
    }

    const prompt = `Create a fresh school-level practice test for ${classLevel}.
Subject: ${subject}
Chapter/topic: ${topic}
Difficulty: ${difficulty}
Question type: ${questionType}
Number of questions: ${count}
Time limit: ${timeLimit ? `${timeLimit} minutes` : "No time limit"}

Return ONLY valid JSON. Do not add Markdown, explanations outside JSON, code fences, or extra text.

Use exactly this structure:
{
  "title": "short test title",
  "subject": "${subject}",
  "classLevel": "${classLevel}",
  "topic": "${topic}",
  "difficulty": "${difficulty}",
  "questionType": "${questionType}",
  "timeLimit": ${timeLimit ?? "null"},
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
- For MCQ questions, provide exactly 4 options and set answer to the exact correct option text.
- For Short Answer and Long Answer questions, use an empty options array and put a concise model answer in answer.
- If questionType is Mixed, use a sensible mixture of MCQ, Short Answer and Long Answer.
- Keep every question appropriate for ${classLevel} and focused on the requested topic.
- Avoid duplicate questions.
- Make the test academically useful, not trivia.
- Ensure the answer is factually correct.`;

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [
          { role: "system", content: "You generate accurate school practice tests and must return valid JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.55,
        max_tokens: 5000,
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
    if (!raw || typeof raw !== "string") return jsonResponse({ error: "Groq returned no test." }, 502);

    let test;
    try {
      test = JSON.parse(raw);
    } catch (parseError) {
      console.error("Invalid JSON from Groq:", raw);
      return jsonResponse({ error: "The AI returned an invalid test format. Please try again." }, 502);
    }

    if (!test?.questions || !Array.isArray(test.questions) || test.questions.length !== count) {
      return jsonResponse({ error: "The AI did not generate the requested number of questions. Please try again." }, 502);
    }

    return jsonResponse({ test }, 200);
  } catch (error) {
    console.error("DIVYAM.AI generate-test ERROR:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
