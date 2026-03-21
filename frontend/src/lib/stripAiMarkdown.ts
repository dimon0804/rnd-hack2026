/**
 * Убирает типичный markdown из ответов модели (#, **, ` и т.д.).
 */

export function stripAiMarkdown(input: string): string {
  let s = input.replace(/\r\n/g, "\n");

  s = s.replace(/^#{1,6}\s+/gm, "");

  for (let i = 0; i < 10 && (s.includes("**") || s.includes("__")); i++) {
    s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
    s = s.replace(/__([^_]+)__/g, "$1");
  }

  s = s.replace(/`([^`]+)`/g, "$1");
  s = s.replace(/```[\s\S]*?```/g, (block) =>
    block.replace(/^```\w*\n?/, "").replace(/```\s*$/, "").trim(),
  );

  return s.replace(/\n{3,}/g, "\n\n").trim();
}
