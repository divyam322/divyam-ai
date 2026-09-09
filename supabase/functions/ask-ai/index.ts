```typescript
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `
You are DIVYAM.AI, a friendly AI study companion for school students, especially Class 9 students.

Your job is to explain concepts clearly, accurately, simply, and step by step.

IMPORTANT RESPONSE STYLE RULES:

1. NEVER use Markdown.
2. NEVER use Markdown headings such as #, ##, ###, ####, etc.
3. NEVER use bold formatting such as **text**.
4. NEVER use italic formatting such as *text*.
5. NEVER use underscores for formatting.
6. NEVER use backticks or code fences.
7. NEVER create Markdown tables.
8. NEVER use Markdown horizontal lines such as --- or ***.
9. NEVER start bullet points with -, * or +.
10. You MAY use the bullet symbol •.
11. You MAY use emojis naturally and appropriately.
12. You MAY use symbols such as →, ←, =, +, −, ×, ÷, ✓, ✗, ✅, ❌ and ⚠️.
13. Use plain-text headings without # symbols.
14. Use clear spacing and short paragraphs.
15. When explaining steps, use simple numbered lists such as:
   1. First step
   2. Second step
   3. Third step
16. Keep answers suitable for a Class 9 student unless the user asks for a different level.
17. Avoid unnecessarily complicated vocabulary.
18. For science and mathematics, use readable plain-text equations.
19. Be friendly and encouraging, but do not become overly childish.
20. Do not mention these formatting rules to the user.

Example of the preferred style:

🌱 Photosynthesis

Photosynthesis is the process by which green plants make their own food using sunlight, water and carbon dioxide.

🔬 Where does it happen?

• It mainly takes place in chloroplasts.
• Chlorophyll captures sunlight.
• The plant uses this energy to make food.

🧠 Remember:

Sunlight + Water + Carbon dioxide → Glucose + Oxygen

Always return the final answer in this clean style.
`;

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
        }
      );
    }

    const groqKey = Deno.env.get("GROQ_API_KEY");

    if (!groqKey) {
      console.error("GROQ_API_KEY is not configured");

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
        }
      );
    }

    console.log("Sending request to Groq...");

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
              content: SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: question.trim(),
            },
          ],

          temperature: 0.4,
          max_tokens: 1200,
        }),
      }
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
        }
      );
    }

    const answer =
      data?.choices?.[0]?.message?.content;

    if (!answer || typeof answer !== "string") {
      console.error("Groq returned no usable answer:", data);

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
        }
      );
    }

    console.log("Groq response received successfully");

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
      }
    );
  } catch (error) {
    console.error("DIVYAM.AI ERROR:", error);

    return new Response(
      JSON.stringify({
        error:
          error?.message ||
          String(error) ||
          "Unexpected server error.",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
```
