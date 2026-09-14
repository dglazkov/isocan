import { defineConfig, type Plugin } from "vite";
import { execFileSync } from "node:child_process";

/**
 * **The page's own server, and its own build.**
 *
 * It used to be served by `packages/web`'s Vite, out of the app's config and by
 * the app's React plugin, with `voice.html` deliberately kept out of
 * `build.rollupOptions.input` so a second Rollup entry could not split the
 * app's first-visit chunk (`cursorart.test.ts` caught exactly that). Inside
 * this package that reasoning inverts: the page IS the build, and there is no
 * app to protect.
 *
 * `base: "/"` and absolute module paths (`/src/main.ts`) stay as they were, so
 * the page's origin is always the server that serves it. Same-origin is not
 * cosmetic — `/harness` carries the audio WebSocket, and a proxied hop that
 * drops it takes the microphone away without saying so.
 */

// The config's checkout, even when Vite was launched from another directory.
const checkout = new URL("../../", import.meta.url);
const git = (args: string[]): string | null => {
  try { return execFileSync("git", args, { cwd: checkout, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return null; }
};
const gitBranch = () => {
  const branch = git(["branch", "--show-current"]);
  return branch === null ? "unknown branch" : branch || "(detached)";
};

/**
 * `/voice` is the page's address; the `.html` is an implementation detail.
 *
 * Vite serves any `.html` at its own address, so `voice.html` is reachable at
 * `/voice.html` with no help. This spells it without the extension — and the
 * page is the whole of this server, so `/` is the same page rather than a
 * missing `index.html`.
 */
function voiceEntry(): Plugin {
  const rewrite = (url: string | undefined): string | undefined => {
    if (url === "/voice") return "/voice.html";
    if (url?.startsWith("/voice?")) return "/voice.html" + url.slice("/voice".length);
    if (url === "/" || url?.startsWith("/?")) return "/voice.html" + (url.length > 1 ? url.slice(1) : "");
    return url;
  };
  return {
    name: "voice-entry",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        req.url = rewrite(req.url);
        next();
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  define: {
    /**
     * The tag in the header — `branch @ commit` — is this page's own claim
     * about itself, so the build that injects it has to be the build that
     * serves the page. The page reads it defensively (absent → "build tag not
     * injected"), which is why it is a define and not a hard dependency.
     */
    __VOICE_BUILD_INFO__: JSON.stringify({
      branch: gitBranch(),
      commit: git(["rev-parse", "--short", "HEAD"]) || "unknown",
      command,
      startedAt: new Date().toISOString(),
    }),
  },
  plugins: [voiceEntry()],
  build: {
    // The page is the entry. `voice.html` rather than the default `index.html`
    // because that is the file the page has always been.
    rollupOptions: { input: "voice.html" },
  },
  server: {
    /**
     * **`5199`, and `strictPort`** (decided 2026-09-13). The page's own port is
     * the one its evidence and its bookmarks name, and a lane that silently
     * lands on another port is a lane that measures the wrong server — twice in
     * one night, one of them a server that died and went on serving cached
     * pages. Failing loudly is the cheaper discovery.
     */
    port: 5199,
    strictPort: true,
    proxy: {
      /**
       * The voice harness, same-origin so the daemon needs no CORS header and
       * the audio socket survives HMR. `ws: true` for /harness/audio.
       * `ISOCAN_VOICE_HARNESS` aims it at another harness for an evidence run
       * that must not attach to the one on 7654 somebody is using.
       */
      "/harness": {
        target: process.env.ISOCAN_VOICE_HARNESS ?? "http://127.0.0.1:7654",
        changeOrigin: true,
        ws: true,
        rewrite: (path: string) => path.replace(/^\/harness/, ""),
      },
    },
  },
}));
