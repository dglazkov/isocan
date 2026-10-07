import { build, defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const labHtml = fileURLToPath(new URL("./judge-lab.html", import.meta.url));

/**
 * **The judge lab is built on its own, after the app** (local-judge phase 0).
 *
 * `judge-lab.html` is a second page, not a route in the app, and it must not
 * move a byte the app's first visit loads. As a second `rollupOptions.input`
 * it did: Rollup split what both entries share (Vite's modulepreload polyfill)
 * out of the app's entry into a chunk of its own, so the entry chunk changed
 * and `index.html` gained one more request. So the app's build is exactly what
 * it was, and this plugin runs a second, separate build of the lab into the
 * same `outDir` when the first finishes — whatever `outDir` the caller chose
 * (`release.mjs` builds aside with `--outDir`). Nothing is shared between the
 * two, by construction.
 */
function judgeLab(): Plugin {
  let outDir = "";
  let nested = false;
  return {
    name: "isocan-judge-lab",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
      nested = config.build.rollupOptions?.input === labHtml;
    },
    async closeBundle() {
      if (nested) return;
      await build({
        configFile: false,
        root: fileURLToPath(new URL(".", import.meta.url)),
        logLevel: "warn",
        plugins: [judgeLab()],
        build: { outDir, emptyOutDir: false, rollupOptions: { input: labHtml } },
        // A name the daemon recognises, so it can send this script its own
        // Content-Security-Policy (`judgeWorkerPolicy` in packages/server):
        // a dedicated Worker takes its policy from its own response, never
        // from the page's meta tag.
        worker: { rollupOptions: { output: { entryFileNames: "assets/judge-worker-[hash].js" } } },
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), judgeLab()],
  server: {
    port: 5173,
    // /ws is deliberately NOT proxied: the client connects its WebSocket
    // straight to the daemon in dev (see canvasStore.wsUrl) — the proxy hop
    // spammed EPIPE stacks whenever the daemon restarted mid-write.
    proxy: {
      "/api": "http://127.0.0.1:4441",
      // The local judge's model, served by the daemon from <home>/models/.
      "/models": "http://127.0.0.1:4441",
    },
  },
});
