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
 * this page and without reading anything else. The repo link at the bottom is
 * a footnote for the curious, deliberately placed after the steps and worded
 * as an aside, because the moment it becomes the ask, the page has failed the
 * rule.
 *
 * Everything it draws comes from the app's own stylesheet and the system font
 * stack. No image, no webfont, no third-party anything — phase 10 made this
 * tab offline-capable out of a cached shell, and the FIRST page a stranger
 * sees is the worst possible place to add a network dependency the service
 * worker does not hold.
 */
export function FrontPage({ onIdentity }: { onIdentity: (actor: Actor) => void }) {
  const [doorOpen, setDoorOpen] = useState(false);
  return (
    <div className="front-page">
      <header className="front-head">
        <h1>isocan</h1>
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
