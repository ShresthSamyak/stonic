// Edge TTS (Microsoft neural voices) — same service as rany2/edge-tts, via a Node port.
// Takes text, returns an MP3 the browser plays. No API key required.
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

export const runtime = "nodejs";
export const maxDuration = 30;

const VOICES = {
  aria: "en-US-AriaNeural", // US English, female
  guy: "en-US-GuyNeural", // US English, male
  neerja: "en-IN-NeerjaNeural", // Indian English, female
  prabhat: "en-IN-PrabhatNeural", // Indian English, male
  sonia: "en-GB-SoniaNeural", // British English, female
  ryan: "en-GB-RyanNeural", // British English, male
};

function collect(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (c) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 2000) : "";
  if (!text) return Response.json({ error: "no_text" }, { status: 400 });

  const voice = VOICES[body?.voice] || VOICES.aria;

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text);
    const buffer = await collect(audioStream);

    if (!buffer || buffer.length < 200) {
      return Response.json({ error: "empty_audio" }, { status: 502 });
    }

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("edge-tts failed", err);
    return Response.json({ error: "tts_failed" }, { status: 502 });
  }
}
