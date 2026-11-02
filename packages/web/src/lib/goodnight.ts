import type { Actor, Item, NightNote, NightSeen } from "@isocan/core";
import {
  TEXT_FILENAME,
  TEXT_MIME,
  goodnightNotes,
  handoffProperties,
  handoffSpot,
  leftOpen,
  newGroupId,
  newItemId,
  newVersionId,
  nightAnswerable,
  nightLead,
  noteText,
  planNight,
  readNote,
  readyAt,
  settledToday,
  handoffBox,
  textLookProperties,
  untickLine,
} from "@isocan/core";
import { fetchRcAnswering, getOplog } from "./api.ts";
import { postToMain } from "./mainthread.ts";
import { uploadOrStageTextBlob } from "./upload.ts";
import { sendEchoed, useCanvasStore } from "../stores/canvasStore.ts";

/**
 * **The night watch, from the web** (proactive-agent phase 2, design §4) —
 * the person's half: `/goodnight` typed in the Chat, **That's the plan**, and
 * unticking a line on the note. The lead agent's half is the CLI's (`isocan
 * goodnight note|fill|done`), as every agent's hands are; the rules are core's
 * (`goodnight.ts`), so the two surfaces read one answer.
 *
 * Loaded on the Enter that sends a `/goodnight`, the press of the plan button
 * or an untick — never on first paint.
 */

/** Who is listening, as this tab can see it: the rcs answering here, and the parked sessions in presence. */
async function seeing(canvasId: string): Promise<NightSeen> {
  const { sessions, actorJoins } = useCanvasStore.getState();
  const answering = await fetchRcAnswering(canvasId).catch(() => null);
  return { answering, sessions, ...(actorJoins ? { joined: actorJoins } : {}) };
}

/** The canvas's lead for tonight, and why nothing can answer — or null when something can. */
export async function goodnightLead(canvasId: string, personId: string): Promise<{ lead: Actor | null; cannot: string | null }> {
  const { canvas, record } = useCanvasStore.getState();
  if (!canvas) return { lead: null, cannot: "the canvas is not loaded" };
  const seen = await seeing(canvasId);
  const lead = nightLead(canvas, record?.properties ?? {}, seen);
  return { lead: lead.agent?.actor ?? null, cannot: nightAnswerable(lead, personId, seen) };
}

/**
 * **`/goodnight` typed in the Chat.** It posts as any command does — to the
 * lead by name, so the conversation is with one agent — and when nothing can
 * answer it also writes the note here, from what the canvas says: settled
 * today, left open, and why nothing is promised. Resolves to what the person
 * should be told, or null.
 */
export async function startGoodnight(canvasId: string, actor: Actor, body: string, attached: string[]): Promise<string | null> {
  const { lead, cannot } = await goodnightLead(canvasId, actor.id);
  const words = body.replace(/^\s*\/goodnight\b/, "").trim();
  const mention = lead && !new RegExp(`@${lead.name}\\b`, "i").test(words) ? ` @${lead.name}` : "";
  const sent = await postToMain(canvasId, actor, `/goodnight${mention}${words ? ` ${words}` : ""}`, attached);
  if (sent.status === "refused") return sent.message ?? "the Chat refused the message";
  if (!cannot) return null;
  await writeQuietNote(canvasId, actor, lead, cannot);
  return `Nothing can answer overnight: ${cannot}. The note says so, and promises nothing.`;
}

async function writeQuietNote(canvasId: string, actor: Actor, lead: Actor | null, cannot: string): Promise<void> {
  const canvas = useCanvasStore.getState().canvas!;
  const now = Date.now();
  const since = new Date(now);
  since.setHours(0, 0, 0, 0);
  const entries = await getOplog(canvasId, 0).catch(() => []);
  const planned = planNight({ canvas, person: actor, lead: lead ?? actor, cannotAnswer: cannot, asks: [], named: [], settled: [], others: new Map() });
  const note: NightNote = {
    person: actor,
    lead,
    settled: settledToday(canvas, entries, actor.id, since.getTime(), useCanvasStore.getState().actorJoins ?? undefined),
    open: leftOpen(canvas),
    lines: [],
    wont: [],
    ready: readyAt("8:00", now)!,
    ...("nothing" in planned && planned.nothing ? { nothing: planned.nothing } : {}),
    named: [],
    titles: {},
  };
  const text = noteText(note);
  const box = handoffBox(text);
  const { upload, stagedBlob } = await uploadOrStageTextBlob(canvasId, text, TEXT_MIME, TEXT_FILENAME);
  await sendEchoed(
    canvasId,
    actor,
    {
      type: "item.add",
      itemId: newItemId(),
      version: { id: newVersionId(), blobHash: upload.blobHash, mimeType: TEXT_MIME, filename: TEXT_FILENAME, size: upload.size },
      ...box,
      placement: { ...handoffSpot(canvas, [], box), chosen: true },
      title: `Goodnight, ${actor.name}`,
      properties: { ...textLookProperties({ style: "body", face: "sans", paper: null, colour: null, font: null }), ...handoffProperties(note) },
    },
    undefined,
    undefined,
    stagedBlob,
  );
}

/** **That's the plan**: the conversation ends, and the lead writes the note from what was agreed. */
export async function planGoodnight(canvasId: string, actor: Actor, lead: Actor | null): Promise<string | null> {
  const sent = await postToMain(canvasId, actor, `That's the plan.${lead ? ` @${lead.name}` : ""}`, [], undefined, { goodnight: { step: "plan" } });
  return sent.status === "refused" ? (sent.message ?? "the Chat refused the message") : null;
}

/**
 * **Untick a line**: it stays on the note as an offer, and its empty frame
 * goes — the note's words and model and the frame's delete in one undo.
 */
export async function untickGoodnight(canvasId: string, actor: Actor, noteItem: Item, n: number): Promise<string | null> {
  const note = readNote(noteItem);
  if (!note) return "this is not a goodnight note";
  const out = untickLine(note, n);
  if ("refused" in out) return out.refused;
  const group = newGroupId();
  const text = noteText(out.note);
  const { upload, stagedBlob } = await uploadOrStageTextBlob(canvasId, text, TEXT_MIME, TEXT_FILENAME);
  await sendEchoed(canvasId, actor, { type: "item.addVersion", itemId: noteItem.id, version: { id: newVersionId(), blobHash: upload.blobHash, mimeType: TEXT_MIME, filename: TEXT_FILENAME, size: upload.size } }, group, undefined, stagedBlob);
  await sendEchoed(canvasId, actor, { type: "item.update", itemId: noteItem.id, patch: { properties: handoffProperties(out.note) } }, group);
  if (out.frame && useCanvasStore.getState().canvas?.items[out.frame]) await sendEchoed(canvasId, actor, { type: "item.delete", itemId: out.frame }, group);
  return null;
}

/**
 * **⌫ on a promised frame**: the line it answers, unticked — when the frame is
 * a promise of the viewer's own goodnight. Anybody else's promise is deleted
 * as an ordinary item would be; nothing here may untick another's night.
 */
export async function untickFrame(canvasId: string, actor: Actor, frameId: string): Promise<void> {
  const canvas = useCanvasStore.getState().canvas;
  const found = canvas && goodnightNotes(canvas).find(({ note }) => note.lines.some((l) => l.frame === frameId));
  const line = found?.note.lines.find((l) => l.frame === frameId);
  if (found && line && found.note.person.id === actor.id) {
    await untickGoodnight(canvasId, actor, found.item, line.n);
    return;
  }
  await sendEchoed(canvasId, actor, { type: "item.delete", itemId: frameId });
}
