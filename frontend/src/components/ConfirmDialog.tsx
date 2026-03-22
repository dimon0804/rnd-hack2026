import { useCallback, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger — акцент на деструктивное действие */
  variant?: "default" | "danger";
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Да",
  cancelLabel = "Отмена",
  variant = "default",
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!busy) onClose();
      }
    },
    [busy, onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    queueMicrotask(() => cancelRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, onKeyDown]);

  if (!open) return null;

  const root = (
    <div
      className="confirm-dialog-root"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="confirm-dialog-backdrop" aria-hidden />
      <div
        className={`confirm-dialog-panel${variant === "danger" ? " confirm-dialog-panel--danger" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="confirm-dialog-glow" aria-hidden />
        <h2 id={titleId} className="confirm-dialog-title">
          {title}
        </h2>
        <p id={descId} className="confirm-dialog-text">
          {message}
        </p>
        <div className="confirm-dialog-actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn-outline confirm-dialog-btn"
            disabled={busy}
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn-solid confirm-dialog-btn${variant === "danger" ? " confirm-dialog-btn--danger" : ""}`}
            disabled={busy}
            onClick={() => void Promise.resolve(onConfirm())}
          >
            {busy ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(root, document.body);
}
