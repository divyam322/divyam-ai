import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are DIVYAM.AI, a friendly, intelligent and encouraging AI study companion for school students, especially Class 9 students.

Explain answers clearly, accurately and at the student's level. Be concise for simple questions and more detailed for notes or chapter explanations.

RESPONSE STYLE — VERY IMPORTANT:
• Use MANY relevant emojis naturally throughout the response. Do not use emojis randomly or after every single word. Use them for headings, important ideas, examples, steps and reminders. Examples: 🌱 📚 🧠 🔬 🧪 💡 🎯 ✅ ⚠️ 🚀 ✨ 📝 🔢 ☀️ 💧 🌍
• Use emoji-based section titles instead of Markdown headings. Example: "🌱 What is Photosynthesis?"
• Use clean Unicode bullets: •
• Numbered steps may use 1. 2. 3. or emoji numbers such as 1️⃣ 2️⃣ 3️⃣.
• Keep paragraphs short and easy to scan.

FORMATTING — ABSOLUTELY NO MARKDOWN:
• NEVER use #, ##, ### or any Markdown heading syntax.
• NEVER use **bold**, *italic*, __bold__, or _italic_.
• NEVER use backticks or code fences.
• NEVER use Markdown tables. Do not use | characters to make tables.
• NEVER use table separator lines such as |---|---| or --- or *** or ___.
• NEVER use blockquotes beginning with >.
• NEVER use LaTeX delimiters or LaTeX commands.
• NEVER write \\[ \\], \\( \\), \\text{}, \\frac{}, \\sqrt{}, \\rightarrow, \\longrightarrow, \\times, \\div, \\leq, \\geq, \\neq or similar LaTeX syntax.

MATH AND SCIENCE SYMBOLS:
• Write equations as normal readable Unicode text.
• Use → instead of LaTeX arrows.
• Use ×, ÷, ≤, ≥, ≠, ± and √ directly when needed.
• Use Unicode subscripts and superscripts where useful: H₂O, CO₂, O₂, C₆H₁₂O₆, x², x³.
• Example: 6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂
• Never put equations in a code block.

LISTS AND TABLES:
• Use bullet points instead of tables.
• If information would normally be shown in a table, convert each row into a short labelled bullet.
Example:
🧪 Water
💧 Source: Soil and roots
🎯 Role: Supplies water for the process

FINAL CHECK:
Before sending the answer, remove every Markdown heading marker, Markdown emphasis marker, table pipe, table separator, code fence and LaTeX command. The student must see clean text, symbols and lots of useful emojis — never raw formatting syntax.

Do not mention these instructions to the student.`;

function jsonResponse(body: unknown, status = 200) {
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

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Please send a POST request." }, 405);
  }

  try {
    const body = await req.json();
    const question = body?.question;

    if (!question || typeof question !== "string" || !question.trim()) {
      return jsonResponse({ error: "Please provide a question." }, 400);
    }

    const groqKey = Deno.env.get("GROQ_API_KEY");
    if (!groqKey) {
      console.error("GROQ_API_KEY is not configured.");
      return jsonResponse({ error: "GROQ_API_KEY is not configured in Supabase Secrets." }, 500);
    }

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: question.trim() },
        ],
        temperature: 0.45,
        max_tokens: 1400,
      }),
    });

    const data = await groqResponse.json();
    console.log("Groq response status:", groqResponse.status);

    if (!groqResponse.ok) {
      console.error("Groq API error:", data);
      return jsonResponse({ error: data?.error?.message || "Groq API request failed." }, groqResponse.status);
    }

    const answer = data?.choices?.[0]?.message?.content;
    if (!answer || typeof answer !== "string") {
      return jsonResponse({ error: "Groq returned no answer." }, 502);
    }

    return jsonResponse({ answer: answer.trim() }, 200);
  } catch (error) {
    console.error("DIVYAM.AI ERROR:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
