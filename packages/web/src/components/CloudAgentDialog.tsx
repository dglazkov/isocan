import { useCallback, useEffect, useState } from "react";
import type { Actor } from "@isocan/core";
import { cloudAgentInstructions } from "@isocan/core";
import { mintPass } from "../lib/api.ts";

/**
 * **"Run an agent in the cloud…"** — Scene 6's dialog, and the sibling of
 * `TerminalDialog`.
 *
 * Both are *extend my reach*, minted from an admitted session, which is why
 * they sit together under your own face. What separates them is the sentence
 * of concept: Scene 5's is "your machine gets its own copy", and this one's is
 * **an agent that outlives your lid needs to run somewhere that doesn't
 * close.** Inna has watched every evening's lids take Isaac's and Nico's rings
 * with them, and this is the door she reaches for.
 *
 * **What it hands over is a prompt, not a command**, and that is the whole
 * difference in shape from its sibling. Scene 5's line goes into a shell;
 * this one goes into a cloud session's prompt box — the person's four clicks
 * are New session, pick the repo, paste, Start — so it is addressed to an
 * agent and reads as a sentence. `cloudAgentInstructions` builds it in
 * `@isocan/core` for `setupCommand`'s reason: an install spec written a fifth
 * time is a fifth thing to get wrong, and `test/packaging.test.ts` fails the
 * build over exactly that literal.
 *
 * **It names no vendor, deliberately.** The journey says claude.ai/code as one
 * concrete instantiation; this dialog must not, because it goes to whatever
 * cloud the person already has and a line naming somebody's product would be
 * wrong for every other reader. What it says instead is what the workspace has
 * to be able to do — clone a repo and run a shell — which is true of all of
 * them.
 *
 * **The line declares direct mode, and that is not a guess.** Picking this
 * menu entry IS the declaration: the person has said the agent runs somewhere
 * disposable, so the line carries `ISOCAN_DIRECT=1` and the agent's setup
 * keeps no local copy. Nothing sniffs the environment on the person's behalf —
 * the whole design of direct mode is that the vendor is never asked.
 *
 * **The pass, its clock and its re-mint are `TerminalDialog`'s, on purpose.**
 * Single-use, about fifteen minutes, re-minted on every open, and REPLACED
 * rather than disabled at zero — a dialog that cached one would show a dead
 * credential to whoever came back to it, which is the cheerful-wrong-address
 * failure this codebase has now recorded five times.
 */
export function CloudAgentDialog({
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
    // The one origin: this tab IS the home's web app, so the address the agent
    // redeems at is the address this page is served from.
    // **No actor: the pass admits, and hands over nobody.** This is the one
    // place Scene 6 diverges from its sibling, and it is the difference
    // between the two doors. Scene 5 puts YOUR machine on the canvas, so its
    // pass carries your identity. Scene 6 starts an AGENT, and the journey is
    // explicit about what it does on arrival: it claims its own actor, checks
    // the roster, finds Isaac and Nico taken, and names itself Sonia. A pass
    // that endowed your identity would put a second face wearing your name in
    // the pile and make every op it sent read as yours.
    mintPass(canvasId)
      .then(({ pass, token }) => {
        if (cancelled) return;
        setMinted({
          line: cloudAgentInstructions(location.origin, canvasId, token),
          expiresAt: pass.expiresAt,
        });
        setNow(Date.now());
      })
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [canvasId, actor.id, nonce]);

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
      <div className="share-head">Run an agent in the cloud</div>

      {/* One sentence, and it is the problem rather than the topology. What
          it used to also say — that no copy is kept — is a consequence the
          agent acts on and the person never does, so it went. */}
      <div className="share-link-note">
        Run an agent in a cloud workspace so it keeps working after you close your laptop.
      </div>

      {error && <div className="identity-warning">{error}</div>}

      {!minted && !error && <div className="share-link-note">minting a pass…</div>}

      {minted && !dead && (
        <>
          {/* Deliberately no vendor named: whatever cloud you already have,
              so long as it can clone a repo and run a shell. The action leads
              now — it used to arrive after two qualifiers. */}
          <div className="share-link-note">
            In your coding harness&apos;s cloud, start a session on the repo you want the agent to
            work from. Paste this as the prompt:
          </div>
          <pre className="terminal-command">{minted.line}</pre>
          <div className="terminal-actions">
            <button className="btn primary" onClick={() => void copy(minted.line)}>
              {copied ? "Copied" : "Copy instructions"}
            </button>
            <span className="terminal-expiry">{expiryLine(left)}</span>
          </div>
          <div className="share-link-note">
            The agent names itself, parks, and wakes when you @-mention it.
          </div>
          {/* Its sibling says "it arrives as you", and this one MUST NOT: the
              pass here endows nobody, so saying so would be false about the
              one thing a person needs to be right about before pasting a
              credential somewhere. Still a key, for a different reason.

              "It works once" is gone from this line and not from the product:
              the expiry sits directly above it, and a warning that repeats
              what the reader just read is a warning they learn to skip. */}
          <div className="share-deferred">
            This admits one workspace: a key, not an invitation. To invite a person, use Share.
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
