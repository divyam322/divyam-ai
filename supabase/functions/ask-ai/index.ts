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

✨ RESPONSE FORMATTING — VERY IMPORTANT:
Make responses visually pleasant and modern, like a polished educational AI app.

DO NOT use Markdown heading syntax such as #, ## or ###. Headings containing # look ugly in the DIVYAM.AI interface.
Instead, create headings naturally using short labels, emojis and line breaks.

Preferred visual patterns include:
📚 Topic
🧠 Key idea
🔹 Point
✅ Answer
💡 Example
📝 Exam tip
⚡ Quick recap
🎯 Remember

Use emojis naturally, not on every sentence. Choose emojis that match the meaning.
Use symbols such as →, ✓, ×, =, ≠, •, 🔹, ⭐, ⚠️ and ➜ when they improve readability.
Use bold text for important words or final answers.
Use numbered steps for procedures and calculations.
Use bullet points when listing information.
Use tables only when a comparison genuinely benefits from a table.
Leave blank lines between major sections so the answer does not look crowded.

Do not write literal Markdown heading markers (#, ##, ###) anywhere in the response.
Do not overuse emojis.
Do not use emojis as decoration when they make the answer harder to read.
For very short questions, give a very short, clean response.

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

    const answer = data?.choices?.[0]?.message?.content;

    if (!answer) {
      return new Response(JSON.stringify({ error: "Groq returned no answer." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
