import { useState } from "react";
import type { Actor } from "@isocan/core";
import { adoptIdentity, knownIdentities, renameIdentity, signOut } from "../lib/identity.ts";
import { actorColor } from "../lib/colors.ts";
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
 *   else from now on. (`isocan identity --name` does exactly this.)
 * - SWITCH adopts an identity this browser has worn before, id and all, so
 *   coming back as yourself really is coming back.
 * - LEAVE clears the current identity and returns you to the door, where the
 *   roster is still waiting.
 *
 * Past ops are never rewritten: every op carries the actor as it read at the
 * time, so a rename changes who you ARE, not who you WERE.
 */
export function IdentityMenu({
  actor,
  takenNames = [],
  onIdentity,
  onClose,
}: {
  actor: Actor;
  /** Names other people on this canvas answer to, for the collision warning. */
  takenNames?: string[];
  /** null = signed out; App swaps in the door. */
  onIdentity: (actor: Actor | null) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(actor.name);
  const [others] = useState(() => knownIdentities().filter((known) => known.id !== actor.id));
  const themePref = useTheme((s) => s.pref);
  const setThemePref = useTheme((s) => s.setPref);
  const trimmed = name.trim();
  const collides = takenNames.some(
    (taken) => taken.trim().toLowerCase() === trimmed.toLowerCase(),
  );

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
          onIdentity(renameIdentity(trimmed));
          onClose();
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
      {collides && (
        <div className="identity-warning">
          Someone here already answers to “{trimmed}” — @-mentions won't tell you apart.
        </div>
      )}
      {others.length > 0 && (
        <>
          <div className="identity-menu-head">Switch to</div>
          <div className="identity-known">
            {others.map((other) => (
              <button
                key={other.id}
                className="identity-known-row"
                title={`Continue as ${other.name} — the same you as before`}
                onClick={() => {
                  onIdentity(adoptIdentity(other));
                  onClose();
                }}
              >
                <span className="face-mark" style={{ background: actorColor(other.id) }}>
                  {other.name.charAt(0).toUpperCase()}
                </span>
                {other.name}
              </button>
            ))}
          </div>
        </>
      )}
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
