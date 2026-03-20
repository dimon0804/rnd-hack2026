import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { DocumentItem } from "../../api/documents";
import { aiChat } from "../../api/ai";
import { ragQuery } from "../../api/rag";
import { documentStatusRu } from "../../lib/documentStatus";
import { generateFlashcards, generateSummaryAndTopics, runQuickAction } from "../../lib/workspaceAi";
import { humanizeChatError } from "../../lib/apiError";
import { useAuth } from "../../context/AuthContext";
import { ProcessingOverlay } from "./ProcessingOverlay";

type Tab = "summary" | "chat" | "tests" | "flashcards";

type Msg = { role: "user" | "assistant"; content: string };

type Props = {
  document: DocumentItem;
};

const QUICK_LABELS: Record<"simple" | "short" | "test" | "podcast" | "mindmap", string> = {
  simple: "Объяснить просто",
  short: "Сделать кратко",
  test: "Тест",
  podcast: "Подкаст",
  mindmap: "Mindmap",
};

export function DocumentWorkspace({ document }: Props) {
  const { authFetch } = useAuth();
  const [tab, setTab] = useState<Tab>("summary");
  const [summary, setSummary] = useState<string | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [lastChunks, setLastChunks] = useState<{ document_id: string; chunk_id: number; score: number; text: string }[]>(
    [],
  );
  const [testsText, setTestsText] = useState<string | null>(null);
  const [cards, setCards] = useState<{ q: string; a: string }[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [quickResult, setQuickResult] = useState<string | null>(null);
  const [quickKind, setQuickKind] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const st = document.status.trim().toLowerCase();
  const ready = st === "ready";
  const failed = st === "failed";
  const processing = !ready && !failed;

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setLoadingInsights(true);
    void generateSummaryAndTopics(document.id, authFetch)
      .then((r) => {
        if (!cancelled) {
          setSummary(r.summary);
          setTopics(r.topics);
        }
      })
      .catch(() => {
        if (!cancelled) setSummary("Не удалось сгенерировать описание. Проверьте ключ Mistral.");
      })
      .finally(() => {
        if (!cancelled) setLoadingInsights(false);
      });
    return () => {
      cancelled = true;
    };
  }, [document.id, ready, authFetch]);

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatBusy || !ready) return;
    setChatInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setChatBusy(true);
    try {
      const chunks = await ragQuery(text, authFetch, 6, [document.id]);
      setLastChunks(chunks);
      const ctx = chunks.map((c) => c.text).join("\n\n").slice(0, 12000);
      const system = `Помощник по одному документу. Отвечай на русском только по приведённому контексту. Если в контексте нет ответа — скажи об этом.\n\nКонтекст:\n${ctx || "(пусто)"}`;
      const reply = await aiChat(text, system, authFetch, { maxTokens: 1200 });
      setMessages((m) => [...m, { role: "assistant", content: reply.content }]);
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Ошибка";
      setMessages((m) => [...m, { role: "assistant", content: humanizeChatError(raw) }]);
    } finally {
      setChatBusy(false);
    }
  };

  const onQuick = async (kind: "simple" | "short" | "test" | "podcast" | "mindmap") => {
    if (!ready) return;
    setQuickKind(QUICK_LABELS[kind]);
    setQuickResult("Генерируем…");
    try {
      const t = await runQuickAction(kind, document.id, authFetch);
      setQuickResult(t);
    } catch (e) {
      setQuickResult(humanizeChatError(e instanceof Error ? e.message : "Ошибка"));
    }
  };

  const onGenerateTests = async () => {
    if (!ready) return;
    setTestsText(null);
    try {
      const t = await runQuickAction("test", document.id, authFetch);
      setTestsText(t);
      setTab("tests");
    } catch (e) {
      setTestsText(humanizeChatError(e instanceof Error ? e.message : "Ошибка"));
    }
  };

  const onFlashcards = async () => {
    if (!ready) return;
    setCardsLoading(true);
    try {
      const f = await generateFlashcards(document.id, authFetch);
      setCards(f);
      setTab("flashcards");
    } finally {
      setCardsLoading(false);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const statusLabel = documentStatusRu(document.status);

  return (
    <>
      <ProcessingOverlay active={processing} />
      <div style={styles.page}>
        {failed ? (
          <div style={styles.failBanner}>
            <strong>Не удалось обработать документ.</strong>
            {document.status_message ? ` ${document.status_message}` : " Попробуйте загрузить файл снова."}
          </div>
        ) : null}
        <div className="workspace-grid">
        <aside style={styles.left}>
          <p style={styles.sideKicker}>Документ</p>
          <h2 style={styles.docTitle}>{document.original_filename}</h2>
          <p style={styles.statusLine}>
            <span style={styles.statusBadge}>{statusLabel}</span>
            {document.status_message ? (
              <span style={styles.statusMsg}> · {document.status_message}</span>
            ) : null}
          </p>
          <div style={styles.leftBlock}>
            <h3 style={styles.h3}>Ключевые темы</h3>
            {loadingInsights ? (
              <p style={styles.muted}>Готовим обзор…</p>
            ) : topics.length ? (
              <ul style={styles.topicList}>
                {topics.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            ) : (
              <p style={styles.muted}>{ready ? "Темы появятся после анализа." : "Сначала дождитесь готовности."}</p>
            )}
          </div>
          <button
            type="button"
            style={styles.mindBtn}
            disabled={!ready}
            onClick={() => void onQuick("mindmap")}
          >
            Сгенерировать mindmap
          </button>
        </aside>

        <main style={styles.main}>
          <div style={styles.tabs}>
            {(
              [
                ["summary", "Кратко"],
                ["chat", "Чат"],
                ["tests", "Тесты"],
                ["flashcards", "Карточки"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                style={{ ...styles.tab, ...(tab === id ? styles.tabOn : {}) }}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "summary" ? (
            <div style={styles.panel}>
              <h3 style={styles.panelTitle}>Краткое содержание</h3>
              {loadingInsights ? (
                <p style={styles.muted}>Анализируем документ и формируем описание…</p>
              ) : (
                <p style={styles.bodyText}>{summary ?? "—"}</p>
              )}
            </div>
          ) : null}

          {tab === "chat" ? (
            <div style={styles.panelChat}>
              <p style={styles.chatHint}>Вопросы только по этому файлу. Источники — внизу после ответа.</p>
              <div style={styles.chatThread}>
                {messages.map((msg, i) => (
                  <div key={i} style={{ ...styles.chatRow, ...(msg.role === "user" ? styles.chatUser : {}) }}>
                    <span style={styles.chatWho}>{msg.role === "user" ? "Вы" : "Ответ"}</span>
                    <div
                      style={{
                        ...styles.chatBubble,
                        ...(msg.role === "user" ? styles.chatBubbleUser : {}),
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatBusy ? <p style={styles.muted}>Ищем в документе…</p> : null}
                <div ref={bottomRef} />
              </div>
              {lastChunks.length > 0 ? (
                <details style={styles.sources}>
                  <summary>Источники ({lastChunks.length} фрагментов)</summary>
                  <ol style={styles.srcOl}>
                    {lastChunks.map((c, i) => (
                      <li key={`${c.chunk_id}-${i}`}>
                        <span style={styles.srcMeta}>{(c.score * 100).toFixed(0)}%</span> {c.text.slice(0, 280)}…
                      </li>
                    ))}
                  </ol>
                </details>
              ) : null}
              <div style={styles.chatComposer}>
                <textarea
                  style={styles.textarea}
                  rows={2}
                  placeholder="Например: объясни как школьнику…"
                  value={chatInput}
                  disabled={chatBusy || !ready}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendChat();
                    }
                  }}
                />
                <button type="button" style={styles.sendBtn} disabled={chatBusy || !ready} onClick={() => void sendChat()}>
                  Отправить
                </button>
              </div>
            </div>
          ) : null}

          {tab === "tests" ? (
            <div style={styles.panel}>
              <div style={styles.rowBetween}>
                <h3 style={styles.panelTitle}>Тесты</h3>
                <button type="button" style={styles.genBtn} disabled={!ready} onClick={() => void onGenerateTests()}>
                  Создать тест
                </button>
              </div>
              <pre style={styles.pre}>{testsText ?? "Нажмите «Создать тест» — вопросы появятся здесь."}</pre>
            </div>
          ) : null}

          {tab === "flashcards" ? (
            <div style={styles.panel}>
              <div style={styles.rowBetween}>
                <h3 style={styles.panelTitle}>Карточки</h3>
                <button type="button" style={styles.genBtn} disabled={!ready || cardsLoading} onClick={() => void onFlashcards()}>
                  {cardsLoading ? "…" : "Сгенерировать"}
                </button>
              </div>
              <div style={styles.cardGrid}>
                {cards.map((c, i) => (
                  <FlashCard key={i} q={c.q} a={c.a} />
                ))}
              </div>
            </div>
          ) : null}
        </main>

        <aside style={styles.right}>
          <h3 style={styles.h3}>Быстрые действия</h3>
          <div style={styles.quickList}>
            <button type="button" style={styles.quickBtn} disabled={!ready} onClick={() => void onQuick("simple")}>
              Объяснить просто
            </button>
            <button type="button" style={styles.quickBtn} disabled={!ready} onClick={() => void onQuick("short")}>
              Сделать кратко
            </button>
            <button type="button" style={styles.quickBtn} disabled={!ready} onClick={() => void onGenerateTests()}>
              Создать тест
            </button>
            <button type="button" style={styles.quickBtn} disabled={!ready} onClick={() => void onQuick("podcast")}>
              Сделать подкаст
            </button>
            <button type="button" style={styles.quickBtn} disabled={!ready} onClick={() => void onQuick("mindmap")}>
              Mindmap
            </button>
          </div>
          {quickResult ? (
            <div style={styles.quickOut}>
              <p style={styles.quickOutTitle}>{quickKind ?? "Результат"}</p>
              <pre style={styles.preSm}>{quickResult}</pre>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
    </>
  );
}

function FlashCard({ q, a }: { q: string; a: string }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button type="button" style={styles.fc} onClick={() => setFlipped(!flipped)}>
      <span style={styles.fcLabel}>{flipped ? "Ответ" : "Вопрос"}</span>
      <p style={styles.fcText}>{flipped ? a : q}</p>
      <span style={styles.fcTap}>Нажмите, чтобы перевернуть</span>
    </button>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { padding: "20px 16px 48px", maxWidth: 1400, margin: "0 auto" },
  failBanner: {
    marginBottom: 16,
    padding: "12px 16px",
    borderRadius: "var(--radius)",
    border: "1px solid rgba(248, 113, 113, 0.45)",
    background: "rgba(248, 113, 113, 0.1)",
    color: "var(--text)",
    fontSize: "0.9rem",
    lineHeight: 1.5,
  },
  left: {
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: 16,
    background: "var(--bg-elevated)",
    alignSelf: "start",
  },
  sideKicker: { margin: 0, fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" },
  docTitle: { margin: "8px 0", fontSize: "1rem", fontWeight: 700, wordBreak: "break-word" },
  statusLine: { margin: "0 0 16px", fontSize: "0.85rem" },
  statusBadge: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    background: "rgba(110, 231, 183, 0.12)",
    border: "1px solid rgba(110, 231, 183, 0.35)",
    fontWeight: 700,
    fontSize: "0.75rem",
  },
  statusMsg: { color: "var(--muted)" },
  leftBlock: { marginBottom: 12 },
  h3: { margin: "0 0 8px", fontSize: "0.9rem", fontWeight: 700 },
  topicList: { margin: 0, paddingLeft: 18, fontSize: "0.88rem", color: "var(--muted)", lineHeight: 1.5 },
  muted: { color: "var(--muted)", fontSize: "0.88rem" },
  mindBtn: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,0.04)",
    color: "var(--text)",
    fontWeight: 600,
    cursor: "pointer",
  },
  main: {
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    background: "var(--bg-elevated)",
    minHeight: 420,
    display: "flex",
    flexDirection: "column",
  },
  tabs: { display: "flex", flexWrap: "wrap", gap: 6, padding: 10, borderBottom: "1px solid var(--border)" },
  tab: {
    padding: "8px 14px",
    borderRadius: 10,
    border: "1px solid transparent",
    background: "transparent",
    color: "var(--muted)",
    fontWeight: 600,
    cursor: "pointer",
  },
  tabOn: { borderColor: "var(--accent)", color: "var(--text)", background: "var(--accent-dim)" },
  panel: { padding: 18, flex: 1 },
  panelTitle: { margin: "0 0 12px", fontSize: "1.05rem" },
  bodyText: { margin: 0, lineHeight: 1.6, fontSize: "0.95rem", whiteSpace: "pre-wrap" },
  panelChat: { display: "flex", flexDirection: "column", flex: 1, minHeight: 360 },
  chatHint: { margin: "0 0 8px", padding: "0 18px", fontSize: "0.85rem", color: "var(--muted)" },
  chatThread: { flex: 1, overflowY: "auto", padding: "0 18px 12px", maxHeight: 360, display: "flex", flexDirection: "column", gap: 10 },
  chatRow: { alignSelf: "flex-start", maxWidth: "92%" },
  chatUser: { alignSelf: "flex-end" },
  chatWho: { fontSize: "0.7rem", color: "var(--muted)", display: "block", marginBottom: 4 },
  chatBubble: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,0.04)",
    fontSize: "0.92rem",
    whiteSpace: "pre-wrap",
  },
  chatBubbleUser: {
    background: "var(--accent-dim)",
    borderColor: "rgba(110, 231, 183, 0.35)",
  },
  sources: { padding: "0 18px", fontSize: "0.82rem", color: "var(--muted)" },
  srcOl: { margin: "8px 0 0", paddingLeft: 18 },
  srcMeta: { color: "var(--accent)", fontWeight: 600 },
  chatComposer: { display: "flex", gap: 8, padding: 14, borderTop: "1px solid var(--border)", marginTop: "auto" },
  textarea: {
    flex: 1,
    minHeight: 48,
    padding: 10,
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,0.04)",
    color: "var(--text)",
    resize: "vertical",
  },
  sendBtn: {
    padding: "12px 16px",
    borderRadius: 10,
    border: "none",
    background: "var(--accent)",
    color: "#0b1220",
    fontWeight: 800,
    cursor: "pointer",
  },
  rowBetween: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  genBtn: {
    padding: "8px 14px",
    borderRadius: 10,
    background: "var(--accent)",
    color: "#0b1220",
    fontWeight: 700,
    border: "none",
    cursor: "pointer",
  },
  pre: {
    margin: 0,
    whiteSpace: "pre-wrap",
    fontSize: "0.88rem",
    lineHeight: 1.5,
    color: "var(--text)",
  },
  cardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 },
  fc: {
    textAlign: "left",
    padding: 14,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,0.03)",
    color: "var(--text)",
    cursor: "pointer",
    minHeight: 120,
  },
  fcLabel: { fontSize: "0.7rem", color: "var(--accent)", fontWeight: 700 },
  fcText: { margin: "8px 0 0", fontSize: "0.9rem" },
  fcTap: { display: "block", marginTop: 8, fontSize: "0.75rem", color: "var(--muted)" },
  right: {
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: 16,
    background: "var(--bg-elevated)",
    alignSelf: "start",
  },
  quickList: { display: "flex", flexDirection: "column", gap: 8 },
  quickBtn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,0.04)",
    color: "var(--text)",
    fontWeight: 600,
    fontSize: "0.88rem",
    cursor: "pointer",
    textAlign: "left",
  },
  quickOut: { marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)" },
  quickOutTitle: { margin: "0 0 6px", fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" },
  preSm: { margin: 0, fontSize: "0.78rem", whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto" },
};
