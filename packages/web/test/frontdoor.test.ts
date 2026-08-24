import { beforeEach, describe, expect, it } from "vitest";
import { promises as fs, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { SKILL_INSTALL_COMMAND } from "@isocan/core";
import { faceFor } from "../src/lib/faces.ts";
import { browserClipboard, copyLabel, copySaid, copyToClipboard } from "../src/lib/copy.ts";
import { LEDGER, verbOf } from "../src/lib/ledger.ts";
import { CANVAS_SHOT } from "../src/lib/shot.ts";
import { CopyCommandView, FrontPage } from "../src/pages/FrontPage.tsx";

/**
 * **One address, two faces** (Scene 0, phase 13.5).
 *
 * The change under test is a subtraction as much as an addition: the identity
 * dialog used to be rendered INSTEAD OF the router for any browser that was
 * nobody yet, so a stranger arriving at the home origin met "pick your name"
 * before they had learned what isocan is. Now `/` wears a front page for that
 * browser — and **every other address still meets the door**, which phases 7-9
 * proved and this phase must not spend.
 *
 * There is no DOM in this suite (`vitest.config.ts` sets no environment, and
 * every web test here is a pure module test) so the rule itself lives in
 * `lib/faces.ts` and is tested as a function. The pages are rendered with
 * `react-dom/server`, which needs no environment and no dependency this repo
 * does not already ship — enough to read what a face actually PUTS on the page,
 * not enough to press anything. The one thing pressing does — the copy
 * button's state — is split so that both halves are reachable without a
 * browser: `copyToClipboard` decides, `CopyCommandView` draws. The two lines
 * that join them are proven by driving Chrome, per AGENTS.md, and the report
 * says so.
 */

const priya = { id: "usr_priya", name: "Priya" };

/** The repo root, for the guards that read files the page makes claims about. */
const REPO = fileURLToPath(new URL("../../..", import.meta.url));

/** The one outbound link the front page is allowed, named once. */
const GITHUB = "https://github.com/dglazkov/isocan";

/**
 * The verbs the CLI actually registers, read out of its source — the same
 * two-line parse `packages/cli/test/surface.test.ts` uses, and for the same
 * reason: a list somebody has to remember to update is not a check.
 */
function registeredCommands(): Set<string> {
  const source = readFileSync(path.join(REPO, "packages/cli/src/main.ts"), "utf8");
  return new Set([...source.matchAll(/\.command\("([a-z-]+)/g)].map((m) => m[1]!));
}

/**
 * The two browser globals `App`'s module graph reads AT IMPORT TIME —
 * `lib/theme.ts` asks `window.matchMedia` for the OS preference and
 * `localStorage` for the stored one, both while the module is still
 * evaluating. Stubbed here, and `App.tsx` imported after, because a static
 * import is hoisted above every statement in this file.
 */
function stubBrowserGlobals(): void {
  const map = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  (globalThis as { window?: unknown }).window = {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };
}

stubBrowserGlobals();
const { Doorway } = await import("../src/App.tsx");
/** Every test starts on an empty roster — the door offers no old names. */
beforeEach(stubBrowserGlobals);

describe("which face the origin wears", () => {
  it("gives a browser that is nobody yet the front page, at the origin only", () => {
    expect(faceFor("/", null)).toBe("front-page");
    // A trailing slash names the same door.
    expect(faceFor("//", null)).toBe("front-page");
  });

  it("still shows the door at every other address — the share link is unchanged", () => {
    // The regression this phase could most easily cause. `/p/<id>` is what
    // strangers paste to each other, and a canvas whose link grant is open
    // still needs to know who is writing on it.
    expect(faceFor("/p/prj_acme", null)).toBe("door");
    expect(faceFor("/p/prj_acme/i/itm_1", null)).toBe("door");
    // Including addresses nothing serves: a mistyped share link asks who you
    // are and then says nothing is there, exactly as it did before.
    expect(faceFor("/c/prj_acme", null)).toBe("door");
    expect(faceFor("/nothing/at/all", null)).toBe("door");
  });

  it("gives somebody the app, wherever they are standing", () => {
    for (const at of ["/", "/p/prj_acme", "/p/prj_acme/i/itm_1", "/nothing"]) {
      expect(faceFor(at, priya)).toBe("here");
    }
  });
});

/** What `Doorway` actually renders — the rule wired to the pages. */
function meet(at: string, actor: { id: string; name: string } | null): string {
  return renderToStaticMarkup(
    h(
      MemoryRouter,
      { initialEntries: [at] },
      h(Doorway, {
        actor,
        onIdentity: () => {},
        children: (who) => h("div", null, `the app, for ${who.name}`),
      }),
    ),
  );
}

describe("the front door", () => {
  it("meets a stranger at the origin with the front page, not with the door", () => {
    const html = meet("/", null);
    expect(html).toContain(SKILL_INSTALL_COMMAND);
    expect(html).not.toContain("Pick a name"); // the identity dialog's line
    expect(html).not.toContain("the app, for");
  });

  it("meets a stranger on a canvas with the door, as it always has", () => {
    const html = meet("/p/prj_acme", null);
    expect(html).toContain("Pick a name");
    expect(html).not.toContain(SKILL_INSTALL_COMMAND);
  });

  it("hands the origin to somebody who is already here", () => {
    const html = meet("/", priya);
    expect(html).toContain("the app, for Priya");
    expect(html).not.toContain(SKILL_INSTALL_COMMAND);
  });
});

describe("the front page", () => {
  const page = () => renderToStaticMarkup(h(FrontPage, { onIdentity: () => {} }));

  it("says the idea and then hands over Scene 0's three steps", () => {
    const html = page();
    const words = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
    // The idea, in the journey's own terms.
    expect(words).toContain("One canvas, driven from a web app and a terminal");
    // The three moves, in Scene 0's order.
    const steps = [SKILL_INSTALL_COMMAND, "Launch an agent.", "use isocan."];
    let from = -1;
    for (const step of steps) {
      const at = words.indexOf(step);
      expect(at, `the front page never says “${step}”`).toBeGreaterThan(from);
      from = at;
    }
  });

  it("sends nobody away to documentation to learn how to enter", () => {
    // Scene 0's rule. A link to the repo is a footnote and is allowed; it must
    // not be an instruction, and there must be no OTHER outbound link on the
    // page competing with the steps.
    const hrefs = [...page().matchAll(/href="([^"]*)"/g)].map((m) => m[1]!);
    expect(hrefs).toEqual(["https://github.com/dglazkov/isocan"]);
  });

  /**
   * **Rewritten when `marketing/` was folded in, and the rewrite is a
   * strengthening rather than a relaxation — but it is a rewrite, so it is
   * argued for here.**
   *
   * The case used to be `not.toMatch(/<img|<link|<script|url\(/)`, which was
   * the right guard for a page that drew nothing. The page now carries one
   * picture: `marketing/`'s screenshot, which is the strongest thing that site
   * had — a real canvas with four cursors on it, three of them agents — and
   * which the front page could not otherwise say at all.
   *
   * `<img>` was never the hazard, though. The hazard is a FIRST PAINT that
   * depends on somebody else's server: `marketing/index.html` pulled two faces
   * from `fonts.googleapis.com`, and phase 10's service worker holds the shell
   * and nothing else, so a page that needs a third-party host is a page that
   * does not render offline and does not render when that host is slow.
   *
   * So the invariant is stated as the thing that actually matters, in three
   * parts, and every one of them can say no:
   *   - nothing is fetched from another origin, by any mechanism;
   *   - nothing that BLOCKS rendering is fetched at all (`<link>`, `<script>`,
   *     `url(` — the three shapes a webfont or a third-party stylesheet takes);
   *   - the one thing that is fetched is lazy, and sits after the ask.
   */
  it("reaches no third-party host, and blocks its first paint on nothing", () => {
    const html = page();

    // Every URL the markup names, whatever attribute carries it. The one
    // outbound link is the footnote; everything else must be same-origin and
    // root-relative, which is what the daemon serves out of `dist`.
    const urls = [...html.matchAll(/(?:src|href|srcset|poster)="([^"]*)"/g)].map((m) => m[1]!);
    expect(urls.length, "no URLs found at all — this parse is wrong").toBeGreaterThan(0);
    const offsite = urls.filter((u) => /^(?:[a-z]+:)?\/\//i.test(u) && u !== GITHUB);
    expect(offsite, "the front page must not fetch from another origin").toEqual([]);
    for (const url of urls) {
      if (url === GITHUB) continue;
      expect(url.startsWith("/"), `${url} is not a root-relative same-origin path`).toBe(true);
    }

    // The render-blocking shapes. A webfont arrives as one of these three and
    // never as anything else, so this is the case that would have caught
    // `marketing/`'s two Google Fonts links had they been carried across.
    expect(html, "a stylesheet, script or url() would block the first paint").not.toMatch(
      /<link|<script|url\(/,
    );

    // And the picture waits. `loading="lazy"` is the browser being told it may
    // skip this until it is near the viewport, which is only honest because
    // the picture is below the steps — see the order case below.
    for (const tag of html.match(/<img[^>]*>/g) ?? []) {
      expect(tag, "an image on this page must be lazy").toContain('loading="lazy"');
    }
  });

  /**
   * The picture came from `marketing/`; the ORDER did not, and the order is
   * the thing Scene 0 rules on. A hero screenshot above the ask would put 49KB
   * and a scroll between a stranger and the three steps, which is the rule
   * "nobody is ever sent away to learn how to enter" losing on a technicality.
   */
  it("puts the picture after the ask, not in front of it", () => {
    const html = page();
    const command = html.indexOf(SKILL_INSTALL_COMMAND);
    const picture = html.indexOf("<img");
    expect(command, "the install command is not on the page").toBeGreaterThan(-1);
    expect(picture, "the screenshot is not on the page").toBeGreaterThan(-1);
    expect(picture, "the screenshot is above the three steps").toBeGreaterThan(command);
  });

  it("offers the second face's entrance to somebody who already has a canvas", () => {
    expect(page().replace(/<[^>]*>/g, " ")).toContain("Been here before?");
  });

  /**
   * **`marketing/`'s claim, kept as a test.** Its README said "every command on
   * this page is a real command", and nothing checked it — the page was a
   * static file and the CLI was somewhere else entirely, so a renamed verb
   * would have left the argument for the isomorphism illustrated with commands
   * the isomorphism no longer has.
   *
   * Now the rows are a value (`lib/ledger.ts`) and the verbs are read off the
   * CLI's own registrations, exactly as `packages/cli/test/surface.test.ts`
   * reads them for the agent guide. Same shape as `SKILL_INSTALL_COMMAND`: the
   * page does not get to hold its own copy of what the product does.
   */
  it("shows only commands the CLI actually registers", () => {
    const registered = registeredCommands();
    // Lesson #8: this whole case reads as a pass if the parse comes back empty.
    expect(registered.size, "no commands parsed out of main.ts").toBeGreaterThan(20);
    expect(LEDGER.length, "an empty ledger asserts nothing").toBeGreaterThan(5);

    const strays = LEDGER.filter((row) => !registered.has(verbOf(row.command)));
    expect(
      strays.map((r) => r.command),
      "the front page promises a command the CLI does not have",
    ).toEqual([]);
    // Every row is a command, not prose: the ledger's right column is the half
    // that has to be paste-able.
    for (const row of LEDGER) expect(row.command.startsWith("isocan ")).toBe(true);
  });

  /**
   * Every FIELD of every row, not every row.
   *
   * The first version of this checked `did` and `command` and called that
   * "both halves" — and deleting the JSX that draws `row.note`, the second
   * line of the left column, left all 24 cases green. A row's note is where
   * the claim that needs a caveat lives ("per person — you never undo somebody
   * else's work"), so a page that silently stopped drawing them would be a
   * page making nine unqualified claims. Lesson #10 in miniature: the rule is
   * "the ledger is drawn", and the rule has no field name in it.
   */
  it("draws every field of every ledger row", () => {
    // `renderToStaticMarkup` escapes quotes and apostrophes; the ledger's
    // commands contain both, so they are unescaped before comparing.
    const words = page()
      .replace(/<[^>]*>/g, " ")
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/\s+/g, " ");
    for (const row of LEDGER) {
      expect(words, `the gesture “${row.did}” is missing`).toContain(row.did);
      expect(words, `the note under “${row.did}” is missing`).toContain(row.note);
      expect(words, `the command “${row.command}” is missing`).toContain(row.command);
    }
  });
});

describe("copying the one step that is a command", () => {
  it("reports success when the clipboard takes it", async () => {
    const wrote: string[] = [];
    const state = await copyToClipboard("npx thing", {
      writeText: async (text: string) => void wrote.push(text),
    });
    expect(state).toBe("copied");
    expect(wrote).toEqual(["npx thing"]);
  });

  it("falls back to a hand copy when the browser refuses", async () => {
    // The shape of a refusal: a rejected promise. `docs/phases.md`'s standing
    // lessons record the measured case — Chrome blocks the clipboard while
    // `visibilityState` is `hidden`.
    const refused = {
      writeText: () => Promise.reject(new Error("NotAllowedError")),
    };
    await expect(copyToClipboard("npx thing", refused)).resolves.toBe("select-it");
  });

  it("falls back the same way when there is no clipboard at all", async () => {
    // An insecure origin has no `navigator.clipboard`, and neither does a tab
    // rendering this anywhere that is not a browser.
    await expect(copyToClipboard("npx thing", null)).resolves.toBe("select-it");
    await expect(copyToClipboard("npx thing", {} as never)).resolves.toBe("select-it");
    expect(browserClipboard()).toBeNull(); // no navigator in this suite
  });

  it("reaches its success state in the DOM, with no clipboard involved", () => {
    const drawn = (state: "idle" | "copied" | "select-it") =>
      renderToStaticMarkup(
        h(CopyCommandView, { command: SKILL_INSTALL_COMMAND, state, onCopy: () => {} }),
      );

    const copied = drawn("copied");
    expect(copied).toContain('data-copy-state="copied"');
    expect(copied).toContain(copyLabel("copied"));
    expect(copied).toContain(copySaid("copied"));

    // And the fallback is a real path, not a sentence: the command itself is
    // on the page in every state, selectable, whatever the clipboard said.
    for (const state of ["idle", "copied", "select-it"] as const) {
      expect(drawn(state)).toContain(`<code class="front-command-line">${SKILL_INSTALL_COMMAND}`);
    }
    expect(drawn("select-it")).toContain('data-copy-state="select-it"');
    // Nothing announced before anything is pressed.
    expect(copySaid("idle")).toBe("");
  });
});

/**
 * **The command on the page is checked against the one the repo advertises.**
 *
 * `packages/cli/test/surface.test.ts`'s move, applied to a string instead of a
 * verb: a command written into a page is a copy that ages, and this one is the
 * first thing a stranger will type. So the page imports it from core — where
 * `INSTALL_SPEC` already lives for the same reason — and the build checks that
 * core's spelling is the spelling `README.md` and the skill's own `SKILL.md`
 * hand out. Change any one of the three and this fails naming the other two.
 */
describe("the install command", () => {
  const ADVERTISED = ["README.md", ".agents/skills/isocan-collab/SKILL.md"];

  it("is spelled the same on the front page and everywhere the repo advertises it", async () => {
    for (const doc of ADVERTISED) {
      const text = await fs.readFile(path.join(REPO, doc), "utf8");
      expect(text, `${doc} no longer advertises “${SKILL_INSTALL_COMMAND}”`).toContain(
        SKILL_INSTALL_COMMAND,
      );
    }
    expect(renderToStaticMarkup(h(FrontPage, { onIdentity: () => {} }))).toContain(
      SKILL_INSTALL_COMMAND,
    );
  });

  it("is written down once in the source, and imported everywhere else", async () => {
    const strays: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === "dist") continue;
          await walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(entry.name)) continue;
        if (full.endsWith(path.join("core", "src", "address.ts"))) continue; // the definition
        if (full.endsWith(path.join("test", "frontdoor.test.ts"))) continue; // this file
        const text = await fs.readFile(full, "utf8");
        for (const [i, line] of text.split("\n").entries()) {
          if (line.includes("skills add")) strays.push(`${path.relative(REPO, full)}:${i + 1}`);
        }
      }
    };
    await walk(path.join(REPO, "packages"));
    expect(strays, `import SKILL_INSTALL_COMMAND from @isocan/core instead:\n${strays.join("\n")}`)
      .toEqual([]);
  });
});
