import { useState } from "react";
import type { Actor } from "@isocan/core";
import { adoptIdentity, knownIdentities, renameIdentity, signOut } from "../lib/identity.ts";
import { IDENTITY_COLORS, actorColorIn, useActorColors } from "../lib/colors.ts";
import { setActorColor } from "../lib/identitycolor.ts";
import { type ThemePref, useTheme } from "../lib/theme.ts";

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
  onIdentity,
  onClose,
}: {
  actor: Actor;
  /** null = signed out; App swaps in the door. */
  onIdentity: (actor: Actor | null) => void;
  onClose: () => void;
}) {
  const colors = useActorColors();
  const [name, setName] = useState(actor.name);
  const [others] = useState(() => knownIdentities().filter((known) => known.id !== actor.id));
  const [error, setError] = useState<string | null>(null);
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
                  {other.name.charAt(0).toUpperCase()}
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
