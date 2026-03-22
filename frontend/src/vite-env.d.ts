/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string;
  /** Показать панель «живая система» (RAG): только `"true"` */
  readonly VITE_SHOW_LIVE_PANEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
