import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { listDocuments, fetchDocumentStats, type DocumentItem, type DocumentStats } from "../api/documents";
import { useAuth } from "../context/AuthContext";
import { formatBytes } from "../lib/formatBytes";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function CabinetPage() {
  const { authFetch, isAuthenticated, isHydrated, email } = useAuth();
  const [stats, setStats] = useState<DocumentStats | null>(null);
  const [recent, setRecent] = useState<DocumentItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    void (async () => {
      try {
        const [s, docs] = await Promise.all([fetchDocumentStats(authFetch), listDocuments(authFetch)]);
        if (!cancelled) {
          setStats(s);
          setRecent(docs.slice(0, 12));
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Ошибка загрузки");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, isAuthenticated, isHydrated]);

  if (!isHydrated) {
    return (
      <div className="cabinet-page">
        <p className="cabinet-muted">Загрузка…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: "/cabinet" }} />;
  }

  const maxMimeCount = stats?.mime_breakdown.length
    ? Math.max(...stats.mime_breakdown.map((m) => m.count), 1)
    : 1;

  return (
    <div className="cabinet-page">
      <header className="cabinet-header">
        <div>
          <h1 className="cabinet-title">Личный кабинет</h1>
          <p className="cabinet-lead">
            Сводка по вашим загрузкам: типы файлов, статусы и тематические группы. Аккаунт:{" "}
            <strong>{email ?? "—"}</strong>
          </p>
        </div>
        <Link to="/upload" className="btn-solid cabinet-upload-link">
          Загрузить документы
        </Link>
      </header>

      {err ? (
        <div className="callout callout--danger cabinet-callout" role="alert">
          {err}
        </div>
      ) : null}

      {loading ? (
        <p className="cabinet-muted">Собираем статистику…</p>
      ) : stats ? (
        <>
          <section className="cabinet-grid" aria-label="Ключевые показатели">
            <article className="cabinet-card">
              <h2 className="cabinet-card__kicker">Всего файлов</h2>
              <p className="cabinet-card__value">{stats.total_documents}</p>
              <p className="cabinet-card__hint">записей в вашей библиотеке</p>
            </article>
            <article className="cabinet-card">
              <h2 className="cabinet-card__kicker">Объём</h2>
              <p className="cabinet-card__value">{formatBytes(stats.total_bytes)}</p>
              <p className="cabinet-card__hint">суммарный размер загрузок</p>
            </article>
            <article className="cabinet-card">
              <h2 className="cabinet-card__kicker">Готово к работе</h2>
              <p className="cabinet-card__value cabinet-card__value--ok">{stats.ready_count}</p>
              <p className="cabinet-card__hint">
                ошибок: {stats.failed_count}, в обработке: {stats.pending_or_processing_count}
              </p>
            </article>
            <article className="cabinet-card">
              <h2 className="cabinet-card__kicker">Тематические группы</h2>
              <p className="cabinet-card__value">{stats.topic_groups_count}</p>
              <p className="cabinet-card__hint">
                файлов в группах: {stats.documents_in_groups}, отдельно: {stats.documents_standalone}
              </p>
            </article>
          </section>

          <section className="cabinet-section" aria-labelledby="cabinet-types-heading">
            <h2 id="cabinet-types-heading" className="cabinet-section__title">
              Типы документов
            </h2>
            <p className="cabinet-section__lead">
              Распределение по формату (MIME). Длиннее полоса — больше файлов этого типа.
            </p>
            {stats.mime_breakdown.length === 0 ? (
              <p className="cabinet-muted">Пока нет загрузок.</p>
            ) : (
              <ul className="cabinet-mime-list">
                {stats.mime_breakdown.map((m) => (
                  <li key={m.mime_type} className="cabinet-mime-row">
                    <div className="cabinet-mime-row__head">
                      <span className="cabinet-mime-row__label">{m.label_ru}</span>
                      <span className="cabinet-mime-row__meta">
                        {m.count} шт. · {formatBytes(m.bytes_total)}
                      </span>
                    </div>
                    <div className="cabinet-mime-bar" aria-hidden>
                      <div
                        className="cabinet-mime-bar__fill"
                        style={{ width: `${Math.max(8, (m.count / maxMimeCount) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="cabinet-section" aria-labelledby="cabinet-topic-groups-heading">
            <h2 id="cabinet-topic-groups-heading" className="cabinet-section__title">
              Список тематических групп
            </h2>
            <p className="cabinet-section__lead">
              Файлы, объединённые при пакетной загрузке по теме. По ссылке открывается рабочая область документа.
            </p>
            {!stats.topic_groups?.length ? (
              <p className="cabinet-muted">Пока нет тематических групп — загрузите несколько файлов одним пакетом.</p>
            ) : (
              <ul className="cabinet-topic-groups">
                {stats.topic_groups.map((g) => (
                  <li key={g.topic_group_id} className="cabinet-topic-group">
                    <div className="cabinet-topic-group__head">
                      <span className="cabinet-topic-group__id" title={g.topic_group_id}>
                        Группа {g.topic_group_id.slice(0, 8)}…
                      </span>
                      <span className="cabinet-topic-group__meta">
                        {g.document_count} файлов · {formatBytes(g.total_bytes)}
                      </span>
                    </div>
                    <ul className="cabinet-topic-group__members">
                      {g.members.map((m) => (
                        <li key={m.document_id}>
                          <Link to={`/workspace/${m.document_id}`} className="cabinet-topic-group__link">
                            {m.original_filename}
                          </Link>
                          <span className={`cabinet-status cabinet-status--${normStatus(m.status)}`}>
                            {m.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="cabinet-section" aria-labelledby="cabinet-dates-heading">
            <h2 id="cabinet-dates-heading" className="cabinet-section__title">
              Активность
            </h2>
            <ul className="cabinet-dates">
              <li>
                <span className="cabinet-dates__k">Первая загрузка</span>
                <span className="cabinet-dates__v">{formatDate(stats.first_upload_at ?? null)}</span>
              </li>
              <li>
                <span className="cabinet-dates__k">Последняя загрузка</span>
                <span className="cabinet-dates__v">{formatDate(stats.last_upload_at ?? null)}</span>
              </li>
            </ul>
          </section>

          <section className="cabinet-section" aria-labelledby="cabinet-recent-heading">
            <h2 id="cabinet-recent-heading" className="cabinet-section__title">
              Недавние документы
            </h2>
            {recent.length === 0 ? (
              <p className="cabinet-muted">
                Список пуст. <Link to="/upload">Перейти к загрузке</Link>
              </p>
            ) : (
              <ul className="cabinet-recent-list">
                {recent.map((d) => (
                  <li key={d.id} className="cabinet-recent-item">
                    <Link to={`/workspace/${d.id}`} className="cabinet-recent-link">
                      {d.original_filename}
                    </Link>
                    <span className="cabinet-recent-meta">
                      {_mimeShort(d.mime_type)} · {formatBytes(d.size_bytes)} ·{" "}
                      <span className={`cabinet-status cabinet-status--${normStatus(d.status)}`}>{d.status}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function normStatus(s: string): string {
  const x = s.trim().toLowerCase();
  if (x === "ready") return "ready";
  if (x === "failed") return "failed";
  return "pending";
}

function _mimeShort(mime: string): string {
  const base = mime.split(";")[0].trim().toLowerCase();
  if (base === "application/pdf") return "PDF";
  if (base.includes("wordprocessingml")) return "DOCX";
  if (base.includes("presentationml")) return "PPTX";
  if (base === "text/plain") return "TXT";
  return base.slice(0, 18) || "файл";
}
