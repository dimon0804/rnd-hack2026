import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppHeader } from "./AppHeader";
import { CookieConsent } from "./CookieConsent";
import { LiveSystemPanel } from "./LiveSystemPanel";
import { GlassDropletsForeground, GlassDropletsLayer } from "./GlassDroplets";

export function Layout() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    const el = document.getElementById("main");
    el?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className="page">
      <CookieConsent />
      <div className="atmosphere-blobs" aria-hidden />
      <GlassDropletsLayer />
      <AppHeader />
      <div className="main-stage" key={pathname}>
        <Outlet />
      </div>
      <GlassDropletsForeground />
      <LiveSystemPanel />
      <footer className="site-footer">
        <div className="footer-inner">
          <span>
            © {new Date().getFullYear()} <span className="footer-brand">AI platform</span>
          </span>
          <span className="footer-isbn" aria-hidden>
            DOC · AI-PL-2026
          </span>
        </div>
      </footer>
    </div>
  );
}
