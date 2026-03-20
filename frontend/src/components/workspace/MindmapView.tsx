import { useMemo, useState, type CSSProperties } from "react";
import type { MindLayoutNode } from "../../lib/mindmapParse";
import { flattenMindLayout } from "../../lib/mindmapParse";

type Props = {
  root: MindLayoutNode;
};

function Edges({ n }: { n: MindLayoutNode }) {
  return (
    <>
      {n.children.map((c) => (
        <g key={c.id}>
          <line
            x1={n.x + 110}
            y1={n.y}
            x2={c.x + 4}
            y2={c.y}
            stroke="rgba(110, 231, 183, 0.35)"
            strokeWidth={1.5}
          />
          <Edges n={c} />
        </g>
      ))}
    </>
  );
}

function Nodes({
  n,
  selected,
  onSelect,
}: {
  n: MindLayoutNode;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const w = Math.min(200, Math.max(96, n.label.length * 6.5 + 24));
  const active = selected === n.id;
  return (
    <>
      <g style={{ cursor: "pointer" }} onClick={() => onSelect(n.id)} aria-hidden>
        <rect
          x={n.x}
          y={n.y - 16}
          width={w}
          height={32}
          rx={8}
          fill={active ? "rgba(110, 231, 183, 0.18)" : "rgba(255,255,255,0.06)"}
          stroke={active ? "rgba(110, 231, 183, 0.55)" : "rgba(255,255,255,0.12)"}
          strokeWidth={1}
        />
        <text
          x={n.x + 12}
          y={n.y + 5}
          fill="var(--text, #e2e8f0)"
          fontSize={12}
          fontFamily="system-ui, sans-serif"
        >
          {n.label.length > 32 ? `${n.label.slice(0, 30)}…` : n.label}
        </text>
      </g>
      {n.children.map((c) => (
        <Nodes key={c.id} n={c} selected={selected} onSelect={onSelect} />
      ))}
    </>
  );
}

export function MindmapView({ root }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const flat = useMemo(() => flattenMindLayout(root), [root]);
  const bounds = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const n of flat) {
      const w = Math.min(200, Math.max(96, n.label.length * 6.5 + 24));
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x + w);
      minY = Math.min(minY, n.y - 16);
      maxY = Math.max(maxY, n.y + 16);
    }
    const pad = 32;
    return {
      minX: minX - pad,
      minY: minY - pad,
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2,
    };
  }, [flat]);

  return (
    <div style={styles.wrap}>
      <svg
        width="100%"
        height={Math.max(320, bounds.height)}
        viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
        style={styles.svg}
        role="img"
        aria-label="Интеллект-карта"
      >
        <rect
          x={bounds.minX}
          y={bounds.minY}
          width={bounds.width}
          height={bounds.height}
          fill="rgba(0,0,0,0.15)"
          rx={12}
        />
        <Edges n={root} />
        <Nodes n={root} selected={selected} onSelect={setSelected} />
      </svg>
      {selected ? (
        <p style={styles.hint}>
          Выбрано: <strong>{flat.find((x) => x.id === selected)?.label ?? ""}</strong> — клик по другому узлу для
          переключения.
        </p>
      ) : (
        <p style={styles.hint}>Клик по узлу — подсветка связей смысла (иерархия слева направо).</p>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { width: "100%", overflowX: "auto" },
  svg: { display: "block", minHeight: 320 },
  hint: { margin: "10px 0 0", fontSize: "0.82rem", color: "var(--muted)" },
};
