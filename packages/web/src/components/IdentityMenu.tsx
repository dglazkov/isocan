import { faceMark } from "@isocan/core";
import { useRef, useState } from "react";
import type { Actor } from "@isocan/core";
import { adoptIdentity, knownIdentities, renameIdentity, signOut } from "../lib/identity.ts";
import { IDENTITY_COLORS, actorColorIn, useActorColors } from "../lib/colors.ts";
import { setActorColor, setActorMark } from "../lib/identitycolor.ts";
import { type ThemePref, useTheme } from "../lib/theme.ts";
import { EmojiPicker } from "./EmojiPicker.tsx";
import { TerminalDialog } from "./TerminalDialog.tsx";
import { CloudAgentDialog } from "./CloudAgentDialog.tsx";
import { SurfacesDialog } from "./SurfacesDialog.tsx";
import { VerifyDialog } from "./VerifyDialog.tsx";
import { useActorMarks } from "../lib/marks.ts";

const THEME_OPTS: { value: ThemePref; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

/**
 * Who you are, and how to be someone else (#43). Three verbs, deliberately
 * distinct:
 *
 * - RENAME keeps your actor id. Everything you have done stays yours — your
 *   undo stack, the comments addressed to you — you are just called something
 *   else from now on. (`isocan identity --name --session` does exactly this.)
 * - SWITCH adopts an identity this browser has worn before, id and all, so
 *   coming back as yourself really is coming back.
 * - LEAVE clears the current identity and returns you to the door, where the
 *   roster is still waiting.
 * - COLOR picks the color you wear — cursor, face, pins, and your Pen's
 *   default ink. It is `actor.setColor`, stored in the daemon's actor
 *   registry beside your name, because a color only you can see would not be
 *   an identity: everyone on every canvas sees you change.
 * - PROVE YOUR ADDRESS is the borrowed attester (phase 9 stage 2). Not a
 *   login — isocan has no accounts — but the one gesture that makes an
 *   `email:` grant able to admit you, and the one that lets this browser
 *   RESUME a person your other machines already are. It sits here because
 *   what this browser has proved is another fact about how it is connected.
 * - YOUR SURFACES is kill-a-badge (phase 9): every holder that carries this
 *   identity, and the button that ends one. It sits here for the reason the
 *   escalation dialog does — this menu is *how I'm connected here*, and a
 *   surface of yours is another way you are connected. Unlike escalation it
 *   needs no canvas: a badge is not about one room, which is exactly why
 *   ending one ends it everywhere.
 * - WORK FROM YOUR TERMINAL is Scene 5, and it belongs here rather than
 *   beside Share for a reason the journey states: this menu is *how I'm
 *   connected here*, and escalation is another way to be connected — a second
 *   surface of the same person. Share is *who may be here*, which is about
 *   somebody else. It appears only on a canvas, because a pass names exactly
 *   one canvas and there is nothing to name on the canvas list.
 *
 * All of it is `actor.claim` under the hood (#58): the daemon applies one
 * continuity rule for every client, and a refusal — a name somebody on a
 * canvas already answers to — is shown here rather than second-guessed by a
 * client-side check.
 *
 * Past ops are never rewritten: every op carries the actor as it read at the
 * time. What people are SHOWN is a different question, and the answer is the
 * registry: a rename reaches the comments you already wrote, because the name
 * over somebody's words should be the name they answer to (lib/names.ts). The
 * log keeps what it recorded; nobody reads the log to find out who you are.
 */
export function IdentityMenu({
  actor,
  canvasId,
  onIdentity,
  onClose,
}: {
  actor: Actor;
  /** The canvas this menu was opened on, or null on the canvas list. A pass
   * names one canvas, so with none there is nothing to escalate onto. */
  canvasId: string | null;
  /** null = signed out; App swaps in the door. */
  onIdentity: (actor: Actor | null) => void;
  onClose: () => void;
}) {
  const colors = useActorColors();
  const marks = useActorMarks();
  const mine = marks[actor.id] ?? null;
  const [picking, setPicking] = useState(false);
  const markButton = useRef<HTMLButtonElement>(null);
  const [name, setName] = useState(actor.name);
  const [others] = useState(() => knownIdentities().filter((known) => known.id !== actor.id));
  const [error, setError] = useState<string | null>(null);
  const [terminal, setTerminal] = useState(false);
  const [cloud, setCloud] = useState(false);
  const [surfaces, setSurfaces] = useState(false);
  const [verify, setVerify] = useState(false);
  const themePref = useTheme((s) => s.pref);
  const setThemePref = useTheme((s) => s.setPref);
  const trimmed = name.trim();

  const attempt = (claim: Promise<Actor>) => {
    setError(null);
    claim
      .then((who) => {
        onIdentity(who);
        onClose();
      })
      .catch((err: Error) => setError(err.message));
  };

  // The dialog takes the popover over rather than opening a second one beside
  // it: it was reached from this menu, it is about the same subject, and two
  // stacked panels hanging off one face is a worse thing to look at than one.
  if (terminal && canvasId) {
    return <TerminalDialog actor={actor} canvasId={canvasId} onClose={onClose} />;
  }
  if (cloud && canvasId) {
    return <CloudAgentDialog actor={actor} canvasId={canvasId} onClose={onClose} />;
  }
  if (surfaces) return <SurfacesDialog onClose={onClose} />;
  if (verify) {
    return <VerifyDialog actor={actor} onIdentity={onIdentity} onClose={onClose} />;
  }

  return (
    <div
      className="identity-menu"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <form
        className="identity-rename"
        onSubmit={(e) => {
          e.preventDefault();
          if (!trimmed || trimmed === actor.name) return onClose();
          attempt(renameIdentity(trimmed));
        }}
      >
        {/**
         * **The face, to the left of the name it stands in for.**
         *
         * A disc with a letter in it is fine until a canvas has a Di, a Dion
         * and a Dimitri on it. Clicking it opens the picker the canvas
         * already has — one emoji picker, several doorways — and picking the
         * mark you already wear takes it back, which is the behaviour that
         * component's `worn` prop exists to show before you click.
         */}
        <button
          type="button"
          ref={markButton}
          className="identity-mark face-mark"
          style={{ background: actorColorIn(colors, actor.id) }}
          title={mine ? "Change or remove your emoji" : "Wear an emoji instead of your initial"}
          aria-label="Your emoji"
          onClick={() => setPicking((was) => !was)}
        >
          {faceMark(marks, actor, name)}
        </button>
        {picking && (
          <EmojiPicker
            anchor={markButton}
            worn={mine ? [mine] : []}
            onClose={() => setPicking(false)}
            onPick={(emoji) => {
              setPicking(false);
              /* Picking the one you wear takes it back — the same gesture
                 both ways, which is why the picker shows it pressed. */
              void setActorMark(actor, emoji === mine ? null : emoji);
            }}
          />
        )}
        <input
          className="text-input"
          autoFocus
          aria-label="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn primary" type="submit" disabled={!trimmed}>
          Rename
        </button>
      </form>
      {error && <div className="identity-warning">{error}</div>}
      {others.length > 0 && (
        <>
          <div className="identity-menu-head">Switch to</div>
          <div className="identity-known">
            {others.map((other) => (
              <button
                key={other.id}
                className="identity-known-row"
                title={`Continue as ${other.name} — the same you as before`}
                onClick={() => attempt(adoptIdentity(other))}
              >
                <span className="face-mark" style={{ background: actorColorIn(colors, other.id) }}>
                  {faceMark(marks, other)}
                </span>
                {other.name}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="identity-menu-head">Your color</div>
      <div className="identity-colors" role="group" aria-label="Your color">
        {IDENTITY_COLORS.map((option) => {
          const active = actorColorIn(colors, actor.id) === option.value;
          return (
            <button
              key={option.value}
              className={`ink-swatch${active ? " active" : ""}`}
              style={{ background: option.value }}
              title={option.name}
              aria-label={option.name}
              aria-pressed={active}
              onClick={() => {
                void setActorColor(actor, option.value).catch((err: Error) => setError(err.message));
              }}
            />
          );
        })}
      </div>
      <div className="identity-menu-head">Theme</div>
      <div className="theme-switch" role="group" aria-label="Theme">
        {THEME_OPTS.map((opt) => (
          <button
            key={opt.value}
            className={`theme-opt${themePref === opt.value ? " active" : ""}`}
            aria-pressed={themePref === opt.value}
            onClick={() => setThemePref(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {/* Escalation, one click from your own face — "the canvas teaches its
          own escalation", so nobody is ever sent to documentation to find out
          how to get their own agent working here. Named for what the person
          came for (their agent on this canvas) and not for the surface they
          pass through on the way (a terminal). */}
      {canvasId && (
        <button
          className="btn identity-terminal"
          title="Run your own agent on this canvas, from your own machine"
          onClick={() => setTerminal(true)}
        >
          Bring your own agent…
        </button>
      )}
      {/* Scene 6's sibling door, and it sits directly under Scene 5's because
          the journey groups them by what they are: both are *extend my reach*,
          minted from an admitted session. The order is the order a person
          meets them — your own machine is the obvious answer, and the cloud is
          what you reach for once you have watched a lid take your agent with
          it. */}
      {canvasId && (
        <button
          className="btn identity-terminal"
          title="Run an agent somewhere that doesn't close when your laptop does"
          onClick={() => setCloud(true)}
        >
          Run an agent in the cloud…
        </button>
      )}
      {/* Proving an address — phase 9 stage 2, and it belongs on this menu for
          the reason the whole menu exists: what this browser has proved is a
          fact about how it is connected here. Above "Your surfaces…" because
          it is the thing that CREATES a second surface of one person, and
          reading a list of your surfaces makes more sense after you have one.

          Shown unconditionally rather than only on a home that has borrowed an
          attester: the panel behind it says, in one sentence, that this home
          has borrowed nothing and that the link is how sharing works. Hiding
          the entry would make a person hunt for a control that is deliberately
          absent, which is a worse answer than being told. */}
      <button
        className="btn identity-terminal"
        title="Prove an email address — so somebody can invite you by name, and so this browser can be a person your other machines already are"
        onClick={() => setVerify(true)}
      >
        Prove your address…
      </button>
      {/* Kill-a-badge, one click from your own face. It is above Leave on
          purpose: both end something, and the one that ends a holder's
          recognition everywhere should not sit under the one that only
          forgets a persona in this browser. */}
      <button
        className="btn identity-terminal"
        title="Every surface that carries your identity — and end one that should not"
        onClick={() => setSurfaces(true)}
      >
        Your surfaces…
      </button>
      <button
        className="btn identity-leave"
        onClick={() => {
          signOut();
          onIdentity(null);
          onClose(); // don't leave the menu hanging open behind the door
        }}
      >
        Leave — enter as someone else
      </button>
    </div>
  );
}
