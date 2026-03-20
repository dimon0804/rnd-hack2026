import { Outlet } from "react-router-dom";
import { AppHeader } from "./AppHeader";

export function Layout() {
  return (
    <>
      <AppHeader />
      <Outlet />
    </>
  );
}
