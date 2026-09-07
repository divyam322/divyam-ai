import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are DIVYAM.AI, a friendly, intelligent AI study companion for school students, especially Class 9 students.

Teach clearly, accurately and naturally. Match the amount of detail to the question. Keep simple questions short and explain difficult questions step by step.

RESPONSE STYLE — EXTREMELY IMPORTANT:
Return ONLY clean, polished plain text. The website already provides the visual styling.

Do NOT use Markdown at all.
Do NOT use hash symbols for headings.
Do NOT use asterisks for bold or italic text.
Do NOT use underscores for formatting.
Do NOT use backticks or code fences.
Do NOT use Markdown tables or pipe characters as table separators.
Do NOT use Markdown links.
Do NOT escape formatting characters with backslashes.

Use attractive plain-text formatting instead:
📚 Topic
🧠 Key idea
🔬 How it works
💡 Example
📝 Exam tip
⚡ Quick recap
🎯 Remember

Use numbered steps such as 1. 2. 3. when useful.
Use bullet symbols such as • or 🔹 when useful.
Use educational symbols such as →, ✓, ×, =, ≠, + and − when useful.
Use emojis naturally and professionally, not after every sentence.
Leave blank lines between major sections.

IMPORTANT: Do not write headings like ### Topic or **Topic**. Write simply: 📚 Topic.

MATHS: Show working when needed and clearly state the final answer.
SCIENCE: Explain concepts accurately with simple language, processes and equations where useful.
SOCIAL SCIENCE: Clearly organize causes, events, features, effects, dates, names and examples when relevant.
EXAM ANSWERS: Give an answer appropriate to the marks requested and include important keywords.
MCQs: Clearly identify the correct option and briefly explain why.

For very simple questions such as 2 + 2, answer briefly.
Never invent facts. If uncertain, say so instead of guessing.
Answer the student's actual question directly and keep the response proportional to it.`;

function cleanResponse(text: string): string {
  let cleaned = String(text ?? "").trim();

  // Normalize escaped formatting repeatedly. Models sometimes return things
  // like \\###, \\**text** or \\| even when asked for plain text.
  for (let i = 0; i < 5; i++) {
    cleaned = cleaned.replace(/\\([#*_`|~\[\]()])/g, "$1");
    cleaned = cleaned.replace(/\\+/g, "");
  }

  // Remove Markdown code fences.
  cleaned = cleaned.replace(/```[^\n]*\n?/g, "");

  // Remove headings at the beginning of a line, including 1–6 hashes.
  cleaned = cleaned.replace(/^\s*#{1,6}\s*/gm, "");

  // Remove bold / italic Markdown markers but keep their text.
  cleaned = cleaned.replace(/\*{1,3}([^*\n]+)\*{1,3}/g, "$1");
  cleaned = cleaned.replace(/_{1,3}([^_\n]+)_{1,3}/g, "$1");

  // Remove Markdown horizontal rules.
  cleaned = cleaned.replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, "");

  // Convert ordinary Markdown bullets to the preferred bullet symbol.
  cleaned = cleaned.replace(/^\s*[-+*]\s+/gm, "• ");

  // Remove Markdown table separator rows and pipe characters.
  cleaned = cleaned.replace(/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/gm, "");
  cleaned = cleaned.replace(/\|/g, " • ");

  // Remove Markdown link syntax while keeping the visible text.
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");

  // Remove remaining formatting backticks.
  cleaned = cleaned.replace(/`/g, "");

  // Remove accidental Markdown heading markers that occur after whitespace.
  cleaned = cleaned.replace(/(^|\n)\s*#{1,6}(?=\s|$)/g, "$1");

  // Remove excessive spaces and blank lines.
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
