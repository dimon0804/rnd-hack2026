import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="main not-found" id="main" tabIndex={-1}>
      <div className="not-found-orbit" aria-hidden>
        <span className="not-found-planet">404</span>
        <span className="not-found-moon" />
      </div>
      <p className="kick-label">страница не найдена</p>
      <h1 className="not-found-title">
        Здесь ничего нет.
        <br />
        <span className="not-found-punch">Как и смысла в совещании без повестки.</span>
      </h1>
      <p className="not-found-lede">
        Возможно, ссылка устарела, документ уехал в архив, а может вы просто опечатались в URL — бывает у всех,
        даже у нейросетей после пятницы.
      </p>
      <div className="not-found-actions">
        <Link to="/" className="btn-solid btn-cta">
          На главную
        </Link>
        <Link to="/upload" className="btn-outline btn-cta">
          К загрузке
        </Link>
      </div>
      <p className="not-found-joke mono small muted">
        HTTP 404: страница ушла за кофе и не вернулась.
      </p>
    </main>
  );
}
