import { Link } from "react-router-dom";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div className="offline-banner" role="status">
      <span className="offline-banner__text">
        Соединения с интернетом нет. Основные функции недоступны — можно сыграть в змейку.
      </span>
      <Link to="/offline-snake" className="offline-banner__link">
        Змейка
      </Link>
    </div>
  );
}
