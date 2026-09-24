import { useEffect, useMemo, useRef, useState } from "react";
import type { Actor } from "@isocan/core";
import { faceMark, policyWords } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useActorColors } from "../lib/colors.ts";
import { faceMarkClass, faceMarkStyle } from "../lib/face.ts";
import { actorNameIn, useActorNames } from "../lib/names.ts";
import { useActorMarks } from "../lib/marks.ts";
import { useActorKinds } from "../lib/actorkinds.ts";
import { useAnsweredAt, useAnswerable, useRcPolicies } from "../lib/answerable.ts";
import { agentsPresent, arrivalsFor, NO_ARRIVALS } from "../lib/arrivals.ts";

/** Long enough to read a name and a gate; short enough to be gone before it
 * is in the way. */
const LIFETIME_MS = 5_000;
/** A third arrival pushes the oldest out: a stack is for "a couple just
 * came", not a feed. */
const MOST = 3;

interface Note {
  key: string;
  at: number;
  agent: Actor;
  kind: "joined" | "back";
}

/**
 * **"Scout joined · listens only to you (Dion)", under the presence pile.**
 *
 * The rule is `arrivalsFor` (`lib/arrivals.ts`) — quiet on opening a canvas,
 * "joined" for a first sighting, "is back" after the rc's own away window,
 * nothing for a flap — over `agentsPresent`, the same facts the pile draws.
 * Nothing is written anywhere: this is the pile noticing it grew. Loaded
 * lazily beside the pile, so a first visit downloads none of it — the default
 * export, because the entry pays for every byte of the `lazy()` that names it.
 */
export default function ArrivalToasts({ actor }: { actor: Actor }) {
  const canvasId = useCanvasStore((s) => s.canvasId);
  const canvas = useCanvasStore((s) => s.canvas);
  const sessions = useCanvasStore((s) => s.sessions);
  const joined = useCanvasStore((s) => s.actorJoins);
  const answerable = useAnswerable(canvasId);
  const answeredAt = useAnsweredAt(canvasId);
  const policies = useRcPolicies(canvasId);
  const kinds = useActorKinds();
  const names = useActorNames();
  const marks = useActorMarks();
  const colors = useActorColors();
  const memory = useRef(NO_ARRIVALS);
  const [notes, setNotes] = useState<Note[]>([]);

  const present = useMemo(
    () => agentsPresent(answerable, sessions, canvas?.agents, kinds, actor.id, joined),
    [answerable, sessions, canvas?.agents, kinds, actor.id, joined],
  );
  // One key for the set, so a new array with the same people is not a read.
  const presentKey = [...present].sort().join(" ");
  const ready = canvas !== null && answeredAt > 0;

  useEffect(() => {
    if (!canvasId) return;
    const read = arrivalsFor(memory.current, canvasId, present, ready, Date.now());
    memory.current = read.memory;
    if (read.arrived.length === 0) return;
    const who = (id: string): Actor =>
      canvas?.agents?.[id]?.actor ??
      sessions.find((s) => s.actor.id === id)?.actor ?? { id, name: id };
    setNotes((shown) =>
      [...shown, ...read.arrived.map((a) => ({ key: `${a.id}:${Date.now()}`, at: Date.now(), agent: who(a.id), kind: a.kind }))].slice(-MOST),
    );
    // `present` is read through its key; the rest are read at the moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId, presentKey, ready]);

  // Each note lives its own five seconds: one timer, for whichever is due first.
  useEffect(() => {
    if (notes.length === 0) return;
    const due = Math.min(...notes.map((n) => n.at)) + LIFETIME_MS - Date.now();
    const timer = setTimeout(() => setNotes((shown) => shown.filter((n) => Date.now() - n.at < LIFETIME_MS)), Math.max(due, 0));
    return () => clearTimeout(timer);
  }, [notes]);

  if (notes.length === 0) return null;
  const nameOf = (id: string) => actorNameIn(names, { id, name: id });
  return (
    <div className="joined-toasts" role="status" aria-live="polite">
      {notes.map((note) => {
        const policy = policies[note.agent.id];
        const gate = policy ? policyWords(policy, nameOf, actor.id, joined) ?? "listens to everyone" : null;
        const name = actorNameIn(names, note.agent);
        const owner = policy?.owner ?? canvas?.agents?.[note.agent.id]?.writtenBy ?? null;
        return (
          <div className="joined-toast" key={note.key}>
            <span className={faceMarkClass(marks, note.agent, undefined, true)} style={faceMarkStyle(colors, note.agent, owner)}>
              {faceMark(marks, note.agent, name)}
            </span>
            <span className="joined-text">
              <b>{name}</b> {note.kind === "joined" ? "joined" : "is back"}
              {gate && <span className="joined-gate"> · {gate}</span>}
            </span>
            <button
              className="joined-close"
              aria-label={`Dismiss ${name} ${note.kind === "joined" ? "joined" : "is back"}`}
              onClick={() => setNotes((shown) => shown.filter((n) => n.key !== note.key))}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
