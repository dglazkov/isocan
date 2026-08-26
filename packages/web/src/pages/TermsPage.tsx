import { Link } from "react-router-dom";
import { TERMS, TERMS_HISTORY, TERMS_LEDE } from "../lib/terms.ts";

/**
 * **The innkeeper's obligations, at the innkeeper's own address** (phase 13.7).
 *
 * `docs/projects/multiuser/innkeeper.md` chose the posture — *an* innkeeper, never *the*
 * innkeeper — and left one line open beneath it: a named operator and a terms
 * document. This is that document, and it is a face of the origin for the same
 * reason the front page is (`lib/faces.ts`): the subject is what THIS home can
 * see, so hosting the answer anywhere else would be odd, and hosting it behind
 * the door would be asking somebody to accept the terms in order to read them.
 *
 * **Why it is drawn from `lib/terms.ts` rather than written as JSX.** The same
 * reason `lib/ledger.ts` exists: every paragraph is a promise, and a promise a
 * test cannot hold is a promise that drifts. There the right column is checked
 * against the CLI's registrations; here each section is checked against the
 * sentence in the design doc it restates, so the failure arrives at the page
 * when somebody edits the design — which is the direction this actually goes
 * wrong. `packages/web/test/terms.test.ts` is the guard.
 *
 * **The register is the rest of the site's, and deliberately not a legal
 * document's.** No new colour, no webfont, no third-party asset — phase 13.5
 * took one webfont off the front page on purpose and `FrontPage.tsx` says why,
 * and the argument is stronger here: this page has to be readable by somebody
 * on a bad connection deciding whether to trust the address. Prose held to a
 * measure, headings that can be scanned, and nothing to fetch.
 *
 * **What it does not have is a Back button, an "I agree", or a nav.** It has
 * one link home, at the end, where somebody who read it is standing.
 */
export function TermsPage() {
  return (
    <div className="terms-page">
      <header className="terms-head">
        <h1 className="terms-title">Terms, and what this home can see</h1>
        <p className="terms-lede">{TERMS_LEDE}</p>
      </header>

      {/* One section per obligation the design names. `id` is on the section so
          a paragraph of this page can be linked to directly — a takedown thread
          or a support mail wants to point at the sentence, not at the page. */}
      {TERMS.map((section) => (
        <section className="terms-section" id={section.id} key={section.id}>
          <h2 className="terms-section-head">{section.heading}</h2>
          {section.body.map((paragraph) => (
            <p className="terms-p" key={paragraph}>
              {paragraph}
            </p>
          ))}
        </section>
      ))}

      <footer className="terms-foot">
        <p className="terms-p">{TERMS_HISTORY}</p>
        <Link to="/">Back to the front page</Link>
      </footer>
    </div>
  );
}
