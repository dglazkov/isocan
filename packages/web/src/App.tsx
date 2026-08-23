import { useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import type { Actor } from "@isocan/core";
import { CANVAS_ROUTE } from "@isocan/core";
import { readIdentity } from "./lib/identity.ts";
import { IdentityDialog } from "./components/IdentityDialog.tsx";
import { ProjectListPage } from "./pages/ProjectListPage.tsx";
import { CanvasPage } from "./pages/CanvasPage.tsx";
import { NotHerePage } from "./pages/NotHerePage.tsx";

export function App() {
  const [actor, setActor] = useState<Actor | null>(readIdentity);

  if (!actor) {
    return <IdentityDialog onDone={setActor} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProjectListPage actor={actor} onIdentity={setActor} />} />
        {/* The canvas's address, built from core's one spelling of it — see
            `address.ts` for why that is worth a module. */}
        <Route path={CANVAS_ROUTE} element={<CanvasPage actor={actor} onIdentity={setActor} />} />
        {/* The catch-all, and it is required rather than tidy. The daemon's
            SPA fallback answers every path with the app shell and a 200, so
            without a route here a mistyped or doc-shaped share link renders a
            blank page: no error, no 404, no redirect, nothing to read. */}
        <Route path="*" element={<NotHerePage />} />
      </Routes>
    </BrowserRouter>
  );
}
