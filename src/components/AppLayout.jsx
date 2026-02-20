import { Outlet } from "react-router-dom";

export default function AppLayout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__brand">Minda Corp</div>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
      <footer className="footer">Developed by- Mr. Kuldeep Sharma</footer>
    </div>
  );
}

