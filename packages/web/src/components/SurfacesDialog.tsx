import { useEffect, useState } from "react";
import type { BadgeSummary, SweepReport } from "@isocan/core";
import { elapsedLabel } from "@isocan/core";
import { killBadge, listBadges } from "../lib/api.ts";

/**
 * **"Your surfaces…"** — kill-a-badge, in a browser (identity desk, mechanism
 * 1's enforcement primitive).
 *
 * The design's sentence is *"not yet 'revoke Jordan', but 'end that holder's
 * recognition' exists"*, and the case it is written for is a stolen laptop.
 * That case is a browser case first: the machine is gone, so the surface that
 * still answers is Jordan's phone, and what she needs from it is a list she
 * recognises and one button.
 *
 * **It belongs in the identity menu**, beside "Work from your terminal…", for
 * the reason that menu already states: this menu is *how I'm connected here*,
 * and a surface carrying your identity is another way you are connected. Share
 * is *who may be here*, which is about somebody else. Ending a surface is
 * never about somebody else — the home will not let it be (`not-your-badge`),
 * because a surface of yours is defined as one that shares an identity with
 * yours.
 *
 * **Two sentences of consequence, and they are not decoration.** Ending a
 * badge is one of two composing gestures and a person who thinks it is one
 * gesture will be surprised:
 *
 * - It ends recognition — that holder cannot speak as you anywhere, on any
 *   canvas, from that moment. This is the half that matters for a stolen
 *   machine, because it is what stops the thief being you.
 * - It does not un-invite. A killed holder that knocks again gets a NEW badge
 *   with none of your claims, and if the link grant is on that stranger is let
 *   back in as a stranger. Turning the link off is the other gesture, and it
 *   is one panel away.
 *
 * The sweep count is shown because ending a machine ends everything that
 * machine passed onto a canvas: a laptop that had escalated two others takes
 * them with it, and a person is entitled to know that before they wonder where
 * their build agent went.
 */
export function SurfacesDialog({ onClose }: { onClose: () => void }) {
  const [badges, setBadges] = useState<BadgeSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /** Which row is one click from being ended. A destructive act with no undo
   * gets a second click, and the second click is on a button that says what it
   * does — never a browser `confirm()`, which is a dialog this app does not
   * control the words of. */
  const [arming, setArming] = useState<string | null>(null);
  const [ended, setEnded] = useState<{ badge: BadgeSummary; swept: SweepReport } | null>(null);
  const [now, setNow] = useState(() => new Date().toISOString());

  useEffect(() => {
    let cancelled = false;
    listBadges()
      .then((res) => {
        if (cancelled) return;
        setBadges(res.badges);
        // Read once, when the answer lands: "seen 4m ago" is measured against
        // the moment the list was fetched, and a clock that ticked on its own
        // would age rows that had not changed.
        setNow(new Date().toISOString());
      })
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  async function end(badge: BadgeSummary): Promise<void> {
    setBusy(badge.badgeId);
    setError(null);
    try {
      const answer = await killBadge(badge.badgeId);
      setEnded({ badge: answer.killed, swept: answer.swept });
      setBadges((current) => (current ?? []).filter((row) => row.badgeId !== badge.badgeId));
      // Ending THIS surface means this tab's own cookie no longer resolves.
      // Nothing is faked here — the next request the page makes is answered
      // `bad-badge` and `api.ts`'s recover path knocks for a fresh badge, at
      // which point this browser is a stranger with no personas. Reloading is
      // the honest way to arrive at that state rather than sitting in a page
      // built for somebody the home has stopped recognising.
      if (badge.self) setTimeout(() => location.reload(), 1200);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
      setArming(null);
    }
  }

  return (
    <div
      className="terminal-menu"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="share-head">Your surfaces</div>
      <div className="share-link-note">
        Everything that carries your identity — this browser, your machines, the terminals you
        enrolled. Ending one stops it speaking as you, everywhere.
      </div>

      {error && <div className="identity-warning">{error}</div>}
      {!badges && !error && <div className="share-link-note">asking the desk…</div>}

      {ended && (
        <div className="share-link-note">
          <b>{ended.badge.self ? "This surface" : "That surface"} is ended.</b>{" "}
          {sweptNote(ended.swept)} It is not un-invited: if it knocks again it arrives as a
          stranger with none of your personas, and the link grant decides whether a stranger gets
          in.
        </div>
      )}

      <div className="share-roster">
        {(badges ?? []).map((badge) => (
          <div key={badge.badgeId} className="surface-row">
            <span className="surface-what">
              <b>{badge.kind === "cookie" ? "Browser" : "Machine"}</b>
              {badge.self && <span className="surface-self"> this one</span>}
              <span className="share-roster-kind">
                {badge.actors.map((a) => a.name || a.id).join(", ") || "speaks as nobody"} ·{" "}
                {badge.canvases === 1 ? "1 canvas" : `${badge.canvases} canvases`} ·{" "}
                {badge.self ? "here now" : `seen ${elapsedLabel(badge.lastSeen, now)} ago`}
                {/* What this surface has PROVED (phase 9 stage 2). It is the
                    answer to "why does that machine get into the canvas I only
                    invited Jordan to", which a list of names and counts cannot
                    give — and every badge here shares an identity with you, so
                    these are your own proofs on your own surfaces. */}
                {(badge.attested ?? []).length > 0 &&
                  ` · proved ${(badge.attested ?? [])
                    .map((attribute) => attribute.replace(/^email:/, ""))
                    .join(", ")}`}
              </span>
            </span>
            {arming === badge.badgeId ? (
              <button
                className="btn danger"
                disabled={busy !== null}
                onClick={() => void end(badge)}
              >
                {badge.self ? "End this one — sign out" : "End it"}
              </button>
            ) : (
              <button
                className="btn"
                disabled={busy !== null}
                onClick={() => setArming(badge.badgeId)}
              >
                End…
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** What ending a surface did to everybody it had vouched onto a canvas. Only
 * said when there was something to say — a badge that passed nobody anywhere
 * sweeps nobody, and a sentence about zero people is noise on a panel that is
 * already delivering news. */
function sweptNote(swept: SweepReport): string {
  if (swept.expelled === 0) return "";
  const who = swept.expelled === 1 ? "One surface it had let in" : `${swept.expelled} surfaces it had let in`;
  return `${who} went with it.`;
}
