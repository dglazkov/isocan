import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { RE_HOMING_NOT_YET, TERMS, TERMS_HISTORY, TERMS_LEDE } from "../src/lib/terms.ts";
import { TermsPage } from "../src/pages/TermsPage.tsx";

/**
 * **The innkeeper's obligations, guarded** (phase 13.7).
 *
 * `docs/design/innkeeper.md` names what running a home obliges; `docs/phases.md`
 * makes the terms page the proof that those obligations were said out loud to a
 * stranger. Two different things can go wrong here and they need two different
 * checks, because only one of them is visible to somebody editing this package:
 *
 *   - **The page stops saying something.** A section deleted from `lib/terms.ts`
 *     or from the JSX that draws it — an obligation quietly dropped. Caught by
 *     rendering the page and reading every field of every section back off it,
 *     the same move `frontdoor.test.ts` makes for the ledger's rows after
 *     deleting one field left 24 cases green.
 *   - **The design stops saying it.** This is the direction it actually goes
 *     wrong: nobody will edit this page and forget the design, but somebody may
 *     edit the design — a ledger stops being innkeeper-private, a replica stops
 *     holding blobs — and this page will go on making the retired promise to
 *     strangers at the origin. So every section names the sentence in
 *     `innkeeper.md` it restates, and the check fails HERE when that sentence
 *     leaves the doc.
 *
 * Both can say no, which is lesson #14's question asked of each: delete a
 * section and the first fails by name; edit a source sentence in the doc and the
 * second fails naming the section and the sentence.
 *
 * No DOM here, like every other web test in this suite — `react-dom/server` is
 * enough to read what the page PUTS on itself. The parts of this page a browser
 * would have to prove (that it is legible in both themes, that it reads on a
 * phone) are not asserted here and the report says so; the stylesheet's own
 * guards — `tokens.test.ts` and `oneblock.test.ts` — cover the mechanical half,
 * which is that it uses tokens and declares each class once.
 */

const REPO = fileURLToPath(new URL("../../..", import.meta.url));

/**
 * `docs/design/innkeeper.md`, flattened enough that a sentence quoted out of it
 * survives its line wrapping and its markdown: emphasis and code ticks removed,
 * every run of whitespace collapsed. It is deliberately NOT lowercased — a
 * quote that has drifted in case has drifted.
 */
function innkeeperDoc(): string {
  return readFileSync(path.join(REPO, "docs/design/innkeeper.md"), "utf8")
    .replace(/[`*_]/g, "")
    .replace(/\s+/g, " ");
}

/** The page as somebody meets it, with the tags taken off. */
function words(): string {
  const html = renderToStaticMarkup(h(MemoryRouter, { initialEntries: ["/terms"] }, h(TermsPage)));
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#x2F;/g, "/")
    .replace(/\s+/g, " ");
}

describe("the terms page", () => {
  it("draws every field of every section", () => {
    // Lesson #8: an empty list of obligations is a page that asserts nothing.
    expect(TERMS.length, "no obligations to check").toBeGreaterThan(5);
    const said = words();
    expect(said, "the lede is missing").toContain(TERMS_LEDE);
    for (const section of TERMS) {
      expect(said, `the heading “${section.heading}” is missing`).toContain(section.heading);
      expect(section.body.length, `“${section.id}” has no paragraphs`).toBeGreaterThan(0);
      for (const paragraph of section.body) {
        expect(said, `“${section.id}” stopped saying: ${paragraph.slice(0, 60)}…`).toContain(
          paragraph,
        );
      }
    }
    expect(said, "the page no longer says where its own history is").toContain(TERMS_HISTORY);
  });

  /**
   * The obligations by name, one case each, so a failure says which one went —
   * `phases.md` lists them and a page missing any one of them is the phase not
   * done. The `id`s are the contract between that list and this file.
   */
  it("names every obligation phases.md requires of it", () => {
    const ids = TERMS.map((s) => s.id);
    expect(ids).toEqual([
      "operator", // a named operator
      "reads", // the home reads everything it hosts
      "own-home", // run your own if that is unacceptable
      "ledgers", // the two ledgers and the line between them
      "sovereignty", // sovereignty by replica, and its two caveats
      "uptime", // liveness, never data
      "abuse", // what the operator will do, and where to write
    ]);
  });

  /**
   * **The operator, named, with an address that reaches him.** Decided by the
   * user verbatim: an individual, not a company. Asserted as a literal rather
   * than imported from the module it lives in, because a guard that reads the
   * value under test and compares it to itself cannot say no (lesson #5) — and
   * the thing at risk is not a typo, it is somebody "tidying" a real name and a
   * real address off a public page.
   */
  it("names the operator and the address, and invents no company", () => {
    const said = words();
    expect(said).toContain("Dimitri Glazkov, an individual — not a company");
    expect(said).toContain("dimitri@glazkov.com");
    // Nothing anybody said, so nothing this page may say. Each of these is a
    // thing a terms page grows on its own if a model writes it unattended.
    for (const invented of [
      /\bLLC\b/,
      /\bInc\.?\b/,
      /\barbitration\b/i,
      /\bgoverned by the laws\b/i,
      /\bjurisdiction\b/i,
      /\bwarrant(y|ies)\b/i,
      /\bhereby\b/i,
      /\bAS IS\b/,
    ]) {
      expect(said, `the terms invented ${invented}`).not.toMatch(invented);
    }
  });

  /**
   * **The sovereignty caveat, in both its parts, and honestly.**
   *
   * The half that is fact (a daemon holds the whole store) and the two halves
   * that are not (re-homing in one command is unbuilt; a browser-only canvas has
   * no such copy at all). A page that said only the first would be the most
   * flattering possible reading of the design, and `phases.md` asks for the
   * caveat stated rather than implied.
   */
  it("says the sovereignty caveat as well as the sovereignty", () => {
    const said = words();
    expect(said).toContain("~/.isocan holds the full store");
    expect(said, "the re-homing caveat is not on the page").toContain(RE_HOMING_NOT_YET);
    expect(said).toContain("no such copy at all");
  });

  /**
   * **The sentence phase 13 comes back to delete, kept findable.**
   *
   * Phase 13's Work says retiring this caveat is part of ITS outcome, so the
   * sentence has to be reachable from that phase by grep rather than by reading
   * the whole page: it is a named constant, it is commented with the phase
   * number at its site, and this case fails if either goes — which is the point
   * at which somebody would otherwise delete the wrong half of the caveat.
   */
  it("leaves phase 13 a sentence it can find and delete", () => {
    const source = readFileSync(path.join(REPO, "packages/web/src/lib/terms.ts"), "utf8");
    expect(source, "the comment naming phase 13 is gone").toMatch(/phase 13\b/);
    expect(source).toContain("RE_HOMING_NOT_YET");
    // And it is one paragraph, not a clause welded into another: deleting it
    // must leave the paragraphs on either side standing.
    const sovereignty = TERMS.find((s) => s.id === "sovereignty")!;
    expect(sovereignty.body).toContain(RE_HOMING_NOT_YET);
    expect(sovereignty.body.length, "the caveat is the whole section").toBeGreaterThan(1);
  });

  /**
   * Every claim on this page is a claim `innkeeper.md` makes. See the file
   * comment for why this points at the doc rather than restating it.
   */
  it("makes no promise the design does not", () => {
    const doc = innkeeperDoc();
    // Lesson #8 again: if the read or the flattening breaks, every `includes`
    // below answers false — but a source list that is empty answers true, so
    // both ends are asserted.
    expect(doc.length, "innkeeper.md did not read").toBeGreaterThan(4000);
    for (const section of TERMS) {
      expect(section.sources.length, `“${section.id}” cites nothing`).toBeGreaterThan(0);
      for (const source of section.sources) {
        expect(
          doc.includes(source),
          `innkeeper.md no longer says “${source}” — “${section.id}” is promising something the ` +
            "design has retired, at the origin, to strangers",
        ).toBe(true);
      }
    }
  });

  /**
   * The register, checked the one way a module test can: this page fetches
   * nothing. `FrontPage.tsx`'s argument about a webfont on the critical path
   * applies harder here — somebody reads this while deciding whether to trust
   * the address — and the three shapes a third-party asset arrives in are the
   * same three `frontdoor.test.ts` names.
   */
  /**
   * **Found by mutation, and it was a hole in the front page's guard too.**
   *
   * `frontdoor.test.ts` refuses `<link`, `<script` and `url(` in the RENDERED
   * MARKUP, which catches an inline style and a stylesheet tag — and misses the
   * obvious way a webfont actually arrives, which is a rule in `styles.css`.
   * Giving `.terms-lede` a `font-family: url(https://fonts.example/…)` left all
   * 44 cases green. So the rule is asserted where the declaration lives, for
   * the whole stylesheet rather than for this page: a third-party host on the
   * critical path of the front door is what phase 13.5 spent a webfont to
   * avoid, and neither of the door's two pages may reintroduce it.
   *
   * `data:` is not a fetch and is allowed — the pen cursor is one, inline.
   */
  it("adds no rule that fetches from another host", () => {
    const css = readFileSync(path.join(REPO, "packages/web/src/styles.css"), "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );
    const urls = [...css.matchAll(/url\(\s*['"]?([^'")]+)/g)].map((m) => m[1]!);
    expect(urls.length, "no url() found at all — this parse is wrong").toBeGreaterThan(0);
    const offsite = urls.filter((u) => !u.startsWith("data:") && !u.startsWith("/"));
    expect(offsite, "the stylesheet fetches from another origin").toEqual([]);
  });

  it("reaches no third-party host and blocks its first paint on nothing", () => {
    const html = renderToStaticMarkup(
      h(MemoryRouter, { initialEntries: ["/terms"] }, h(TermsPage)),
    );
    expect(html).not.toMatch(/<link|<script|<img|url\(/);
    const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]!);
    expect(hrefs.length, "the way back is gone").toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href.startsWith("/"), `${href} leaves this origin`).toBe(true);
    }
  });
});
