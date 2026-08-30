import { useCallback, useEffect, useState } from "react";
import type { Actor } from "@isocan/core";
import { localAgentInstructions } from "@isocan/core";
import { mintPass } from "../lib/api.ts";

/**
 * **"Bring your own agent…"** — Scene 5's dialog, and the canvas teaching
 * its own escalation.
 *
 * The concept, one line with a copy button, and nothing else. That is the
 * whole design, and the journey wrote it that way for a reason: the person
 * reading this has, by construction, never installed isocan. Anything more
 * than a line to paste is a tutorial, and a tutorial is the thing arriving
 * thin was supposed to make unnecessary.
 *
 * **What it hands over is a prompt, not a command**, which is the change its
 * cloud sibling earned first. The old shape was a shell command plus a
 * paragraph asking for two more things — start your agent in that directory,
 * tell it to use isocan — so the dialog was one artifact and three steps.
 * `localAgentInstructions` is addressed to the agent instead, and the paste IS
 * those steps: the person starts the agent they were going to start anyway and
 * pastes into its prompt box. The paragraph is gone with the step it described.
 *
 * `setupCommand` still exists and is still what `isocan pass` prints, because
 * its reader is a person at a shell. One pass, two wrappers, each shaped for
 * who reads it; what neither of them writes is the install spec, which must
 * never appear without its `#release` branch (#47) — `test/packaging.test.ts`
 * fails the build on that literal in any package's `src` but the single
 * definition in `@isocan/core`.
 *
 * **No `ISOCAN_DIRECT=1`, and that is the one place the line differs from its
 * sibling's.** Picking THIS menu entry declares the opposite of what Scene 6's
 * declares: the machine is the person's own and keeps the daemon, the replica
 * and the marker. The local copy is the point of the scene, so the opening
 * sentence keeps it — unlike the cloud dialog, which dropped its "no copy is
 * kept" as a consequence only the agent ever acts on.
 *
 * **The pass names this canvas and THIS person's actor**, which is the whole
 * point — *minted by her admitted tab, for her actor* — and it is why there is
 * no second door and no social claim here: the session that already IS her
 * hands the identity over. There is no "as somebody else" control because the
 * home would refuse one (`not-your-actor`), and no admission-only checkbox
 * because the gesture that wants it — an agent that will name itself — is not
 * one a person makes in a browser. The agent that reads this line still gets
 * its own name from `identity --session` when it arrives; what the pass endows
 * is the machine, which is hers.
 *
 * **It re-mints on every open, and it says when it dies.** A pass is
 * single-use and lives about fifteen minutes, so a dialog that cached one
 * would show a dead credential to anyone who came back to it — and "the
 * cheerful wrong address" is a failure this codebase has now recorded five
 * times. So: a fresh pass each time the dialog opens, a countdown while it
 * stands, and at zero the line is REPLACED (not merely disabled) by the button
 * that mints the next one. Abandoned passes cost a dead row nobody can redeem,
 * which the design already accounts for.
 */export function TerminalDialog({
  actor,
  canvasId,
  onClose,
}: {
  actor: Actor;
  canvasId: string;
  onClose: () => void;
}) {
  const [minted, setMinted] = useState<{ line: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    setMinted(null);
    setError(null);
    // The one origin: people always enter through the home's web app, and this
    // tab IS the home's web app — so the address to redeem at is the address
    // this page is being served from. (In dev that is Vite's port, which is
    // where the person reading it is standing.)
    mintPass(canvasId, actor.id)
      .then(({ pass, token }) => {
        if (cancelled) return;
        setMinted({
          line: localAgentInstructions(location.origin, canvasId, token),
          expiresAt: pass.expiresAt,
        });
        setNow(Date.now());
      })
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [canvasId, actor.id, nonce]);

  // A minute's resolution needs a coarse tick; the point is only that the
  // number on screen cannot be a lie somebody acts on.
  useEffect(() => {
    if (!minted) return;
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [minted]);

  const copy = useCallback(async (line: string) => {
    try {
      await navigator.clipboard.writeText(line);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("this browser would not let the page copy — select the text and copy it");
    }
  }, []);

  const left = minted ? Date.parse(minted.expiresAt) - now : 0;
  const dead = minted !== null && left <= 0;

  return (
    <div
      className="terminal-menu"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="share-head">Bring your own agent</div>

      {/* One sentence, and it is the problem rather than the topology — with
          the local copy kept, because unlike the cloud sibling's discarded one
          it is a thing the person gets. */}
      <div className="share-link-note">
        Run an agent on your own machine — it gets its own copy of this canvas to work on, next to
        your files and tools.
      </div>

      {error && <div className="identity-warning">{error}</div>}

      {!minted && !error && <div className="share-link-note">minting a pass…</div>}

      {minted && !dead && (
        <>
          {/* The person picks the directory by starting their agent in it,
              which is a thing they were going to do anyway. */}
          <div className="share-link-note">
            Start your agent in the directory you want it to work from. Paste this as the prompt:
          </div>
          <pre className="terminal-command">{minted.line}</pre>
          <div className="terminal-actions">
            <button className="btn primary" onClick={() => void copy(minted.line)}>
              {copied ? "Copied" : "Copy instructions"}
            </button>
            <span className="terminal-expiry">{expiryLine(left)}</span>
          </div>
          {/* Word for word its sibling's, because it is true word for word in
              both: setup, `identity --session`, `isocan wait`. */}
          <div className="share-link-note">
            The agent names itself, parks, and wakes when you @-mention it.
          </div>
          {/* Said where the credential is, not in a tooltip. What it has to
              get across is WHO the machine redeeming this turns out to be:
              the pass endows this person's actor, so her machine joins being
              her — and the agent on it still takes its own name, which is why
              this must not be shortened to "it arrives as you" beside a line
              that says the agent names itself. The cloud sibling's pass endows
              nobody, so its version of this line says "one workspace" instead.
              "It works once" is gone: the expiry sits directly above, and a
              warning that repeats what the reader just read is one they learn
              to skip. */}
          <div className="share-deferred">
            This admits your machine as you: a key, not an invitation. To invite a person, use
            Share.
          </div>
        </>
      )}

      {dead && (
        <>
          <div className="share-link-note">
            That pass expired while this was open. Passes are short-lived on purpose — a line that
            still worked tomorrow would be a live credential lying in a scrollback.
          </div>
          <button className="btn primary" onClick={() => setNonce((n) => n + 1)}>
            Mint a fresh one
          </button>
        </>
      )}
    </div>
  );
}

/** "expires in 12 min", and never "expires in 0 min". */
function expiryLine(left: number): string {
  const minutes = Math.ceil(left / 60_000);
  return minutes > 1 ? `expires in ${minutes} min` : "expires in under a minute";
}
