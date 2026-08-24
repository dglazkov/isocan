/**
 * Registering the cached shell (phase 10). The worker itself is
 * `public/sw.js`; this is the one line of the app that knows it exists.
 *
 * **Production only, and that is deliberate rather than cautious.** In dev the
 * page is served by Vite on port 5173 while the daemon owns `/api` and `/ws`
 * on 4441, and Vite serves unhashed, hot-reloaded modules whose whole contract
 * is that they change under you. A service worker caching that is a service
 * worker fighting HMR, and the failure it produces — a module served from
 * yesterday, indistinguishable from a bug in the code you just wrote — is
 * expensive out of all proportion to what it buys. It also means the phase's
 * Proof has to be actuated against a BUILT app served by the daemon, which is
 * the honest configuration to prove it in anyway: it is the one people use.
 *
 * A registration that fails is not worth a word to anybody. The app works
 * without it; what it loses is the ability to load with no network at all,
 * which a person who is looking at the app already has.
 */
export function registerShell(): void {
  if (import.meta.env.DEV) return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  // After `load`, so registering never competes with the first render for the
  // network. The shell it caches is for the NEXT visit; this one is already
  // here.
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
