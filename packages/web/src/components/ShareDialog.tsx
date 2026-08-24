import { useEffect, useState } from "react";
import type { Actor, AttestOffer, Grant, SweepReport } from "@isocan/core";
import { canvasUrl, collectCanvasActors, grantSubjectOf, LINK } from "@isocan/core";
import { createGrant, listGrants, revokeGrant, ApiError } from "../lib/api.ts";
import { attesterOffer, canVerifyEmail } from "../lib/signin.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { actorColorIn, useActorColors } from "../lib/colors.ts";
import { actorNameIn, useActorNames } from "../lib/names.ts";

/**
 * **Who may be here** — the facepile's twin, and Scenes 1–2's whole gesture.
 *
 * It sits next to the pile because it is the same subject: the pile is *who's
 * here*, this is *who may be here*. Three things, in the order the journey
 * puts them:
 *
 * 1. **The address, with a copy button.** That is the entire invitation —
 *    *"here's the canvas"* — and it deliberately carries no installation
 *    instructions, because the canvas teaches its own escalation (Scene 5) to
 *    whoever reaches for it. Nothing here needs to survive in a Slack
 *    scrollback.
 * 2. **The link grant, as a toggle.** "Anyone with the link" is the control
 *    every sharing product has taught, and underneath it is one revocable desk
 *    row — the status quo demoted to data. Turning it off refuses the next
 *    arrival AND expels the people who got in on it — phase 9's provenance
 *    sweep, which this dialog reports rather than describes: the count comes
 *    back on the revoke response, so what is shown is what happened, not what
 *    the dialog believes should have.
 * 3. **The roster.** Who is on this canvas — live sessions first, then
 *    everyone whose work is on it. It is `isocan who --all`'s answer, and it
 *    is here because "who may be here" is unreadable without "who is".
 *
 * **The "who" field landed with the attester, in one change, exactly as this
 * comment promised it would** — "so the control appears the day it works".
 * Phase 9 stage 1 made `email:` a real subject and left the field out, because
 * nothing could yet ATTEST an email and a field that wrote a row admitting
 * nobody is a dialog that lies. Stage 2 borrowed the bench, so the field is
 * here, and it is drawn from what THIS HOME says it can verify rather than
 * from a build-time constant: a local daemon has borrowed nothing, shows no
 * field, and says so in the sentence where the field would have been.
 *
 * Two invited people can be told apart from two people with the link, so the
 * named rows get their own list with an un-invite on each. That is what makes
 * the sweep's re-rooting visible for the first time: turn the link off with an
 * email grant standing, and the person invited by name stays.
 *
 * **There is no owner, either.** Any admitted badge may share or un-share.
 * The desk design leaves roles open, and inventing an owner in the dialog
 * would imply a rule the door does not have.
 */
export function ShareDialog({ actor, onClose }: { actor: Actor; onClose: () => void }) {
  const project = useCanvasStore((s) => s.project);
  const canvas = useCanvasStore((s) => s.canvas);
  const sessions = useCanvasStore((s) => s.sessions);
  const colors = useActorColors();
  const names = useActorNames();
  const [grants, setGrants] = useState<Grant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  /**
   * What the last revocation actually did to the people inside — **and which
   * revocation it was.**
   *
   * Held rather than folded into a note, because it is news about a moment and
   * not a description of a state: it appears when something is revoked and
   * stays until the dialog is closed.
   *
   * The `what` half is not bookkeeping. Turning the link off and un-inviting
   * somebody are two gestures on two controls, and a count that rendered under
   * whichever note was nearest would tell a person that the link toggle
   * expelled two people when it was the un-invite that did — which is stage
   * 1's own finding ("the verb contradicted itself in one screen") arriving in
   * the dialog rather than in the CLI. Measured in a real browser: the count
   * from an un-invite landed under "Anyone with the link", and read as if the
   * toggle had done it.
   */
  const [swept, setSwept] = useState<{ what: "link" | string; report: SweepReport } | null>(null);
  /** What this home can verify, which decides whether the "who" field is a
   * control or a lie. Null while asking; a home that has borrowed nothing
   * answers with an empty `attesters` and the field never appears. */
  const [offer, setOffer] = useState<AttestOffer | null>(null);
  const [who, setWho] = useState("");

  const projectId = project?.id ?? null;

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    listGrants(projectId)
      .then((res) => !cancelled && setGrants(res.grants))
      .catch((err: Error) => !cancelled && setError(err.message));
    attesterOffer()
      .then((answer) => !cancelled && setOffer(answer))
      // Deliberately silent: not knowing what this home can verify costs the
      // "who" field, and an error banner about it would sit above a working
      // link toggle saying something a person cannot act on.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!project) return null;

  // The one origin. People always enter through the home's web app, and this
  // tab IS the home's web app — so the address to hand somebody is the address
  // this page is already being served from. (In dev that is Vite's port, which
  // is correct: it is where the person reading this is standing.)
  const address = canvasUrl(location.origin, project.id);
  const link = grants?.find((g) => g.subject === LINK) ?? null;
  const linkOn = link !== null;
  const invited = (grants ?? []).filter((g) => g.subject !== LINK);

  async function toggleLink(): Promise<void> {
    if (!projectId || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Two rows, never one resurrected: revocation is a tombstone, so turning
      // the link off and on again writes a new grant. The list is re-read
      // rather than patched, because the row that comes back is the desk's,
      // not one this dialog imagined.
      if (link) {
        const answer = await revokeGrant(projectId, link.id);
        // A home from before the sweep answers without a count; zeroes are
        // the honest reading of that, and of a revocation that expelled
        // nobody.
        setSwept({ what: "link", report: answer.swept ?? { expelled: 0, rerooted: 0 } });
      } else {
        await createGrant(projectId, LINK);
        setSwept(null);
      }
      setGrants((await listGrants(projectId)).grants);
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "not-admitted"
          ? "this canvas will not have you any more — ask whoever shared it"
          : (err as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }

  /**
   * Invite one person by name.
   *
   * `grantSubjectOf` is core's, not this file's: `isocan share <who>` asks the
   * same question, and until this field landed the CLI owned the only copy
   * with a note saying it would move "when the field lands — it is the same
   * question asked twice at that point". It landed.
   *
   * No client-side "is that an email": the home refuses shape (`bad-grant`)
   * and capability (`no-attester`) with two deliberately different sentences,
   * and a second copy of either here would be a policy that goes stale.
   */
  async function invite(): Promise<void> {
    if (!projectId || busy || !who.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createGrant(projectId, grantSubjectOf(who));
      setWho("");
      setGrants((await listGrants(projectId)).grants);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Un-invite one. The same route the link toggle drives, so the sweep runs
   * and its count is reported the same way — a named person's grant is not a
   * different kind of row.
   *
   * **The row is dropped locally before the list is re-read**, and that is not
   * an optimism about the network: un-inviting somebody can expel THE PERSON
   * DOING IT — the caller may be admitted by the very row they just revoked,
   * which is the ordinary case for anybody who was invited by name and is now
   * tidying up. The re-read then 403s, and a dialog that only trusted the
   * re-read would leave a revoked invitation on screen with a live-looking
   * Un-invite button beside it. Measured in a real browser, where it did
   * exactly that.
   */
  async function uninvite(grant: Grant): Promise<void> {
    if (!projectId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const answer = await revokeGrant(projectId, grant.id);
      setSwept({ what: grant.subject, report: answer.swept ?? { expelled: 0, rerooted: 0 } });
      setGrants((current) => (current ?? []).filter((row) => row.id !== grant.id));
      setGrants((await listGrants(projectId)).grants);
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "not-admitted"
          ? "done — and it removed you too: you were here by that invitation, so this canvas " +
            "will not have you any more"
          : (err as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("this browser would not let the page copy — select the address and copy it");
    }
  }

  return (
    <div
      className="share-menu"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="share-head">Share this canvas</div>

      {/* The whole invitation. */}
      <div className="share-address">
        <input
          className="text-input"
          readOnly
          aria-label="This canvas's address"
          value={address}
          onFocus={(e) => e.currentTarget.select()}
        />
        <button className="btn primary" onClick={() => void copy()}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {/* The link grant, as the toggle everybody already knows. */}
      <button
        className={`share-link-row${linkOn ? " on" : ""}`}
        role="switch"
        aria-checked={linkOn}
        disabled={busy || grants === null}
        onClick={() => void toggleLink()}
      >
        <span className={`share-switch${linkOn ? " on" : ""}`} aria-hidden="true">
          <span className="share-knob" />
        </span>
        <span className="share-link-text">
          <b>Anyone with the link</b>
          <span className="share-link-note">
            {grants === null
              ? "asking the door…"
              : linkOn
                ? // The consequence, BEFORE the click. Turning the link off is
                  // a destructive act since phase 9, and the people it removes
                  // include whoever came in by the link — which, on a canvas
                  // created from a terminal, is the owner's own browser tab.
                  // Measured against a real daemon: turning it off from this
                  // dialog expelled the tab that did it, and the page it
                  // landed on said "ask whoever shared it" to the person who
                  // had just shared it. Saying so here costs one sentence and
                  // needs no new mechanism.
                  "anyone who has the address can open this canvas. Turning it off removes everyone who came in that way — including you, unless you made this canvas."
                : // Say what revocation actually did — and since phase 9 it
                  // does expel, so the count is read off the answer rather
                  // than asserted. `swept` is null when the link was already
                  // off before this dialog was opened, and there is nothing
                  // to report about a gesture nobody made.
                  sweptNote(swept?.what === "link" ? swept.report : null)}
          </span>
        </span>
      </button>

      {error && <div className="identity-warning">{error}</div>}

      {/* The "who" field — on a home that can verify one. */}
      {offer && canVerifyEmail(offer) ? (
        <>
          <form
            className="share-address"
            onSubmit={(e) => {
              e.preventDefault();
              void invite();
            }}
          >
            <input
              className="text-input"
              type="email"
              aria-label="Invite somebody by email"
              placeholder="someone@example.com"
              value={who}
              onChange={(e) => setWho(e.target.value)}
            />
            <button className="btn" type="submit" disabled={busy || !who.trim()}>
              Invite
            </button>
          </form>
          <div className="share-link-note">
            They get in by proving that address — nothing is emailed from here, and no account
            is made for them. Send them the link above; the door does the rest.
          </div>
        </>
      ) : (
        offer && (
          // The deferral, stated where somebody would look for the control.
          <div className="share-deferred">
            Inviting one person by email needs somewhere to verify it, and this home has
            nowhere yet — the link is how you share today.
          </div>
        )
      )}

      {/* Who was invited by name. Separate from the roster below on purpose:
          that is who IS here, this is who MAY be, and the two answer different
          questions about the same canvas. */}
      {/* The count from an UN-INVITE, beside the control that did it — and
          OUTSIDE the list, because un-inviting the last named person empties
          the list, and news that vanishes with the row it is about is news
          nobody reads. Measured in a browser, where it did exactly that. */}
      {swept && swept.what !== "link" && (
        <div className="share-link-note">
          {swept.what.replace(/^email:/, "")} is un-invited. {lost(swept.report)}
        </div>
      )}

      {invited.length > 0 && (
        <>
          <div className="identity-menu-head">Invited by name</div>
          <div className="share-roster">
            {invited.map((grant) => (
              <div key={grant.id} className="surface-row">
                <span className="surface-what">
                  <b>{grant.subject.replace(/^email:/, "")}</b>
                  <span className="share-roster-kind">
                    invited {grant.at.slice(0, 10)} · gets in by proving it
                  </span>
                </span>
                <button className="btn" disabled={busy} onClick={() => void uninvite(grant)}>
                  Un-invite
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="identity-menu-head">On this canvas</div>
      <div className="share-roster">
        {roster(actor, sessions, canvas).map((who) => (
          <div key={who.actor.id} className={`share-roster-row${who.live ? "" : " away"}`}>
            <span
              className="face-mark"
              style={{ background: actorColorIn(colors, who.actor.id) }}
            >
              {actorNameIn(names, who.actor).charAt(0).toUpperCase()}
            </span>
            <span className="share-roster-name">{actorNameIn(names, who.actor)}</span>
            <span className="share-roster-kind">{who.kind}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * What turning the link off did, in the dialog's own voice.
 *
 * The re-rooted half is the sentence worth writing carefully. "Turning off the
 * link expels only those no other grant covers" is the design's promise, and a
 * person watching a toggle needs to be told that it kept its promise —
 * otherwise the only visible fact is a number of people who lost the canvas,
 * and the natural reading of that is that the toggle did too much.
 */
function sweptNote(swept: SweepReport | null): string {
  if (!swept) return "New arrivals are turned away.";
  if (swept.expelled === 0 && swept.rerooted === 0) {
    return "New arrivals are turned away. Nobody was on it by the link, so nobody left.";
  }
  return `New arrivals are turned away, and ${lost(swept)}`;
}

/** The same count, without the link's own sentence in front of it — what an
 * un-invite did. Two callers, one spelling of "how many left and how many
 * stayed", because the half nobody expects (somebody STAYED, covered by
 * another grant) has to read the same way wherever it is reported. */
function lost(swept: SweepReport): string {
  if (swept.expelled === 0 && swept.rerooted === 0) return "Nobody left.";
  const who = swept.expelled === 1 ? "1 surface" : `${swept.expelled} surfaces`;
  const kept =
    swept.rerooted > 0
      ? ` ${swept.rerooted === 1 ? "One" : String(swept.rerooted)} stayed — another grant still covers ${swept.rerooted === 1 ? "it" : "them"}.`
      : "";
  return `${who} lost this canvas.${kept}`;
}

interface RosterRow {
  actor: Actor;
  live: boolean;
  kind: string;
}

/**
 * Who is on this canvas — live sessions first, then everyone whose work is on
 * it. Exactly `isocan who --all`'s answer, computed from the same core helper
 * (`collectCanvasActors`) rather than from a second walk of the state.
 */
function roster(
  self: Actor,
  sessions: ReturnType<typeof useCanvasStore.getState>["sessions"],
  canvas: ReturnType<typeof useCanvasStore.getState>["canvas"],
): RosterRow[] {
  const rows: RosterRow[] = [{ actor: self, live: true, kind: "you" }];
  for (const session of sessions) {
    if (rows.some((row) => row.actor.id === session.actor.id)) continue;
    rows.push({
      actor: session.actor,
      live: true,
      kind: session.kind === "cli" ? "terminal" : "here",
    });
  }
  for (const who of canvas ? collectCanvasActors(canvas) : []) {
    if (rows.some((row) => row.actor.id === who.id)) continue;
    rows.push({ actor: who, live: false, kind: "away" });
  }
  return rows;
}
