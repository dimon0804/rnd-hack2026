import { Navigate } from "react-router-dom";

/** Старый URL: чат теперь внутри рабочей области документа. */
export function ChatPage() {
  return <Navigate to="/upload" replace />;
}
