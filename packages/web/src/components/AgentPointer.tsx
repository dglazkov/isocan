import "./agent-pointer.css";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { pointerMark, resolveActor, type Actor, type ActorJoins } from "@isocan/core";
import { listBadges } from "../lib/api.ts";
import { readIdentity } from "../lib/identity.ts";
import { setActorMark } from "../lib/identitycolor.ts";
import { useActorMarks } from "../lib/marks.ts";
import { flashNotice, useCanvasStore } from "../stores/canvasStore.ts";
import { EmojiPicker } from "./EmojiPicker.tsx";

/**
 * **The pointer an agent wears — shown to everybody, chosen by its owner**
 * (agent pointers, 30 Sep 2026).
 *
 * Lazy, and the whole of it: the facepile's card and the agent row mount it
 * for an agent, and nothing here reaches the entry chunk — not the ownership
 * read, not the picker, not the op.
 *
 * The pill says what the pointer IS — 🤖 until somebody chooses, the mark once
 * they have — because a control that changes a thing and never shows it is a
 * control that appears to do nothing (Dion, the same day: *"after set pointer
 * nothing happens"* … *"should show which pointer is chosen"*). For the owner
 * it opens the picker and sends `actor.setMark` with the agent's id, the op
 * `isocan agent mark` sends. For anybody else it says whose choice it is,
 * rather than being a button that silently does nothing.
 */

/**
 * The actors a badge holds together with `me` — the browser's reading of the
 * home's rule (`ownsAgent` in core). An agent lives on the machine that
 * enrolled it, not in the browser looking at it, so "mine" is a badge that
 * holds the agent AND you: your own other surface. `GET /api/badges` is the
 * list the "Your surfaces" dialog reads, and it names every badge that holds
 * one of your actors.
 *
 * **Through joins** — the case that made the first version draw nothing. The
 * machine that enrolled the agent may hold you under an identity you have
 * since folded into this one (`actor.join`): the badge says the old id, you
 * are the new one, and they are one person. Every id is resolved before it is
 * compared, the way the home resolves them.
 */
export function heldWith(
  badges: readonly { actors: readonly { id: string }[] }[],
  me: string,
  joined?: ActorJoins,
): Set<string> {
  const self = resolveActor(joined, me);
  const held = new Set<string>();
  for (const badge of badges) {
    if (!badge.actors.some((actor) => resolveActor(joined, actor.id) === self)) continue;
    for (const actor of badge.actors) held.add(actor.id);
  }
  return held;
}

/** One read per tab, for `ownactors.ts`'s reason: a card mounts on every hover. */
let asked: Promise<readonly { actors: readonly { id: string }[] }[]> | null = null;
function surfaces(): Promise<readonly { actors: readonly { id: string }[] }[]> {
  asked ??= listBadges().then((res) => res.badges);
  asked.catch(() => (asked = null));
  return asked;
}

export default function AgentPointer({
  agent,
  owner,
}: {
  agent: { id: string; name: string };
  /** Whose agent it is, by name — what a reader who is not the owner is told. */
  owner?: string | undefined;
}) {
  const me = readIdentity();
  const joined = useCanvasStore((s) => s.actorJoins);
  const marks = useActorMarks();
  /** null until the home has said; a pill with no answer yet is not drawn. */
  const [owns, setOwns] = useState<boolean | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const meId = me?.id;
  useEffect(() => {
    let live = true;
    if (meId) {
      void surfaces().then(
        (badges) => live && setOwns(heldWith(badges, meId, joined).has(agent.id)),
        () => live && setOwns(false),
      );
    }
    return () => {
      live = false;
    };
  }, [meId, agent.id, joined]);
  if (!me || owns === null) return null;
  const glyph = pointerMark(marks, agent, true);
  return (
    <>
      <button
        ref={button}
        type="button"
        className={`agent-pointer${owns ? "" : " not-yours"}`}
        aria-label={`${agent.name}'s pointer: ${glyph}${owns ? " — change it" : ""}`}
        title={
          owns
            ? `Choose the emoji ${agent.name} wears — on its face, and as its pointer`
            : `${agent.name}'s pointer is set by its owner${owner ? `, ${owner}` : ""}`
        }
        onClick={(event) => {
          event.stopPropagation();
          if (!owns) {
            setSaid(`${agent.name}'s pointer is set by its owner${owner ? `, ${owner}` : ""}.`);
            return;
          }
          setSaid(null);
          if (button.current) openPointerPicker(me, agent, button.current, setSaid);
        }}
      >
        <span className="agent-pointer-glyph" aria-hidden>
          {glyph}
        </span>
        Pointer
      </button>
      {said && (
        <em className="agent-pointer-said" role="status">
          {said}
        </em>
      )}
    </>
  );
}

/**
 * **In a root of its own**, because the card that opened it is a hover card:
 * it goes the moment the pointer leaves the facepile for the picker, and a
 * picker mounted inside it would go too. The anchor is the button's rectangle
 * AT THE CLICK, for the same reason — measuring a button that has since left
 * the page would put the panel in the corner.
 *
 * **Over the covers, too.** The tray also lives on a module's page and in the
 * workbench, which are route-driven covers above every popover layer; a
 * picker at the popover layer opened BEHIND them, and the click looked like
 * nothing. `over-covers` lifts this one picker to the modal layer.
 *
 * `say` hands a refusal back to the pill that opened it, where the person is
 * looking; the notice bar is a canvas-page thing and a cover hides it.
 */
export function openPointerPicker(
  me: Actor,
  agent: { id: string; name: string },
  from: HTMLElement,
  say?: (words: string) => void,
): void {
  const rect = from.getBoundingClientRect();
  const anchor = { current: { getBoundingClientRect: () => rect } as HTMLElement };
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const close = () =>
    queueMicrotask(() => {
      root.unmount();
      host.remove();
    });
  root.render(<Picker me={me} agent={agent} anchor={anchor} onClose={close} say={say} />);
}

function Picker({
  me,
  agent,
  anchor,
  onClose,
  say,
}: {
  me: Actor;
  agent: { id: string; name: string };
  anchor: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  say?: ((words: string) => void) | undefined;
}) {
  const worn = useActorMarks()[agent.id] ?? null;
  return (
    <EmojiPicker
      anchor={anchor}
      className="over-covers"
      worn={worn ? [worn] : []}
      onClose={onClose}
      onPick={(emoji) => {
        onClose();
        // Picking the one it wears takes it back to the robot — the same
        // gesture both ways, as on your own face.
        setActorMark(me, emoji === worn ? null : emoji, agent).catch((err: Error) => {
          const words = `${agent.name}'s pointer did not change — ${err.message}`;
          say?.(words);
          flashNotice(words, 5000);
        });
      }}
    />
  );
}
