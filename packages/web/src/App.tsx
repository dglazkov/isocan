import { useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import type { Actor } from "@isocan/core";
import { readIdentity } from "./lib/identity.ts";
import { IdentityDialog } from "./components/IdentityDialog.tsx";
import { ProjectListPage } from "./pages/ProjectListPage.tsx";
import { CanvasPage } from "./pages/CanvasPage.tsx";

export function App() {
  const [actor, setActor] = useState<Actor | null>(readIdentity);

  if (!actor) {
    return <IdentityDialog onDone={setActor} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProjectListPage actor={actor} onIdentity={setActor} />} />
        <Route
          path="/p/:projectId"
          element={<CanvasPage actor={actor} onIdentity={setActor} />}
        />
      </Routes>
    </BrowserRouter>
  );
}
