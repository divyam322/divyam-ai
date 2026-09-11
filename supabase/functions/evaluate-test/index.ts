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

function clean(value: unknown, max = 2000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function clampScore(value: unknown, maxMarks: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(maxMarks, Math.round(n * 2) / 2));
}

serve(async (req) => {
  console.log("DIVYAM.AI evaluate-test received a request");

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  try {
    const body = await req.json();
    const answers = Array.isArray(body?.answers) ? body.answers : [];

    if (!answers.length) return jsonResponse({ evaluations: [] });
    if (answers.length > 30) return jsonResponse({ error: "Too many answers to evaluate." }, 400);

    const groqKey = Deno.env.get("GROQ_API_KEY");
    if (!groqKey) return jsonResponse({ error: "GROQ_API_KEY is not configured in Supabase Secrets." }, 500);

    const items = answers.map((item: any, i: number) => ({
      index: Number.isInteger(Number(item?.index)) ? Number(item.index) : i,
      type: clean(item?.type, 30),
      question: clean(item?.question, 1600),
      studentAnswer: clean(item?.studentAnswer, 3000),
      modelAnswer: clean(item?.modelAnswer, 1800),
      maxMarks: Math.max(1, Math.min(10, Number(item?.maxMarks) || 1)),
    }));

    const prompt = `You are an expert school examiner. Evaluate the student's written answers fairly and consistently.

Return ONLY valid JSON with this exact structure:
{
  "evaluations": [
    {
      "index": 0,
      "score": 2.5,
      "feedback": "brief examiner feedback",
      "missingPoints": ["important point not included"]
    }
  ]
}

Rules:
- Return exactly one evaluation for every supplied item, using the same index.
- score must be between 0 and maxMarks and may use 0.5 increments.
- Award partial credit when the student demonstrates some correct knowledge.
- Do not require exact wording. Accept scientifically/socially/mathematically equivalent wording.
- Judge against the model answer, question, class level and subject context.
- Do not award marks for irrelevant statements.
- For a completely correct answer, award full marks.
- For a partly correct answer, award proportionate marks.
- For a wrong or blank answer, award 0.
- Keep feedback short, useful and student-friendly.
- missingPoints should list only important missing ideas; use [] when none are missing.

Answers to evaluate:
${JSON.stringify(items)}`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [
          { role: "system", content: "You are a strict but fair school examiner. Return JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.15,
        max_tokens: 5000,
        response_format: { type: "json_object" },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Groq evaluation error:", data);
      return jsonResponse({ error: data?.error?.message || "AI evaluation failed." }, response.status);
    }

    const raw = data?.choices?.[0]?.message?.content;
    if (!raw || typeof raw !== "string") return jsonResponse({ error: "The AI returned no evaluation." }, 502);

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return jsonResponse({ error: "The AI returned an invalid evaluation format. Please try again." }, 502);
    }

    const byIndex = new Map(items.map((item: any) => [item.index, item]));
    const evaluations = Array.isArray(parsed?.evaluations) ? parsed.evaluations : [];

    const normalized = items.map((item: any) => {
      const found = evaluations.find((e: any) => Number(e?.index) === item.index);
      const score = clampScore(found?.score, item.maxMarks);
      return {
        index: item.index,
        score,
        maxMarks: item.maxMarks,
        feedback: clean(found?.feedback, 700) || (score === item.maxMarks ? "Correct and well explained." : "Review the model answer and strengthen the missing points."),
        missingPoints: Array.isArray(found?.missingPoints) ? found.missingPoints.map((x: unknown) => clean(x, 300)).filter(Boolean).slice(0, 6) : [],
      };
    });

    return jsonResponse({ evaluations: normalized });
  } catch (error) {
    console.error("DIVYAM.AI evaluate-test ERROR:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
