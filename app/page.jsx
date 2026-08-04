import CommandCenter from "@/components/CommandCenter";

const HEADLINES = [
  "AI एथिक्स और रेगुलेशन पर फोकस के साथ ग्लोबल टेक समिट शुरू",
  "लंबे समय से प्रतिद्वंद्वी देशों के बीच ऐतिहासिक शांति समझौता",
  "क्वांटम कंप्यूटिंग में सफलता से डेटा एन्क्रिप्शन में क्रांति की उम्मीद",
];

const BLIPS = [
  { x: 22, y: 34, c: "amber" },
  { x: 38, y: 48, c: "red" },
  { x: 30, y: 62, c: "amber" },
  { x: 52, y: 30, c: "teal" },
  { x: 68, y: 44, c: "amber" },
  { x: 74, y: 58, c: "red" },
  { x: 46, y: 72, c: "teal" },
  { x: 84, y: 66, c: "amber" },
  { x: 16, y: 50, c: "teal" },
];

export default function Page() {
  return (
    <div className="app">
      {/* Title bar */}
      <div className="titlebar">
        <div className="tb-brand">
          <span className="tb-logo">S</span>
          Stonic AI
        </div>
        <div className="tb-controls">
          <span className="tb-dot">—</span>
          <span className="tb-dot">▢</span>
          <span className="tb-dot">✕</span>
        </div>
      </div>

      <div className="workspace">
        {/* ---------- LEFT COLUMN (static) ---------- */}
        <div className="col">
          {/* Media link */}
          <div className="panel">
            <div className="panel-h">
              <div className="pt">
                <span className="led" /> Media Link
              </div>
              <div className="panel-actions">
                <span>⋯</span>
              </div>
            </div>
            <div className="panel-body">
              <div className="media-view">
                <div className="media-chip">System Offline</div>
                <div className="media-icons">
                  <span className="mini-btn">📷</span>
                  <span className="mini-btn">🖥</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sat-link feed */}
          <div className="panel">
            <div className="panel-h">
              <div className="pt">
                <span className="led" /> Sat-Link Feed
              </div>
              <div className="panel-actions">
                <span>↻</span>
                <span>⤢</span>
              </div>
            </div>
            <div style={{ padding: "4px 4px 8px" }}>
              <div style={{ fontSize: 10, letterSpacing: "0.16em", color: "var(--muted)", padding: "6px 12px 0", textTransform: "uppercase" }}>
                ● Satellite Stream
              </div>
              <div className="map-toolbar">
                <span className="seg">
                  <b className="on">2D</b>
                  <b>3D</b>
                </span>
              </div>
              <div className="map">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                  {/* graticule */}
                  {[20, 40, 60, 80].map((y) => (
                    <line key={"h" + y} x1="0" y1={y} x2="100" y2={y} stroke="rgba(46,230,200,0.08)" strokeWidth="0.3" />
                  ))}
                  {[20, 40, 60, 80].map((x) => (
                    <line key={"v" + x} x1={x} y1="0" x2={x} y2="100" stroke="rgba(46,230,200,0.08)" strokeWidth="0.3" />
                  ))}
                  {/* faint stylized landmasses */}
                  <g fill="rgba(46,230,200,0.10)" stroke="rgba(46,230,200,0.22)" strokeWidth="0.3">
                    <path d="M8,30 Q18,22 30,28 Q36,38 28,46 Q16,50 10,42 Z" />
                    <path d="M40,26 Q52,20 60,30 Q58,42 48,44 Q40,38 40,26 Z" />
                    <path d="M46,58 Q56,54 58,66 Q52,78 46,74 Q42,66 46,58 Z" />
                    <path d="M66,40 Q80,34 86,46 Q84,58 74,60 Q66,52 66,40 Z" />
                    <path d="M78,66 Q86,62 88,70 Q84,76 78,74 Z" />
                  </g>
                </svg>
                {BLIPS.map((b, i) => (
                  <span key={i} className={`blip ${b.c}`} style={{ left: `${b.x}%`, top: `${b.y}%` }} />
                ))}
              </div>
            </div>
          </div>

          {/* Headlines */}
          <div className="panel">
            <div className="panel-h">
              <div className="pt">
                <span className="led" /> Today Headlines
              </div>
              <div className="panel-actions">
                <span>↻</span>
                <span>▤</span>
              </div>
            </div>
            <div className="panel-body" style={{ paddingTop: 4, paddingBottom: 6 }}>
              {HEADLINES.map((h, i) => (
                <div className="headline" key={i}>
                  <span className="num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="htext">{h}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ---------- CENTER + RIGHT (interactive) ---------- */}
        <CommandCenter />
      </div>
    </div>
  );
}
