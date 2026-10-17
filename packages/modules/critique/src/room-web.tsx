import { useEffect, useRef, useState } from "react";
import {
  mainThread,
  newCommentId,
  newItemId,
  newThreadId,
  newVersionId,
  type CanvasContents,
  type DialogFacts,
  type NewComment,
  type Operation,
  type OverlayFacts,
  type WebHost,
} from "@isocan/core";
import {
  CRITIC_CARD,
  CRITIC_PROP,
  criticItems,
  criticMarkdown,
  gist,
  moveOf,
  readCritic,
  readNote,
  refuseJoin,
  type CanvasCritic,
  type CriticDraft,
  type CritiqueNote,
} from "./core.ts";
import {
  CRITIC_COLOR,
  CRITIC_ON,
  LOUDNESS,
  STARTER_LENSES,
  WHENS,
  bothAsked,
  describedDraft,
  pauseDue,
  postedRoomRead,
  roomAskBody,
  roomAsks,
  roomBothBody,
  roomRead,
  roomSettings,
  settingsPatch,
  starterDraft,
  type Loudness,
  type When,
} from "./room.ts";

/**
 * **Critics in the room, in the browser** (proactive-agent phase 8, design
 * §9) — the person's half, as the critique module's slots:
 *
 * - **Critics in the room** (a dialog, from the palette and a screen's menu):
 *   the critics on this canvas, each a one-line lens with a switch, *how
 *   loud* and *when*; the starter lenses; a way to describe a new one; and
 *   *Ask the room* about a screen. `isocan critic ls|add|new|set` and
 *   `critique <item>`, one write each.
 * - **The read of the room** (an overlay): once the lenses have spoken about
 *   a screen, the lead's words and the fold — agree, split (each with *Build
 *   both*) and blocker — read live from the notes by the `roomRead` the
 *   terminal prints, so a split is two sides and never an average. It also
 *   listens for a pause: with a critic set to *when I pause*, a minute of
 *   quiet after this person's last edit to a screen asks the room once.
 * - **Build both…** under a posted read in the Chat (a dialog).
 *
 * Every write is the op the terminal sends, built by the same functions.
 * Critics never edit, and nothing here touches a screen: the room's acts are
 * comments in the Chat, and a card's settings.
 */

const said = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Every critic card on the canvas, from its current bytes — `cardsOn`'s twin. */
async function cardsOn(canvas: CanvasContents, readText: (hash: string) => Promise<string>): Promise<CanvasCritic[]> {
  const out: CanvasCritic[] = [];
  for (const item of criticItems(canvas.items)) {
    const v = item.versions.find((x) => x.id === item.currentVersionId) ?? item.versions[0];
    if (!v) continue;
    const critic = readCritic(await readText(v.blobHash), v.filename);
    if (critic) out.push({ itemId: item.id, critic });
  }
  return out;
}

/** Say something in the Chat; the thread is born if this is the first word. */
async function inChat(host: WebHost, canvas: CanvasContents, comment: NewComment): Promise<void> {
  const main = mainThread(canvas);
  await host.send([
    main
      ? ({ type: "thread.reply", threadId: main.id, comment } as Operation)
      : ({ type: "thread.create", threadId: newThreadId(), x: 0, y: 0, anchorItemId: null, main: true, comment } as Operation),
  ]);
}

/** The canvas's lead, or why nothing can wear the critics — the host's reading of it. */
async function leadOf(host: WebHost): Promise<{ lead: { id: string; name: string } | null; cannot: string | null }> {
  if (!host.lead) return { lead: null, cannot: "this app cannot say who leads here" };
  return host.lead();
}

/**
 * **Ask the room** about one screen — `isocan critique <item>`'s message: the
 * lead, named, asked in the Chat to wear the critics switched on (or these).
 * Resolves to why nothing was asked, or null.
 */
async function askRoom(host: WebHost, canvas: CanvasContents, itemId: string, why: "asked" | "pause", only?: readonly string[]): Promise<string | null> {
  const item = canvas.items[itemId];
  if (!item) return "that screen is not on the canvas any more";
  const cards = criticItems(canvas.items).filter((c) => roomSettings(c).on && (!only || only.includes(String(c.properties[CRITIC_PROP]))));
  if (!cards.length) return "no critic is switched on — switch one on here";
  const { lead, cannot } = await leadOf(host);
  if (!lead || cannot) return `nothing can wear the critics here: ${cannot ?? "no lead"}`;
  const lenses = cards.map((c) => ({ name: String(c.properties[CRITIC_PROP]), agentName: c.title, loud: roomSettings(c).loud }));
  await inChat(host, canvas, { id: newCommentId(), body: roomAskBody(lead, [{ id: item.id, title: item.title, versionId: item.currentVersionId }], lenses, why), mentions: [lead.id], items: [item.id] });
  return null;
}

/** **Build both**, asked of the lead — two proposals beneath the screen, one per side. Resolves to why not, or null. */
async function askBoth(host: WebHost, canvas: CanvasContents, a: CritiqueNote, b: CritiqueNote): Promise<string | null> {
  const item = canvas.items[a.item];
  if (!item) return "that screen is not on the canvas any more";
  if (bothAsked(canvas, `${a.threadId}+${b.threadId}`)) return "build both was already asked for this split";
  const { lead, cannot } = await leadOf(host);
  if (!lead || cannot) return `nothing can build them here: ${cannot ?? "no lead"}`;
  await inChat(host, canvas, { id: newCommentId(), body: roomBothBody(lead, item, a, b), mentions: [lead.id], items: [item.id] });
  return null;
}

/** A lens onto the canvas, switched on in its colour — `critic add` and `critic new --lens`'s write. */
async function placeLens(host: WebHost, canvas: CanvasContents, draft: CriticDraft, on: readonly CanvasCritic[]): Promise<void> {
  const refused = refuseJoin(on, draft);
  if (refused) throw new Error(refused);
  const filename = `${draft.name}.md`;
  const put = await host.putBlob(new Blob([criticMarkdown(draft)], { type: "text/markdown" }), filename);
  const leftmost = Object.values(canvas.items).reduce<{ id: string; x: number } | null>((best, item) => (best === null || item.x < best.x ? item : best), null);
  await host.send([{
    type: "item.add",
    itemId: newItemId(),
    version: { id: newVersionId(), blobHash: put.blobHash, mimeType: "text/markdown", filename, size: put.size },
    width: CRITIC_CARD.width,
    height: CRITIC_CARD.height,
    placement: leftmost ? { anchorItemId: leftmost.id } : { x: 0, y: 0 },
    title: draft.agentName,
    properties: { [CRITIC_PROP]: draft.name, [CRITIC_ON]: "on", ...(draft.color ? { [CRITIC_COLOR]: draft.color } : {}) },
  } as Operation]);
}

/* ---- the read of the room ------------------------------------------------ */

const TICK_MS = 10_000;

/** The read of the room, and the ear for a pause. Draws nothing until the lenses have spoken. */
export function RoomOverlay({ canvas, host }: OverlayFacts) {
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const asked = useRef(new Set<string>());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, []);

  // When I pause: once per screen version, from this person's own client.
  const due = pauseDue(canvas, host.viewer.id, now, criticItems(canvas.items).map((i) => ({ itemId: i.id, name: String(i.properties[CRITIC_PROP]) })));
  const dueKey = due ? `${due.itemId}@${due.versionId}` : null;
  useEffect(() => {
    if (!due || !dueKey || asked.current.has(dueKey)) return;
    asked.current.add(dueKey);
    void askRoom(host, canvas, due.itemId, "pause", due.critics).catch(() => undefined);
    // `due` is what `dueKey` names.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dueKey]);

  const ask = roomAsks(canvas).at(-1);
  if (!ask || dismissed === ask.commentId) return null;
  const reads = ask.screens.flatMap((s) => (canvas.items[s.itemId] ? [roomRead(canvas, ask, s.itemId)] : [])).filter((r) => r.notes.length > 0 || postedRoomRead(canvas, ask, r.itemId));
  if (!reads.length) return null;
  const card = (persona: string | undefined) => criticItems(canvas.items).find((i) => i.properties[CRITIC_PROP] === persona);
  const colour = (persona: string | undefined) => card(persona)?.properties[CRITIC_COLOR] ?? "var(--accent)";
  const note = (n: CritiqueNote, withMove = false) => {
    const first = gist(n.text);
    const move = moveOf(n.text);
    return (
      <li key={n.threadId} className="crit-row" data-room-note={n.threadId}>
        <span className="crit-dot" aria-hidden style={{ background: colour(n.persona) }} />
        <span><b>{n.critic}</b> <small>{n.kind}</small> — “{first}”{withMove && move && !first.startsWith(move) ? ` → ${move}.` : ""}</span>
      </li>
    );
  };
  const both = async (a: CritiqueNote, b: CritiqueNote) => {
    setBusy(true);
    setProblem(null);
    try {
      const no = await askBoth(host, canvas, a, b);
      if (no) setProblem(no);
    } catch (err) {
      setProblem(said(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="crit-dialog room-card" data-room-read={ask.commentId} aria-label="Read of the room">
      <button type="button" className="room-close" aria-label="Close" onClick={() => setDismissed(ask.commentId)}>
        <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
      {reads.map((r) => {
        const item = canvas.items[r.itemId]!;
        const posted = postedRoomRead(canvas, ask, r.itemId);
        const { agree, split, blocker, alone } = r.read;
        return (
          <div key={r.itemId} className="crit-dialog" data-room-screen={r.itemId}>
            <div className="room-head">
              <h3>Read of the room — “{item.title || "Untitled"}”</h3>
              <p className="crit-note">{ask.critics.map((c) => card(c)?.title ?? c).join(" · ")}</p>
            </div>
            {posted ? <p className="room-say" data-room-say>{posted.by.name}: {posted.say || "the grouping, as the notes fall"}</p> : <p className="crit-note">The lead is reading the room…</p>}
            <div>
              <h3>Agree</h3>
              {agree.length ? <ul className="crit-list" data-room-section="agree">{agree.map((g, i) => <li key={i}><span className="crit-note">{g.critics.join(" and ")} agree ({g.kind}):</span><ul className="crit-list">{g.notes.map((x) => note(x))}</ul></li>)}</ul> : <p className="crit-note" data-room-section="agree">Nothing two lenses agree on.</p>}
            </div>
            <div>
              <h3>Split</h3>
              {split.length ? (
                <ul className="crit-list" data-room-section="split">
                  {split.map((s) => (
                    <li key={s.ref} data-room-split={s.ref}>
                      <ul className="crit-list">{s.sides[0].map((x) => note(x, true))}</ul>
                      <span className="crit-note room-against">against</span>
                      <ul className="crit-list">{s.sides[1].map((x) => note(x, true))}</ul>
                      {bothAsked(canvas, s.ref) ? (
                        <p className="crit-note" data-room-both-asked>Asked for both — two proposals, one for each side.</p>
                      ) : (
                        <button type="button" className="btn" disabled={busy} data-room-both={s.ref} onClick={() => void both(s.sides[0][0]!, s.sides[1][0]!)}>Build both</button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : <p className="crit-note" data-room-section="split">No split.</p>}
            </div>
            <div>
              <h3>Blocker</h3>
              {blocker.length ? <ul className="crit-list" data-room-section="blocker">{blocker.map((x) => note(x))}</ul> : <p className="crit-note" data-room-section="blocker">None.</p>}
            </div>
            {alone.length > 0 && <div><h3>On their own</h3><ul className="crit-list">{alone.map((x) => note(x))}</ul></div>}
            {r.silent.length > 0 && <p className="crit-note">Nothing to say at their volume: {r.silent.map((c) => card(c)?.title ?? c).join(" and ")}.</p>}
          </div>
        );
      })}
      {problem && <p className="crit-problem" role="alert">{problem}</p>}
    </section>
  );
}

/* ---- the critics in the room --------------------------------------------- */

/** **Critics in the room** — the list with its switches, the starter lenses, a lens described, and the ask. */
export function RoomDialog({ canvas, selection, args, canEdit, host }: DialogFacts) {
  const [critics, setCritics] = useState<CanvasCritic[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [line, setLine] = useState("");
  const [refs, setRefs] = useState("");

  useEffect(() => {
    let live = true;
    cardsOn(host.getCanvas(), host.readText).then((list) => live && setCritics(list), (err) => live && setProblem(said(err)));
    return () => {
      live = false;
    };
  }, [canvas, host]);

  const act = async (run: () => Promise<unknown>) => {
    setBusy(true);
    setProblem(null);
    try {
      await run();
    } catch (err) {
      setProblem(said(err));
    } finally {
      setBusy(false);
    }
  };
  const set = (itemId: string, change: { on?: boolean; loud?: string; when?: string }) => act(async () => {
    const patch = settingsPatch(change);
    if ("refused" in patch) throw new Error(patch.refused);
    await host.send([{ type: "item.update", itemId, patch: { properties: patch } } as Operation]);
  });

  const screenId = args.trim() || (selection.length === 1 ? selection[0] : undefined);
  const screen = screenId ? canvas.items[screenId] : undefined;
  const ask = screen && screen.properties[CRITIC_PROP] === undefined ? screen : undefined;
  const here = new Set((critics ?? []).map((c) => c.critic.name));
  const starters = STARTER_LENSES.filter((l) => !here.has(starterDraft(l).name));

  return (
    <div className="crit-dialog" data-critics-room>
      <p className="crit-note">Lenses the canvas's lead wears over a screen. They point and explain; they never edit.</p>
      {critics === null ? <p className="crit-note">Reading the critics…</p> : critics.length === 0 ? <p className="crit-note">No critics here yet — add a lens below.</p> : (
        <ul className="crit-list">
          {critics.map((c) => {
            const item = host.getCanvas().items[c.itemId];
            if (!item) return null;
            const s = roomSettings(item);
            return (
              <li key={c.itemId} className="crit-row" data-critic={c.critic.name}>
                <input type="checkbox" aria-label={`${c.critic.agentName} speaks in the room`} checked={s.on} disabled={!canEdit || busy} data-critic-on onChange={(e) => void set(c.itemId, { on: e.target.checked })} />
                <span className="crit-dot" aria-hidden style={{ background: s.color ?? "var(--accent)" }} />
                <span className="crit-name">
                  <b>{c.critic.agentName}</b>
                  <small>{c.critic.line || c.critic.questions[0] || c.critic.credit}</small>
                </span>
                <select aria-label={`How loud is ${c.critic.agentName}`} value={s.loud} disabled={!canEdit || busy} data-critic-loud onChange={(e) => void set(c.itemId, { loud: e.target.value })}>
                  {(Object.keys(LOUDNESS) as Loudness[]).map((k) => <option key={k} value={k}>{LOUDNESS[k].label}</option>)}
                </select>
                <select aria-label={`When ${c.critic.agentName} speaks`} value={s.when} disabled={!canEdit || busy} data-critic-when onChange={(e) => void set(c.itemId, { when: e.target.value })}>
                  {(Object.keys(WHENS) as When[]).map((k) => <option key={k} value={k}>{WHENS[k]}</option>)}
                </select>
              </li>
            );
          })}
        </ul>
      )}
      {starters.length > 0 && (
        <div>
          <h3>Add a lens</h3>
          <div className="crit-actions room-starters">
            {starters.map((l) => (
              <button key={l.id} type="button" className="btn" title={l.line} disabled={!canEdit || busy} data-critic-add={l.id} onClick={() => void act(() => placeLens(host, host.getCanvas(), starterDraft(l), critics ?? []))}>
                {l.agentName}
              </button>
            ))}
          </div>
        </div>
      )}
      <form className="crit-new" onSubmit={(e) => {
        e.preventDefault();
        void act(async () => {
          const draft = describedDraft({ agentName: name, line, refs, taken: critics?.length ?? 0 });
          if ("refused" in draft) throw new Error(draft.refused);
          await placeLens(host, host.getCanvas(), draft, critics ?? []);
          setName("");
          setLine("");
          setRefs("");
        });
      }}>
        <label>Describe a critic — its name, for what it looks for<input value={name} placeholder="The Purist" onChange={(e) => setName(e.target.value)} /></label>
        <label>What it looks for, in one line<input value={line} placeholder="One typeface, one accent, nothing decorative" onChange={(e) => setLine(e.target.value)} /></label>
        <label>Work it is after (never a person)<input value={refs} placeholder="Swiss railway signage" onChange={(e) => setRefs(e.target.value)} /></label>
        <button type="submit" className="btn" disabled={!canEdit || busy || !name.trim()}>Add critic</button>
      </form>
      {problem && <p className="crit-problem" role="alert">{problem}</p>}
      <div className="crit-actions">
        <button type="button" className="btn" onClick={host.close}>Close</button>
        {ask && (
          <button type="button" className="btn primary" disabled={!canEdit || busy} data-critics-ask onClick={() => void act(async () => {
            const no = await askRoom(host, host.getCanvas(), ask.id, "asked");
            if (no) throw new Error(no);
            host.notice(`Asked the room about “${ask.title || "Untitled"}” — its notes land as pins in each critic's colour`);
            host.close();
          })}>
            Ask the room about “{ask.title || "Untitled"}”
          </button>
        )}
      </div>
    </div>
  );
}

/** **Build both**, from under a posted read in the Chat: the two notes, and the ask to the lead. */
export function RoomBothDialog({ args, canEdit, host }: DialogFacts) {
  const canvas = host.getCanvas();
  const [a, b] = args.trim().split("+").map((id) => (canvas.threads[id] ? readNote(canvas.threads[id]!, canvas.items) : null));
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!a || !b) return <p className="crit-problem">Those two notes are not on the canvas any more.</p>;
  return (
    <div className="crit-dialog">
      <ol className="crit-read">
        <li><b>{a.critic}</b> — {a.text}</li>
        <li><b>{b.critic}</b> — {b.text}</li>
      </ol>
      <p className="crit-note">The lead makes two proposals beneath the screen, one for each side. Nothing changes until you keep one.</p>
      {problem && <p className="crit-problem" role="alert">{problem}</p>}
      <div className="crit-actions">
        <button type="button" className="btn" onClick={host.close}>Cancel</button>
        <button type="button" className="btn primary" disabled={!canEdit || busy} onClick={() => {
          setBusy(true);
          void askBoth(host, canvas, a, b).then((no) => (no ? (setProblem(no), setBusy(false)) : (host.notice("Asked for both — two proposals, one for each side"), host.close())), (err) => (setProblem(said(err)), setBusy(false)));
        }}>Build both</button>
      </div>
    </div>
  );
}
