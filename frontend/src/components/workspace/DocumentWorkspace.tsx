import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { DocumentItem } from "../../api/documents";
import { aiChat } from "../../api/ai";
import { ragQuery } from "../../api/rag";
import { documentStatusRu } from "../../lib/documentStatus";
import {
  generateFlashcards,
  generateInfographicSpec,
  generateMindmapText,
  generateOfficialReport,
  generatePresentationDeckJson,
  generateStructuredTableCsv,
  generateSummaryAndTopics,
  generateVideoRecapPlan,
  runPodcastAction,
  runQuickAction,
  type InfographicSpec,
  type PodcastPace,
  type PodcastTone,
  type VideoRecapPlan,
} from "../../lib/workspaceAi";
import { layoutMindmap, parseMindmapText, type MindLayoutNode } from "../../lib/mindmapParse";
import { prefetchVoices, speakPodcastScript, stopSpeaking } from "../../lib/speech";
import { humanizeChatError } from "../../lib/apiError";
import { parseGammaDeckJson } from "../../lib/gammaDeck";
import { buildGammaPptxBlob, triggerBlobDownload } from "../../lib/gammaDeckPptx";
import { useAuth } from "../../context/AuthContext";
import { fetchStockImageByQuery } from "../../lib/videoRecapMedia";
import { InfographicChart } from "./InfographicChart";
import { MindmapView } from "./MindmapView";
import { ProcessingOverlay } from "./ProcessingOverlay";
import { SttChatToolbar } from "../SttChatToolbar";

type Tab =
  | "summary"
  | "simple"
  | "short"
  | "report"
  | "table"
  | "chat"
  | "tests"
  | "flashcards"
  | "presentation"
  | "video"
  | "infographic"
  | "mindmap";

type Msg = { role: "user" | "assistant"; content: string };

type Props = {
  document: DocumentItem;
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
  const [easySimple, setEasySimple] = useState<string | null>(null);
  const [easyShort, setEasyShort] = useState<string | null>(null);
  const [easyLoading, setEasyLoading] = useState<null | "simple" | "short">(null);
  const [reportText, setReportText] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [mindmapRoot, setMindmapRoot] = useState<MindLayoutNode | null>(null);
  const [mindmapLoading, setMindmapLoading] = useState(false);
  const [mindmapRaw, setMindmapRaw] = useState<string | null>(null);
  const [presentationBlob, setPresentationBlob] = useState<Blob | null>(null);
  const [presentationErr, setPresentationErr] = useState<string | null>(null);
  const [presentationLoading, setPresentationLoading] = useState(false);
  const [podcastTone, setPodcastTone] = useState<PodcastTone>("popular");
  const [podcastPace, setPodcastPace] = useState<PodcastPace>("normal");
  const [podcastScript, setPodcastScript] = useState<string | null>(null);
  const [podcastLoading, setPodcastLoading] = useState(false);
  const [tableCsv, setTableCsv] = useState<string | null>(null);
  const [tableModel, setTableModel] = useState<string | null>(null);
  const [tableFocus, setTableFocus] = useState("");
  const [tableLoading, setTableLoading] = useState(false);
  const [tableErr, setTableErr] = useState<string | null>(null);
  const [sttBusy, setSttBusy] = useState(false);
  const [videoPlan, setVideoPlan] = useState<VideoRecapPlan | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoErr, setVideoErr] = useState<string | null>(null);
  const [videoSceneImages, setVideoSceneImages] = useState<Record<number, string>>({});
  const [infographic, setInfographic] = useState<InfographicSpec | null>(null);
  const [infographicLoading, setInfographicLoading] = useState(false);
  const [infographicErr, setInfographicErr] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const st = document.status.trim().toLowerCase();
  const ready = st === "ready";
  const failed = st === "failed";
  const processing = !ready && !failed;

  const ragIds = useMemo(
    () => (document.group_document_ids?.length ? document.group_document_ids : [document.id]),
    [document.id, document.group_document_ids],
  );

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setLoadingInsights(true);
    void generateSummaryAndTopics(ragIds, authFetch)
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
  }, [ragIds, ready, authFetch]);

  useEffect(() => {
    if (!videoPlan) {
      setVideoSceneImages({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const next: Record<number, string> = {};
      for (let i = 0; i < videoPlan.scenes.length; i++) {
        const sc = videoPlan.scenes[i];
        const url = await fetchStockImageByQuery(authFetch, sc.image_hint_en, sc.scene_index);
        if (cancelled) return;
        if (url) next[sc.scene_index] = url;
      }
      if (!cancelled) setVideoSceneImages(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [videoPlan, authFetch]);

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatBusy || !ready || sttBusy) return;
    setChatInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setChatBusy(true);
    try {
      const chunks = await ragQuery(text, authFetch, 6, ragIds);
      setLastChunks(chunks);
      const ctx = chunks.map((c) => c.text).join("\n\n").slice(0, 12000);
      const scope =
        ragIds.length > 1
          ? "загруженным связанным документам (одна тема)"
          : "этому документу";
      const system = `Помощник по материалам пользователя (${scope}). Отвечай на русском только по приведённому контексту. Если в контексте нет ответа — скажи об этом. Пиши обычным текстом, без markdown (#, **, обратные кавычки).\n\nКонтекст:\n${ctx || "(пусто)"}`;
      const reply = await aiChat(text, system, authFetch, { maxTokens: 1200 });
      setMessages((m) => [...m, { role: "assistant", content: reply.content }]);
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Ошибка";
      setMessages((m) => [...m, { role: "assistant", content: humanizeChatError(raw) }]);
    } finally {
      setChatBusy(false);
    }
  };

  const genEasySimple = async () => {
    if (!ready) return;
    setEasyLoading("simple");
    try {
      const t = await runQuickAction("simple", ragIds, authFetch);
      setEasySimple(t);
    } catch (e) {
      setEasySimple(humanizeChatError(e instanceof Error ? e.message : "Ошибка"));
    } finally {
      setEasyLoading(null);
    }
  };

  const genEasyShort = async () => {
    if (!ready) return;
    setEasyLoading("short");
    try {
      const t = await runQuickAction("short", ragIds, authFetch);
      setEasyShort(t);
    } catch (e) {
      setEasyShort(humanizeChatError(e instanceof Error ? e.message : "Ошибка"));
    } finally {
      setEasyLoading(null);
    }
  };

  const onOfficialReport = async () => {
    if (!ready) return;
    setReportLoading(true);
    try {
      const t = await generateOfficialReport(ragIds, authFetch);
      setReportText(t);
    } catch (e) {
      setReportText(humanizeChatError(e instanceof Error ? e.message : "Ошибка"));
    } finally {
      setReportLoading(false);
    }
  };

  const baseFilename = () => document.original_filename.replace(/\.[^.]+$/, "") || "presentation";

  const buildPresentation = async () => {
    if (!ready) return;
    setPresentationLoading(true);
    setPresentationBlob(null);
    setPresentationErr(null);
    try {
      const raw = await generatePresentationDeckJson(ragIds, authFetch);
      const deck = parseGammaDeckJson(raw);
      const blob = await buildGammaPptxBlob(deck, authFetch);
      setPresentationBlob(blob);
      triggerBlobDownload(blob, `${baseFilename()}-gamma.pptx`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setPresentationErr(humanizeChatError(msg));
      setPresentationBlob(null);
    } finally {
      setPresentationLoading(false);
    }
  };

  const downloadPresentationAgain = () => {
    if (!presentationBlob) return;
    triggerBlobDownload(presentationBlob, `${baseFilename()}-gamma.pptx`);
  };

  const buildMindmap = async () => {
    if (!ready) return;
    setMindmapLoading(true);
    setMindmapRoot(null);
    setMindmapRaw(null);
    try {
      const raw = await generateMindmapText(ragIds, authFetch);
      setMindmapRaw(raw);
      if (!raw.trim()) {
        setMindmapRoot(null);
        return;
      }
      const label = document.original_filename.replace(/\.[^.]+$/, "").slice(0, 48);
      const tree = parseMindmapText(raw, label || "Документ");
      setMindmapRoot(layoutMindmap(tree));
    } catch (e) {
      setMindmapRaw(humanizeChatError(e instanceof Error ? e.message : "Ошибка"));
    } finally {
      setMindmapLoading(false);
    }
  };

  const onPodcast = async () => {
    if (!ready) return;
    setPodcastLoading(true);
    setPodcastScript(null);
    try {
      const t = await runPodcastAction(ragIds, authFetch, { tone: podcastTone, pace: podcastPace });
      setPodcastScript(t);
    } catch (e) {
      setPodcastScript(humanizeChatError(e instanceof Error ? e.message : "Ошибка"));
    } finally {
      setPodcastLoading(false);
    }
  };

  const onExtractTable = async () => {
    if (!ready) return;
    setTableLoading(true);
    setTableErr(null);
    setTableCsv(null);
    setTableModel(null);
    try {
      const { csv, model } = await generateStructuredTableCsv(
        ragIds,
        authFetch,
        tableFocus.trim() || undefined,
      );
      setTableCsv(csv ?? "");
      setTableModel(model ?? "");
    } catch (e) {
      setTableErr(humanizeChatError(e instanceof Error ? e.message : "Ошибка"));
    } finally {
      setTableLoading(false);
    }
  };

  const downloadTableCsv = () => {
    if (tableCsv === null || tableCsv === "") return;
    const base = document.original_filename.replace(/\.[^.]+$/, "") || "document";
    const blob = new Blob([`\ufeff${tableCsv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `${base}-table.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onVideoRecap = async () => {
    if (!ready) return;
    setVideoLoading(true);
    setVideoErr(null);
    setVideoPlan(null);
    try {
      const plan = await generateVideoRecapPlan(ragIds, authFetch);
      setVideoPlan(plan);
    } catch (e) {
      setVideoErr(humanizeChatError(e instanceof Error ? e.message : "Ошибка"));
    } finally {
      setVideoLoading(false);
    }
  };

  const downloadVideoScript = () => {
    if (!videoPlan) return;
    const text = buildVideoScriptText(videoPlan);
    const base = document.original_filename.replace(/\.[^.]+$/, "") || "document";
    const blob = new Blob([`\ufeff${text}`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `${base}-video-script.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onInfographic = async () => {
    if (!ready) return;
    setInfographicLoading(true);
    setInfographicErr(null);
    setInfographic(null);
    try {
      const spec = await generateInfographicSpec(ragIds, authFetch);
      setInfographic(spec);
    } catch (e) {
      setInfographicErr(humanizeChatError(e instanceof Error ? e.message : "Ошибка"));
    } finally {
      setInfographicLoading(false);
    }
  };

  const downloadInfographicJson = () => {
    if (!infographic) return;
    const base = document.original_filename.replace(/\.[^.]+$/, "") || "document";
    const blob = new Blob([JSON.stringify(infographic, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `${base}-infographic.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onGenerateTests = async () => {
    if (!ready) return;
    setTestsText(null);
    try {
      const t = await runQuickAction("test", ragIds, authFetch);
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
      const f = await generateFlashcards(ragIds, authFetch);
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
      <main className="main main--workspace" id="main" tabIndex={-1}>
        {failed ? (
          <div className="callout callout--danger" style={{ marginBottom: "1rem" }}>
            <strong>Не удалось обработать документ.</strong>
            {document.status_message ? ` ${document.status_message}` : " Попробуйте загрузить файл снова."}
          </div>
        ) : null}
        <div className="workspace-layout">
        <aside className="workspace-sidebar">
          <p className="sidebar-heading">Документ</p>
          <h2 className="workspace-file-title">{document.original_filename}</h2>
          {ragIds.length > 1 ? (
            <p style={styles.groupBanner}>
              Чат и инструменты учитывают <strong>{ragIds.length} файлов</strong> в одной тематической группе (общий поиск
              по тексту).
            </p>
          ) : null}
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
              <ul className="topic-list">
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
            disabled={!ready || mindmapLoading}
            onClick={() => {
              setTab("mindmap");
              void buildMindmap();
            }}
          >
            {mindmapLoading ? "Строим карту…" : "Открыть mindmap"}
          </button>
        </aside>

        <div className="workspace-center">
          <div className="tab-bar" role="tablist">
            {(
              [
                ["summary", "Обзор"],
                ["simple", "Просто"],
                ["short", "Кратко"],
                ["report", "Отчёт"],
                ["table", "Таблица"],
                ["chat", "Чат"],
                ["tests", "Тесты"],
                ["flashcards", "Карточки"],
                ["presentation", "Презентация"],
                ["video", "Видео"],
                ["infographic", "Инфографика"],
                ["mindmap", "Mindmap"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`tab-btn${tab === id ? " is-active" : ""}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "summary" ? (
            <div className="tab-panel">
              <h3 className="tab-title">Краткое содержание</h3>
              {loadingInsights ? (
                <p style={styles.muted}>Анализируем документ и формируем описание…</p>
              ) : (
                <p style={styles.bodyText}>{summary ?? "—"}</p>
              )}
            </div>
          ) : null}

          {tab === "simple" ? (
            <div className="tab-panel">
              <p style={styles.muted}>
                Объяснение «как для человека»: без лишних терминов, на всю ширину окна. Нажмите «Сгенерировать», когда
                будете готовы.
              </p>
              <div style={styles.rowBetween}>
                <h3 className="tab-title">Простыми словами</h3>
                <button
                  type="button"
                  className="btn-solid"
                  disabled={!ready || easyLoading === "simple"}
                  onClick={() => void genEasySimple()}
                >
                  {easyLoading === "simple" ? "…" : "Сгенерировать"}
                </button>
              </div>
              <p style={styles.bodyText}>
                {easySimple ??
                  "Здесь появится текст: что в документе и зачем это важно, простым языком."}
              </p>
            </div>
          ) : null}

          {tab === "short" ? (
            <div className="tab-panel">
              <p style={styles.muted}>
                Отдельно от вкладки «Обзор»: здесь вы сами запускаете короткий пересказ в 3–5 предложениях по запросу к
                модели.
              </p>
              <div style={styles.rowBetween}>
                <h3 className="tab-title">Краткий пересказ</h3>
                <button
                  type="button"
                  className="btn-solid"
                  disabled={!ready || easyLoading === "short"}
                  onClick={() => void genEasyShort()}
                >
                  {easyLoading === "short" ? "…" : "Сгенерировать"}
                </button>
              </div>
              <p style={styles.bodyText}>
                {easyShort ?? "Нажмите «Сгенерировать» — получите сжатую выжимку сути материала."}
              </p>
            </div>
          ) : null}

          {tab === "report" ? (
            <div className="tab-panel">
              <div style={styles.rowBetween}>
                <h3 className="tab-title">Формализованный отчёт</h3>
                <button
                  type="button"
                  className="btn-solid"
                  disabled={!ready || reportLoading}
                  onClick={() => void onOfficialReport()}
                >
                  {reportLoading ? "…" : "Сформировать по шаблону"}
                </button>
              </div>
              <p style={styles.muted}>
                Деловая справка: цель, содержание, ключевые положения, выводы, рекомендации — по тексту документа из RAG.
              </p>
              <pre style={styles.pre}>{reportText ?? "Нажмите «Сформировать по шаблону»."}</pre>
            </div>
          ) : null}

          {tab === "table" ? (
            <div className="tab-panel">
              <p style={styles.muted}>
                По тексту из индекса RAG модель собирает одну таблицу в формате CSV (разделитель — запятая). Файл можно
                открыть в Excel или Google Таблицах. При необходимости уточните, какие сущности или столбцы важнее.
              </p>
              <label style={styles.lblTable}>
                Уточнение для таблицы (необязательно)
                <input
                  type="text"
                  className="input-bordered"
                  placeholder="Например: только сроки и ответственные"
                  value={tableFocus}
                  disabled={!ready || tableLoading}
                  onChange={(e) => setTableFocus(e.target.value)}
                />
              </label>
              <div style={styles.rowBetween}>
                <h3 className="tab-title">Структурированные данные</h3>
                <button type="button" className="btn-solid" disabled={!ready || tableLoading} onClick={() => void onExtractTable()}>
                  {tableLoading ? "…" : "Сформировать CSV"}
                </button>
              </div>
              {tableLoading ? <p style={styles.muted}>Запрос к серверу и модели…</p> : null}
              {tableErr ? (
                <p style={styles.tableErr} role="alert">
                  {tableErr}
                </p>
              ) : null}
              {tableCsv !== null ? (
                <>
                  {tableCsv === "" ? (
                    <p style={styles.tableWarn}>
                      Модель вернула пустой CSV. Попробуйте уточнение в поле выше, другой документ или проверьте ключ
                      LLM и логи ai-service. Если недавно обновляли код — пересоберите контейнер ai-service (эндпоинт{" "}
                      <code style={styles.codeSm}>/api/v1/ai/extract-table</code>).
                    </p>
                  ) : (
                    <pre style={styles.preTable}>{tableCsv}</pre>
                  )}
                  <div style={styles.tableActions}>
                    <button
                      type="button"
                      className="btn-solid"
                      style={tableCsv === "" ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
                      disabled={tableCsv === ""}
                      onClick={() => downloadTableCsv()}
                    >
                      Скачать .csv
                    </button>
                    {tableModel ? <span style={styles.mutedSm}>Модель: {tableModel}</span> : null}
                  </div>
                </>
              ) : !tableLoading && !tableErr ? (
                <p style={styles.muted}>Нажмите «Сформировать CSV» — здесь появится превью.</p>
              ) : null}
            </div>
          ) : null}

          {tab === "chat" ? (
            <div
              className="tab-panel"
              style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 360 }}
            >
              <p style={styles.chatHint}>
                Вопросы только по этому файлу. Источники — внизу после ответа. 🎤 — загрузить аудио, 🎙️ — голосовое в
                текст (STT через <code style={styles.codeSm}>STT_BASE_URL</code>, для хакатона часто порт{" "}
                <strong>6640</strong>).
              </p>
              <div className="chat-thread" style={{ maxHeight: 360 }}>
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`chat-bubble${msg.role === "user" ? " chat-bubble--user" : " chat-bubble--bot"}`}
                  >
                    <span className="chat-label">{msg.role === "user" ? "Вы" : "Ответ"}</span>
                    <p>{msg.content}</p>
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
              <div
                className="composer"
                style={{ marginTop: "auto", padding: "0.85rem 1.15rem 1.25rem", borderTop: "1px solid var(--border)" }}
              >
                <SttChatToolbar
                  authFetch={authFetch}
                  disabled={chatBusy || !ready}
                  onComposerBlockChange={setSttBusy}
                  onTextAppended={(text) =>
                    setChatInput((prev) => (prev ? `${prev.trim()}\n${text}` : text))
                  }
                  onSttError={(msg) =>
                    setMessages((m) => [...m, { role: "assistant", content: `STT: ${msg}` }])
                  }
                />
                <textarea
                  className="composer-input"
                  rows={2}
                  placeholder="Например: объясни как школьнику…"
                  value={chatInput}
                  disabled={chatBusy || !ready || sttBusy}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendChat();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn-solid"
                  disabled={chatBusy || !ready || sttBusy}
                  onClick={() => void sendChat()}
                >
                  Отправить
                </button>
              </div>
            </div>
          ) : null}

          {tab === "tests" ? (
            <div className="tab-panel">
              <div style={styles.rowBetween}>
                <h3 className="tab-title">Тесты</h3>
                <button type="button" className="btn-solid" disabled={!ready} onClick={() => void onGenerateTests()}>
                  Создать тест
                </button>
              </div>
              <pre style={styles.pre}>{testsText ?? "Нажмите «Создать тест» — вопросы появятся здесь."}</pre>
            </div>
          ) : null}

          {tab === "flashcards" ? (
            <div className="tab-panel">
              <div style={styles.rowBetween}>
                <h3 className="tab-title">Карточки</h3>
                <button type="button" className="btn-solid" disabled={!ready || cardsLoading} onClick={() => void onFlashcards()}>
                  {cardsLoading ? "…" : "Сгенерировать"}
                </button>
              </div>
              <div className="flash-grid">
                {cards.map((c, i) => (
                  <FlashCard key={i} q={c.q} a={c.a} />
                ))}
              </div>
            </div>
          ) : null}

          {tab === "presentation" ? (
            <div className="tab-panel">
              <p style={styles.muted}>
                По тексту из RAG собирается файл <strong>.pptx</strong> (PowerPoint / Google Slides / LibreOffice) в духе
                Gamma: тёмный фон, акцентная полоса, крупные заголовки. После генерации файл{" "}
                <strong>скачивается автоматически</strong>.
              </p>
              <div style={styles.rowBetween}>
                <h3 className="tab-title">Презентация</h3>
                <button
                  type="button"
                  className="btn-solid"
                  disabled={!ready || presentationLoading}
                  onClick={() => void buildPresentation()}
                >
                  {presentationLoading ? "…" : "Создать и скачать"}
                </button>
              </div>
              {presentationLoading ? <p style={styles.muted}>Генерируем слайды и собираем PPTX…</p> : null}
              {presentationErr ? (
                <p style={styles.tableErr} role="alert">
                  {presentationErr}
                </p>
              ) : null}
              {presentationBlob && !presentationLoading ? (
                <>
                  <div style={styles.gammaOk}>
                    <strong>Готово.</strong> Файл <code style={styles.codeSm}>.pptx</code> сохранён в загрузки — откройте в
                    PowerPoint или загрузите в Google Презентации.
                  </div>
                  <div style={styles.tableActions}>
                    <button type="button" className="btn-solid" onClick={() => downloadPresentationAgain()}>
                      Скачать снова (.pptx)
                    </button>
                  </div>
                </>
              ) : !presentationLoading && !presentationErr ? (
                <p style={styles.muted}>Нажмите «Создать и скачать» — браузер предложит файл презентации.</p>
              ) : null}
            </div>
          ) : null}

          {tab === "video" ? (
            <div className="tab-panel">
              <p style={styles.muted}>
                Сценарий «как видео»: для каждой сцены — <strong>кадр</strong> (подбор по запросу к стоку) и{" "}
                <strong>текст озвучки</strong>. Это единый пакет для монтажа; готовый MP4 здесь не собирается — скачайте
                сценарий с таймингами и изображения из превью.
              </p>
              <div style={styles.rowBetween}>
                <h3 className="tab-title">Видео-пересказ</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button
                    type="button"
                    className="btn-solid"
                    disabled={!ready || videoLoading}
                    onClick={() => void onVideoRecap()}
                  >
                    {videoLoading ? "…" : "Сгенерировать план"}
                  </button>
                  <button
                    type="button"
                    className="btn-outline"
                    disabled={!videoPlan}
                    onClick={() => downloadVideoScript()}
                  >
                    Скачать сценарий (.txt)
                  </button>
                </div>
              </div>
              {videoLoading ? <p style={styles.muted}>Строим сцены и озвучку по RAG…</p> : null}
              {videoErr ? (
                <p style={styles.tableErr} role="alert">
                  {videoErr}
                </p>
              ) : null}
              {videoPlan ? (
                <>
                  <p style={{ ...styles.muted, marginTop: 10 }}>
                    <strong>{videoPlan.video_title}</strong> · ориентир{" "}
                    <strong>{videoPlan.total_duration_sec}</strong> с · сцен: {videoPlan.scenes.length}
                  </p>
                  {videoPlan.narrator_note_ru ? (
                    <p style={styles.bodyText}>
                      <span style={styles.muted}>Диктору: </span>
                      {videoPlan.narrator_note_ru}
                    </p>
                  ) : null}
                  <div className="video-scene-grid">
                    {videoPlan.scenes.map((sc) => (
                      <div key={sc.scene_index} className="video-scene-card">
                        <div className="video-scene-thumb">
                          {videoSceneImages[sc.scene_index] ? (
                            <img src={videoSceneImages[sc.scene_index]} alt="" />
                          ) : (
                            <span style={styles.muted}>Загрузка кадра…</span>
                          )}
                        </div>
                        <div className="video-scene-body">
                          <div className="video-scene-meta">
                            Сцена {sc.scene_index} · {sc.duration_sec} с · кадр: {sc.image_hint_en}
                          </div>
                          <h4 className="video-scene-title">{sc.title_ru}</h4>
                          <p className="video-scene-voice">{sc.voiceover_ru}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : !videoLoading && !videoErr ? (
                <p style={styles.muted}>Нажмите «Сгенерировать план» — появятся сцены с превью кадров.</p>
              ) : null}
            </div>
          ) : null}

          {tab === "infographic" ? (
            <div className="tab-panel">
              <p style={styles.muted}>
                Числа и показатели из текста в индексе RAG собираются в один график (столбики, горизонтальные полосы или
                кольцо). При необходимости скачайте JSON для внешней визуализации.
              </p>
              <div style={styles.rowBetween}>
                <h3 className="tab-title">Инфографика</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button
                    type="button"
                    className="btn-solid"
                    disabled={!ready || infographicLoading}
                    onClick={() => void onInfographic()}
                  >
                    {infographicLoading ? "…" : "Построить по данным"}
                  </button>
                  <button
                    type="button"
                    className="btn-outline"
                    disabled={!infographic}
                    onClick={() => downloadInfographicJson()}
                  >
                    Скачать JSON
                  </button>
                </div>
              </div>
              {infographicLoading ? <p style={styles.muted}>Извлекаем метрики и тип графика…</p> : null}
              {infographicErr ? (
                <p style={styles.tableErr} role="alert">
                  {infographicErr}
                </p>
              ) : null}
              {infographic ? (
                <>
                  <h4 className="tab-title" style={{ marginTop: 12, fontSize: "1.05rem" }}>
                    {infographic.title}
                  </h4>
                  {infographic.subtitle ? <p style={styles.muted}>{infographic.subtitle}</p> : null}
                  <InfographicChart spec={infographic} />
                  {infographic.items.some((it) => it.source_hint) ? (
                    <details style={{ marginTop: 12 }}>
                      <summary style={styles.muted}>Подписи к источникам</summary>
                      <ul style={{ ...styles.srcOl, marginTop: 8 }}>
                        {infographic.items.map(
                          (it, i) =>
                            it.source_hint ? (
                              <li key={i}>
                                <strong>{it.label}:</strong> {it.source_hint}
                              </li>
                            ) : null,
                        )}
                      </ul>
                    </details>
                  ) : null}
                  {infographic.footnote_ru ? (
                    <p style={{ ...styles.muted, marginTop: 10 }}>{infographic.footnote_ru}</p>
                  ) : null}
                </>
              ) : !infographicLoading && !infographicErr ? (
                <p style={styles.muted}>Нажмите «Построить по данным» — здесь появится диаграмма.</p>
              ) : null}
            </div>
          ) : null}

          {tab === "mindmap" ? (
            <div className="tab-panel">
              <div style={styles.rowBetween}>
                <h3 className="tab-title">Интеллект-карта</h3>
                <button type="button" className="btn-solid" disabled={!ready || mindmapLoading} onClick={() => void buildMindmap()}>
                  {mindmapLoading ? "…" : "Перестроить"}
                </button>
              </div>
              <p style={styles.muted}>
                Интерактивный граф связей (клик по узлу). Данные из RAG; структура генерируется моделью.
              </p>
              {mindmapRoot && mindmapRoot.children.length > 0 ? (
                <MindmapView root={mindmapRoot} />
              ) : mindmapRoot && mindmapRoot.children.length === 0 && mindmapRaw ? (
                <div>
                  <p style={styles.muted}>Модель вернула текст, но иерархия не распознана. Сырой ответ:</p>
                  <pre style={styles.pre}>{mindmapRaw}</pre>
                </div>
              ) : mindmapLoading ? (
                <p style={styles.muted}>Строим структуру…</p>
              ) : mindmapRaw && !mindmapRoot ? (
                <pre style={styles.pre}>{mindmapRaw}</pre>
              ) : (
                <p style={styles.muted}>Нажмите «Перестроить» или кнопку слева.</p>
              )}
              {mindmapRaw && mindmapRoot && mindmapRoot.children.length > 0 ? (
                <details style={{ marginTop: 12 }}>
                  <summary style={styles.muted}>Исходный список</summary>
                  <pre style={{ ...styles.pre, marginTop: 8, fontSize: "0.8rem" }}>{mindmapRaw}</pre>
                </details>
              ) : null}
            </div>
          ) : null}
        </div>

        <aside className="workspace-aside">
          <h3 className="aside-title">Быстрые действия</h3>
          <div style={styles.quickList}>
            <button type="button" style={styles.quickBtn} disabled={!ready} onClick={() => void onGenerateTests()}>
              Создать тест
            </button>
            <div style={styles.podcastBox}>
              <p style={styles.podcastTitle}>Аудиопересказ (сценарий)</p>
              <label style={styles.lbl}>
                Тон
                <select
                  className="input-select"
                  value={podcastTone}
                  disabled={!ready || podcastLoading}
                  onChange={(e) => setPodcastTone(e.target.value as PodcastTone)}
                >
                  <option value="popular">Популярный</option>
                  <option value="academic">Научный</option>
                </select>
              </label>
              <label style={styles.lbl}>
                Темп речи
                <select
                  className="input-select"
                  value={podcastPace}
                  disabled={!ready || podcastLoading}
                  onChange={(e) => setPodcastPace(e.target.value as PodcastPace)}
                >
                  <option value="slow">Медленнее</option>
                  <option value="normal">Норма</option>
                  <option value="fast">Быстрее</option>
                </select>
              </label>
              <button type="button" style={styles.quickBtn} disabled={!ready || podcastLoading} onClick={() => void onPodcast()}>
                {podcastLoading ? "Генерация…" : "Сгенерировать диалог"}
              </button>
              {podcastScript ? (
                <>
                  <pre style={styles.podcastPre}>{podcastScript}</pre>
                  <div style={styles.podcastActions}>
                    <button
                      type="button"
                      style={styles.miniBtn}
                      onClick={() => {
                        void prefetchVoices().then(() => speakPodcastScript(podcastScript, podcastPace));
                      }}
                    >
                      Озвучить в браузере
                    </button>
                    <button type="button" style={styles.miniBtnGhost} onClick={() => stopSpeaking()}>
                      Стоп
                    </button>
                  </div>
                </>
              ) : null}
              <p style={styles.podcastHint}>
                Озвучка через движок браузера: для строк «Алексей»/«Мария» подбираются разные русские голоса (если ОС их
                дала); иначе различаются высотой тона. Качество зависит от Chrome/Edge/Safari и установленных языковых
                пакетов.
              </p>
            </div>
            <button
              type="button"
              style={styles.quickBtn}
              disabled={!ready || presentationLoading}
              onClick={() => {
                setTab("presentation");
                void buildPresentation();
              }}
            >
              {presentationLoading ? "Презентация…" : "Презентация (слайды)"}
            </button>
            <button
              type="button"
              style={styles.quickBtn}
              disabled={!ready || videoLoading}
              onClick={() => {
                setTab("video");
                void onVideoRecap();
              }}
            >
              {videoLoading ? "Видео-план…" : "Видео (сцены + озвучка)"}
            </button>
            <button
              type="button"
              style={styles.quickBtn}
              disabled={!ready || infographicLoading}
              onClick={() => {
                setTab("infographic");
                void onInfographic();
              }}
            >
              {infographicLoading ? "Инфографика…" : "Инфографика (график)"}
            </button>
            <button
              type="button"
              style={styles.quickBtn}
              disabled={!ready || mindmapLoading}
              onClick={() => {
                setTab("mindmap");
                void buildMindmap();
              }}
            >
              Mindmap (граф)
            </button>
          </div>
        </aside>
      </div>
      </main>
    </>
  );
}

function buildVideoScriptText(plan: VideoRecapPlan): string {
  const lines: string[] = [];
  lines.push(`# ${plan.video_title}`);
  lines.push(`Общая длительность (ориентир): ${plan.total_duration_sec} с`);
  if (plan.narrator_note_ru) {
    lines.push("");
    lines.push("Заметка диктору:");
    lines.push(plan.narrator_note_ru);
  }
  for (const s of plan.scenes) {
    lines.push("");
    lines.push(`--- Сцена ${s.scene_index}: ${s.title_ru} (${s.duration_sec} с) ---`);
    lines.push("");
    lines.push("Озвучка:");
    lines.push(s.voiceover_ru);
    lines.push("");
    lines.push(`Кадр (запрос к стоку, EN): ${s.image_hint_en}`);
  }
  return lines.join("\n");
}

function FlashCard({ q, a }: { q: string; a: string }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      type="button"
      className={`flash-card${flipped ? " is-flipped" : ""}`}
      onClick={() => setFlipped(!flipped)}
    >
      <span className="chat-label">{flipped ? "Ответ" : "Вопрос"}</span>
      <span className="flash-face">{flipped ? a : q}</span>
      <span className="muted small" style={{ display: "block", marginTop: 8 }}>
        Нажмите, чтобы перевернуть
      </span>
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
  groupBanner: {
    margin: "0 0 10px",
    fontSize: "0.82rem",
    lineHeight: 1.45,
    color: "var(--muted)",
  },
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
  chatComposer: { display: "flex", gap: 8, padding: 14, borderTop: "1px solid var(--border)", marginTop: "auto", alignItems: "flex-end" },
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
  podcastBox: {
    padding: "10px 0",
    borderTop: "1px solid var(--border)",
    borderBottom: "1px solid var(--border)",
    margin: "4px 0",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  podcastTitle: { margin: 0, fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" },
  lbl: { display: "flex", flexDirection: "column", gap: 4, fontSize: "0.78rem", color: "var(--muted)" },
  sel: {
    padding: "6px 8px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,0.05)",
    color: "var(--text)",
    fontSize: "0.85rem",
  },
  podcastPre: {
    margin: 0,
    maxHeight: 200,
    overflow: "auto",
    fontSize: "0.75rem",
    whiteSpace: "pre-wrap",
    lineHeight: 1.45,
    padding: 8,
    borderRadius: 8,
    background: "rgba(0,0,0,0.2)",
    border: "1px solid var(--border)",
  },
  podcastActions: { display: "flex", flexWrap: "wrap", gap: 8 },
  miniBtn: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "none",
    background: "var(--accent)",
    color: "#0b1220",
    fontWeight: 700,
    fontSize: "0.78rem",
    cursor: "pointer",
  },
  miniBtnGhost: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text)",
    fontSize: "0.78rem",
    cursor: "pointer",
  },
  podcastHint: { margin: 0, fontSize: "0.68rem", color: "var(--muted)", lineHeight: 1.4 },
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
  codeSm: { fontSize: "0.85em", padding: "1px 6px", borderRadius: 4, background: "rgba(0,0,0,0.2)" },
  lblTable: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 14,
    fontSize: "0.82rem",
    color: "var(--muted)",
  },
  inputTable: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,0.04)",
    color: "var(--text)",
    fontSize: "0.9rem",
  },
  preTable: {
    margin: "12px 0 0",
    maxHeight: 280,
    overflow: "auto",
    whiteSpace: "pre-wrap",
    fontSize: "0.82rem",
    lineHeight: 1.45,
    padding: 12,
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "rgba(0,0,0,0.2)",
  },
  tableActions: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginTop: 12 },
  tableErr: { color: "var(--danger)", fontSize: "0.9rem", marginTop: 8 },
  gammaOk: {
    marginTop: 12,
    padding: "12px 14px",
    borderRadius: 10,
    background: "rgba(110, 231, 183, 0.1)",
    border: "1px solid rgba(110, 231, 183, 0.25)",
    fontSize: "0.9rem",
    lineHeight: 1.45,
  },
  tableWarn: {
    margin: "12px 0 0",
    padding: 12,
    borderRadius: 10,
    border: "1px solid rgba(251, 191, 36, 0.35)",
    background: "rgba(251, 191, 36, 0.08)",
    color: "var(--text)",
    fontSize: "0.88rem",
    lineHeight: 1.5,
  },
  tableBtnDisabled: { opacity: 0.45, cursor: "not-allowed" },
  mutedSm: { fontSize: "0.78rem", color: "var(--muted)" },
  preSm: { margin: 0, fontSize: "0.78rem", whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto" },
};
