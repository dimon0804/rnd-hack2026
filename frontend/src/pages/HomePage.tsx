import { Link } from "react-router-dom";
import { KnowledgeVisual } from "../components/KnowledgeVisual";
import { Marginalia } from "../components/Marginalia";
import { ShareLinkOpener } from "../components/ShareLinkOpener";
import { useAuth } from "../context/AuthContext";

export function HomePage() {
  const { isAuthenticated, isHydrated } = useAuth();

  return (
    <main className="main main--home" id="main" tabIndex={-1}>
      <Marginalia />
      <div className="hero">
        <div className="hero-copy">
          <div className="meta-row" aria-hidden>
            <span>
              <span className="meta-dot" />
              REF / AI-2026 / HOME
            </span>
            <span>Публичная витрина</span>
          </div>
          <p className="kick-label">Работа с текстами и подготовка</p>
          <h1 className="hero-title">
            <span className="line">Задавайте вопросы по своим материалам —</span>
            <span className="line">
              <span className="accent-word">не по интернету</span>
            </span>
          </h1>
          <p className="lede">
            Загружайте конспекты, статьи и рабочие документы: ответы опираются на ваши файлы, а не на случайные страницы
            из сети.
          </p>
          <div className="hero-cta-row">
            {isHydrated && isAuthenticated ? (
              <Link to="/upload" className="btn-solid btn-cta">
                Загрузить документы
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn-solid btn-cta">
                  Войти
                </Link>
                <Link to="/register" className="btn-outline btn-cta">
                  Создать аккаунт
                </Link>
              </>
            )}
          </div>
          {!isHydrated || !isAuthenticated ? (
            <p className="guest-hint">
              После регистрации вы сможете загружать файлы и видеть их в разделе «Мои документы».
            </p>
          ) : null}

          <ShareLinkOpener variant="hero" />

          <div className="home-cards">
            <article className="home-card">
              <h2>Ваши источники</h2>
              <p>PDF, Word и текстовые файлы в одном кабинете; видно, на какой стадии обработка.</p>
            </article>
            <article className="home-card">
              <h2>Ответы по смыслу</h2>
              <p>Система опирается на загруженные материалы, а не на произвольные страницы из сети.</p>
            </article>
            <article className="home-card home-card--soon">
              <h2>Скоро</h2>
              <p>Краткие конспекты, карточки для повторения и проверка знаний.</p>
            </article>
          </div>
        </div>
        <KnowledgeVisual />
      </div>
    </main>
  );
}
