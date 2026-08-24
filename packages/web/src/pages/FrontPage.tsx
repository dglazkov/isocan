import { useState } from "react";
import type { Actor } from "@isocan/core";
import { SKILL_INSTALL_COMMAND } from "@isocan/core";
import {
  browserClipboard,
  copyLabel,
  copySaid,
  copyToClipboard,
  type CopyState,
} from "../lib/copy.ts";
import { IdentityDialog } from "../components/IdentityDialog.tsx";
import { LEDGER } from "../lib/ledger.ts";
import { CANVAS_SHOT } from "../lib/shot.ts";

/**
 * **The origin, wearing a face** (Scene 0, phase 13.5).
 *
 * Not a brochure standing apart from the product: this is the same address
 * every canvas lives at, answering somebody who has never been here. So it
 * says the idea in a few sentences and then does what every door in this
 * journey does — hands over the exact next move where the reader is already
 * standing.
 *
 * Three steps, and **nobody is ever sent away to documentation to learn how to
 * enter**. The steps ARE the entry: the reader can finish them without leaving
 * this page and without reading anything else. Everything below them is the
 * argument for having taken them, and the one link on the page is a footnote
 * at the bottom worded as an aside, because the moment it becomes the ask, the
 * page has failed the rule.
 *
 * **This absorbed `marketing/`**, which was a second front door: a static site
 * for the same audience, at the same address, that nothing served. Its thesis
 * came across (*every click has a command*, proved by the split ledger rather
 * than asserted), its proof came across (a real canvas with four cursors on
 * it), and the parts that only made sense standing alone did not — a sticky
 * nav for a page with no scroll targets, a second copy of the install line in a
 * closing band, a catalogue of six other people's skill repos, and a webfont
 * from a third-party host. Where the two disagreed about the command, Scene 0
 * won: the command is `SKILL_INSTALL_COMMAND`, imported from core, and there is
 * exactly one of it on the page.
 *
 * **What it loads, and what it does not.** The register comes from size, weight
 * and colour rather than from a display face, so first paint still needs
 * nothing but the cached shell — phase 10 made this tab offline-capable and a
 * webfont on the critical path of the first page a stranger sees would spend
 * that. The one picture is below the steps, `loading="lazy"`, same-origin, and
 * 49KB; a reader with no network gets its alt text and a reserved box, and
 * everything they are actually asked to do is above it.
 */
export function FrontPage({ onIdentity }: { onIdentity: (actor: Actor) => void }) {
  const [doorOpen, setDoorOpen] = useState(false);
  return (
    <div className="front-page">
      <header className="front-head">
        {/* The register marketing/ had and this page did not. The accent takes
            one word — the one the whole page is about — rather than a band. */}
        <h1 className="front-title">
          Every click has a <em>command</em>.
        </h1>
        <p className="front-lede">
          One canvas, driven from a web app and a terminal. You move things with
          a mouse; your agent does the same work with a command, on the same
          live canvas, and you both watch it happen.
        </p>
      </header>

      <ol className="front-steps">
        <li className="front-step">
          <span className="front-step-n" aria-hidden="true">
            1
          </span>
          <div className="front-step-body">
            <div className="front-step-say">Add the skill, wherever your project lives.</div>
            <CopyCommand command={SKILL_INSTALL_COMMAND} />
          </div>
        </li>
        <li className="front-step">
          <span className="front-step-n" aria-hidden="true">
            2
          </span>
          <div className="front-step-body">
            <div className="front-step-say">Launch an agent.</div>
            <div className="front-step-note">
              Whichever one you already use — the skill is the doorway, and it
              installs the rest itself.
            </div>
          </div>
        </li>
        <li className="front-step">
          <span className="front-step-n" aria-hidden="true">
            3
          </span>
          <div className="front-step-body">
            <div className="front-step-say">Say “use isocan.”</div>
            <div className="front-step-note">
              Your agent brings up a canvas and opens it in your browser. You are
              both standing on it.
            </div>
          </div>
        </li>
      </ol>

      {/* **A real canvas, not a mockup** — and it sits BELOW the steps, which is
          the whole of what the fold is for here. The steps are the ask; the
          picture is the reason to have taken them, and a hero image above the
          ask would put 49KB and a scroll between a stranger and the one thing
          this page wants from them.

          `loading="lazy"` and `decoding="async"` for the same reason: nothing
          about the first screen waits on it. `width`/`height` come from
          `CANVAS_SHOT` so the box is reserved before the bytes land, and
          `height: auto` in the stylesheet keeps those attributes a hint rather
          than a squash (lessons.md #3 — this exact image shipped stretched
          once). */}
      <figure className="front-shot">
        <img
          src={CANVAS_SHOT.src}
          width={CANVAS_SHOT.width}
          height={CANVAS_SHOT.height}
          alt={CANVAS_SHOT.alt}
          loading="lazy"
          decoding="async"
        />
        <figcaption className="front-shot-note">
          <span>A real canvas, not a mockup.</span>
          <span>One person and three agents on it at once, each cursor saying what it is doing.</span>
          <span>The screens are a synthetic product; the canvas is the product.</span>
        </figcaption>
      </figure>

      {/* **The split ledger**, and it is the page's argument rather than a
          feature list: the gesture on the left, the command that performs the
          identical operation on the right. Rows, not cards — a card grid would
          say "here are nine features" where this says "here are nine pairs, and
          they are the same nine acts". The commands come from `lib/ledger.ts`
          so the build can check them against the CLI's own registry. */}
      <section className="front-claim">
        <h2 className="front-claim-head">The isomorphism is the whole idea</h2>
        <p className="front-claim-lede">
          Not “we also have an API.” Every mutation on this canvas is one
          operation value, posted to one endpoint, applied by one pure reducer —
          so the web app and the CLI cannot drift apart, because they speak the
          same vocabulary to the same engine. Here is the same work, both ways.
        </p>
        <div className="front-ledger">
          {LEDGER.map((row) => (
            <div className="front-row" key={row.command}>
              <div className="front-row-did">
                {row.did}
                <span className="front-row-note">{row.note}</span>
              </div>
              <code className="front-row-cmd">{row.command}</code>
            </div>
          ))}
        </div>
      </section>

      {/* The second face's entrance. Somebody who already has a canvas does not
          need the steps — they need to say who they are, which is the same door
          every other route shows them, summoned here by an act rather than by
          arriving. */}
      <div className="front-onward">
        <button className="btn" onClick={() => setDoorOpen(true)}>
          Been here before?
        </button>
        <span className="front-onward-note">Say who you are and pick up your canvases.</span>
      </div>

      <footer className="front-foot">
        isocan is open source; the code and the longer story are{" "}
        <a href="https://github.com/dglazkov/isocan">on GitHub</a>. You do not
        need any of it to run the three steps.
      </footer>

      {doorOpen && <IdentityDialog onDone={onIdentity} />}
    </div>
  );
}

/**
 * **The one step that is a command**, with a copy button and a way through
 * when the button cannot work.
 *
 * Split in two on purpose. The state lives here; what the reader SEES in each
 * state is `CopyCommandView` below, a pure function of that state — so the
 * success state is reachable in a test by handing the view the state, with no
 * clipboard, no click and no DOM environment. The seam left open is the two
 * lines between them (`onCopy` → `setState`), and per AGENTS.md that half is
 * proven by driving a real browser and saying so, not by asserting nothing.
 */
function CopyCommand({ command }: { command: string }) {
  const [state, setState] = useState<CopyState>("idle");
  return (
    <CopyCommandView
      command={command}
      state={state}
      onCopy={() => void copyToClipboard(command, browserClipboard()).then(setState)}
    />
  );
}

/**
 * The command as the reader meets it, in whatever state pressing has left it.
 *
 * The `<code>` is the fallback and it is always there, in every state:
 * `user-select: all`, so one click selects the whole line and ⌘C finishes the
 * job with no permission involved. The button is the convenience on top, and
 * its answer is written into `data-copy-state` as well as into its label and
 * its live region — a state that can be read off the DOM rather than off the
 * clipboard, which is the only way to observe it without asserting something
 * about a browser that nobody measured.
 */
export function CopyCommandView({
  command,
  state,
  onCopy,
}: {
  command: string;
  state: CopyState;
  onCopy: () => void;
}) {
  return (
    <div className="front-command" data-copy-state={state}>
      <code className="front-command-line">{command}</code>
      <button className="btn front-command-copy" type="button" onClick={onCopy}>
        {copyLabel(state)}
      </button>
      {/* Said out loud, not merely drawn: the whole point of the state is that
          pressing the button told you something. */}
      <span className="front-command-said" role="status">
        {copySaid(state)}
      </span>
    </div>
  );
}
