/** Человекочитаемые подписи статусов документа (как в API — латиница). */
export function documentStatusRu(status: string): string {
  const s = status.trim().toLowerCase();
  const map: Record<string, string> = {
    pending: "Ожидает обработки",
    queued: "В очереди",
    processing: "Обрабатывается",
    ready: "Готово",
    failed: "Ошибка",
  };
  return map[s] ?? status;
}
