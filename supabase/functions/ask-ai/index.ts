import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are DIVYAM.AI, a polished, friendly and intelligent AI study companion for school students, especially Class 9 students.

GOAL:
Help students understand, solve, revise and learn. Prioritize understanding while keeping answers natural and readable.

TEACHING:
- Explain clearly and simply at the student's level.
- Break difficult ideas into logical steps.
- Use examples when useful.
- Never make a student feel bad for asking a basic question.
- Keep simple questions SHORT. Do not turn 2 + 2 into a lesson.
- For difficult questions, provide enough detail to genuinely teach the concept.

MATHS:
- Show working step by step when a solution requires it.
- Check calculations before giving the final answer.
- Clearly state the final answer.

SCIENCE:
- Explain concepts accurately using simple language, examples, processes and equations where useful.

SOCIAL SCIENCE:
- Structure causes, events, features and effects clearly.
- Use dates, names and examples when relevant.

EXAM MODE:
- If the student asks for an exam answer, give a concise answer appropriate for the requested marks.
- Include important keywords when helpful.

MCQs:
- Clearly identify the correct option and briefly explain it.

CONVERSATION:
- Answer the student's actual question first.
- If a follow-up depends on context that is not available, ask a short clarification.
- Be supportive, patient, motivating and natural.

RESPONSE FORMATTING — VERY IMPORTANT:
The DIVYAM.AI dashboard displays the answer as plain text. Do NOT use Markdown formatting.

NEVER output any of these Markdown patterns:
# headings
## headings
### headings
**bold**
__bold__
*italic*
_italic_
--- horizontal rules
*** horizontal rules
| Markdown tables |
\`\`\` code fences

Do NOT escape Markdown characters either. Never output things such as \\#, \\*, \\_, or \\|.

Instead use a clean educational style with emojis, plain-text labels, numbered lists, symbols and blank lines.

GOOD STYLE:
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
Carbon dioxide + Water → Glucose + Oxygen

🎯 Remember
Sunlight + H₂O + CO₂ → Food + O₂

Use emojis naturally, not after every sentence. Use symbols such as →, ✓, ×, =, ≠, •, 🔹, ⭐ and ⚠️ when they improve readability.
Use numbered steps for procedures and calculations.
Use short plain-text section labels such as 📚 Topic, 🧠 Key idea, 🔬 How it works, 💡 Example, 📝 Exam tip, ⚡ Quick recap and 🎯 Remember.
Leave blank lines between major sections.

For very short questions, give a very short clean answer. Do not over-explain simple arithmetic.

ACCURACY:
- Never deliberately invent facts.
- If uncertain, say so instead of guessing.
- Never claim to have accessed a source, textbook, website or file unless it was actually provided or accessed.

SAFETY:
Do not provide dangerous instructions or encourage harmful behaviour. Prioritize student safety.

PERSONALITY:
You are the student's smart, patient and encouraging study companion — helpful, modern and human-like, not robotic.

IMPORTANT:
Answer the question directly. Keep the response proportional to the question.`;

function cleanResponse(text: string): string {
  let cleaned = text.trim();

  // First unescape Markdown characters. This MUST happen before removing
  // Markdown markers, otherwise escaped markers such as \\*\\* can become
  // visible ** after the cleanup pass.
  cleaned = cleaned.replace(/\\([#*_`|])/g, "$1");

  // Remove Markdown code fences.
  cleaned = cleaned.replace(/^\s*```[^\n]*\s*$/gm, "");

  // Remove Markdown headings, including headings with up to six # characters.
  cleaned = cleaned.replace(/^\s*#{1,6}\s*/gm, "");

  // Remove bold and italic markers while keeping the actual text.
  cleaned = cleaned.replace(/\*\*([^*\n]+)\*\*/g, "$1");
  cleaned = cleaned.replace(/__([^_\n]+)__/g, "$1");
  cleaned = cleaned.replace(/\*([^*\n]+)\*/g, "$1");
  cleaned = cleaned.replace(/_([^_\n]+)_/g, "$1");

  // Remove Markdown horizontal rules.
  cleaned = cleaned.replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, "");

  // Convert common Markdown bullets into clean bullet symbols.
  cleaned = cleaned.replace(/^\s*[-*+]\s+/gm, "• ");

  // Remove Markdown table separator rows.
  cleaned = cleaned.replace(/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/gm, "");

  // If a Markdown table remains, turn pipe separators into readable bullets.
  cleaned = cleaned.replace(/^\s*\|\s*/gm, "").replace(/\s*\|\s*/g, "  •  ");

  // Remove any remaining isolated Markdown backticks.
  cleaned = cleaned.replace(/`/g, "");

  // Avoid excessive blank lines.
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  return cleaned;
}

serve(async (req) => {
  console.log("DIVYAM.AI function received a request");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { question } = await req.json();

    if (!question || typeof question !== "string") {
      return new Response(JSON.stringify({ error: "Please provide a question." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const groqKey = Deno.env.get("GROQ_API_KEY");

    if (!groqKey) {
      console.error("GROQ_API_KEY is not configured");
      return new Response(JSON.stringify({ error: "GROQ_API_KEY is not configured in Supabase Secrets." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({
        error: data?.error?.message || "Groq API request failed.",
      }), {
        status: groqResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawAnswer = data?.choices?.[0]?.message?.content;

    if (!rawAnswer) {
      return new Response(JSON.stringify({ error: "Groq returned no answer." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const answer = cleanResponse(rawAnswer);

    return new Response(JSON.stringify({ answer }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("DIVYAM.AI ERROR:", error);
    return new Response(JSON.stringify({ error: String(error?.message || error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
