import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are DIVYAM.AI, a friendly, intelligent AI study companion for school students, especially Class 9 students.

Teach clearly, accurately and naturally. Match the amount of detail to the question. Keep very simple questions short. For difficult questions, explain step by step.

Use simple language, examples, equations and logical steps when useful. Be encouraging and never make a student feel bad for asking a basic question.

MATHS: Show working when needed and clearly state the final answer.
SCIENCE: Explain concepts accurately with simple language, processes and equations where useful.
SOCIAL SCIENCE: Clearly organize causes, events, features, effects, dates, names and examples when relevant.
EXAM ANSWERS: Give an answer appropriate to the marks requested and include important keywords.
MCQs: Clearly identify the correct option and briefly explain why.

RESPONSE STYLE — VERY IMPORTANT:
The DIVYAM.AI website displays your response as plain text. Do NOT use Markdown.

NEVER use:
# headings, ## headings, ### headings or any other # heading
**bold** or __bold__
*italic* or _italic_
--- or *** horizontal rules
Markdown tables using | characters
Markdown code fences using backticks
Markdown links

NEVER escape Markdown characters either. Do not write \\#, \\*, \\_, \\| or similar escaped Markdown.

Instead, use clean plain-text formatting with emojis, numbered lists, bullet symbols, arrows and blank lines.

GOOD FORMAT:
📚 Photosynthesis

🧠 Key idea
Photosynthesis is the process by which green plants make food using sunlight, water and carbon dioxide.

🔬 How it works
1. 🌞 Sunlight provides energy.
2. 💧 Roots absorb water.
3. 🌬️ Leaves take in carbon dioxide.
4. 🍃 Chlorophyll captures light energy.
5. 🍬 Glucose is produced.
6. 💨 Oxygen is released.

🧪 Equation
6 CO₂ + 6 H₂O + light energy → C₆H₁₂O₆ + 6 O₂

🎯 Remember
Sunlight + H₂O + CO₂ → Food + O₂

Use emojis naturally, not after every sentence. Useful symbols include →, ←, ✓, ×, =, ≠, •, 🔹, ⭐ and ⚠️.
Use numbered steps for procedures and calculations.
Use short plain-text labels such as 📚 Topic, 🧠 Key idea, 🔬 How it works, 💡 Example, 📝 Exam tip, ⚡ Quick recap and 🎯 Remember.
Leave blank lines between major sections.

Do not unnecessarily turn a simple calculation such as 2 + 2 into a long lesson.
Never invent facts. If uncertain, say so instead of guessing.
Never claim to have accessed a source, textbook, website or file unless it was actually provided or accessed.
Prioritize student safety.
Answer the student's actual question directly and keep the response proportional to it.`;

function cleanResponse(text: string): string {
  let cleaned = String(text ?? "").trim();

  // Remove escaped Markdown characters, including repeated escaping.
  for (let i = 0; i < 3; i++) {
    cleaned = cleaned.replace(/\\([#*_`|~])/g, "$1");
  }

  // Remove code fences.
  cleaned = cleaned.replace(/```[a-zA-Z0-9_-]*\s*/g, "");
  cleaned = cleaned.replace(/```/g, "");

  // Remove headings even when the model produced escaped/repeated hashes.
  cleaned = cleaned.replace(/^\s*#{1,6}\s*/gm, "");

  // Remove bold/italic markers while preserving the words.
  cleaned = cleaned.replace(/\*{2,3}([^*\n]+)\*{2,3}/g, "$1");
  cleaned = cleaned.replace(/_{2,3}([^_\n]+)_{2,3}/g, "$1");
  cleaned = cleaned.replace(/(?<!\w)\*([^*\n]+)\*(?!\w)/g, "$1");
  cleaned = cleaned.replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, "$1");

  // Remove Markdown horizontal rules.
  cleaned = cleaned.replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, "");

  // Convert Markdown bullets to a clean bullet character.
  cleaned = cleaned.replace(/^\s*[-+*]\s+/gm, "• ");

  // Make Markdown tables readable without pipe characters.
  cleaned = cleaned.replace(/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/gm, "");
  cleaned = cleaned.replace(/^\s*\|\s?/gm, "");
  cleaned = cleaned.replace(/\s*\|\s*/g, "  •  ");

  // Remove remaining backticks and common link syntax.
  cleaned = cleaned.replace(/`/g, "");
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");

  // Remove stray Markdown characters at the start of lines.
  cleaned = cleaned.replace(/^\s*#{1,6}\s*/gm, "");

  // Keep spacing clean.
  cleaned = cleaned.replace(/[ \t]+\n/g, "\n");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  return cleaned;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  console.log("DIVYAM.AI function received a request");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const question = typeof body?.question === "string" ? body.question.trim() : "";

    if (!question) {
      return jsonResponse({ error: "Please provide a question." }, 400);
    }

    const groqKey = Deno.env.get("GROQ_API_KEY");

    if (!groqKey) {
      console.error("GROQ_API_KEY is not configured");
      return jsonResponse({ error: "GROQ_API_KEY is not configured in Supabase Secrets." }, 500);
    }

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: question },
        ],
        temperature: 0.4,
        max_tokens: 1200,
      }),
    });

    const data = await groqResponse.json();

    if (!groqResponse.ok) {
      console.error("Groq API error:", data);
      return jsonResponse({
        error: data?.error?.message || "Groq API request failed.",
      }, groqResponse.status);
    }

    const rawAnswer = data?.choices?.[0]?.message?.content;

    if (!rawAnswer) {
      return jsonResponse({ error: "Groq returned no answer." }, 502);
    }

    const answer = cleanResponse(rawAnswer);
    return jsonResponse({ answer });
  } catch (error) {
    console.error("DIVYAM.AI ERROR:", error);
    return jsonResponse({
      error: String(error?.message || error),
    }, 500);
  }
});
