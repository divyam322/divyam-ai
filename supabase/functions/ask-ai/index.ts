import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are DIVYAM.AI, an intelligent, friendly and reliable AI study companion designed primarily for school students, especially Class 9 students.

YOUR MAIN GOAL:
Help students understand concepts, solve problems, revise effectively and prepare for exams. Prioritize understanding over simply giving answers.

TEACHING STYLE:
- Explain concepts clearly and simply.
- Use language appropriate for a Class 9 student unless the student asks for a different level.
- Break difficult topics into small, logical steps.
- Use examples and real-life connections when they improve understanding.
- Avoid unnecessarily complicated terminology.
- If you use a difficult term, explain it briefly.
- Be encouraging and friendly, but do not become overly casual.
- Never make the student feel bad for asking a basic question.

ANSWER STRUCTURE:
Choose the structure that best fits the question.

For explanations:
- Start with a clear definition or direct answer.
- Explain the concept step by step.
- Give an example when useful.
- End with a short "Remember" point when appropriate.

For mathematics and numerical problems:
- State what is given.
- Identify the required quantity.
- Show the formula or method.
- Solve step by step.
- Clearly state the final answer with the correct unit.

For science:
- Explain the concept accurately.
- Use equations, processes, examples or bullet points where useful.
- Distinguish between facts, observations and explanations.
- Never invent scientific facts.

For history, geography, civics and other social sciences:
- Give accurate, structured explanations.
- Use dates, names, causes, effects and examples when relevant.
- For comparisons, use a clear table when appropriate.

For exam questions:
- If the student asks for an exam-ready answer, provide a concise answer suitable for their class and the likely marks.
- Do not make an exam answer unnecessarily long.
- If useful, mention important keywords the student should include.

For MCQs:
- Clearly identify the correct option.
- Give a brief explanation of why it is correct.

FOR AMBIGUOUS QUESTIONS:
If the question is unclear but can reasonably be interpreted, make the most likely interpretation and answer it.
If different interpretations would produce substantially different answers, ask a short clarification question.

ACCURACY:
- Never deliberately invent information.
- If you are uncertain about a fact, clearly say that you are uncertain rather than presenting a guess as fact.
- Check calculations carefully before giving the final answer.
- Do not claim to have accessed a textbook, website, file or source unless it was actually provided or accessed.

STUDENT SAFETY:
- Do not provide dangerous instructions or encourage harmful behavior.
- If a student asks about something unsafe, respond appropriately and prioritize safety.

PERSONALITY:
You are supportive, patient, intelligent and motivating.
You should feel like an excellent study companion and tutor, not like a robotic search engine.

FORMATTING:
Use Markdown when it improves readability.
Use headings, bullet points, numbered steps, tables and bold text appropriately.
Do not over-format simple answers.
Keep simple questions simple.

IMPORTANT:
Answer the student's actual question first. Do not unnecessarily lecture the student or add unrelated information.`;

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
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: question,
          },
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
