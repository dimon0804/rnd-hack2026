import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { parseShareTokenFromInput } from "../lib/shareLink";

type Props = {
  /** Дополнительный класс обёртки */
  className?: string;
  /** Вариант оформления */
  variant?: "collections" | "hero";
};

export function ShareLinkOpener({ className = "", variant = "collections" }: Props) {
  const [value, setValue] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();

  const open = () => {
    setErr(null);
    const token = parseShareTokenFromInput(value);
    if (!token) {
      setErr("Вставьте ссылку (https://…/share/…) или id коллекции.");
      return;
    }
    navigate(`/share/${token}`);
  };

  if (variant === "hero") {
    return (
      <div className={`share-link-opener share-link-opener--hero ${className}`.trim()}>
        <p className="share-link-opener__title">Войти в коллекцию по ссылке</p>
        <p className="share-link-opener__hint">Вставьте адрес, который вам прислали, или только длинный id.</p>
        <div className="share-link-opener__row">
          <input
            id="share-link-input-hero"
            type="text"
            className="input-bordered share-link-opener__input"
            placeholder="https://…/share/… или uuid"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                open();
              }
            }}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="btn-solid btn-compact" onClick={open}>
            Открыть
          </button>
        </div>
        {err ? (
          <p className="form-error share-link-opener__err" role="alert">
            {err}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`collections-panel collections-panel--open-link ${className}`.trim()}>
      <h3 className="collections-panel__title">Войти по ссылке</h3>
      <p className="collections-panel__hint">
        Вставьте ссылку на общую коллекцию или её id — откроется read-only просмотр без входа в аккаунт владельца.
      </p>
      <div className="collections-create-row share-link-opener__row">
        <input
          id="share-link-input-upload"
          type="text"
          className="input-bordered collections-create-input"
          placeholder="https://…/share/… или uuid"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              open();
            }
          }}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="button" className="btn-outline btn-compact collections-create-btn" onClick={open}>
          Открыть
        </button>
      </div>
      {err ? (
        <p className="form-error" role="alert" style={{ marginTop: 8 }}>
          {err}
        </p>
      ) : null}
    </div>
  );
}
