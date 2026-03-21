export function KnowledgeVisual() {
  return (
    <div className="hero-visual-wrap">
      <svg className="knowledge-svg" viewBox="0 0 320 400" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <path className="kv-line" d="M48 210 C 90 120, 130 100, 168 168 S 260 260, 272 118" />
        <path className="kv-line kv-line--2" d="M168 168 L 210 310 L 92 340" />
        <path className="kv-line kv-line--3" d="M168 168 L 118 72" />
        <circle className="kv-node kv-node--soft" cx="48" cy="210" r="5" />
        <circle className="kv-node" cx="168" cy="168" r="7" />
        <circle className="kv-node kv-node--soft" cx="272" cy="118" r="5" />
        <circle className="kv-node kv-node--soft" cx="210" cy="310" r="5" />
        <circle className="kv-node kv-node--soft" cx="92" cy="340" r="5" />
        <circle className="kv-node kv-node--soft" cx="118" cy="72" r="4" />
      </svg>
    </div>
  );
}
