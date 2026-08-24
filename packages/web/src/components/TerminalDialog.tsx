import { useCallback, useEffect, useState } from "react";
import type { Actor } from "@isocan/core";
import { setupCommand } from "@isocan/core";
import { mintPass } from "../lib/api.ts";

/**
 * **"Work from your terminal…"** — Scene 5's dialog, and the canvas teaching
 * its own escalation.
 *
 * One sentence of concept and one command with a copy button. That is the
 * whole design, and the journey wrote it that way for a reason: the person
 * reading this has, by construction, never installed isocan. Anything more
 * than a line to paste is a tutorial, and a tutorial is the thing arriving
 * thin was supposed to make unnecessary.
 *
 * **The command is built, never written** — `setupCommand` in `@isocan/core`,
 * the same function `isocan pass` prints from. Two surfaces spelling one
 * string is house rule 4's definition of a computation that belongs to
 * neither; and the install spec inside it is the one thing that must never be
 * written without its `#release` branch (#47), which is why
 * `test/packaging.test.ts` now fails the build on that literal in any
 * package's `src` but the single definition.
 *
 * **The pass names this canvas and THIS person's actor**, which is the whole
 * point — *minted by her admitted tab, for her actor* — and it is why there is
 * no second door and no social claim here: the session that already IS her
 * hands the identity over. There is no "as somebody else" control because the
 * home would refuse one (`not-your-actor`), and no admission-only checkbox
 * because the gesture that wants it — an agent that will name itself — is not
 * one a person makes in a browser.
 *
 * **It re-mints on every open, and it says when it dies.** A pass is
 * single-use and lives about fifteen minutes, so a dialog that cached one
 * would show a dead credential to anyone who came back to it — and "the
 * cheerful wrong address" is a failure this codebase has now recorded four
 * times over two phases. So: a fresh pass each time the dialog opens, a
 * countdown while it stands, and at zero the command is REPLACED (not merely
 * disabled) by the button that mints the next one. Abandoned passes cost a
 * dead row nobody can redeem, which the design already accounts for.
 */
export function TerminalDialog({
  actor,
  projectId,
  onClose,
}: {
  actor: Actor;
  projectId: string;
  onClose: () => void;
}) {
  const [minted, setMinted] = useState<{ command: string; expiresAt: string } | null>(null);
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
    mintPass(projectId, actor.id)
      .then(({ pass, token }) => {
        if (cancelled) return;
        setMinted({ command: setupCommand(location.origin, projectId, token), expiresAt: pass.expiresAt });
        setNow(Date.now());
      })
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [projectId, actor.id, nonce]);

  // A minute's resolution needs a coarse tick; the point is only that the
  // number on screen cannot be a lie somebody acts on.
  useEffect(() => {
    if (!minted) return;
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [minted]);

  const copy = useCallback(async (command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("this browser would not let the page copy — select the command and copy it");
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
      <div className="share-head">Work from your terminal</div>

      {/* The one sentence of concept, in the journey's own words. */}
      <div className="share-link-note">
        Your machine gets its own copy of this canvas, and your own agent can join it here.
        Paste this into a terminal, in an empty directory:
      </div>

      {error && <div className="identity-warning">{error}</div>}

      {!minted && !error && <div className="share-link-note">minting a pass…</div>}

      {minted && !dead && (
        <>
          <pre className="terminal-command">{minted.command}</pre>
          <div className="terminal-actions">
            <button className="btn primary" onClick={() => void copy(minted.command)}>
              {copied ? "Copied" : "Copy command"}
            </button>
            <span className="terminal-expiry">{expiryLine(left)}</span>
          </div>
          {/* Said where the credential is, not in a tooltip: this line arrives
              as you, and a person who has just been handed something copyable
              deserves to know it is not a link to share. */}
          <div className="share-deferred">
            It works once, and it arrives as you — so it is a key, not an invitation. To invite a
            person, hand them the address from Share instead.
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
