import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AuthPage } from "./pages/AuthPage";
import { ChatPage } from "./pages/ChatPage";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { UploadPage } from "./pages/UploadPage";
import { CabinetPage } from "./pages/CabinetPage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { OfflineSnakePage } from "./pages/OfflineSnakePage";
import { SharedCollectionPage } from "./pages/SharedCollectionPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/share/:token" element={<SharedCollectionPage />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/cabinet" element={<CabinetPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/workspace/:documentId" element={<WorkspacePage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/offline-snake" element={<OfflineSnakePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
