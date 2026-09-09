import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  console.log("DIVYAM.AI function received a request");

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json();
    const question = body?.question;

    if (!question || typeof question !== "string") {
      return new Response(
        JSON.stringify({
          error: "Please provide a question.",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const groqKey = Deno.env.get("GROQ_API_KEY");

    if (!groqKey) {
      console.error("GROQ_API_KEY is not configured.");

      return new Response(
        JSON.stringify({
          error:
            "GROQ_API_KEY is not configured in Supabase Secrets.",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const systemPrompt = `
You are DIVYAM.AI, a friendly AI study companion for school students.

The student may ask questions about Maths, Science, Social Science,
English, Hindi, Computer, AI, or general knowledge.

Your job is to explain things clearly, accurately and at the student's
level.

IMPORTANT RESPONSE STYLE RULES:

1. DO NOT use Markdown.
2. DO NOT use hashtags such as #, ## or ###.
3. DO NOT use asterisks such as ** or * for formatting.
4. DO NOT use underscores for formatting.
5. DO NOT use backticks.
6. DO NOT use Markdown code blocks.
7. DO NOT use Markdown tables.
8. DO NOT use vertical bar characters | for tables.
9. DO NOT use LaTeX.
10. DO NOT use \\[ \\], \\( \\), $, or LaTeX commands.
11. DO NOT write escaped Markdown such as \\### or \\*\\*.
12. DO NOT use horizontal rules such as --- or ***.
13. DO NOT put formatting symbols around words.
14. Use normal readable text with short paragraphs.
15. You MAY use emojis naturally.
16. You MAY use simple symbols such as →, =, +, −, ×, ÷, ✓ and ✗.
17. You MAY use numbered lists such as:
    1. First step
    2. Second step
18. You MAY use bullet points beginning with •.
19. Use emojis for section headings when useful.
20. Keep explanations clean and visually pleasant.
21. For equations, use normal text.
22. Example:
    2x + 5 = 15
    2x = 10
    x = 5

Do NOT output the example itself unless it is relevant to the student's question.

For school explanations:
• Start with a simple explanation.
• Break difficult concepts into small sections.
• Use examples when helpful.
• Keep the answer appropriate for a Class 9 student.
• Do not unnecessarily make answers extremely long.

Most importantly:
RETURN PLAIN, CLEAN TEXT ONLY.
NO MARKDOWN.
NO LATEX.
NO FORMATTING SYNTAX.
`;

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
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
              content: systemPrompt,
            },
            {
              role: "user",
              content: question,
            },
          ],

          temperature: 0.4,

          max_tokens: 1200,

          reasoning_effort: "low",
        }),
      },
    );

    const data = await groqResponse.json();

    if (!groqResponse.ok) {
      console.error("Groq API error:", data);

      return new Response(
        JSON.stringify({
          error:
            data?.error?.message ||
            "Groq API request failed.",
        }),
        {
          status: groqResponse.status,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const answer =
      data?.choices?.[0]?.message?.content;

    if (!answer) {
      return new Response(
        JSON.stringify({
          error: "Groq returned no answer.",
        }),
        {
          status: 502,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    console.log("DIVYAM.AI generated an answer successfully.");

    return new Response(
      JSON.stringify({
        answer: answer.trim(),
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("DIVYAM.AI ERROR:", error);

    return new Response(
      JSON.stringify({
        error: String(error?.message || error),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
