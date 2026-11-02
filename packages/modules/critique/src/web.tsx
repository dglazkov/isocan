import "../assets/styles.css";
import { useEffect, useMemo, useState } from "react";
import {
  anchorOffset,
  isSystemActor,
  moduleAsset,
  moduleSlug,
  newCommentId,
  newItemId,
  newThreadId,
  newVersionId,
  type CanvasContents,
  type DialogFacts,
  type DialogHost,
  type Item,
  type ModuleCommentFacts,
  type ModuleMenuFacts,
  type ModuleMenuRow,
  type Operation,
  type RendererFacts,
  type WebModule,
} from "@isocan/core";
import { boardCriticDraft } from "@isocan/core/mood";
import {
  CRITIC_CARD,
  CRITIC_PROP,
  CRITIC_TEMPLATE,
  CRITICS_POINT,
  bothBrief,
  buildersFor,
  canvasClashes,
  criticItems,
  criticMarkdown,
  criticProblems,
  critiqueCore,
  critiqueRead,
  critiqueStatus,
  draftFromRoster,
  enrolArgs,
  isPostedRead,
  isReadyLine,
  lensPath,
  postedSplits,
  readCritic,
  readLens,
  readNote,
  readWords,
  refuseJoin,
  requestBody,
  requestNotes,
  requestScreen,
  rosterFrom,
  skeletonDraft,
  type CanvasCritic,
  type Critic,
  type CriticDraft,
  type CritiqueNote,
  type Lens,
  type RosterEntry,
} from "./core.ts";
import { CRITIC_COLOR, CRITIC_ON } from "./room.ts";
import { RoomBothDialog, RoomDialog, RoomOverlay } from "./room-web.tsx";

/**
 * **Critique in the browser** — the critic card, and the web's doors
 * (critique phase 4): the *Critics* dialog (the roster, this canvas's
 * critics, add, new and release), *Critique with…* on a screen's menu, and,
 * under the request thread's comments, *Post the read…* and *Build both…*.
 * The whole half is fetched only once the `critique` experiment is on
 * (`packages/web/src/modules.ts`).
 *
 * **Every write is the op the terminal sends**, built by the same core
 * functions: `critic add` and `new` are one blob and one `item.add`
 * (`criticMarkdown`), asking is `host.enrol` to the parked rc then
 * `agent.ceiling note` then one `thread.create` (`requestBody`), the read is
 * the `critique read --post` reply (`readWords`) and *Build both* is the
 * `critique both` reply (`bothBrief`). Nothing here runs a model.
 */

/* ---- the card ----------------------------------------------------------- */

/**
 * **A critic, drawn as a card** — its name, the credit line, its colour and
 * its three questions. Read through `readCritic`, the reader `isocan critic
 * ls` uses, so the card and the terminal cannot disagree about what a critic
 * says. A card that no longer parses as a critic says so rather than drawing
 * an empty one.
 */
function CriticCard({ readText, filename }: RendererFacts) {
  const [critic, setCritic] = useState<Critic | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    readText().then((text) => { if (live) setCritic(readCritic(text, filename)); }, () => { if (live) setCritic(null); });
    return () => { live = false; };
  }, [readText, filename]);
  if (critic === undefined) return null;
  if (critic === null) return <div className="file-view">Not a critic any more — its front matter needs <code>critic: true</code>.</div>;
  const colour = critic.color ?? "currentColor";
  return (
    <article className="critic-card" style={{ borderTop: `6px solid ${colour}`, padding: "16px 18px", height: "100%", boxSizing: "border-box", overflow: "auto" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span aria-hidden style={{ width: 14, height: 14, borderRadius: "50%", background: colour, flex: "none" }} />
        <h3 style={{ margin: 0, fontSize: 20 }}>{critic.agentName || critic.name}</h3>
      </header>
      <p style={{ margin: "4px 0 12px 24px", opacity: 0.7, fontSize: 13 }}>{critic.credit}</p>
      <ol style={{ margin: 0, paddingLeft: 24, display: "grid", gap: 8 }}>
        {critic.questions.map((q, i) => <li key={i}>{q || <em style={{ opacity: 0.6 }}>unwritten</em>}</li>)}
      </ol>
    </article>
  );
}

/* ---- reading the canvas, the way the terminal does ---------------------- */

const current = (item: Item) => item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0];

/** Every critic on the canvas, read from its card's current bytes — `criticsOn`'s twin. */
async function criticsOn(canvas: CanvasContents, readText: DialogHost["readText"]): Promise<CanvasCritic[]> {
  const out: CanvasCritic[] = [];
  for (const item of criticItems(canvas.items)) {
    const v = current(item);
    if (!v) continue;
    const critic = readCritic(await readText(v.blobHash), v.filename);
    if (critic) out.push({ itemId: item.id, critic });
  }
  return out;
}

/** The standing agent wearing a critic's name, if it has ever been asked here. */
const agentOf = (canvas: CanvasContents, agentName: string) =>
  Object.values(canvas.agents ?? {}).find((a) => a.actor.name.toLowerCase() === agentName.toLowerCase());

/** The critics on this canvas as actors — `criticActors`' twin. */
const actorsOf = (canvas: CanvasContents, on: readonly CanvasCritic[]) =>
  on.flatMap(({ critic }) => {
    const a = agentOf(canvas, critic.agentName);
    return a ? [{ id: a.actor.id, name: a.actor.name }] : [];
  });

const said = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Where a new card goes when nothing says: beside the leftmost item — the terminal's default. */
function cardPlacement(canvas: CanvasContents) {
  const leftmost = Object.values(canvas.items).reduce<Item | null>((best, item) => (best === null || item.x < best.x ? item : best), null);
  return leftmost ? { anchorItemId: leftmost.id } : { x: 0, y: 0 };
}

/** One critic card: one blob, one `item.add`, the property beside it — `place`'s twin. */
async function placeCard(host: DialogHost, draft: CriticDraft, extra: Record<string, string> = {}): Promise<string> {
  const text = criticMarkdown(draft);
  const filename = `${draft.name}.md`;
  const put = await host.putBlob(new Blob([text], { type: "text/markdown" }), filename);
  const itemId = newItemId();
  await host.send([{
    type: "item.add",
    itemId,
    version: { id: newVersionId(), blobHash: put.blobHash, mimeType: "text/markdown", filename, size: put.size },
    width: CRITIC_CARD.width,
    height: CRITIC_CARD.height,
    placement: cardPlacement(host.getCanvas()),
    title: draft.agentName,
    properties: { [CRITIC_PROP]: draft.name, ...extra },
  } as Operation]);
  return itemId;
}

/**
 * **The roster, from the daemon's registry** — the one `isocan critic ls`
 * reads. The browser registers design-competition's record only once its own
 * half loads, so asking the daemon is how the nine reach this dialog without
 * a second copy of them.
 */
async function loadRoster(): Promise<RosterEntry[]> {
  const res = await fetch(`/api/points/${encodeURIComponent(CRITICS_POINT)}`);
  if (!res.ok) throw new Error(`the roster did not load (${res.status})`);
  const body = (await res.json()) as { contributions?: { module: string; value: unknown }[] };
  return rosterFrom(body.contributions ?? []);
}

/**
 * **A roster entry's lens**, from the module that contributed it — `lensOf`'s
 * twin: its runtime base, or the built-in module's own `assets/` (served by
 * the daemon from where the terminal reads them), else the record's three
 * questions with the two headings left for a person.
 */
async function lensOf(entry: RosterEntry): Promise<Lens> {
  const rel = lensPath(entry.critic);
  const url = moduleAsset(entry.module, rel) ?? `/modules/${moduleSlug(entry.module)}/${rel}`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const lens = readLens(await res.text());
      if (lens.questions.length > 0) return lens;
    }
  } catch {
    /* the fallback below */
  }
  return { questions: [...entry.critic.critique], looksFor: "", ranks: "" };
}

/* ---- the Critics dialog -------------------------------------------------- */

/**
 * **Critics** — `critic ls`, `add`, `new` and `release` in one place. Each
 * row is the verb's own write: a refusal is `refuseJoin`'s sentence, shown
 * where the button was.
 */
function CriticsDialog({ canvas, canEdit, host }: DialogFacts) {
  const [rosterList, setRoster] = useState<RosterEntry[] | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [on, setOn] = useState<CanvasCritic[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [after, setAfter] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    loadRoster().then(setRoster, (err) => setRosterError(said(err)));
  }, []);
  useEffect(() => {
    let live = true;
    criticsOn(host.getCanvas(), host.readText).then((list) => { if (live) setOn(list); }, (err) => { if (live) setProblem(said(err)); });
    return () => { live = false; };
  }, [canvas, tick, host]);

  const act = async (key: string, run: () => Promise<void>) => {
    setBusy(key);
    setProblem(null);
    try {
      await run();
      setTick((t) => t + 1);
    } catch (err) {
      setProblem(said(err));
    } finally {
      setBusy(null);
    }
  };

  const add = (entry: RosterEntry) => act(entry.critic.id, async () => {
    const draft = draftFromRoster(entry.critic, await lensOf(entry));
    const refused = refuseJoin(await criticsOn(host.getCanvas(), host.readText), draft);
    if (refused) throw new Error(refused);
    const itemId = await placeCard(host, draft);
    host.notice(`${draft.agentName} is on this canvas — ${draft.credit}`);
    host.reveal([itemId]);
  });

  const write = () => act("new", async () => {
    const draft = skeletonDraft(name, after.trim() ? { after } : {});
    const refused = refuseJoin(await criticsOn(host.getCanvas(), host.readText), draft);
    if (refused) throw new Error(refused);
    const itemId = await placeCard(host, draft);
    setName("");
    setAfter("");
    host.notice(`${draft.agentName} is on this canvas — three questions to write on its card`);
    host.reveal([itemId]);
  });

  const release = (agentName: string) => act(`release:${agentName}`, async () => {
    const agent = agentOf(host.getCanvas(), agentName);
    if (!agent || agent.ceiling !== "note") return;
    await host.send([{ type: "agent.ceiling", actorId: agent.actor.id, ceiling: null } as Operation]);
    host.notice(`${agent.actor.name} may edit this canvas again — it is capped at notes the next time it is asked`);
  });

  const here = new Set((on ?? []).map(({ critic }) => critic.agentName.toLowerCase()));
  const clashes = new Map(canvasClashes(on ?? []).map((c) => [c.id, c.problem]));

  return (
    <div className="crit-dialog">
      {!canEdit && <p className="crit-note">You are reading this canvas — critics are added by somebody who can edit it.</p>}
      <section aria-labelledby="crit-on">
        <h3 id="crit-on">On this canvas</h3>
        {on === null ? <p className="crit-note">Reading the cards…</p> : on.length === 0 ? <p className="crit-note">No critics yet. Add one from the roster, or write your own.</p> : (
          <ul className="crit-list">
            {on.map(({ itemId, critic }) => {
              const agent = agentOf(canvas, critic.agentName);
              const problems = [...criticProblems(critic), ...(clashes.has(critic.name) ? [clashes.get(critic.name)!] : [])];
              const mayLift = agent?.ceiling === "note" && (!agent.ceilingBy || agent.ceilingBy.id === host.viewer.id);
              return (
                <li key={itemId} className="crit-row">
                  <span className="crit-dot" aria-hidden style={{ background: critic.color ?? "currentColor" }} />
                  <span className="crit-name">
                    <button type="button" className="crit-link" onClick={() => host.reveal([itemId])}>{critic.agentName}</button>
                    <small>{critic.credit}{agent?.ceiling === "note" ? " · notes only" : ""}</small>
                    {problems.map((p) => <small key={p} className="crit-problem">{p}</small>)}
                  </span>
                  {agent?.ceiling === "note" && canEdit && (
                    <button type="button" className="btn" disabled={!mayLift || busy !== null} onClick={() => void release(critic.agentName)}
                      title={mayLift ? `Lift the ceiling, so ${critic.agentName} may edit — what \`isocan critic release\` does` : `${agent.ceilingBy?.name ?? "Whoever capped it"} capped ${critic.agentName}, and lifts it`}>
                      Release
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section aria-labelledby="crit-roster">
        <h3 id="crit-roster">The roster</h3>
        {rosterError ? <p className="crit-problem">{rosterError}</p> : rosterList === null ? <p className="crit-note">Loading…</p> : rosterList.length === 0 ? (
          <p className="crit-note">No module contributes critics here — write your own below.</p>
        ) : (
          <ul className="crit-list">
            {rosterList.map((entry) => {
              const added = here.has(entry.critic.agentName.toLowerCase());
              return (
                <li key={`${entry.module}:${entry.critic.id}`} className="crit-row">
                  <span className="crit-dot" aria-hidden style={{ background: entry.critic.colour }} />
                  <span className="crit-name">
                    <b>{entry.critic.agentName}</b>
                    <small>{entry.critic.credit}</small>
                  </span>
                  <button type="button" className="btn" disabled={!canEdit || added || busy !== null} onClick={() => void add(entry)}
                    aria-label={added ? `${entry.critic.agentName} is on this canvas` : `Add ${entry.critic.agentName}`}>
                    {added ? "Added" : busy === entry.critic.id ? "Adding…" : "Add"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section aria-labelledby="crit-new">
        <h3 id="crit-new">Write your own</h3>
        <form className="crit-new" onSubmit={(e) => { e.preventDefault(); if (name.trim()) void write(); }}>
          <label>Name <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Counter" disabled={!canEdit} /></label>
          <label>After <input value={after} onChange={(e) => setAfter(e.target.value)} placeholder="who it is an homage to (optional)" disabled={!canEdit} /></label>
          <button type="submit" className="btn" disabled={!canEdit || !name.trim() || busy !== null}>New critic</button>
        </form>
        <p className="crit-note">A card with three empty questions to fill in. A critic is named for a principle, never a person.</p>
      </section>
      {problem && <p className="crit-problem" role="alert">{problem}</p>}
    </div>
  );
}

/* ---- Critique with… ------------------------------------------------------ */

/**
 * **Ask critics about a screen** — `isocan critique <item> --by a,b`, from
 * its menu. Each is enrolled on the person's parked rc through
 * `host.enrol` (the template writes its directory from the card's current
 * bytes, and the rc applies the card's budget and colour), capped at notes,
 * and then ONE thread on the screen mentions them all.
 */
function CritiqueWithDialog({ args, canvasId, canvas, groupMode, rcParked, canEdit, host }: DialogFacts) {
  const screen = canvas.items[args.trim()];
  const [on, setOn] = useState<CanvasCritic[] | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [boardChosen, setBoardChosen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    criticsOn(host.getCanvas(), host.readText).then((list) => { if (live) setOn(list); }, (err) => { if (live) setProblem(said(err)); });
    return () => { live = false; };
  }, [host]);

  if (!screen) return <p className="crit-problem">That screen is not on this canvas any more.</p>;
  if (screen.properties[CRITIC_PROP] !== undefined) return <p className="crit-problem">{screen.title} is a critic&rsquo;s card — a critique is of a screen.</p>;

  const clashes = new Map(canvasClashes(on ?? []).map((c) => [c.id, c.problem]));
  const problemsOf = (c: CanvasCritic) => [...criticProblems(c.critic), ...(clashes.has(c.critic.name) ? [clashes.get(c.critic.name)!] : [])];
  const picked = (on ?? []).filter((c) => chosen.includes(c.itemId));
  const boardDraft = (on ?? []).some((c) => c.critic.name === "board") ? null : boardCriticDraft(canvas, groupMode);
  const totalPicked = picked.length + (boardDraft && boardChosen ? 1 : 0);

  const ask = async () => {
    setBusy(true);
    setProblem(null);
    try {
      for (const c of picked) {
        const problems = problemsOf(c);
        if (problems.length) throw new Error(`${c.critic.agentName}'s card needs fixing first — ${problems.join("; ")}`);
      }
      const toAsk: CanvasCritic[] = [...picked];
      if (boardDraft && boardChosen) {
        const refused = refuseJoin(on ?? [], boardDraft);
        if (refused) throw new Error(refused);
        const boardItemId = await placeCard(host, boardDraft, {
          [CRITIC_ON]: "on",
          ...(boardDraft.color ? { [CRITIC_COLOR]: boardDraft.color } : {}),
        });
        const boardCritic = readCritic(criticMarkdown(boardDraft), `${boardDraft.name}.md`);
        if (!boardCritic) throw new Error("Board critic card failed to parse.");
        toAsk.push({ itemId: boardItemId, critic: boardCritic });
      }
      const asked: { name: string; actorId: string }[] = [];
      for (const c of toAsk) {
        const before = agentOf(host.getCanvas(), c.critic.agentName);
        const text = await host.readText(current(host.getCanvas().items[c.itemId]!)!.blobHash);
        const { actorId } = await host.enrol({ name: c.critic.agentName, template: CRITIC_TEMPLATE, args: enrolArgs(text, canvasId, c.itemId), reuse: true });
        if (host.getCanvas().agents?.[actorId]?.ceiling !== "note") {
          try {
            await host.send([{ type: "agent.ceiling", actorId, ceiling: "note" } as Operation]);
          } catch (err) {
            if (!before) await host.send([{ type: "agent.withdraw", actorId } as Operation]).catch(() => {});
            throw new Error(`this canvas's home would not cap ${c.critic.agentName} at notes (${said(err)}), and a critic that could edit is not one — nothing was asked${before ? "" : `, and ${c.critic.agentName} was not left enrolled`}`);
          }
        }
        asked.push({ name: c.critic.agentName, actorId });
      }
      const item = host.getCanvas().items[screen.id] ?? screen;
      await host.send([{
        type: "thread.create",
        threadId: newThreadId(),
        ...anchorOffset(item),
        anchorItemId: item.id,
        comment: { id: newCommentId(), body: requestBody(asked.map((a) => a.name), item.title), mentions: asked.map((a) => a.actorId), items: [item.id] },
      } as Operation]);
      host.notice(asked.length === 1
        ? `Asked ${asked[0]!.name} about ${item.title} — its notes pin to the screen`
        : `Asked ${asked.map((a) => a.name).join(" and ")} about ${item.title} — each works alone, and the last says when the read is ready`);
      host.close();
    } catch (err) {
      setProblem(said(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="crit-dialog">
      <p className="crit-note">They pin notes on <b>{screen.title}</b> and change nothing. Each runs on your parked runner, bounded by the budget on its card.</p>
      {!rcParked ? (
        <p className="crit-problem" role="status">Nobody&rsquo;s runner is parked on this canvas — start <code>isocan rc</code> there, then ask again. Nothing was enrolled.</p>
      ) : on === null ? <p className="crit-note">Reading the cards…</p> : on.length === 0 && !boardDraft ? (
        <p className="crit-note">No critics on this canvas yet — open <b>Critics</b> from the palette (⌘K) to add some.</p>
      ) : (
        <fieldset className="crit-pick">
          <legend>Critics</legend>
          {boardDraft && (
            <label className="crit-row" data-critic-board>
              <input type="checkbox" checked={boardChosen} disabled={!canEdit}
                onChange={(e) => setBoardChosen(e.target.checked)} />
              <span className="crit-dot" aria-hidden style={{ background: boardDraft.color }} />
              <span className="crit-name">
                <b>Board</b>
                <small>from your kept tiles on the Mood board</small>
              </span>
            </label>
          )}
          {on.map((c) => {
            const problems = problemsOf(c);
            return (
              <label key={c.itemId} className="crit-row">
                <input type="checkbox" checked={chosen.includes(c.itemId)} disabled={!canEdit || problems.length > 0}
                  onChange={(e) => setChosen((was) => (e.target.checked ? [...was, c.itemId] : was.filter((id) => id !== c.itemId)))} />
                <span className="crit-dot" aria-hidden style={{ background: c.critic.color ?? "currentColor" }} />
                <span className="crit-name">
                  <b>{c.critic.agentName}</b>
                  <small>{c.critic.credit}</small>
                  {problems.map((p) => <small key={p} className="crit-problem">{p}</small>)}
                </span>
              </label>
            );
          })}
        </fieldset>
      )}
      {problem && <p className="crit-problem" role="alert">{problem}</p>}
      <div className="crit-actions">
        <button type="button" className="btn" onClick={host.close}>Cancel</button>
        <button type="button" className="btn primary" disabled={!rcParked || !canEdit || totalPicked === 0 || busy} onClick={() => void ask()}>
          {busy ? "Asking…" : totalPicked > 1 ? `Ask ${totalPicked} critics` : "Ask"}
        </button>
      </div>
    </div>
  );
}

/* ---- the read, and Build both -------------------------------------------- */

/** A request thread, read as the terminal reads it: status, screen, notes, fold. */
async function readRequest(host: DialogHost, threadId: string) {
  const canvas = host.getCanvas();
  const thread = canvas.threads[threadId];
  if (!thread) throw new Error("that thread is not on this canvas any more");
  const status = critiqueStatus(thread, actorsOf(canvas, await criticsOn(canvas, host.readText)), isSystemActor);
  if (!status) throw new Error("that thread asks no critic anything — a read is of a critique's request thread");
  const itemId = requestScreen(thread, status);
  const item = itemId ? canvas.items[itemId] : undefined;
  if (!item) throw new Error("that thread is about no screen that is still here");
  const notes = requestNotes(canvas, item.id, status);
  return { thread, status, item, notes, read: critiqueRead(notes) };
}

type Request = Awaited<ReturnType<typeof readRequest>>;

/** Load a request once the dialog opens; a refusal is a sentence. */
function useRequest(host: DialogHost, threadId: string) {
  const [req, setReq] = useState<Request | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    readRequest(host, threadId).then((r) => { if (live) setReq(r); }, (err) => { if (live) setProblem(said(err)); });
    return () => { live = false; };
  }, [host, threadId]);
  return { req, problem, setProblem };
}

/**
 * **Post the read** — `critique read <thread> --post --say "…"`: the fold's
 * grouping, under the person's own words if they write any, as one record in
 * the request thread. Posted only once every critic asked is done.
 */
function CritiqueReadDialog({ args, canEdit, host }: DialogFacts) {
  const { req, problem, setProblem } = useRequest(host, args.trim());
  const [say, setSay] = useState("");
  const [busy, setBusy] = useState(false);
  const words = useMemo(() => (req ? readWords(req.read) : ""), [req]);
  if (!req) return <p className={problem ? "crit-problem" : "crit-note"}>{problem ?? "Reading the notes…"}</p>;
  const waiting = req.status.pending.map((p) => p.name);
  const post = async () => {
    setBusy(true);
    try {
      const body = `${say.trim() ? `${say.trim()}\n\n` : ""}${words}`;
      await host.send([{ type: "thread.reply", threadId: req.thread.id, comment: { id: newCommentId(), body, record: true, items: [req.item.id] } } as Operation]);
      host.close();
    } catch (err) {
      setProblem(said(err));
      setBusy(false);
    }
  };
  return (
    <div className="crit-dialog">
      <p className="crit-note">{req.item.title} — asked {req.status.asked.map((a) => a.name).join(" and ")}; {req.notes.length} {req.notes.length === 1 ? "note" : "notes"}.</p>
      <ReadView notes={req.notes} words={words} />
      {waiting.length > 0 && <p className="crit-problem" role="status">Still waiting on {waiting.join(" and ")} — the read is posted once every critic asked is done.</p>}
      <label className="crit-say">Your words, above the read — name each tension in design words (optional)
        <textarea value={say} onChange={(e) => setSay(e.target.value)} rows={3} disabled={!canEdit} />
      </label>
      {problem && <p className="crit-problem" role="alert">{problem}</p>}
      <div className="crit-actions">
        <button type="button" className="btn" onClick={host.close}>Cancel</button>
        <button type="button" className="btn primary" disabled={!canEdit || waiting.length > 0 || busy} onClick={() => void post()}>Post the read</button>
      </div>
    </div>
  );
}

/** The fold as it will be posted, one group per line. */
function ReadView({ notes, words }: { notes: readonly CritiqueNote[]; words: string }) {
  if (notes.length === 0) return <p className="crit-note">No notes yet.</p>;
  // As a person reads it: the bold marks and the terminal's `critique both`
  // ref left out here — the posted read keeps both, for whoever reads it next.
  return <ul className="crit-read">{words.split("\n").map((line, i) => <li key={i}>{line.replace(/\*\*/g, "").replace(/ — build both: `[^`]*`$/, "")}</li>)}</ul>;
}

/**
 * **Build both** — `critique both <split> --to <agent>`: one agent that may
 * edit is asked, in the request thread, for two variations, each citing the
 * note it answers. The person names the builder here: every agent standing on
 * the canvas and not capped at notes is offered, never a critic; the lead who
 * asked is chosen first when there is one, and otherwise the first standing,
 * and nothing is sent until they press.
 */
function CritiqueBothDialog({ args, canEdit, host }: DialogFacts) {
  const [threadId = "", ref = ""] = args.trim().split(/\s+/);
  const { req, problem, setProblem } = useRequest(host, threadId);
  const [builder, setBuilder] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pair = useMemo(() => {
    if (!req) return null;
    const canvas = host.getCanvas();
    const [a, b] = ref.split("+").map((id) => (canvas.threads[id] ? readNote(canvas.threads[id]!, canvas.items) : null));
    if (!a || !b) return null;
    const split = req.read.split.find((s) => s.sides[0].some((n) => n.threadId === a.threadId) && s.sides[1].some((n) => n.threadId === b.threadId));
    return split ? { a, b } : null;
  }, [req, ref, host]);
  const builders = req ? buildersFor(host.getCanvas().agents, req.status.asker.id) : [];
  const chosen = builders.find((x) => x.actor.id === builder) ?? builders[0];
  if (!req) return <p className={problem ? "crit-problem" : "crit-note"}>{problem ?? "Reading the notes…"}</p>;
  if (!pair) return <p className="crit-problem">Those two notes are not a split in {req.item.title}&rsquo;s read any more.</p>;
  const build = async () => {
    if (!chosen) return;
    setBusy(true);
    try {
      await host.send([{
        type: "thread.reply",
        threadId: req.thread.id,
        comment: { id: newCommentId(), body: bothBrief(chosen.actor.name, req.item, pair.a, pair.b), mentions: [chosen.actor.id], items: [req.item.id] },
      } as Operation]);
      host.notice(`Asked ${chosen.actor.name} for two variations of ${req.item.title} — one answering ${pair.a.critic}, one answering ${pair.b.critic}`);
      host.close();
    } catch (err) {
      setProblem(said(err));
      setBusy(false);
    }
  };
  return (
    <div className="crit-dialog">
      <ol className="crit-read">
        <li><b>{pair.a.critic}</b> — {pair.a.text}</li>
        <li><b>{pair.b.critic}</b> — {pair.b.text}</li>
      </ol>
      {builders.length === 0 ? (
        <p className="crit-problem" role="status">No agent on this canvas may build — critics are capped at notes. Add an agent that may edit, then build both.</p>
      ) : (
        <fieldset className="crit-pick">
          <legend>Who builds them</legend>
          {builders.map((x) => (
            <label key={x.actor.id} className="crit-row">
              <input type="radio" name="crit-builder" checked={chosen?.actor.id === x.actor.id} onChange={() => setBuilder(x.actor.id)} disabled={!canEdit} />
              <span className="crit-name"><b>{x.actor.name}</b>{x.actor.id === req.status.asker.id && <small>asked for this critique</small>}</span>
            </label>
          ))}
        </fieldset>
      )}
      {problem && <p className="crit-problem" role="alert">{problem}</p>}
      <div className="crit-actions">
        <button type="button" className="btn" onClick={host.close}>Cancel</button>
        <button type="button" className="btn primary" disabled={!canEdit || !chosen || busy} onClick={() => void build()}>Build both</button>
      </div>
    </div>
  );
}

/* ---- the doors ----------------------------------------------------------- */

/** A screen's menu: *Critique with…* on one item that is not a critic's card. */
function menu({ items, open }: ModuleMenuFacts): ModuleMenuRow[] {
  const [one] = items;
  if (items.length !== 1 || !one || one.properties[CRITIC_PROP] !== undefined) return [];
  return [
    // The room (proactive-agent phase 8): the lead wears the critics switched on — `isocan critique <item>`.
    { label: "Crit with the room…", writes: true, run: () => open("critics-room", one.id) },
    { label: "Critique with…", writes: true, run: () => open("critique-with", one.id) },
  ];
}

/**
 * Under a comment in a request thread: *Post the read…* on the last critic's
 * ready line until a read is posted, and *Build both…* under a posted read,
 * one per split it carries.
 */
function comments({ thread, comment, open }: ModuleCommentFacts): ModuleMenuRow[] {
  // The read of the room (proactive-agent phase 8): Build both asks the lead in the Chat for two proposals.
  if (comment.record && comment.body.startsWith("Read of the room")) {
    const refs = postedSplits(comment.body);
    return refs.map((ref, i) => ({ label: refs.length > 1 ? `Build both · split ${i + 1}…` : "Build both…", writes: true, run: () => open("room-both", ref) }));
  }
  if (isReadyLine(comment.body)) {
    const posted = thread.comments.some((c) => c.createdAt >= comment.createdAt && c.record && isPostedRead(c.body));
    return posted ? [] : [{ label: "Post the read…", writes: true, run: () => open("critique-read", thread.id) }];
  }
  const refs = comment.record ? postedSplits(comment.body) : [];
  return refs.map((ref, i) => ({ label: refs.length > 1 ? `Build both · split ${i + 1}…` : "Build both…", writes: true, run: () => open("critique-both", `${thread.id} ${ref}`) }));
}

/** The web half. */
export const critiqueWeb: WebModule<never, typeof CriticCard, never, never, typeof RoomOverlay, typeof CriticsDialog> = {
  core: critiqueCore,
  renderers: [{ mimes: ["text/markdown"], property: CRITIC_PROP, component: CriticCard }],
  actions: [
    { id: "critique.critics", name: "Critics", hint: "the roster, this canvas's critics — add, write, release", opens: "critics" },
    { id: "critique.room", name: "Critics in the room", hint: "the lenses the lead wears — on or off, how loud, when; ask the room about a screen", opens: "critics-room" },
  ],
  overlays: [{ region: "right", label: "Read of the room", component: RoomOverlay }],
  dialogs: [
    { id: "critics-room", title: "Critics in the room", wide: true, component: RoomDialog },
    { id: "room-both", title: "Build both", component: RoomBothDialog },
    { id: "critics", title: "Critics", component: CriticsDialog },
    { id: "critique-with", title: "Critique with", component: CritiqueWithDialog },
    { id: "critique-read", title: "The read", wide: true, component: CritiqueReadDialog },
    { id: "critique-both", title: "Build both", wide: true, component: CritiqueBothDialog },
  ],
  menu,
  comments,
};

export default critiqueWeb;
