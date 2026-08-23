import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { onReBadge } from "./lib/api.ts";
import { reclaimIdentity } from "./lib/identity.ts";
import { initTheme } from "./lib/theme.ts";
import { loadActorColors } from "./lib/colors.ts";
import { loadActorNames } from "./lib/names.ts";
import "./styles.css";

initTheme();
// A replaced badge holds no claims, so the tab re-claims its persona before
// the door's retry replays anything (the identity desk's mechanism 5). Wired
// here, at the entry point, so it is in place before the first fetch.
onReBadge(reclaimIdentity);
// Faces are painted before any canvas is open; the WS snapshot refreshes this.
void loadActorColors();
void loadActorNames();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
