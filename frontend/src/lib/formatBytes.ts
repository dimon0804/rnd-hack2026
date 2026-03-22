/** Человекочитаемый размер файла. */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10_240 ? 1 : 0)} КБ`;
  return `${(n / (1024 * 1024)).toFixed(n < 10_485_760 ? 1 : 1)} МБ`;
}
