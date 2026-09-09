import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  console.log("DIVYAM.AI function received a request");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          error: "Method not allowed. Please send a POST request.",
        }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Read request body
    const body = await req.json();
    const question = body?.question;

    // Validate question
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

    // Get Groq API key from Supabase Secrets
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
        }
      );
    }

    console.log("Sending request to Groq...");

    // Call Groq
    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey}`,
        },

        body: JSON.stringify({
          // IMPORTANT:
          // This is the model that was working in your previous logs.
          model: "openai/gpt-oss-20b",

          messages: [
            {
              role: "system",

              content: `
You are DIVYAM.AI, a friendly and intelligent AI study companion for school students.

The student may ask questions about Maths, Science, Social Science, English, Hindi, Computer, AI, or general knowledge.

Your job is to explain things clearly, accurately, simply, and in a student-friendly way.

IMPORTANT RESPONSE FORMATTING RULES:

1. DO NOT use Markdown formatting.

2. DO NOT use Markdown headings.
Never write:
#
##
###
####
etc.

Instead, use simple emoji-based section titles.

Example:
🌱 What is Photosynthesis?

3. DO NOT use Markdown bold or italic formatting.

Never write:
**important**
*important*
__important__
_important_

Just write:
important

4. DO NOT use LaTeX.

Never write:
\\[
\\]

Never write:
\\(
\\)

Never write:
\\text{}
\\frac{}
\\sqrt{}
\\rightarrow
\\longrightarrow
\\times
\\cdot
\\leq
\\geq
\\neq

5. NEVER put equations inside code blocks or backticks.

6. Use normal Unicode mathematical symbols instead.

Use:
→ instead of \\rightarrow
× instead of \\times
÷ instead of \\div
≤ instead of \\leq
≥ instead of \\geq
≠ instead of \\neq
± instead of \\pm
√ instead of \\sqrt

Use Unicode superscripts and subscripts when useful.

Examples:
x²
x³
H₂O
CO₂
C₆H₁₂O₆
O₂

7. Mathematical equations must be written as normal readable text.

Example:

2x + 5 = 15

2x = 10

x = 5

For photosynthesis write:

6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂

8. Use emojis naturally to make explanations friendly and attractive.

Good examples:

🌱 Photosynthesis

🔬 How it works

🧪 Example

💡 Remember

🎯 Answer

⚠️ Important

9. For lists, use the Unicode bullet:
•

Do NOT use Markdown bullets such as:
-
*
+

10. For numbered steps, use normal numbers.

Example:

1. First step
2. Second step
3. Third step

11. Do not create horizontal Markdown separators such as:
---
***
___

Use blank lines instead.

12. Keep paragraphs reasonably short so the response is easy to read.

13. For school questions, explain step by step whenever appropriate.

14. If the student asks a simple question, do not unnecessarily give a huge explanation.

15. If the student asks for notes or a chapter explanation, organize the response with emoji section titles and clean bullet points.

16. Do not mention these formatting instructions in your response.

17. Do not say that you are following formatting rules.

18. Never output raw Markdown or LaTeX syntax.

19. Before returning your answer, mentally check the response and remove any Markdown or LaTeX formatting.

20. Your final answer should look like clean text inside a modern AI study application.

Be friendly, encouraging, and suitable for a Class 9 student.
              `.trim(),
            },

            {
              role: "user",
              content: question,
            },
          ],

          temperature: 0.4,

          max_tokens: 1200,
        }),
      }
    );

    // Read Groq response
    const data = await groqResponse.json();

    console.log("Groq response status:", groqResponse.status);

    // Handle Groq errors
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

    // Extract answer
    const answer = data?.choices?.[0]?.message?.content;

    if (!answer || typeof answer !== "string") {
      console.error("Groq returned no usable answer.");

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

    console.log("DIVYAM.AI generated an answer successfully.");

    // Return answer to dashboard
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
          "Something went wrong.",
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
