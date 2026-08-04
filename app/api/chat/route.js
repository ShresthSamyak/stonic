// Server-side route. The DeepSeek key lives in .env.local and NEVER reaches the browser.
export const runtime = "nodejs";

const SYSTEM_PROMPT = `तुम "Stonic" हो — एक फ्यूचरिस्टिक हिंदी AI वॉइस असिस्टेंट, बिल्कुल जैसे किसी sci-fi फिल्म का JARVIS।

नियम:
- हमेशा हिंदी (देवनागरी) में जवाब दो, आसान और बातचीत वाली भाषा में। ज़रूरत हो तो अंग्रेज़ी के common शब्द ठीक हैं।
- जवाब बोलकर सुनाने लायक हो — छोटा, साफ़ और natural। 2 से 5 वाक्य काफी हैं जब तक user ज़्यादा detail न माँगे।
- अगर user कोई जानकारी या रिसर्च माँगे, तो ऐसे जवाब दो जैसे तुमने पता लगाकर एक छोटी रिपोर्ट तैयार की हो — सीधे मुद्दे की बात, points में अगर ज़रूरी हो।
- markdown symbols (*, #) कम इस्तेमाल करो क्योंकि यह टेक्स्ट बोलकर सुनाया जाएगा।
- गर्मजोशी और थोड़ा confident tone रखो, पर बकवास मत करो।`;

export async function POST(req) {
  const key = process.env.DEEPSEEK_API_KEY;
  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

  if (!key || key === "your_deepseek_api_key_here") {
    return Response.json(
      {
        error: "no_key",
        reply:
          "DeepSeek API key सेट नहीं है। कृपया प्रोजेक्ट की .env.local फाइल में अपनी असली key डालें और सर्वर दोबारा चालू करें।",
      },
      { status: 200 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request", reply: "अनुरोध समझ नहीं आया।" }, { status: 400 });
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
            "माफ़ कीजिए, DeepSeek से जवाब नहीं मिल पाया। थोड़ी देर बाद फिर कोशिश करें या अपनी API key जाँच लें।",
        },
        { status: 200 }
      );
    }

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || "माफ़ कीजिए, मुझे जवाब नहीं मिला।";
    return Response.json({ reply });
  } catch (err) {
    console.error("chat route failed", err);
    return Response.json(
      {
        error: "exception",
        reply: "कुछ तकनीकी दिक्कत आ गई। कृपया दोबारा प्रयास करें।",
      },
      { status: 200 }
    );
  }
}
