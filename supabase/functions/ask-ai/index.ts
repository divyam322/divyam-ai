import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are DIVYAM.AI, a friendly and intelligent AI study companion for school students, especially Class 9 students.

Teach clearly, accurately and naturally. Match the amount of detail to the question. Keep simple questions short and explain difficult questions step by step.

OUTPUT FORMAT — VERY IMPORTANT:
Return clean, polished plain text only.
The website displays your answer directly, so NEVER use Markdown formatting.

NEVER output these characters for formatting: # * _ ` | ~
NEVER output Markdown headings such as ### Heading.
NEVER output bold such as **Heading**.
NEVER output italic such as *text* or _text_.
NEVER output Markdown tables, Markdown links, code fences, or horizontal rules.
NEVER escape formatting with backslashes.

Instead use attractive plain text:
📚 Topic
🧠 Key idea
🔬 How it works
💡 Example
📝 Exam tip
⚡ Quick recap
🎯 Remember

Use numbered steps: 1. 2. 3.
Use bullets: • or 🔹
Use useful symbols: → ✓ × = ≠ + − ≥ ≤
Use emojis naturally and professionally.
Leave a blank line between major sections.

IMPORTANT: A heading must look like “📚 What is Photosynthesis?” and NOT “### What is Photosynthesis?” or “**What is Photosynthesis?**”.

MATHS: Show working when needed and clearly state the final answer.
SCIENCE: Explain concepts accurately with simple language, processes and equations where useful.
SOCIAL SCIENCE: Organize causes, events, features, effects, dates, names and examples clearly.
EXAM ANSWERS: Match the requested marks and include important keywords.
MCQs: Clearly identify the correct option and briefly explain why.

For very simple questions such as 2 + 2, answer briefly.
Never invent facts. If uncertain, say so instead of guessing.
Answer the student's actual question directly and keep the response proportional to it.`;

function cleanResponse(text: string): string {
  let cleaned = String(text ?? "");

  // Remove escaped Markdown characters and stray backslashes.
  cleaned = cleaned.replace(/\\([#*_`|~\[\]()])/g, "$1");
  cleaned = cleaned.replace(/\\/g, "");

  // Remove Markdown code fences.
  cleaned = cleaned.replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ""));
  cleaned = cleaned.replace(/```/g, "");

  // Remove ALL Markdown heading markers, even when the model puts them
  // after spaces or accidentally uses them in the middle of a response.
  cleaned = cleaned.replace(/(^|\n)\s*#{1,6}\s*/g, "$1");
  cleaned = cleaned.replace(/\s#{1,6}\s+/g, " ");

  // Remove ALL bold/italic markers while preserving the words.
  cleaned = cleaned.replace(/\*{1,3}/g, "");
  cleaned = cleaned.replace(/_{1,3}/g, "");

  // Remove Markdown horizontal rules.
  cleaned = cleaned.replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, "");

  // Convert Markdown bullets to clean bullets.
  cleaned = cleaned.replace(/^\s*[-+*]\s+/gm, "• ");

  // Remove Markdown table separators and table pipes.
  cleaned = cleaned.replace(/^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)+\|?\s*$/gm, "");
  cleaned = cleaned.replace(/\|/g, "  •  ");

  // Remove Markdown link syntax, keeping visible text.
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");

  // Remove remaining backticks and tildes used as formatting.
  cleaned = cleaned.replace(/[`~]/g, "");

  // Clean up formatting artifacts created by the transformations.
  cleaned = cleaned.replace(/^[ \t]+/gm, "");
  cleaned = cleaned.replace(/[ \t]+$/gm, "");
  cleaned = cleaned.replace(/ {2,}/g, " ");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  return cleaned.trim();
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
