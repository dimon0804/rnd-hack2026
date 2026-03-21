import type { InfographicSpec } from "../../lib/infographicSpec";

const PALETTE = [
  "rgba(110, 231, 183, 0.85)",
  "rgba(96, 165, 250, 0.85)",
  "rgba(251, 191, 36, 0.85)",
  "rgba(244, 114, 182, 0.85)",
  "rgba(167, 139, 250, 0.85)",
  "rgba(52, 211, 153, 0.75)",
];

function formatValue(v: number, unit?: string): string {
  const abs = Math.abs(v);
  const s =
    abs >= 1e9
      ? `${(v / 1e9).toFixed(2)} млрд`
      : abs >= 1e6
        ? `${(v / 1e6).toFixed(2)} млн`
        : abs >= 1e3
          ? `${(v / 1e3).toFixed(1)} тыс.`
          : Number.isInteger(v)
            ? String(v)
            : v.toFixed(2);
  return unit ? `${s} ${unit}` : s;
}

export function InfographicChart({ spec }: { spec: InfographicSpec }) {
  const items = spec.items.map((it) => ({
    ...it,
    value: typeof it.value === "number" && !Number.isNaN(it.value) ? it.value : 0,
  }));
  const maxVal = Math.max(...items.map((i) => Math.abs(i.value)), 1e-9);
  const sum = items.reduce((a, i) => a + Math.max(0, i.value), 0) || 1;

  if (spec.chart_type === "donut") {
    let angle = 0;
    const segs = items.map((it, idx) => {
      const portion = Math.max(0, it.value) / sum;
      const start = angle;
      angle += portion * 360;
      return {
        ...it,
        startDeg: start,
        endDeg: angle,
        color: PALETTE[idx % PALETTE.length],
      };
    });
    const gradient = segs.map((s) => `${s.color} ${s.startDeg}deg ${s.endDeg}deg`).join(", ");
    return (
      <div className="infographic-chart infographic-chart--donut">
        <div className="infographic-donut-wrap">
          <div
            className="infographic-donut"
            style={{
              background: `conic-gradient(from 0deg, ${gradient})`,
            }}
          />
          <div className="infographic-donut-hole" />
        </div>
        <ul className="infographic-legend">
          {items.map((it, idx) => (
            <li key={idx}>
              <span className="infographic-swatch" style={{ background: PALETTE[idx % PALETTE.length] }} />
              <span className="infographic-legend-label">{it.label}</span>
              <span className="infographic-legend-val">{formatValue(it.value, it.unit)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (spec.chart_type === "horizontal_bar") {
    return (
      <div className="infographic-chart infographic-chart--hbar">
        {items.map((it, idx) => {
          const w = (Math.abs(it.value) / maxVal) * 100;
          return (
            <div key={idx} className="infographic-hrow">
              <div className="infographic-hlabel" title={it.label}>
                {it.label}
              </div>
              <div className="infographic-htrack">
                <div
                  className="infographic-hfill"
                  style={{
                    width: `${w}%`,
                    background: PALETTE[idx % PALETTE.length],
                  }}
                />
              </div>
              <div className="infographic-hval">{formatValue(it.value, it.unit)}</div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="infographic-chart infographic-chart--bar">
      <div className="infographic-bars">
        {items.map((it, idx) => {
          const h = (Math.abs(it.value) / maxVal) * 100;
          return (
            <div key={idx} className="infographic-bcol">
              <div className="infographic-bval">{formatValue(it.value, it.unit)}</div>
              <div className="infographic-btrack">
                <div
                  className="infographic-bfill"
                  style={{
                    height: `${h}%`,
                    background: PALETTE[idx % PALETTE.length],
                  }}
                />
              </div>
              <div className="infographic-blabel" title={it.label}>
                {it.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
