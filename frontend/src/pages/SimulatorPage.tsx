import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchSimulatorScenario,
  fetchSimulatorScenarios,
  submitSimulatorChoice,
  type ChatScenario,
  type EmailScenario,
  type ScenarioListItem,
  type SubmitResult,
} from "../api/simulator";

type Lang = "ru" | "en";

export function SimulatorPage() {
  const [lang, setLang] = useState<Lang>("ru");
  const [list, setList] = useState<ScenarioListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scenario, setScenario] = useState<EmailScenario | ChatScenario | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingScenario, setLoadingScenario] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<SubmitResult | null>(null);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setErr(null);
    try {
      const { scenarios } = await fetchSimulatorScenarios(lang);
      setList(scenarios);
      setActiveId((prev) => {
        if (prev && scenarios.some((s) => s.id === prev)) return prev;
        return scenarios[0]?.id ?? null;
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка загрузки списка");
      setList([]);
    } finally {
      setLoadingList(false);
    }
  }, [lang]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadScenario = useCallback(
    async (id: string) => {
      setLoadingScenario(true);
      setErr(null);
      setLastResult(null);
      try {
        const { scenario: s } = await fetchSimulatorScenario(id, lang);
        setScenario(s);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Ошибка сценария");
        setScenario(null);
      } finally {
        setLoadingScenario(false);
      }
    },
    [lang],
  );

  useEffect(() => {
    if (activeId) void loadScenario(activeId);
    else setScenario(null);
  }, [activeId, loadScenario]);

  const onChoice = async (choiceId: string) => {
    if (!scenario || submitting) return;
    setSubmitting(true);
    setErr(null);
    try {
      const res = await submitSimulatorChoice(scenario.id, choiceId, lang);
      setLastResult(res);
      if (!res.ok) {
        setErr(res.error ?? "Отклонено");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка отправки");
      setLastResult(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="main cabinet-page simulator-page" id="main" tabIndex={-1}>
      <header className="cabinet-header">
        <div>
          <h1 className="cabinet-title">Тренажёр безопасности</h1>
          <p className="cabinet-lead">
            Запросы к API Gateway: <code className="simulator-code">GET/POST /api/v1/simulator/…</code> — без
            Swagger, проверка прямо в интерфейсе. В dev Vite проксирует <code className="simulator-code">/api</code> на
            gateway (см. <code className="simulator-code">vite.config.ts</code>).
          </p>
        </div>
        <Link to="/" className="btn-outline btn-compact cabinet-upload-link">
          На главную
        </Link>
      </header>

      <div className="simulator-toolbar">
        <span className="simulator-toolbar__label">Язык API</span>
        <div className="simulator-lang">
          {(["ru", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              className={`simulator-lang__btn${lang === l ? " simulator-lang__btn--active" : ""}`}
              onClick={() => setLang(l)}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <button type="button" className="btn-outline btn-compact" onClick={() => void loadList()} disabled={loadingList}>
          Обновить список
        </button>
      </div>

      {err ? (
        <div className="cabinet-callout simulator-error" role="alert">
          {err}
        </div>
      ) : null}

      <section className="cabinet-section">
        <h2 className="cabinet-section__title">Сценарии</h2>
        <p className="cabinet-section__lead">
          Выберите сценарий — загрузится тело с <code className="simulator-code">GET …/scenarios/{"{id}"}</code>.
        </p>
        {loadingList ? (
          <p className="cabinet-muted">Загрузка списка…</p>
        ) : (
          <div className="simulator-scenario-tabs">
            {list.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`simulator-tab${activeId === s.id ? " simulator-tab--active" : ""}`}
                onClick={() => setActiveId(s.id)}
              >
                <span className="simulator-tab__type">{s.type === "email" ? "Почта" : "Чат"}</span>
                <span className="simulator-tab__title">{s.title}</span>
                <span className="simulator-tab__id">{s.id}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {loadingScenario ? <p className="cabinet-muted">Загрузка сценария…</p> : null}

      {scenario && !loadingScenario ? (
        <>
          <section className="cabinet-section">
            <h2 className="cabinet-section__title">Содержимое</h2>
            {scenario.type === "email" ? (
              <EmailBlock s={scenario} />
            ) : (
              <ChatBlock s={scenario} />
            )}
          </section>

          <section className="cabinet-section">
            <h2 className="cabinet-section__title">Действия → POST …/submit</h2>
            <p className="cabinet-section__lead">Тело: <code className="simulator-code">{"{ \"choice_id\": \"…\" }"}</code></p>
            <div className="simulator-choices">
              {scenario.choices.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="btn-solid simulator-choice-btn"
                  disabled={submitting}
                  onClick={() => void onChoice(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </section>
        </>
      ) : null}

      {lastResult ? (
        <section className="cabinet-section">
          <h2 className="cabinet-section__title">Ответ API</h2>
          <ResultBlock result={lastResult} />
        </section>
      ) : null}
    </main>
  );
}

function EmailBlock({ s }: { s: EmailScenario }) {
  return (
    <article className="cabinet-card simulator-mail">
      <p className="simulator-mail__meta">
        <strong>{s.sender_display}</strong> &lt;{s.sender_email}&gt;
      </p>
      <h3 className="simulator-mail__subject">{s.subject}</h3>
      <p className="simulator-mail__preview">{s.preview}</p>
      <div className="simulator-mail__body">
        {s.body_paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <div className="simulator-mail__cta">
        <span className="btn-solid simulator-mail__cta-fake">{s.cta_label}</span>
        <code className="simulator-code simulator-mail__href">{s.cta_href_display}</code>
      </div>
    </article>
  );
}

function ChatBlock({ s }: { s: ChatScenario }) {
  return (
    <article className="cabinet-card simulator-chat">
      <p className="simulator-chat__peer">
        {s.peer_name} <span className="simulator-chat__handle">@{s.peer_handle}</span>
      </p>
      <div className="simulator-chat__messages">
        {s.messages.map((m, i) => (
          <div key={i} className={`simulator-chat__bubble simulator-chat__bubble--${m.from}`}>
            <p>{m.text}</p>
            <span className="simulator-chat__time">{m.time}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function ResultBlock({ result }: { result: SubmitResult }) {
  if (!result.ok || !result.result) {
    return (
      <pre className="simulator-json">{JSON.stringify(result, null, 2)}</pre>
    );
  }
  const r = result.result;
  return (
    <div className="cabinet-card simulator-result">
      <p className="simulator-result__row">
        <span className="simulator-result__k">choice_id</span>
        <code>{r.choice_id}</code>
      </p>
      <p className="simulator-result__row">
        <span className="simulator-result__k">is_safe</span>
        <span className={r.is_safe ? "simulator-result__ok" : "simulator-result__bad"}>
          {String(r.is_safe)}
        </span>
      </p>
      <p className="simulator-result__row">
        <span className="simulator-result__k">severity</span>
        <code>{r.severity}</code>
      </p>
      <p className="simulator-result__row">
        <span className="simulator-result__k">security_delta / xp_delta</span>
        <code>
          {r.security_delta} / {r.xp_delta}
        </code>
      </p>
      <div className="simulator-result__teach">
        <h4>{r.teach_title}</h4>
        <p>{r.teach_body}</p>
      </div>
      {r.show_consequences && r.consequence_steps.length > 0 ? (
        <div className="simulator-result__cons">
          <strong>Последствия (шаги)</strong>
          <ol>
            {r.consequence_steps.map((step, i) => (
              <li key={i}>
                <strong>{step.title}</strong> — {step.detail}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      <details className="simulator-result__raw">
        <summary>Сырой JSON</summary>
        <pre>{JSON.stringify(result, null, 2)}</pre>
      </details>
    </div>
  );
}
