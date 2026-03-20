/** Парсинг иерархии из ответа LLM: отступы (пробелы/таб), маркеры - * • */

export type MindNode = { id: string; label: string; children: MindNode[] };

let idSeq = 0;
function nid(): string {
  idSeq += 1;
  return `n${idSeq}`;
}

function depthOfLine(line: string): number {
  const m = line.match(/^[\t ]*/);
  if (!m) return 0;
  const prefix = m[0];
  let d = 0;
  for (const ch of prefix) {
    if (ch === "\t") d += 1;
    else d += 0.5;
  }
  return Math.floor(d);
}

function cleanLabel(raw: string): string {
  return raw
    .replace(/^[-*•]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .trim();
}

/** Корень — синтетический; реальные темы в children. */
export function parseMindmapText(text: string, rootLabel = "Документ"): MindNode {
  idSeq = 0;
  const root: MindNode = { id: nid(), label: rootLabel, children: [] };
  const stack: { depth: number; node: MindNode }[] = [{ depth: -1, node: root }];

  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const depth = depthOfLine(line);
    const label = cleanLabel(line.trim());
    if (!label) continue;

    const node: MindNode = { id: nid(), label, children: [] };

    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }

    stack[stack.length - 1].node.children.push(node);
    stack.push({ depth, node });
  }

  return root;
}

export type MindLayoutNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  children: MindLayoutNode[];
};

/** Дерево с координатами: листья по вертикали, родитель по середине детей. */
export function layoutMindmap(root: MindNode, opts?: { xStep?: number; yStep?: number }): MindLayoutNode {
  const xStep = opts?.xStep ?? 200;
  const yStep = opts?.yStep ?? 40;
  let yLeaf = 0;

  function build(n: MindNode, depth: number): MindLayoutNode {
    if (!n.children.length) {
      const y = yLeaf * yStep;
      yLeaf += 1;
      return { ...n, x: depth * xStep, y, children: [] };
    }
    const kids = n.children.map((c) => build(c, depth + 1));
    const y = kids.reduce((s, k) => s + k.y, 0) / kids.length;
    return { ...n, x: depth * xStep, y, children: kids };
  }

  if (!root.children.length) {
    return { ...root, x: 0, y: 0, children: [] };
  }
  const children = root.children.map((c) => build(c, 0));
  const y = children.reduce((s, k) => s + k.y, 0) / children.length;
  return { ...root, x: -xStep, y, children };
}

export function flattenMindLayout(n: MindLayoutNode): MindLayoutNode[] {
  return [n, ...n.children.flatMap(flattenMindLayout)];
}
