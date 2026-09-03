import { useEffect, useState } from "react";
import type { Actor, AttestOffer, Canvas, Capability, Grant, GrantSubject, Space, SpaceLinkResponse, SweepReport } from "@isocan/core";
import { atLeast, canvasUrl, capabilityOf, capabilityWord, ownsCanvas, ownsSpace, collectCanvasActors, grantSubjectOf, isBar, LINK, roster, faceMark, RUNGS } from "@isocan/core";
import type { PresenceSession, RowState } from "@isocan/core";
import { useCanEdit } from "../lib/capability.ts";
import { useAnswerable } from "../lib/answerable.ts";
import {
  createBar,
  createGrant,
  createSpaceGrant,
  listGrants,
  listSpaceGrants,
  listSpaces,
  revokeGrant,
  revokeSpaceGrant,
  setSpaceLink,
  ApiError,
} from "../lib/api.ts";
import { attesterOffer, canVerifyEmail } from "../lib/signin.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { actorColorIn, useActorColors } from "../lib/colors.ts";
import { actorNameIn, useActorNames } from "../lib/names.ts";
import { useActorMarks } from "../lib/marks.ts";

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
 * **The rung is a ladder** (roles design). The link's setting is three words
 * — Editor, Canvas Viewer, Presentation Viewer — and the invite field puts
 * a person on one of the same rungs. Every word comes from core's one map,
 * so this dialog and `isocan share` name a rung the same way. A reader gets
 * this dialog with its controls gone and the address kept: who may be here
 * is worth knowing whoever you are, and the address is the one thing a
 * reader can hand on.
 *
 * **Every control is an owner's** (roles phase 2). The daemon refuses
 * anybody below `own` with `not-owner`; what this dialog owes is not to
 * offer a control that will refuse — disabled, with a note naming the
 * owner, rather than hidden, because what the link allows and who was
 * invited are worth knowing whoever you are. `own` is a rung on a row, so an
 * invited person can be raised to it here and then this dialog shows them
 * the same controls; the creator's row reads **Owner, made this** and has no
 * control, because the creator's standing is not a row.
 *
 * **Withdrawing versus barring** (roles phase 3). **Remove** on a row revokes
 * it, and the answer says whether the link would still admit that person;
 * when it would, the dialog says so — *they can still enter by the link* —
 * and offers **and keep them out**, which writes a bar. A bar is a row that
 * says no, listed under the invitations as **kept out** with who and when,
 * and **Let back in** revokes it like any other row. The difference between
 * the two gestures is the whole of journey 3 step 3, so the dialog names it
 * before the second one is taken.
 */
/**
 * **The space** (roles phase 4). With `space`, this is the SPACE's Share —
 * the same dialog with a space scope, see `SpaceShare` below. Without it, a
 * canvas's, which now also renders the rows from the canvas's space first,
 * greyed, under *from the space <name>, set by <who>*, and links to the
 * space's Share in place. Those rows are read from `GET /api/spaces` joined
 * on the canvas id — a badge that may not see the space sees no such rows,
 * and learns nothing about the space around a canvas it was invited to.
 */
export function ShareDialog({
  actor,
  onClose,
  space,
  canvases = [],
}: {
  actor: Actor;
  onClose: () => void;
  /** The space scope: opened from a heading on the canvas list. */
  space?: Space;
  /** For the space scope, the canvases whose titles it lists. */
  canvases?: readonly Canvas[];
}) {
  const record = useCanvasStore((s) => s.project);
  const canvas = useCanvasStore((s) => s.canvas);
  const sessions = useCanvasStore((s) => s.sessions);
  const answerable = useAnswerable(record?.id ?? null);
  const colors = useActorColors();
  const marks = useActorMarks();
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
  /**
   * The person just removed whom the link would still admit — the answer's
   * `stillAdmittedBy` — until they are kept out or the dialog closes. The
   * subject is held rather than the row, because the row is a tombstone now
   * and the bar is written by subject.
   */
  const [stillIn, setStillIn] = useState<{ subject: GrantSubject; by: "link" | "space" } | null>(null);
  /** What this home can verify, which decides whether the "who" field is a
   * control or a lie. Null while asking; a home that has borrowed nothing
   * answers with an empty `attesters` and the field never appears. */
  const [offer, setOffer] = useState<AttestOffer | null>(null);
  const [who, setWho] = useState("");
  /** The rung an invitation goes out at — Editor until somebody says otherwise. */
  const [inviteRung, setInviteRung] = useState<Capability>("edit");
  const canEdit = useCanEdit();
  const capability = useCanvasStore((s) => s.capability);
  /**
   * The space this canvas is in, with its rows — null when it is in none, or
   * when this badge may not see it. Read from the spaces list, because the
   * canvas record carries no space id (it is desk state, and a laptop has no
   * use for the id of a space it cannot see).
   */
  const [fromSpace, setFromSpace] = useState<{ space: Space; grants: Grant[] } | null>(null);
  /** Showing the space's Share in place, reached from the *from the space*
   * line. */
  const [showSpace, setShowSpace] = useState(false);

  const canvasId = record?.id ?? null;

  useEffect(() => {
    if (!canvasId || space) return;
    let cancelled = false;
    listGrants(canvasId)
      .then((res) => !cancelled && setGrants(res.grants))
      .catch((err: Error) => !cancelled && setError(err.message));
    attesterOffer()
      .then((answer) => !cancelled && setOffer(answer))
      // Deliberately silent: not knowing what this home can verify costs the
      // "who" field, and an error banner about it would sit above a working
      // link toggle saying something a person cannot act on.
      .catch(() => {});
    // The space's rows, silently: a home from before spaces has no route,
    // and a canvas in no space has nothing to say here.
    void listSpaces()
      .then(async (answer) => {
        const holder = answer.spaces.find((s) => s.canvasIds.includes(canvasId)) ?? null;
        if (!holder) return null;
        return { space: holder, grants: (await listSpaceGrants(holder.id)).grants };
      })
      .then((found) => !cancelled && setFromSpace(found))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // `capability` too: a `standing` message means a row on this canvas
    // changed — the one naming this tab's person — and the rows are read on
    // open only. Re-read them, so the person's own row shows the new rung
    // without closing and reopening the dialog (conductor's review, roles
    // phase 2). The offer is cached by `signin.ts`, so it costs nothing.
  }, [canvasId, capability, space]);

  if (space) return <SpaceShare actor={actor} space={space} canvases={canvases} onClose={onClose} />;
  if (!record) return null;
  if (showSpace && fromSpace) {
    return (
      <SpaceShare
        actor={actor}
        space={fromSpace.space}
        canvases={[record]}
        onClose={onClose}
        onBack={() => setShowSpace(false)}
      />
    );
  }

  // The one origin. People always enter through the home's web app, and this
  // tab IS the home's web app — so the address to hand somebody is the address
  // this page is already being served from. (In dev that is Vite's port, which
  // is correct: it is where the person reading this is standing.)
  const address = canvasUrl(location.origin, record.id);
  const link = grants?.find((g) => g.subject === LINK) ?? null;
  const linkOn = link !== null;
  const linkRung: Capability = link ? capabilityOf(link) : "edit";
  const linkReads = !atLeast(linkRung, "edit");
  // Whoever made the canvas owns it — a fact it has carried since it was
  // made, so nothing had to be stored for this — and so does anybody whose
  // admission holds `own` (roles phase 2): the hello said so, and a
  // `standing` message moves it without a reload.
  const made = record !== null && ownsCanvas(record, actor.id);
  const owned = made || atLeast(capability, "own");
  const ownerName = record ? actorNameIn(names, record.createdBy) : "";
  const ownerNote = record
    ? `only ${ownerName}, who owns this canvas, can change who may enter it or what the link allows`
    : "";
  const invited = (grants ?? []).filter((g) => g.subject !== LINK && !isBar(g));
  /** The bars: rows that say no (roles phase 3). Never the link. */
  const keptOut = (grants ?? []).filter(isBar);
  /** The title on a control somebody below `own` cannot press. */
  const ownerTitle = owned ? undefined : ownerNote;

  async function toggleLink(): Promise<void> {
    if (!canvasId || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Two rows, never one resurrected: revocation is a tombstone, so turning
      // the link off and on again writes a new grant. The list is re-read
      // rather than patched, because the row that comes back is the desk's,
      // not one this dialog imagined.
      if (link) {
        const answer = await revokeGrant(canvasId, link.id, actor.id);
        // A home from before the sweep answers without a count; zeroes are
        // the honest reading of that, and of a revocation that expelled
        // nobody.
        setSwept({ what: "link", report: answer.swept ?? { expelled: 0, rerooted: 0 } });
      } else {
        await createGrant(canvasId, LINK, undefined, actor.id);
        setSwept(null);
      }
      setGrants((await listGrants(canvasId)).grants);
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
  /**
   * What the link admits to — one POST, the home does the replacing (#88).
   *
   * The sweep that rides back is the mechanism, not a side effect: the people
   * already inside on the old link are re-rooted onto the new one at its
   * capability, so "can view" reaches them without expelling them — and it
   * reaches the person flipping the control too, unless they made the canvas
   * or hold a named invitation. The count is reported the way the off-toggle's
   * is, because it is the same kind of news.
   */
  async function setLinkCapability(capability: Capability): Promise<void> {
    if (!canvasId || busy || !link || capabilityOf(link) === capability) return;
    setBusy(true);
    setError(null);
    try {
      const answer = await createGrant(canvasId, LINK, capability, actor.id);
      if (answer.swept) setSwept({ what: "link", report: answer.swept });
      setGrants((await listGrants(canvasId)).grants);
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

  async function invite(): Promise<void> {
    if (!canvasId || busy || !who.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createGrant(canvasId, grantSubjectOf(who), inviteRung, actor.id);
      setWho("");
      setGrants((await listGrants(canvasId)).grants);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Remove one — revoke the row. The same route the link toggle drives, so
   * the sweep runs and its count is reported the same way — a named person's
   * grant is not a different kind of row. **Let back in** on a bar is this
   * same call: revoking a bar is the ordinary DELETE (roles phase 3).
   *
   * The answer says whether the link would still admit the person; when it
   * would, the *they can still enter by the link* line appears with **and
   * keep them out**, which is `keepOut` below. Said AFTER the revoke and from
   * the home's answer rather than from this dialog's copy of the rows,
   * because the rows may have moved under it.
   *
   * **The row is dropped locally before the list is re-read**, and that is not
   * an optimism about the network: removing somebody can expel THE PERSON
   * DOING IT — the caller may be admitted by the very row they just revoked,
   * which is the ordinary case for anybody who was invited by name and is now
   * tidying up. The re-read then 403s, and a dialog that only trusted the
   * re-read would leave a revoked invitation on screen with a live-looking
   * Remove button beside it. Measured in a real browser, where it did
   * exactly that.
   */
  async function remove(grant: Grant): Promise<void> {
    if (!canvasId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const answer = await revokeGrant(canvasId, grant.id, actor.id);
      // Letting somebody back in puts nobody out, so there is no count to
      // report and no line about the link: the link admitting them again is
      // the point.
      setSwept(
        isBar(grant) ? null : { what: grant.subject, report: answer.swept ?? { expelled: 0, rerooted: 0 } },
      );
      setStillIn(answer.stillAdmittedBy && !isBar(grant) ? { subject: grant.subject, by: answer.stillAdmittedBy } : null);
      setGrants((current) => (current ?? []).filter((row) => row.id !== grant.id));
      setGrants((await listGrants(canvasId)).grants);
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

  /**
   * **And keep them out** — the bar, written after a Remove whose answer said
   * the link would still admit them (roles design, "Withdrawing versus
   * barring"). One POST with `bars: true`; the home sweeps, so a person who
   * re-entered on the link in the meantime is put out by this write, and the
   * count is reported like any other.
   */
  async function keepOut(subject: GrantSubject): Promise<void> {
    if (!canvasId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const answer = await createBar(canvasId, subject, actor.id);
      if (answer.swept) setSwept({ what: subject, report: answer.swept });
      setStillIn(null);
      setGrants((await listGrants(canvasId)).grants);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Change what an invited person may do — one POST, and the home replaces
   * the row (roles journey 2: "every step is one change to one row"). The
   * sweep that rides back is what reaches the person if they are on the
   * canvas: their tab is told `standing` and redraws with no reload.
   */
  async function regrant(grant: Grant, rung: Capability): Promise<void> {
    if (!canvasId || busy || capabilityOf(grant) === rung) return;
    setBusy(true);
    setError(null);
    try {
      const answer = await createGrant(canvasId, grant.subject, rung, actor.id);
      if (answer.swept) setSwept({ what: grant.subject, report: answer.swept });
      setGrants((await listGrants(canvasId)).grants);
    } catch (err) {
      setError((err as Error).message);
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

      {canEdit && (
        <>
          {/* The link grant, as the toggle everybody already knows. */}
      <button
        className={`share-link-row${linkOn ? " on" : ""}`}
        role="switch"
        aria-checked={linkOn}
        disabled={busy || grants === null || !owned}
        title={ownerTitle}
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
                  linkReads
                  ? `anyone who has the address can ${linkRung === "view" ? "look at the deck" : "see the canvas"}, and change nothing. Turning it off removes everyone who came in that way.`
                  : "anyone who has the address can open this canvas. Turning it off removes everyone who came in that way — including you, unless you made this canvas."
                : // Say what revocation actually did — and since phase 9 it
                  // does expel, so the count is read off the answer rather
                  // than asserted. `swept` is null when the link was already
                  // off before this dialog was opened, and there is nothing
                  // to report about a gesture nobody made.
                  sweptNote(swept?.what === "link" ? swept.report : null)}
          </span>
        </span>
      </button>

      {/* What the link admits to — shown only while there is a link to speak
          for. Three rungs rather than a second switch: "on but read-only" and
          "off" must not look like neighbouring positions of one control.

          **Only an owner may move it**, and the daemon is what enforces that
          (`heldRung`). Disabled rather than hidden for everybody else:
          what the link currently admits to is worth knowing whoever you are,
          and a control that vanishes leaves somebody wondering where the
          setting went. The title says whose it is. */}
      {linkOn && (
        <div className="share-link-mode" role="radiogroup" aria-label="What the link allows">
          {LINK_RUNGS.map((rung) => (
            <button
              key={rung}
              className={`btn${linkRung === rung ? " primary" : ""}`}
              role="radio"
              aria-checked={linkRung === rung}
              disabled={busy || !owned}
              title={owned ? RUNG_HINT[rung] : ownerNote}
              onClick={() => void setLinkCapability(rung)}
            >
              {capabilityWord.dialog[rung]}
            </button>
          ))}
        </div>
      )}
        </>
      )}
      {/* Who made it. Worth saying on its own — it is the answer to "why can I
          not change that", and on a shared canvas it is simply useful to know
          whose room you are in. */}
      {record && (
        <p className="share-owner">
          Made by {made ? "you" : ownerName}
        </p>
      )}

      {error && <div className="identity-warning">{error}</div>}

      {/* The "who" field — on a home that can verify one, for somebody who
          may invite. */}
      {!canEdit ? null : offer && canVerifyEmail(offer) ? (
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
              disabled={!owned}
              title={ownerTitle}
              onChange={(e) => setWho(e.target.value)}
            />
            {/* The rung, in the dialog's words. Editor selected, because
                that is what an invitation has always meant here; Owner is in
                the list (roles phase 2), and a person raised to it gets these
                controls. */}
            <select
              className="text-input share-rung"
              aria-label="What they may do"
              value={inviteRung}
              disabled={!owned}
              title={ownerTitle}
              onChange={(e) => setInviteRung(e.target.value as Capability)}
            >
              {INVITE_RUNGS.map((rung) => (
                <option key={rung} value={rung}>
                  {capabilityWord.dialog[rung]}
                </option>
              ))}
            </select>
            {/* The action this form exists for, so it wears the accent — and
                for the same reason as the reply button: disabled is an
                opacity, and grey-on-grey cannot say which of the two states
                it is in. */}
            <button
              className="btn primary"
              type="submit"
              disabled={busy || !who.trim() || !owned}
              title={ownerTitle}
            >
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
          {swept.what.replace(/^email:/, "")} is removed. {lost(swept.report)}
        </div>
      )}
      {/* The difference between withdrawing and barring, said where the
          person can act on it: the home's answer said the link would still
          admit them, so removing the row did not remove the person. */}
      {stillIn && canEdit && stillIn.by === "space" && fromSpace && (
        <div className="share-link-note">
          {stillIn.subject.replace(/^email:/, "")} can still enter by the space {fromSpace.space.name}
          — removing them there removes them from every canvas in it.{" "}
          <button className="btn" onClick={() => setShowSpace(true)}>
            Share the space
          </button>
        </div>
      )}
      {stillIn && canEdit && stillIn.by === "link" && (
        <div className="share-link-note">
          {stillIn.subject.replace(/^email:/, "")} can still enter by the link.{" "}
          <button
            className="btn"
            disabled={busy || !owned}
            title={ownerTitle}
            onClick={() => void keepOut(stillIn.subject)}
          >
            and keep them out
          </button>
        </div>
      )}

      {/* The rows from the space, first and greyed (roles journey 5, step 1):
          they cannot be edited here, and the line says where they can. A
          canvas in no space, or a badge that may not see the space, shows no
          such rows (journey 8). */}
      {fromSpace && (
        <>
          <div className="identity-menu-head">From the space {fromSpace.space.name}</div>
          <div className="share-link-note">
            set by {actorNameIn(names, { id: fromSpace.space.createdBy, name: fromSpace.space.createdBy })} — these
            apply to every canvas in it and cannot be changed here.{" "}
            <button className="btn" onClick={() => setShowSpace(true)}>
              Share the space
            </button>
          </div>
          <div className="share-roster share-from-space">
            {fromSpace.grants.length === 0 && (
              <div className="share-link-note">Nobody is invited on the space yet.</div>
            )}
            {fromSpace.grants.map((grant) => (
              <div key={grant.id} className="surface-row">
                <span className="surface-what">
                  <b>{grant.subject.replace(/^email:/, "")}</b>
                  <span className="share-roster-kind">
                    {isBar(grant) ? "kept out" : capabilityWord.dialog[capabilityOf(grant)]} · from the space
                  </span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {grants !== null && (
        <>
          <div className="identity-menu-head">Invited by name</div>
          <div className="share-roster">
            {/* The creator's row, first and with no control: their standing
                is the floor, not a row, so there is nothing here to change
                or remove (roles journey 7). */}
            <div className="surface-row">
              <span className="surface-what">
                <b>{ownerName}</b>
                <span className="share-roster-kind">Owner, made this</span>
              </span>
            </div>
            {invited.map((grant) => (
              // `share-invited`: the address and its line take the full
              // width, and the controls wrap to a second line, right-aligned
              // — a picker beside a 340px popover's address squeezed the
              // address to a word a line (conductor's review, roles phase 2).
              <div key={grant.id} className="surface-row share-invited">
                <span className="surface-what">
                  <b>{grant.subject.replace(/^email:/, "")}</b>
                  <span className="share-roster-kind">
                    {canEdit ? "" : `${capabilityWord.dialog[capabilityOf(grant)]} · `}
                    invited {grant.at.slice(0, 10)} · gets in by proving it
                    {belowSpace(grant, fromSpace)}
                  </span>
                </span>
                {canEdit && (
                  <span className="share-row-controls">
                    {/* The row's rung as a picker: changing it is one POST
                        that replaces the row (roles journey 2). */}
                    <select
                      className="text-input share-rung"
                      aria-label={`What ${grant.subject.replace(/^email:/, "")} may do`}
                      value={capabilityOf(grant)}
                      disabled={busy || !owned}
                      title={ownerTitle}
                      onChange={(e) => void regrant(grant, e.target.value as Capability)}
                    >
                      {INVITE_RUNGS.map((rung) => (
                        <option key={rung} value={rung}>
                          {capabilityWord.dialog[rung]}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn"
                      disabled={busy || !owned}
                      title={ownerTitle}
                      onClick={() => void remove(grant)}
                    >
                      Remove
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>
          {/* The bars, under the invitations (roles phase 3): who is kept
              out, by which badge and since when, and the one control that
              lifts it. Shown to everybody for the invitations' reason — who
              may not be here is worth knowing whoever you are — and
              controlled by owners only, like every other row. */}
          {keptOut.length > 0 && (
            <>
              <div className="identity-menu-head">Kept out</div>
              <div className="share-roster">
                {keptOut.map((grant) => (
                  <div key={grant.id} className="surface-row share-invited">
                    <span className="surface-what">
                      <b>{grant.subject.replace(/^email:/, "")}</b>
                      <span className="share-roster-kind">
                        kept out {grant.at.slice(0, 10)} · by {grant.grantedBy} · refused at the door
                        whatever the link allows
                      </span>
                    </span>
                    {canEdit && (
                      <span className="share-row-controls">
                        <button
                          className="btn"
                          disabled={busy || !owned}
                          title={ownerTitle}
                          onClick={() => void remove(grant)}
                        >
                          Let back in
                        </button>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <div className="identity-menu-head">On this canvas</div>
      <div className="share-roster">
        {rosterRows(actor, sessions, canvas, answerable).map((who) => (
          <div
            key={who.actor.id}
            /* The state IS the class — the same shape the facepile uses. It
               said `available` for BOTH standing states at first, which is a
               lie in the markup: an enrolled agent nobody is listening for is
               precisely not available. */
            className={`share-roster-row ${who.state}`}
          >
            <span
              className="face-mark"
              style={{ background: actorColorIn(colors, who.actor.id) }}
            >
              {faceMark(marks, who.actor, actorNameIn(names, who.actor))}
            </span>
            <span className="share-roster-name">{actorNameIn(names, who.actor)}</span>
            <span className="share-roster-kind">{who.kind}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The rungs the link can be set to. Not `own`: a link that made owners of
 * strangers would be a link that could revoke itself. */
const LINK_RUNGS: readonly Capability[] = ["edit", "read", "view"];

/** The rungs an invitation can be on — the whole ladder, highest first,
 * from core's one list (roles phase 2: **Owner** in both pickers). */
const INVITE_RUNGS: readonly Capability[] = [...RUNGS].reverse();

/** What each rung means, as a title on its radio. */
const RUNG_HINT: Record<Capability, string> = {
  own: "Anyone with the link owns this canvas",
  edit: "Anyone with the link can change things",
  read: "Anyone with the link can see the canvas, and change nothing",
  view: "Anyone with the link can look at the deck, and change nothing",
};

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

/**
 * A canvas row below the space's rung is written, and the dialog says it is
 * below what the space already gives (roles design, "A canvas row below the
 * space's rung"). It takes effect if the canvas leaves the space.
 */
function belowSpace(grant: Grant, fromSpace: { grants: Grant[] } | null): string {
  if (!fromSpace) return "";
  const onSpace = fromSpace.grants.find((g) => g.subject === grant.subject && !isBar(g));
  if (!onSpace || atLeast(capabilityOf(grant), capabilityOf(onSpace))) return "";
  return ` · below what the space already gives (${capabilityWord.dialog[capabilityOf(onSpace)]})`;
}

/**
 * **The space's Share** (roles design, "The Share dialog"): the same dialog
 * with a space scope, and one more row at the top — **Every canvas in this
 * space**, whose one control is the link setting from journey 4 step 4.
 * That control is not a row on the space: a space has no address and no
 * link row, and the floor is not the ceiling, so it is the per-canvas link
 * written or revoked on every canvas in a loop at the home, and the answer
 * says how many canvases it reached. Below the rows it lists the canvases,
 * each marked when its own rows go wider than the space (journey 5's
 * *eleven-minus-ten*).
 *
 * Every control is an owner's, as on a canvas: the space's creator, or
 * anybody a live row on the space admits at `own` — read off this badge's
 * own attestations, since a space is not entered and carries no admission.
 * Opened from the heading on the canvas list, and from a canvas's Share
 * through the *from the space* line.
 */
function SpaceShare({
  actor,
  space,
  canvases,
  onClose,
  onBack,
}: {
  actor: Actor;
  space: Space;
  canvases: readonly Canvas[];
  onClose: () => void;
  /** Back to the canvas's Share, when this was reached from one. */
  onBack?: () => void;
}) {
  const names = useActorNames();
  const [grants, setGrants] = useState<Grant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [offer, setOffer] = useState<AttestOffer | null>(null);
  const [who, setWho] = useState("");
  const [inviteRung, setInviteRung] = useState<Capability>("edit");
  /** What the last every-canvas link write reached — the count is the whole
   * point of the gesture (journey 4 step 4), so it is shown as the home
   * answered it. */
  const [reached, setReached] = useState<SpaceLinkResponse | null>(null);
  const [swept, setSwept] = useState<{ what: string; report: SweepReport } | null>(null);
  /** Each canvas's own live rows, for the wider-than-the-space mark and the
   * every-canvas link's current reading. */
  const [rowsOf, setRowsOf] = useState<Map<string, Grant[]>>(new Map());

  const reload = async (): Promise<void> => {
    setGrants((await listSpaceGrants(space.id)).grants);
    const found = new Map<string, Grant[]>();
    await Promise.all(
      space.canvasIds.map(async (canvasId) => {
        try {
          found.set(canvasId, (await listGrants(canvasId)).grants);
        } catch {
          // A canvas this badge cannot read has rows it cannot see; the mark
          // says nothing rather than something wrong.
        }
      }),
    );
    setRowsOf(found);
  };

  useEffect(() => {
    let cancelled = false;
    void listSpaceGrants(space.id)
      .then((res) => !cancelled && setGrants(res.grants))
      .catch((err: Error) => !cancelled && setError(err.message));
    attesterOffer()
      .then((answer) => !cancelled && setOffer(answer))
      .catch(() => {});
    void (async () => {
      const found = new Map<string, Grant[]>();
      await Promise.all(
        space.canvasIds.map(async (canvasId) => {
          try {
            found.set(canvasId, (await listGrants(canvasId)).grants);
          } catch {
            // see `reload`
          }
        }),
      );
      if (!cancelled) setRowsOf(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [space.id, space.canvasIds]);

  const ownerName = actorNameIn(names, { id: space.createdBy, name: space.createdBy });
  const proved = new Set((offer?.attestations ?? []).map((row) => row.attribute));
  const owned =
    ownsSpace(space, actor.id) ||
    (grants ?? []).some((g) => !isBar(g) && atLeast(capabilityOf(g), "own") && proved.has(g.subject));
  const ownerNote = `only ${ownerName}, who owns the space ${space.name}, can change what is in it or who may enter its canvases`;
  const ownerTitle = owned ? undefined : ownerNote;
  const invited = (grants ?? []).filter((g) => !isBar(g));
  const keptOut = (grants ?? []).filter(isBar);

  /**
   * What the every-canvas link currently reads: one rung when every canvas's
   * link agrees, `off` when none has one, and nothing when they differ — a
   * mixed space is shown as mixed, never as whichever canvas came first.
   */
  const linkReadings = space.canvasIds.map((canvasId) => {
    const link = rowsOf.get(canvasId)?.find((g) => g.subject === LINK);
    return link ? capabilityOf(link) : "off";
  });
  const everyLink: Capability | "off" | null =
    linkReadings.length > 0 && linkReadings.every((r) => r === linkReadings[0]) ? linkReadings[0]! : null;

  async function act(what: string, work: () => Promise<{ swept?: SweepReport } | void>): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const answer = await work();
      if (answer && answer.swept) setSwept({ what, report: answer.swept });
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function setEveryLink(capability: Capability | "off"): Promise<void> {
    await act("link", async () => {
      const answer = await setSpaceLink(space.id, capability, actor.id);
      setReached(answer);
      return answer;
    });
  }

  /** Is this canvas open wider than the space? A live link of its own, or a
   * row of its own that the space does not give — a subject the space has no
   * row for, or a rung above the space's row for that subject. */
  function wider(canvasId: string): string | null {
    const rows = (rowsOf.get(canvasId) ?? []).filter((g) => !isBar(g));
    const link = rows.find((g) => g.subject === LINK);
    if (link) return `link on at ${capabilityWord.dialog[capabilityOf(link)]}`;
    const beyond = rows.filter((row) => {
      const onSpace = invited.find((g) => g.subject === row.subject);
      return !onSpace || !atLeast(capabilityOf(onSpace), capabilityOf(row));
    });
    if (beyond.length === 0) return null;
    return `${beyond.length === 1 ? "1 invitation" : `${beyond.length} invitations`} of its own`;
  }

  return (
    <div
      className="share-menu"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="share-head">
        {onBack && (
          <button className="btn quiet share-back" onClick={onBack} title="Back to the canvas's Share">
            ‹
          </button>
        )}
        Share the space {space.name}
      </div>

      {/* **Every canvas in this space** — the row above the invitations. */}
      <div className="share-every">
        <b>Every canvas in this space</b>
        <div className="share-link-mode" role="radiogroup" aria-label="What every canvas's link allows">
          {[...LINK_RUNGS, "off" as const].map((rung) => (
            <button
              key={rung}
              className={`btn${everyLink === rung ? " primary" : ""}`}
              role="radio"
              aria-checked={everyLink === rung}
              disabled={busy || grants === null || !owned}
              title={owned ? (rung === "off" ? "Turn the link off on every canvas in this space" : RUNG_HINT[rung]) : ownerNote}
              onClick={() => void setEveryLink(rung)}
            >
              {rung === "off" ? "Off" : capabilityWord.dialog[rung]}
            </button>
          ))}
        </div>
        <span className="share-link-note">
          {reached
            ? `Reached ${reached.reached === 1 ? "1 canvas" : `${reached.reached} canvases`}` +
              (reached.changed === reached.reached ? "" : ` and changed ${reached.changed}`) +
              ". Each canvas's own link can be turned back on from its Share." +
              (reached.swept.expelled > 0 || reached.swept.rerooted > 0 ? ` ${lost(reached.swept)}` : "")
            : everyLink === null && space.canvasIds.length > 0
              ? "The canvases' links differ. Choosing one sets it on every canvas here."
              : "Sets the link on every canvas in this space, in one gesture. A canvas's own link can still be set wider afterwards."}
        </span>
      </div>

      <p className="share-owner">Made by {ownsSpace(space, actor.id) ? "you" : ownerName}</p>

      {error && <div className="identity-warning">{error}</div>}

      {offer && canVerifyEmail(offer) ? (
        <>
          <form
            className="share-address"
            onSubmit={(e) => {
              e.preventDefault();
              if (!who.trim()) return;
              void act(who, async () => {
                const answer = await createSpaceGrant(space.id, grantSubjectOf(who), inviteRung, actor.id);
                setWho("");
                return answer;
              });
            }}
          >
            <input
              className="text-input"
              type="email"
              aria-label="Invite somebody by email to every canvas in this space"
              placeholder="someone@example.com"
              value={who}
              disabled={!owned}
              title={ownerTitle}
              onChange={(e) => setWho(e.target.value)}
            />
            <select
              className="text-input share-rung"
              aria-label="What they may do"
              value={inviteRung}
              disabled={!owned}
              title={ownerTitle}
              onChange={(e) => setInviteRung(e.target.value as Capability)}
            >
              {INVITE_RUNGS.map((rung) => (
                <option key={rung} value={rung}>
                  {capabilityWord.dialog[rung]}
                </option>
              ))}
            </select>
            <button className="btn primary" type="submit" disabled={busy || !who.trim() || !owned} title={ownerTitle}>
              Invite
            </button>
          </form>
          <div className="share-link-note">
            They get in to every canvas here by proving that address. A canvas's own rows can only
            add to what the space gives, never take away.
          </div>
        </>
      ) : (
        offer && (
          <div className="share-deferred">
            Inviting by email needs somewhere to verify it, and this home has nowhere yet.
          </div>
        )
      )}

      {swept && swept.what !== "link" && (
        <div className="share-link-note">
          {swept.what.replace(/^email:/, "")} — {lost(swept.report)}
        </div>
      )}

      {grants !== null && (
        <>
          <div className="identity-menu-head">Invited by name</div>
          <div className="share-roster">
            <div className="surface-row">
              <span className="surface-what">
                <b>{ownerName}</b>
                <span className="share-roster-kind">Owner, made this</span>
              </span>
            </div>
            {invited.map((grant) => (
              <div key={grant.id} className="surface-row share-invited">
                <span className="surface-what">
                  <b>{grant.subject.replace(/^email:/, "")}</b>
                  <span className="share-roster-kind">invited {grant.at.slice(0, 10)} · on every canvas here</span>
                </span>
                <span className="share-row-controls">
                  <select
                    className="text-input share-rung"
                    aria-label={`What ${grant.subject.replace(/^email:/, "")} may do`}
                    value={capabilityOf(grant)}
                    disabled={busy || !owned}
                    title={ownerTitle}
                    onChange={(e) =>
                      void act(grant.subject, () =>
                        createSpaceGrant(space.id, grant.subject, e.target.value as Capability, actor.id),
                      )
                    }
                  >
                    {INVITE_RUNGS.map((rung) => (
                      <option key={rung} value={rung}>
                        {capabilityWord.dialog[rung]}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn"
                    disabled={busy || !owned}
                    title={ownerTitle}
                    onClick={() => void act(grant.subject, () => revokeSpaceGrant(space.id, grant.id, actor.id))}
                  >
                    Remove
                  </button>
                </span>
              </div>
            ))}
          </div>
          {keptOut.length > 0 && (
            <>
              <div className="identity-menu-head">Kept out</div>
              <div className="share-roster">
                {keptOut.map((grant) => (
                  <div key={grant.id} className="surface-row share-invited">
                    <span className="surface-what">
                      <b>{grant.subject.replace(/^email:/, "")}</b>
                      <span className="share-roster-kind">
                        kept out {grant.at.slice(0, 10)} · by {grant.grantedBy} · refused on every canvas here
                      </span>
                    </span>
                    <span className="share-row-controls">
                      <button
                        className="btn"
                        disabled={busy || !owned}
                        title={ownerTitle}
                        onClick={() => void act(grant.subject, () => revokeSpaceGrant(space.id, grant.id, actor.id))}
                      >
                        Let back in
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* The canvases, each marked when its own rows go wider than the space
          — the eleven-minus-ten an owner is looking for (journey 5). */}
      <div className="identity-menu-head">In this space</div>
      <div className="share-roster">
        {space.canvasIds.length === 0 && <div className="share-link-note">Nothing yet — drag a canvas onto the heading.</div>}
        {space.canvasIds.map((canvasId) => {
          const title = canvases.find((c) => c.id === canvasId)?.title ?? canvasId;
          const mark = wider(canvasId);
          return (
            <div key={canvasId} className="surface-row share-invited">
              <span className="surface-what">
                <b>{title}</b>
                <span className={`share-roster-kind${mark ? " share-wider" : ""}`}>
                  {mark ? `wider than the space: ${mark}` : "as the space gives"}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface RosterRow {
  actor: Actor;
  state: RowState | "you";
  kind: string;
}

/**
 * Who is on this canvas — from core's `roster()`, the same fold the workbench,
 * the agent tray and `isocan who` read.
 *
 * **This used to be its own walk**, and the walk was wrong in the way a second
 * implementation always eventually is: it pushed every session as `live` with
 * `kind: "cli" ? "terminal" : "here"`, so a PARKED RC — a process fact that
 * renders nowhere else, no cursor, no face — appeared in this dialog as a
 * person who is here. The one roster you open to see who you are sharing with
 * was the one roster inventing an occupant.
 *
 * Core knows the difference and has for some time: `answerable` when a live rc
 * holds a connection claiming an enrolled agent, `enrolled` when the record
 * stands and nothing is listening.
 */
function rosterRows(
  self: Actor,
  sessions: ReturnType<typeof useCanvasStore.getState>["sessions"],
  canvas: ReturnType<typeof useCanvasStore.getState>["canvas"],
  answerable: ReadonlySet<string>,
): RosterRow[] {
  const rows: RosterRow[] = [{ actor: self, state: "you", kind: "you" }];
  for (const row of roster(sessions, canvas, Date.now(), answerable)) {
    if (rows.some((r) => r.actor.id === row.actorId)) continue;
    rows.push({
      actor: row.primary?.actor ?? { id: row.actorId, name: row.name },
      state: row.state,
      kind: KIND_WORD[row.state],
    });
  }
  /* People at browsers, whom core's roster leaves to the facepile. They are
     here because this dialog is about who can REACH the canvas, and a person
     reading it over your shoulder is exactly the fact a Share dialog owes
     you: a `read` connection says *reading*, from the same map the facepile
     and `isocan who` read (roles design, "Presence says the rung"). */
  for (const session of sessions) {
    if (session.kind !== "web") continue;
    if (rows.some((r) => r.actor.id === session.actor.id)) continue;
    rows.push({ actor: session.actor, state: "here", kind: rungWord(session) ?? KIND_WORD.here });
  }
  /* Core's roster caps its away half at six — a room, not a list. This dialog
     is about who can REACH the canvas, so it names everyone the canvas
     remembers; the cap belongs to the panel that has to fit on a screen. */
  for (const who of canvas ? collectCanvasActors(canvas) : []) {
    if (rows.some((row) => row.actor.id === who.id)) continue;
    rows.push({ actor: who, state: "away", kind: "away" });
  }
  return rows;
}

/** *reading* for a connection below `edit`; null for an editor, who is
 * simply here. */
function rungWord(session: PresenceSession): string | null {
  if (session.capability === undefined || atLeast(session.capability, "edit")) return null;
  return capabilityWord.presence[session.capability];
}

/** One word per state, in this dialog's voice. */
const KIND_WORD: Record<RowState, string> = {
  blocked: "waiting on an answer",
  working: "working",
  parked: "parked",
  quiet: "quiet",
  here: "here",
  answerable: "standing by",
  enrolled: "enrolled",
  away: "away",
};
