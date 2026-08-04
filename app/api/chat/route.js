// Server-side route. The DeepSeek key lives in .env.local and NEVER reaches the browser.
export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are "Stonic" — a friendly, futuristic AI voice assistant, like JARVIS.

LANGUAGE — this is the most important rule:
- ALWAYS reply in clear, natural ENGLISH only. Never use Hindi or Hinglish, and never use the Devanagari script — not a single word.
- Understand input in any language, but your OUTPUT is always plain English.

STYLE:
- Sound good when spoken aloud — short, clear and conversational. 2 to 5 sentences unless the user asks for more detail.
- For info/research questions, answer like you quickly researched and prepared a short report — straight to the point.
- Avoid heavy markdown symbols (*, #) because the reply is read out loud.
- Warm, confident and friendly, but no rambling.`;

export async function POST(req) {
  const key = process.env.DEEPSEEK_API_KEY;
  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

  if (!key || key === "your_deepseek_api_key_here") {
    return Response.json(
      {
        error: "no_key",
        reply:
          "DeepSeek API key is not set. Please add your real key in the project's .env.local file and restart the server.",
      },
      { status: 200 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request", reply: "Couldn't understand the request." }, { status: 400 });
  }

  const history = Array.isArray(body?.messages) ? body.messages : [];
  // keep only role/content, cap history length to keep prompts small
  const clean = history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-10);

  const messages = [{ role: "system", content: SYSTEM_PROMPT }, ...clean];

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 700,
        stream: false,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("DeepSeek error", res.status, text);
      return Response.json(
        {
          error: "upstream",
          reply:
            "Sorry, couldn't get a response from DeepSeek. Please try again in a moment or check your API key.",
        },
        { status: 200 }
      );
    }

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || "Sorry, I didn't get a reply.";
    return Response.json({ reply });
  } catch (err) {
    console.error("chat route failed", err);
    return Response.json(
      {
        error: "exception",
        reply: "Something went wrong technically. Please try again.",
      },
      { status: 200 }
    );
  }
}
