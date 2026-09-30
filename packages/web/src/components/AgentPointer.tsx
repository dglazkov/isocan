import "./agent-pointer.css";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Actor } from "@isocan/core";
import { listBadges } from "../lib/api.ts";
import { readIdentity } from "../lib/identity.ts";
import { setActorMark } from "../lib/identitycolor.ts";
import { useActorMarks } from "../lib/marks.ts";
import { flashNotice } from "../stores/canvasStore.ts";
import { EmojiPicker } from "./EmojiPicker.tsx";

/**
 * **"Set pointer…" — an agent of yours wears the emoji you choose, as its
 * face and as the pointer it moves across the canvas** (agent pointers,
 * 30 Sep 2026).
 *
 * Lazy, and the whole of it: the facepile's card and the agent row mount it
 * for an agent, and nothing here reaches the entry chunk — not the ownership
 * read, not the picker, not the op.
 *
 * It sends `actor.setMark` with the agent's id, one op, the same one
 * `isocan agent mark` sends. The home decides whether you may (`ownsAgent` in
 * core); the button is drawn only where it would say yes, so a person is not
 * offered a control that will be refused.
 */

/**
 * The actors a badge holds together with `me` — the browser's reading of the
 * home's rule. An agent lives on the machine that enrolled it, not in the
 * browser looking at it, so "mine" is a badge that holds the agent AND you:
 * your own other surface. `GET /api/badges` is the list the "Your surfaces"
 * dialog reads, and it names every badge that holds one of your actors.
 */
export function heldWith(badges: readonly { actors: readonly { id: string }[] }[], me: string): Set<string> {
  const held = new Set<string>();
  for (const badge of badges) {
    if (!badge.actors.some((actor) => actor.id === me)) continue;
    for (const actor of badge.actors) held.add(actor.id);
  }
  return held;
}

/** One read per tab, for `ownactors.ts`'s reason: a card mounts on every hover. */
let asked: Promise<Set<string>> | null = null;
let askedFor = "";
function heldActors(me: string): Promise<Set<string>> {
  if (askedFor !== me) asked = null;
  askedFor = me;
  asked ??= listBadges().then((res) => heldWith(res.badges, me));
  asked.catch(() => (asked = null));
  return asked;
}

export default function AgentPointer({ agent }: { agent: { id: string; name: string } }) {
  const me = readIdentity();
  const [owns, setOwns] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const meId = me?.id;
  useEffect(() => {
    let live = true;
    if (meId && meId !== agent.id) {
      void heldActors(meId).then((held) => live && setOwns(held.has(agent.id)), () => {});
    }
    return () => {
      live = false;
    };
  }, [meId, agent.id]);
  if (!me || !owns) return null;
  return (
    <button
      ref={button}
      type="button"
      className="agent-pointer"
      title={`Choose the emoji ${agent.name} wears — on its face, and as its pointer`}
      onClick={(event) => {
        event.stopPropagation();
        if (button.current) openPointerPicker(me, agent, button.current);
      }}
    >
      Set pointer…
    </button>
  );
}

/**
 * **In a root of its own**, because the card that opened it is a hover card:
 * it goes the moment the pointer leaves the facepile for the picker, and a
 * picker mounted inside it would go too. The anchor is the button's rectangle
 * AT THE CLICK, for the same reason — measuring a button that has since left
 * the page would put the panel in the corner.
 */
export function openPointerPicker(me: Actor, agent: { id: string; name: string }, from: HTMLElement): void {
  const rect = from.getBoundingClientRect();
  const anchor = { current: { getBoundingClientRect: () => rect } as HTMLElement };
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const close = () => {
    root.unmount();
    host.remove();
  };
  root.render(<Picker me={me} agent={agent} anchor={anchor} onClose={close} />);
}

function Picker({
  me,
  agent,
  anchor,
  onClose,
}: {
  me: Actor;
  agent: { id: string; name: string };
  anchor: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  const worn = useActorMarks()[agent.id] ?? null;
  return (
    <EmojiPicker
      anchor={anchor}
      worn={worn ? [worn] : []}
      onClose={onClose}
      onPick={(emoji) => {
        onClose();
        // Picking the one it wears takes it back to the arrow — the same
        // gesture both ways, as on your own face.
        setActorMark(me, emoji === worn ? null : emoji, agent).catch((err: Error) =>
          flashNotice(`${agent.name}'s pointer did not change — ${err.message}`, 5000),
        );
      }}
    />
  );
}
