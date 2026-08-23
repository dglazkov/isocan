import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { onReBadge } from "./lib/api.ts";
import { beginArrival, reloadOnLatePass } from "./lib/arrival.ts";
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

/**
 * A tab that arrived on `…/p/<id>#<pass>` starts spending it HERE, outside
 * React and before the first render (see `lib/arrival.ts`).
 *
 * Outside React because redemption is single-use and StrictMode runs an
 * effect body twice in development: the second run would meet its own spent
 * pass and tell the person somebody else had used it. Before the first render
 * because the identity this hands over decides what the first render IS —
 * flashing the door at somebody who is one request away from being themselves
 * is the wrong first impression, and racing a name they typed against an
 * identity arriving behind it is worse than wrong.
 */
const arrival = beginArrival();
// And one that shows up later, in the bar of a tab that is already open — a
// same-document navigation that would otherwise leave a live credential
// sitting there doing nothing (measured in Chrome; see `reloadOnLatePass`).
reloadOnLatePass();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App arrival={arrival} />
  </StrictMode>,
);
