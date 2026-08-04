import CommandCenter from "@/components/CommandCenter";

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
        <CommandCenter />
      </div>
    </div>
  );
}
