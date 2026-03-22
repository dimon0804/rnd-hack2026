import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { aiChat } from "../api/ai";
import { listDocuments } from "../api/documents";
import type { RagChunk } from "../api/rag";
import { formatRagChunksForLlm, ragQuery, ragQueryBalanced } from "../api/rag";
import { humanizeChatError } from "../lib/apiError";
import { hydrateChunkTextsFromDocuments } from "../lib/ragChunkHydrate";
import { useAuth } from "../context/AuthContext";
import { SttChatToolbar } from "./SttChatToolbar";

type Msg = { role: "user" | "assistant"; content: string };

const MAX_CONTEXT_CHARS = 12000;

function isReady(d: { status: string }): boolean {
  return d.status.trim().toLowerCase() === "ready";
}

function buildSystemPrompt(
  chunks: RagChunk[],
  docNames: Record<string, string>,
  multiDoc: boolean,
): string {
  const intro = multiDoc
    ? "Ты помощник по нескольким документам пользователя. Отвечай на русском. Пиши обычным текстом, без markdown (заголовки #, **жирный**, обратные кавычки). Фрагменты подписаны именами файлов — сопоставляй ответ с нужным файлом; при общем вопросе используй все релевантные блоки. Опирайся на приведённый текст; если ответа нет — скажи прямо, не выдумывай."
    : "Ты помощник по документам пользователя. Отвечай на русском. Пиши обычным текстом, без markdown (заголовки #, **жирный**, обратные кавычки). Ниже — только фрагменты из файлов этого пользователя. Опирайся на них; если ответа нет — скажи прямо, не выдумывай.";
  if (!chunks.length) {
    return `${intro}\n\nПо запросу не найдено релевантных фрагментов в индексе (или индекс пуст после перезапуска сервера). Ответь кратко и предложи загрузить документы на странице загрузки.`;
  }
  const body = formatRagChunksForLlm(
    chunks,
    (id) => docNames[id] ?? (id.length > 12 ? `${id.slice(0, 8)}…` : id),
    MAX_CONTEXT_CHARS,
  );
  return `${intro}\n\n${body}`;
}

export function ChatPanel() {
  const { authFetch } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastChunks, setLastChunks] = useState<RagChunk[]>([]);
  const [readyCount, setReadyCount] = useState<number | null>(null);
  const [sttBusy, setSttBusy] = useState(false);
  const refreshReadyCount = useCallback(async () => {
    try {
      const docs = await listDocuments(authFetch);
      setReadyCount(docs.filter(isReady).length);
    } catch {
      setReadyCount(null);
    }
  }, [authFetch]);

  useEffect(() => {
    void refreshReadyCount();
  }, [refreshReadyCount]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy || sttBusy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setBusy(true);
    try {
      const myDocs = await listDocuments(authFetch);
      const indexedIds = myDocs.filter(isReady).map((d) => d.id);
      setReadyCount(indexedIds.length);

      if (indexedIds.length === 0) {
        setLastChunks([]);
        const systemPrompt =
          "У пользователя нет проиндексированных документов (статус ready). Ответь по-русски коротко: предложи загрузить файл и дождаться готовности.";
        const reply = await aiChat(text, systemPrompt, authFetch, { maxTokens: 600 });
        setMessages((m) => [...m, { role: "assistant", content: reply.content }]);
        return;
      }

      const docNames = Object.fromEntries(myDocs.map((d) => [d.id, d.original_filename]));
      const multi = indexedIds.length > 1;
      const topK = multi ? 12 : 6;
      let chunks = multi
        ? await ragQueryBalanced(text, authFetch, topK, indexedIds)
        : await ragQuery(text, authFetch, topK, indexedIds);
      chunks = await hydrateChunkTextsFromDocuments(chunks, authFetch);
      setLastChunks(chunks);
      const systemPrompt = buildSystemPrompt(chunks, docNames, multi);
      const reply = await aiChat(text, systemPrompt, authFetch, { maxTokens: 1200 });
      setMessages((m) => [...m, { role: "assistant", content: reply.content }]);
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Ошибка запроса";
      setMessages((m) => [...m, { role: "assistant", content: humanizeChatError(raw) }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.kicker}>Ваши материалы</p>
          <h1 style={styles.title}>Вопросы по загруженным файлам</h1>
          <p style={styles.lead}>
            Ответ строится на основе <strong>ваших</strong> документов со статусом «готово» — сначала поиск по тексту, затем
            нейросеть. Это не общий чат про всё на свете.
          </p>
        </div>
        <div style={styles.headerAside}>
          {readyCount !== null ? (
            <div style={styles.stat}>
              <span style={styles.statNum}>{readyCount}</span>
              <span style={styles.statLabel}>файлов в индексе</span>
            </div>
          ) : (
            <span style={styles.mutedSm}>…</span>
          )}
          <Link to="/upload" style={styles.linkBtn}>
            Загрузить ещё
          </Link>
        </div>
      </header>

      {readyCount === 0 ? (
        <div style={styles.warnBanner}>
          <strong>Нет готовых документов.</strong> Загрузите файл и дождитесь статуса ready — тогда чат сможет опираться на
          текст.
        </div>
      ) : null}

      <div style={styles.shell}>
        <div style={styles.thread}>
          {messages.length === 0 ? (
            <div style={styles.empty}>
              <p style={styles.emptyTitle}>Начните с вопроса</p>
              <p style={styles.emptyText}>Например: «Кратко перечисли основные тезисы» или «Какие риски упоминаются?»</p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  ...styles.row,
                  ...(msg.role === "user" ? styles.rowUser : styles.rowBot),
                }}
              >
                <div style={styles.avatar}>{msg.role === "user" ? "Вы" : "AI"}</div>
                <div style={{ ...styles.bubble, ...(msg.role === "user" ? styles.bubbleUser : styles.bubbleBot) }}>
                  <div style={styles.bubbleText}>{msg.content}</div>
                </div>
              </div>
            ))
          )}
          {busy ? (
            <p style={styles.thinking} aria-live="polite">
              Ищем фрагменты в ваших документах и формируем ответ…
            </p>
          ) : null}
        </div>

        {lastChunks.length > 0 ? (
          <details style={styles.sources}>
            <summary>Источники по последнему запросу ({lastChunks.length})</summary>
            <ul style={styles.sourceList}>
              {lastChunks.map((c, i) => (
                <li key={`${c.document_id}-${c.chunk_id}-${i}`} style={styles.sourceLi}>
                  <span style={styles.sourceMeta}>
                    #{i + 1} · {(c.score * 100).toFixed(0)}% · {c.document_id.slice(0, 8)}…
                  </span>
                  <p style={styles.sourceText}>
                    {c.text.slice(0, 400)}
                    {c.text.length > 400 ? "…" : ""}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <div style={styles.composer}>
          <SttChatToolbar
            authFetch={authFetch}
            disabled={busy}
            onComposerBlockChange={setSttBusy}
            onTextAppended={(text) => setInput((prev) => (prev ? `${prev.trim()}\n${text}` : text))}
            onSttError={(msg) =>
              setMessages((m) => [...m, { role: "assistant", content: `STT: ${msg}` }])
            }
          />
          <textarea
            style={styles.textarea}
            rows={2}
            placeholder="Ваш вопрос по содержанию файлов…"
            value={input}
            disabled={busy || sttBusy}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button
            type="button"
            style={styles.sendBtn}
            disabled={busy || sttBusy || !input.trim()}
            onClick={() => void send()}
          >
            {busy ? "…" : "Отправить"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 880,
    margin: "0 auto",
    padding: "24px 20px 56px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  header: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    animation: "fadeUp 0.45s ease both",
  },
  kicker: {
    margin: "0 0 6px",
    fontSize: "0.72rem",
    fontWeight: 600,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--accent)",
  },
  title: { margin: "0 0 8px", fontSize: "clamp(1.4rem, 3vw, 1.75rem)", fontWeight: 700, letterSpacing: "-0.02em" },
  lead: { margin: 0, color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.55, maxWidth: 640 },
  headerAside: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  stat: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "10px 16px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,0.03)",
  },
  statNum: { fontSize: "1.35rem", fontWeight: 800, color: "var(--accent)",
    lineHeight: 1.2 },
  statLabel: { fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" },
  mutedSm: { color: "var(--muted)", fontSize: "0.9rem" },
  linkBtn: {
    padding: "10px 16px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    color: "var(--text)",
    fontWeight: 600,
    fontSize: "0.88rem",
    textDecoration: "none",
  },
  warnBanner: {
    padding: "12px 16px",
    borderRadius: "var(--radius)",
    border: "1px solid rgba(248, 113, 113, 0.35)",
    background: "rgba(248, 113, 113, 0.08)",
    fontSize: "0.9rem",
    lineHeight: 1.5,
    color: "var(--text)",
  },
  shell: {
    display: "flex",
    flexDirection: "column",
    borderRadius: "var(--radius)",
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    boxShadow: "var(--shadow)",
    minHeight: 480,
    overflow: "hidden",
    animation: "fadeUp 0.5s ease both",
  },
  thread: {
    flex: 1,
    minHeight: 320,
    maxHeight: "min(58vh, 560px)",
    overflowY: "auto",
    padding: "16px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  empty: {
    margin: "auto",
    textAlign: "center",
    padding: "32px 16px",
    maxWidth: 400,
  },
  emptyTitle: { margin: "0 0 8px", fontWeight: 700, fontSize: "1.05rem" },
  emptyText: { margin: 0, color: "var(--muted)", fontSize: "0.92rem", lineHeight: 1.55 },
  row: {
    display: "flex",
    gap: 10,
    alignItems: "flex-end",
    maxWidth: "100%",
  },
  rowUser: { alignSelf: "flex-end", flexDirection: "row-reverse" },
  rowBot: { alignSelf: "flex-start" },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    fontSize: "0.65rem",
    fontWeight: 800,
    letterSpacing: "0.04em",
    color: "var(--muted)",
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,0.04)",
  },
  bubble: {
    maxWidth: "min(100%, 620px)",
    padding: "12px 14px",
    borderRadius: 14,
  },
  bubbleUser: {
    background: "var(--accent-dim)",
    border: "1px solid rgba(110, 231, 183, 0.35)",
  },
  bubbleBot: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid var(--border)",
  },
  bubbleText: { margin: 0, whiteSpace: "pre-wrap", fontSize: "0.95rem", lineHeight: 1.55 },
  thinking: { margin: 0, color: "var(--muted)", fontSize: "0.88rem", fontStyle: "italic", paddingLeft: 46 },
  sources: {
    borderTop: "1px solid var(--border)",
    padding: "10px 18px",
    fontSize: "0.85rem",
    color: "var(--muted)",
  },
  sourceList: { margin: "8px 0 0", paddingLeft: 18 },
  sourceLi: { marginBottom: 10 },
  sourceMeta: { fontSize: "0.75rem", opacity: 0.9 },
  sourceText: { margin: "4px 0 0", fontSize: "0.82rem", lineHeight: 1.45, color: "var(--text)" },
  composer: {
    display: "flex",
    gap: 10,
    alignItems: "flex-end",
    padding: "14px 16px",
    borderTop: "1px solid var(--border)",
    background: "rgba(0,0,0,0.2)",
  },
  textarea: {
    flex: 1,
    resize: "vertical",
    minHeight: 52,
    maxHeight: 160,
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,0.05)",
    color: "var(--text)",
    outline: "none",
    fontFamily: "inherit",
    fontSize: "0.95rem",
  },
  sendBtn: {
    padding: "14px 22px",
    borderRadius: 12,
    border: "none",
    background: "var(--accent)",
    color: "#0b1220",
    fontWeight: 800,
    fontSize: "0.9rem",
    cursor: "pointer",
    flexShrink: 0,
  },
};
