"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const MODULES = [
  { icon: "🧠", name: "Memory", color: "#4ade80" },
  { icon: "💠", name: "Soul", color: "#e6edf0" },
  { icon: "📖", name: "Skills", color: "#35c9f0" },
  { icon: "⚙️", name: "Settings", color: "#ff5666" },
];

// each agent has a "home" desk + a colour
const AGENTS = [
  { id: "alice", name: "Alice", role: "Research", color: "#4ade80", hx: 20, hy: 34 },
  { id: "bob", name: "Bob", role: "Report", color: "#35c9f0", hx: 80, hy: 32 },
  { id: "carol", name: "Carol", role: "Data", color: "#f5a623", hx: 22, hy: 78 },
  { id: "dave", name: "Dave", role: "Voice", color: "#a78bfa", hx: 80, hy: 78 },
];

// research hub position (center of the floor) where the active agent walks to
const HUB = { x: 50, y: 52 };

// stage -> which agent works + the task shown above them + the action emoji
const STAGE_AGENT = {
  0: { id: "dave", task: "Listening…", emoji: "🎧" },
  2: { id: "alice", task: "Researching…", emoji: "🔎" },
  3: { id: "bob", task: "Writing report…", emoji: "📄" },
  4: { id: "dave", task: "Sending reply…", emoji: "💬" },
};

const STAGE_THOUGHT = [
  "🎙️  Capturing your voice…",
  "🧠  Parsing the command, understanding intent…",
  "🔎  Assigned research task to Alice — gathering information…",
  "📄  Bob is turning the findings into a clean report…",
  "💬  Report ready — speaking the reply out loud…",
];

// deterministic particle field for the core sphere (no Math.random => no hydration mismatch)
function useSphereDots(n = 74) {
  return useMemo(() => {
    const dots = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const r = Math.sqrt(i / n) * 46;
      const a = i * golden;
      const x = Math.round((50 + r * Math.cos(a)) * 100) / 100;
      const y = Math.round((50 + r * Math.sin(a) * 0.72) * 100) / 100;
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
      // Hinglish: use a Hindi voice if the text has Devanagari, else an Indian-English voice
      const hasDevanagari = /[ऀ-ॿ]/.test(t);
      u.lang = hasDevanagari ? "hi-IN" : "en-IN";
      const voices = synth.getVoices();
      const pick = hasDevanagari
        ? voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("hi"))
        : voices.find((v) => v.lang === "en-IN") ||
          voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("en"));
      if (pick) u.voice = pick;
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
        const reply = data?.reply || "Sorry, I didn't get a reply.";
        if (data?.error === "no_key") setError(reply);
        clearTimers();
        setStageAndThought(4);
        const thought =
          "Command received → intent parsed → Alice researched → Bob wrote the report → reply ready.";
        setMessages((m) => [...m, { role: "assistant", content: reply, thought }]);
        speak(reply);
      } catch (e) {
        clearTimers();
        setStage(-1);
        setStatus("idle");
        setError("Couldn't connect to the server. Please try again.");
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
      setError("Voice input isn't supported in this browser. Use Chrome or Edge, or type below.");
      return;
    }
    const rec = new SR();
    recognitionRef.current = rec;
    // hi-IN handles Hindi + Hinglish speech well
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
        setError("Microphone permission denied. Please allow mic access in your browser.");
      else if (e.error === "no-speech") setError("Didn't catch any voice. Please try again.");
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
      ? "Listening…"
      : status === "thinking"
      ? "Agents working…"
      : status === "speaking"
      ? "Speaking…"
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
                <circle r="3" fill="#2ee6c8">
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
                title="Press to talk"
              >
                {status === "listening" ? "⏹" : "🎙"}
              </button>
            </div>
          </div>
        </div>

        {/* Agent Town — game scene */}
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
              {/* rooms */}
              <div className="room" style={{ left: "3%", top: "8%", width: "44%", height: "40%" }}>
                <span className="room-tag">Research Lab</span>
              </div>
              <div className="room" style={{ left: "53%", top: "8%", width: "44%", height: "40%" }}>
                <span className="room-tag">Report Desk</span>
              </div>
              <div className="room" style={{ left: "3%", top: "54%", width: "44%", height: "40%" }}>
                <span className="room-tag">Data Bay</span>
              </div>
              <div className="room" style={{ left: "53%", top: "54%", width: "44%", height: "40%" }}>
                <span className="room-tag">Broadcast</span>
              </div>

              {/* rug + central holo research hub */}
              <div className="furn rug" style={{ left: "50%", top: "52%" }} />
              <div className={`furn holo ${activeAgentId ? "active" : ""}`} style={{ left: "50%", top: "52%" }}>
                <div className="hring a" />
                <div className="hring b" />
                <div className="disc" />
                <div className="hlabel">Hub</div>
              </div>

              {/* furniture: desks + monitors + chairs near each home */}
              {AGENTS.map((a) => (
                <div key={"d" + a.id}>
                  <div className="furn desk" style={{ left: `${a.hx}%`, top: `${a.hy + 8}%` }}>
                    <div className="monitor" />
                  </div>
                  <div className="furn chair" style={{ left: `${a.hx}%`, top: `${a.hy + 17}%` }} />
                </div>
              ))}

              {/* decor */}
              <div className="furn plant" style={{ left: "8%", top: "20%" }}>🪴</div>
              <div className="furn plant" style={{ left: "92%", top: "20%" }}>🌿</div>
              <div className="furn plant" style={{ left: "8%", top: "86%" }}>🌵</div>
              <div className="furn server" style={{ left: "95%", top: "62%" }}>
                <i /><i /><i /><i /><i />
              </div>

              {/* agents */}
              {AGENTS.map((a) => {
                const busy = activeAgentId === a.id;
                const x = busy ? HUB.x : a.hx;
                const y = busy ? HUB.y : a.hy;
                return (
                  <div
                    key={a.id}
                    className={`agent ${busy ? "busy" : ""}`}
                    style={{ left: `${x}%`, top: `${y}%`, color: a.color }}
                  >
                    {busy && activeAgentInfo?.task && (
                      <div className="bubble-task">{activeAgentInfo.task}</div>
                    )}
                    <div className="char">
                      {busy && activeAgentInfo?.emoji && (
                        <span className="action">{activeAgentInfo.emoji}</span>
                      )}
                      <div className="head" style={{ background: a.color }}>
                        {a.name[0]}
                      </div>
                      <div className="torso" />
                      <div className="shadow" />
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
              <span className="tf">👥 4/7 seats</span>
              <span className="tf">⚡ {busyCount}/4 busy</span>
              <span className="chat-fab">💬 Chat</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== RIGHT COLUMN (chat) ===================== */}
      <div className="col col-right">
        <div className="panel chatpanel">
          <div className="chat-tabs">
            {["CHATS", "LOGS", "TASKS", "NOTES"].map((t) => (
              <span key={t} className={`ct ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>
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
              Voice input isn't available in this browser — use Chrome or Edge, or just type below.
            </div>
          )}
          {error && <div className="notice">{error}</div>}

          <div className="messages">
            {messages.length === 0 && (
              <div className="msg-empty">
                🎙️ Tap the mic and ask anything in Hindi, English or Hinglish —<br />
                like “India ke baare mein 3 interesting facts batao”.
                <br />
                <br />
                The agents research, write a report, and Stonic replies out loud.
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div className="msg user fade-in" key={i}>
                  <div className="m-label">You</div>
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
                    Agents are working…
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
                🎙 {status === "listening" ? "Listening…" : "Voice Assistant"}
              </button>
              <label className="vbtn" style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={ttsOn}
                  onChange={(e) => setTtsOn(e.target.checked)}
                  style={{ accentColor: "var(--teal)", marginRight: 4 }}
                />
                Voice Reply
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
