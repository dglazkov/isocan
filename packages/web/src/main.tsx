import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { initTheme } from "./lib/theme.ts";
import { loadActorColors } from "./lib/colors.ts";
import "./styles.css";

initTheme();
// Faces are painted before any canvas is open; the WS snapshot refreshes this.
void loadActorColors();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
