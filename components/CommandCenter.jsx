"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const MODULES = [
  { icon: "🧠", name: "Memory", color: "#4ade80" },
  { icon: "💠", name: "Soul", color: "#e6edf0" },
  { icon: "📖", name: "Skills", color: "#35c9f0" },
  { icon: "⚙️", name: "Settings", color: "#ff5666" },
];

const AGENTS = [
  { id: "alice", name: "Alice", role: "रिसर्च", color: "#4ade80", x: 30, y: 40 },
  { id: "bob", name: "Bob", role: "रिपोर्ट", color: "#35c9f0", x: 62, y: 34 },
  { id: "carol", name: "Carol", role: "डेटा", color: "#f5a623", x: 40, y: 68 },
  { id: "dave", name: "Dave", role: "वॉइस", color: "#a78bfa", x: 74, y: 64 },
];

// stage -> which agent is working + the task label shown above them
const STAGE_AGENT = {
  0: { id: "dave", task: "आवाज़ सुन रहा है…" },
  2: { id: "alice", task: "रिसर्च कर रही है…" },
  3: { id: "bob", task: "रिपोर्ट लिख रहा है…" },
  4: { id: "dave", task: "जवाब भेज रहा है…" },
};

const STAGE_THOUGHT = [
  "🎙️  आवाज़ कैप्चर हो रही है…",
  "🧠  कमांड पार्स कर रहा हूँ, इरादा समझ रहा हूँ…",
  "🔎  एजेंट Alice को रिसर्च टास्क सौंपा — जानकारी जुटाई जा रही है…",
  "📄  एजेंट Bob निष्कर्षों को एक साफ़ रिपोर्ट में बदल रहा है…",
  "💬  रिपोर्ट तैयार — जवाब बोलकर सुनाया जा रहा है…",
];

// deterministic particle field for the core sphere (no Math.random => no hydration mismatch)
function useSphereDots(n = 74) {
  return useMemo(() => {
    const dots = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const r = Math.sqrt(i / n) * 46; // percent radius
      const a = i * golden;
      // round to 2 decimals so SSR and client render byte-identical strings (no hydration mismatch)
      const x = Math.round((50 + r * Math.cos(a)) * 100) / 100;
      const y = Math.round((50 + r * Math.sin(a) * 0.72) * 100) / 100; // squash for globe feel
      const pick = i % 7;
      const color = pick === 0 ? "#f5a623" : pick < 3 ? "#35c9f0" : "#2ee6c8";
      const size = 2 + (i % 3);
      dots.push({ x, y, color, size, o: 0.35 + ((i * 37) % 60) / 100 });
    }
    return dots;
  }, [n]);
}

export default function CommandCenter() {
  const dots = useSphereDots();

  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | listening | thinking | speaking
  const [stage, setStage] = useState(-1);
  const [liveThought, setLiveThought] = useState("");
  const [partial, setPartial] = useState("");
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [sttSupported, setSttSupported] = useState(true);
  const [ttsOn, setTtsOn] = useState(true);
  const [tab, setTab] = useState("CHATS");

  const recognitionRef = useRef(null);
  const finalRef = useRef("");
  const timersRef = useRef([]);
  const messagesRef = useRef([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const SR =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) setSttSupported(false);
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };

  const setStageAndThought = (s) => {
    setStage(s);
    if (s >= 0 && STAGE_THOUGHT[s]) {
      setLiveThought((prev) => (prev ? prev + "\n" + STAGE_THOUGHT[s] : STAGE_THOUGHT[s]));
    }
  };

  const speak = useCallback(
    (t) => {
      if (!ttsOn || typeof window === "undefined" || !window.speechSynthesis) {
        setStatus("idle");
        setStage(-1);
        return;
      }
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(t);
      u.lang = "hi-IN";
      const voices = synth.getVoices();
      const hi =
        voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("hi")) ||
        voices.find((v) => /hindi/i.test(v.name || ""));
      if (hi) u.voice = hi;
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
    setStageAndThought(1);
    timersRef.current.push(setTimeout(() => setStageAndThought(2), 650));
    timersRef.current.push(setTimeout(() => setStageAndThought(3), 1700));
  };

  const send = useCallback(
    async (raw) => {
      const content = (raw || "").trim();
      if (!content || status === "thinking") return;
      setError("");
      setPartial("");
      setLiveThought("");

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
        setStageAndThought(4);
        const thought =
          "कमांड मिली → इरादा समझा → Alice ने रिसर्च की → Bob ने रिपोर्ट बनाई → जवाब तैयार।";
        setMessages((m) => [...m, { role: "assistant", content: reply, thought }]);
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
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSttSupported(false);
      setError("यह ब्राउज़र वॉइस इनपुट सपोर्ट नहीं करता। Chrome या Edge इस्तेमाल करें, या नीचे टाइप करें।");
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
      if (e.error === "not-allowed" || e.error === "service-not-allowed")
        setError("माइक्रोफ़ोन की अनुमति नहीं मिली। ब्राउज़र में mic access दें।");
      else if (e.error === "no-speech") setError("कोई आवाज़ नहीं सुनाई दी। दोबारा बोलिए।");
      setStatus("idle");
      setStage(-1);
    };
    rec.onend = () => {
      const finalText = finalRef.current.trim();
      setPartial("");
      if (finalText) send(finalText);
      else {
        setStatus("idle");
        setStage(-1);
      }
    };

    try {
      rec.start();
    } catch {}
  };

  const onMicClick = () => {
    if (status === "listening") stopListening();
    else if (status === "idle") startListening();
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const v = text;
    setText("");
    send(v);
  };

  const activeAgentInfo = stage >= 0 ? STAGE_AGENT[stage] : null;
  const activeAgentId = activeAgentInfo?.id || null;
  const busyCount = activeAgentId ? 1 : 0;
  const coreBusy = status === "thinking" || status === "speaking";

  const micLabel =
    status === "listening"
      ? "सुन रहा हूँ…"
      : status === "thinking"
      ? "एजेंट काम कर रहे हैं…"
      : status === "speaking"
      ? "बोल रहा हूँ…"
      : "System Active";

  return (
    <>
      {/* ===================== CENTER COLUMN ===================== */}
      <div className="col col-center">
        {/* Module rail -> connectors -> core sphere */}
        <div className="core-zone">
          <div className="modules">
            {MODULES.map((m) => (
              <div className="module" key={m.name} style={{ "--mc": m.color }}>
                <div className="mic-box">{m.icon}</div>
                <div className="mname">{m.name}</div>
                <div className="mchev">▸</div>
              </div>
            ))}
          </div>

          <div className="connectors" aria-hidden>
            <svg viewBox="0 0 300 200" preserveAspectRatio="none">
              {[
                { y: 26, c: "#4ade80" },
                { y: 78, c: "#e6edf0" },
                { y: 122, c: "#35c9f0" },
                { y: 174, c: "#ff5666" },
              ].map((p, i) => (
                <path
                  key={i}
                  d={`M0 ${p.y} C 90 ${p.y}, 120 100, 175 100`}
                  fill="none"
                  stroke={p.c}
                  strokeWidth="1.6"
                  opacity={coreBusy ? 0.9 : 0.5}
                />
              ))}
              <path d="M175 100 L300 100" stroke="#35c9f0" strokeWidth="1.6" opacity="0.7" />
              <circle cx="175" cy="100" r="4" fill="#35c9f0" />
              {coreBusy && (
                <circle r="3" fill="#2ee6c8" className="flow-dot">
                  <animateMotion dur="1.6s" repeatCount="indefinite" path="M175 100 L300 100" />
                </circle>
              )}
            </svg>
          </div>

          <div className="core">
            <div className={`sphere ${coreBusy ? "busy" : ""}`}>
              <div className="globe">
                <div className="orbit o1" />
                <div className="orbit o2" />
                {dots.map((d, i) => (
                  <span
                    key={i}
                    className="pt-dot"
                    style={{
                      left: `${d.x}%`,
                      top: `${d.y}%`,
                      width: d.size,
                      height: d.size,
                      background: d.color,
                      opacity: d.o,
                      boxShadow: `0 0 4px ${d.color}`,
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="core-status">
              <span className="led" /> {micLabel}
            </div>
            <div className="core-actions">
              <button className="terminate" onClick={() => window.speechSynthesis?.cancel()}>
                Terminate
              </button>
              <button
                className={`core-mic ${status === "listening" ? "on" : ""}`}
                onClick={onMicClick}
                disabled={status === "thinking" || status === "speaking"}
                title="बोलने के लिए दबाएँ"
              >
                {status === "listening" ? "⏹" : "🎙"}
              </button>
            </div>
          </div>
        </div>

        {/* Agent Town */}
        <div className="panel agenttown">
          <div className="panel-h">
            <div className="pt">
              <span className="led" /> Agent Town
            </div>
            <div className="town-tabs">
              <span className="town-tab on">Agent Town</span>
              <span className="town-tab">Visual Hub</span>
              <span className="town-tab">Gesture</span>
            </div>
          </div>

          <div className="town-body">
            <div className="agent-chips">
              {AGENTS.map((a) => (
                <div key={a.id} className={`agent-chip ${activeAgentId === a.id ? "busy" : ""}`}>
                  <span className="av" style={{ background: a.color }}>
                    {a.name[0]}
                  </span>
                  {a.name}
                  <span className="st" />
                </div>
              ))}
            </div>

            <div className="floor">
              <div className="room" style={{ left: "4%", top: "8%", width: "54%", height: "44%" }} />
              <div className="room" style={{ left: "40%", top: "50%", width: "56%", height: "42%" }} />
              {/* desks */}
              <div className="desk" style={{ left: "22%", top: "34%", width: "14%", height: "8%" }} />
              <div className="desk" style={{ left: "56%", top: "28%", width: "14%", height: "8%" }} />
              <div className="desk" style={{ left: "34%", top: "62%", width: "14%", height: "8%" }} />
              <div className="desk" style={{ left: "68%", top: "58%", width: "14%", height: "8%" }} />

              {AGENTS.map((a) => {
                const busy = activeAgentId === a.id;
                return (
                  <div
                    key={a.id}
                    className={`agent ${busy ? "busy" : ""}`}
                    style={{ left: `${a.x}%`, top: `${a.y}%`, color: a.color }}
                  >
                    {busy && activeAgentInfo?.task && (
                      <div className="bubble-task">{activeAgentInfo.task}</div>
                    )}
                    <div className="body" style={{ background: a.color }}>
                      {a.name[0]}
                    </div>
                    <div className="nm">{a.name}</div>
                  </div>
                );
              })}
            </div>

            <div className="town-footer">
              <span className="tf online">
                <span className="led" /> Online
              </span>
              <span className="tf">👥 4/7 seat</span>
              <span className="tf">⚡ {busyCount}/4 busy</span>
              <span className="chat-fab">💬 Chat</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== RIGHT COLUMN (chat) ===================== */}
      <div className="col">
        <div className="panel chatpanel">
          <div className="chat-tabs">
            {["CHATS", "LOGS", "TASKS", "NOTES"].map((t) => (
              <span
                key={t}
                className={`ct ${tab === t ? "on" : ""}`}
                onClick={() => setTab(t)}
              >
                {t}
              </span>
            ))}
            <span className="spacer">
              <span>＋</span>
              <span>↻</span>
            </span>
          </div>

          {!sttSupported && (
            <div className="notice">
              वॉइस इनपुट इस ब्राउज़र में उपलब्ध नहीं — Chrome/Edge इस्तेमाल करें या नीचे टाइप करें।
            </div>
          )}
          {error && <div className="notice">{error}</div>}

          <div className="messages">
            {messages.length === 0 && (
              <div className="msg-empty">
                🎙️ माइक दबाइए और हिंदी में कुछ पूछिए —<br />
                जैसे “भारत के बारे में तीन रोचक बातें बताओ”।<br />
                <br />
                एजेंट रिसर्च करेंगे, रिपोर्ट बनाएँगे और Stonic आपको बोलकर जवाब देगा।
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div className="msg user fade-in" key={i}>
                  <div className="m-label">आप</div>
                  <div className="m-user-bubble">{m.content}</div>
                </div>
              ) : (
                <div className="msg ai fade-in" key={i}>
                  <div className="m-label">
                    <span className="led" /> Stonic AI
                  </div>
                  {m.thought && (
                    <details className="thought">
                      <summary>◆ Thought Process</summary>
                      <div className="tbody">{m.thought}</div>
                    </details>
                  )}
                  <div className="m-ai-bubble">{m.content}</div>
                </div>
              )
            )}

            {status === "thinking" && (
              <div className="msg ai">
                <div className="m-label">
                  <span className="led" /> Stonic AI
                </div>
                <details className="thought" open>
                  <summary>◆ Thought Process</summary>
                  <div className="tbody">{liveThought || STAGE_THOUGHT[1]}</div>
                </details>
                <div className="m-ai-bubble">
                  <span className="thinking-row">
                    <span className="eq active">
                      <span /><span /><span /><span /><span />
                    </span>
                    एजेंट काम कर रहे हैं…
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-wrap">
            <form className="chat-input" onSubmit={onSubmit}>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type to Assistant (DeepSeek)…"
                disabled={status === "thinking"}
              />
              <button className="send-btn" type="submit" disabled={status === "thinking"}>
                ↑
              </button>
            </form>
            <div className="chat-controls">
              <button
                className={`vbtn primary ${status === "listening" ? "on" : ""}`}
                onClick={onMicClick}
                disabled={status === "thinking" || status === "speaking"}
              >
                🎙 {status === "listening" ? "सुन रहा हूँ…" : "Voice Assistant"}
              </button>
              <label className="vbtn" style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={ttsOn}
                  onChange={(e) => setTtsOn(e.target.checked)}
                  style={{ accentColor: "var(--teal)", marginRight: 4 }}
                />
                बोलकर जवाब
              </label>
              <span className="live">
                <span className="led" /> Live Connected
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
