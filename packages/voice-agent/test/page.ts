import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * **The page, found from this file rather than from the working directory.**
 *
 * Five test files read `voice.html`, and they each did it through
 * `process.cwd()` plus the repo-relative path `packages/web/voice.html`. That
 * worked while there was exactly one way to run them: `vitest` from the repo
 * root. It breaks now that the page has a home of its own, because the cwd is
 * the repo root under `npm test` and the PACKAGE directory under
 * `npm test -w @isocan/voice-agent` — two right answers to one question, which
 * is how a moved test ends up reading a file that is not there (or worse, one
 * that is).
 *
 * **`import.meta.dirname`, and not `new URL(…, import.meta.url)`.** The URL form
 * is the obvious spelling and it is a trap here, measured on 2026-09-14: under
 * this package's jsdom tests, Vite rewrites `new URL("../voice.html",
 * import.meta.url)` into the URL its dev server SERVES the file at
 * (`http://localhost:3000/voice.html`), and `readFileSync` then refuses it with
 * "The URL must be of scheme file". It works in the node-environment tests,
 * which is what makes it worth writing down: the same line passes in one test
 * file and fails in the next. `import.meta.dirname` is the real directory of
 * this file, in every environment, and turns a string path into a file.
 *
 * (This also replaces a comment claiming `import.meta.url` is not a file URL
 * under jsdom. It is, for the TEST file — but that is not the thing that broke.)
 */
const here = path.join(import.meta.dirname, "..", "voice.html");

/** The whole file, head included — the theme tests read its pre-paint script. */
export const voiceHtml = readFileSync(here, "utf8");

/** The body alone, which is what the DOM tests install. */
export const voiceBody = /<body[^>]*>([\s\S]*)<\/body>/i.exec(voiceHtml)?.[1] ?? "";

/** The first inline `<script>`, which is the theme resolver in the head. */
export const headScript = /<script>([\s\S]*?)<\/script>/.exec(voiceHtml)?.[1] ?? "";
