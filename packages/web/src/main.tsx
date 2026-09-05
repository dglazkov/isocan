import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { onOfflineWrite, onReBadge } from "./lib/api.ts";
import { queueOfflineWrite } from "./stores/canvasStore.ts";
import { registerShell } from "./lib/shell.ts";
import { beginArrival, reloadOnLatePass } from "./lib/arrival.ts";
import { beginSignIn } from "./lib/signin.ts";
import { reclaimIdentity } from "./lib/identity.ts";
import { initTheme } from "./lib/theme.ts";
import { loadActorColors } from "./lib/colors.ts";
import { loadActorNames } from "./lib/names.ts";
import { loadContentBase } from "./lib/contentBase.ts";
import "./styles.css";
// The modules this build carries register their core records on import, so
// every panel that reads core (context, files) sees them before first paint.
import "./modules.ts";

initTheme();
// A replaced badge holds no claims, so the tab re-claims its persona before
// the door's retry replays anything (the identity desk's mechanism 5). Wired
// here, at the entry point, so it is in place before the first fetch.
onReBadge(reclaimIdentity);
/**
 * Where a write goes when the home cannot be reached (phase 10). Wired here
 * for `onReBadge`'s reason exactly — the queue lives in the canvas store,
 * which already imports `lib/api.ts`, and a hook keeps the dependency pointing
 * one way — and before the first render, because the first gesture a person
 * makes on a plane must not be the one that discovers nothing was listening.
 */
onOfflineWrite(queueOfflineWrite);
// And the cached shell, so the app loads at all with no network.
registerShell();
// Faces are painted before any canvas is open; the WS snapshot refreshes this.
void loadActorColors();
void loadActorNames();
// And where item content serves from — null (today's frames) until and
// unless this home advertises a content origin. See lib/contentBase.ts.
void loadContentBase();

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
/**
 * And a tab that came back from an INBOX starts spending its code here, for
 * the arrival's reasons exactly: a sign-in code is single-use, StrictMode runs
 * an effect body twice in development, and the second run would tell a person
 * their link had already been used moments after they used it.
 *
 * Unlike a pass it does not decide who this tab IS — proving an address
 * decorates the badge and offers a resume; it never takes one — so the first
 * render is not held for it. It arrives as a notice.
 */
const signIn = beginSignIn();
// And one that shows up later, in the bar of a tab that is already open — a
// same-document navigation that would otherwise leave a live credential
// sitting there doing nothing (measured in Chrome; see `reloadOnLatePass`).
reloadOnLatePass();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App arrival={arrival} signIn={signIn} />
  </StrictMode>,
);
