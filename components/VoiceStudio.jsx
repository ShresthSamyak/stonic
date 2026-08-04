"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STAGES = [
  { icon: "🎙️", label: "आपकी आवाज़", desc: "हिंदी कमांड" },
  { icon: "🧠", label: "असिस्टेंट", desc: "कमांड समझी" },
  { icon: "🔎", label: "रिसर्च एजेंट", desc: "जानकारी जुटा रहा है" },
  { icon: "📄", label: "रिपोर्ट", desc: "तैयार कर रहा है" },
  { icon: "💬", label: "जवाब", desc: "बोलकर सुना रहा है" },
];

const CAPTIONS = [
  "आपकी आवाज़ सुन रहा हूँ…",
  "कमांड समझ ली — एजेंट को भेज रहा हूँ…",
  "रिसर्च एजेंट जानकारी खोज रहा है…",
  "एजेंट रिपोर्ट तैयार कर रहा है…",
  "जवाब बोलकर सुना रहा हूँ…",
];

export default function VoiceStudio() {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | listening | thinking | speaking
  const [stage, setStage] = useState(-1);
  const [partial, setPartial] = useState("");
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [sttSupported, setSttSupported] = useState(true);
  const [ttsOn, setTtsOn] = useState(true);

  const recognitionRef = useRef(null);
  const finalRef = useRef("");
  const timersRef = useRef([]);
  const chatRef = useRef(null);
  const messagesRef = useRef([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const SR =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) setSttSupported(false);
    // warm up voices
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, partial]);

  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };

  const speak = useCallback(
    (textToSpeak) => {
      if (!ttsOn || typeof window === "undefined" || !window.speechSynthesis) {
        setStatus("idle");
        setStage(-1);
        return;
      }
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(textToSpeak);
      u.lang = "hi-IN";
      const voices = synth.getVoices();
      const hi =
        voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("hi")) ||
        voices.find((v) => /hindi/i.test(v.name || ""));
      if (hi) u.voice = hi;
      u.rate = 1;
      u.pitch = 1;
      u.onstart = () => {
        setStatus("speaking");
        setStage(4);
      };
      u.onend = () => {
        setStatus("idle");
        setStage(-1);
      };
      u.onerror = () => {
        setStatus("idle");
        setStage(-1);
      };
      synth.speak(u);
    },
    [ttsOn]
  );

  const runStageAnimation = () => {
    clearTimers();
    setStage(1);
    timersRef.current.push(setTimeout(() => setStage(2), 700));
    timersRef.current.push(setTimeout(() => setStage(3), 1700));
  };

  const send = useCallback(
    async (raw) => {
      const content = (raw || "").trim();
      if (!content || status === "thinking") return;
      setError("");
      setPartial("");

      const nextMessages = [...messagesRef.current, { role: "user", content }];
      setMessages(nextMessages);
      setStatus("thinking");
      runStageAnimation();

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: nextMessages }),
        });
        const data = await res.json();
        const reply = data?.reply || "माफ़ कीजिए, कोई जवाब नहीं मिला।";
        if (data?.error === "no_key") setError(reply);
        clearTimers();
        setStage(3);
        setMessages((m) => [...m, { role: "assistant", content: reply }]);
        speak(reply);
      } catch (e) {
        clearTimers();
        setStage(-1);
        setStatus("idle");
        setError("सर्वर से कनेक्ट नहीं हो पाया। कृपया दोबारा प्रयास करें।");
      }
    },
    [speak, status]
  );

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
  };

  const startListening = () => {
    setError("");
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSttSupported(false);
      setError("यह ब्राउज़र वॉइस इनपुट सपोर्ट नहीं करता। कृपया Chrome या Edge इस्तेमाल करें, या नीचे टाइप करें।");
      return;
    }
    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = "hi-IN";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    finalRef.current = "";

    rec.onstart = () => {
      setStatus("listening");
      setStage(0);
    };
    rec.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      if (final) finalRef.current += final;
      setPartial(finalRef.current + interim);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("माइक्रोफ़ोन की अनुमति नहीं मिली। ब्राउज़र में mic access दें।");
      } else if (e.error === "no-speech") {
        setError("कोई आवाज़ नहीं सुनाई दी। दोबारा बोलिए।");
      }
      setStatus("idle");
      setStage(-1);
    };
    rec.onend = () => {
      const finalText = finalRef.current.trim();
      setPartial("");
      if (finalText) {
        send(finalText);
      } else if (status === "listening") {
        setStatus("idle");
        setStage(-1);
      }
    };

    try {
      rec.start();
    } catch {
      // already started
    }
  };

  const onMicClick = () => {
    if (status === "listening") stopListening();
    else if (status === "idle") startListening();
  };

  const onTextSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const v = text;
    setText("");
    send(v);
  };

  const orbClass =
    status === "listening"
      ? "orb listening"
      : status === "thinking"
      ? "orb thinking"
      : status === "speaking"
      ? "orb speaking"
      : "orb";

  const micLabel =
    status === "listening"
      ? "सुन रहा हूँ… (रोकने के लिए दबाएँ)"
      : status === "thinking"
      ? "एजेंट काम कर रहा है…"
      : status === "speaking"
      ? "बोल रहा हूँ…"
      : "बोलने के लिए माइक दबाएँ";

  return (
    <>
      <div className="assistant">
        {/* Orb + mic */}
        <div className="card glowtop">
          <div className="orb-stage">
            <div className={orbClass}>
              <span className="ring" />
              <span className="ring r2" />
              <span className="orb-core">
                {status === "speaking" || status === "listening" ? (
                  <span className={`eq active`}>
                    <span /><span /><span /><span /><span />
                  </span>
                ) : (
                  "🤖"
                )}
              </span>
            </div>

            <button
              className={`mic-btn ${status === "listening" ? "on" : ""}`}
              onClick={onMicClick}
              disabled={status === "thinking" || status === "speaking"}
              aria-label="माइक"
              title="माइक"
            >
              {status === "listening" ? "⏹" : "🎤"}
            </button>

            <div className="status-line">
              {partial ? (
                <span>“{partial}”</span>
              ) : (
                <span>
                  <b>Stonic</b> · {micLabel}
                </span>
              )}
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <label style={{ fontSize: 13, color: "var(--muted)", display: "flex", gap: 7, alignItems: "center", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={ttsOn}
                  onChange={(e) => setTtsOn(e.target.checked)}
                  style={{ accentColor: "var(--accent)" }}
                />
                आवाज़ में जवाब
              </label>
            </div>
          </div>

          {!sttSupported && (
            <div className="notice">
              वॉइस इनपुट इस ब्राउज़र में उपलब्ध नहीं है — कृपया Chrome/Edge इस्तेमाल करें या नीचे टाइप करें।
            </div>
          )}
          {error && <div className="notice">{error}</div>}
        </div>

        {/* Chat / transcript */}
        <div className="card">
          <div className="chat" ref={chatRef}>
            {messages.length === 0 && (
              <div className="chat-empty">
                माइक दबाइए और हिंदी में कुछ पूछिए —<br />
                जैसे “भारत के बारे में तीन रोचक बातें बताओ” या
                <br />“मुझे productivity बढ़ाने के टिप्स दो”।
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role === "user" ? "user" : "ai"} fade-up`}>
                <div className="who">{m.role === "user" ? "आप" : "Stonic"}</div>
                {m.content}
              </div>
            ))}
            {status === "thinking" && (
              <div className="bubble ai">
                <div className="who">Stonic</div>
                <span className="eq active" aria-label="typing">
                  <span /><span /><span /><span /><span />
                </span>
              </div>
            )}
          </div>

          <form className="text-input" onSubmit={onTextSubmit}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="या यहाँ हिंदी में टाइप करें…"
              disabled={status === "thinking"}
            />
            <button type="submit" className="btn btn-glow" disabled={status === "thinking"}>
              भेजें
            </button>
          </form>
        </div>
      </div>

      {/* Agent workflow visualization */}
      <div className="flow">
        <div className="flow-track">
          {STAGES.map((s, i) => {
            const active = stage === i;
            const done = stage > i || (stage === -1 && messages.length > 0 && i < 4);
            return (
              <div key={i} className={`node ${active ? "active" : ""} ${done ? "done" : ""}`}>
                <span className="tick">✓</span>
                <div className="ic">{s.icon}</div>
                <div className="nlabel">{s.label}</div>
                <div className="ndesc">{s.desc}</div>
              </div>
            );
          })}
        </div>
        <div className="flow-caption">
          {stage >= 0 ? (
            <span>
              <b>चरण {stage + 1}/5:</b> {CAPTIONS[stage]}
            </span>
          ) : (
            <span>आपकी कमांड इन 5 चरणों से गुज़रती है — आवाज़ → समझ → रिसर्च → रिपोर्ट → जवाब।</span>
          )}
        </div>
      </div>
    </>
  );
}
