import { useEffect, useMemo, useRef, useState, type ComponentType, type KeyboardEvent } from "react";
import {
  moduleAsset,
  newGroupId,
  newVersionId,
  type CanvasContents,
  type DialogFacts,
  type OverlayFacts,
  type RendererFacts,
  type WebModule,
} from "@isocan/core";
import {
  FIGHTER_MIME,
  MEDALS,
  MISS,
  TROPHY,
  arenaOrigin,
  arenaPlan,
  bellPlan,
  bouts,
  briefMarkdown,
  cardJson,
  decidePlan,
  entriesOf,
  findBout,
  laneMarkdown,
  laneOfActor,
  laneState,
  readCard,
  startPlan,
  timeLeft,
  type Bout,
  type EntryKind,
  type Minted,
} from "./bout.ts";
import { competitionCore } from "./core.ts";
import { fighters, packPath, rosterClashes, type Fighter, type FighterPack, type PackFile } from "./packs.ts";
import { competitionTally } from "./tally.ts";

/**
 * **The competition, in the app**: a portrait for each fighter card, the
 * *choose your fighter* picker as a dialog, and a tray that runs the bout —
 * the clock, the bell, your ballot, the result. Every write is an op through
 * the host; every button has a verb in `cli.ts`.
 */

const OWN = competitionCore.name;

/**
 * A pack file's URL — the module's own through `new URL(…, import.meta.url)`,
 * which Vite rewrites at build time and a runtime build leaves for the browser
 * to resolve against `/modules/<slug>/dist/web.js`; another module's through
 * the base its loader registered (proposed: `assets`).
 */
function packUrl(fighter: Fighter, file: PackFile): string | null {
  if (fighter.module !== OWN) return moduleAsset(fighter.module, packPath(fighter.pack, file));
  const id = fighter.pack.id;
  switch (file) {
    case "avatar.svg":
      return new URL(`../assets/packs/${id}/avatar.svg`, import.meta.url).href;
    case "DESIGN.md":
      return new URL(`../assets/packs/${id}/DESIGN.md`, import.meta.url).href;
    case "references.md":
      return new URL(`../assets/packs/${id}/references.md`, import.meta.url).href;
    case "critique.md":
      return new URL(`../assets/packs/${id}/critique.md`, import.meta.url).href;
  }
}

async function packFile(fighter: Fighter, file: PackFile): Promise<string> {
  const url = packUrl(fighter, file);
  if (!url) throw new Error(`${fighter.pack.id}: ${file} has nowhere to come from`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${fighter.pack.id}: ${file} — ${res.status}`);
  return res.text();
}

const svgData = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

// ---------- the card ----------

/**
 * **A fighter card, drawn as a portrait.** Keyed on `blobHash`, never on
 * `readText` (the shell may hand a fresh closure per render). The avatar is
 * inline in the card's own file and drawn as an `<img>`, so it can never
 * script the page; a card whose file is not a card says so rather than
 * drawing nothing.
 */
function FighterCard({ blobHash, readText }: RendererFacts) {
  const [text, setText] = useState<string | null>(null);
  const read = useRef(readText);
  read.current = readText;
  useEffect(() => {
    let live = true;
    read.current().then((t) => live && setText(t), () => live && setText(""));
    return () => {
      live = false;
    };
  }, [blobHash]);
  const card = useMemo(() => (text ? readCard(text) : null), [text]);
  if (text === null) return <div className="dc-card dc-card-empty">…</div>;
  if (!card) return <div className="dc-card dc-card-empty">not a fighter card</div>;
  return (
    <div className="dc-card" style={{ borderColor: card.colour }}>
      {card.avatar && <img className="dc-card-art" src={svgData(card.avatar)} alt="" />}
      <div className="dc-card-words">
        <b className="dc-card-title">{card.title}</b>
        <span className="dc-card-credit">{card.credit}</span>
        <span className="dc-card-tagline">{card.tagline}</span>
        <span className="dc-homage" title={card.homage}>
          homage
        </span>
      </div>
    </div>
  );
}

// ---------- choose your fighter ----------

const MAX_FIGHTERS = 4;

/**
 * **Choose your fighter** (journey Scene 0). A grid of portraits headed by
 * their principle with the designer as a credit, a P1–P4 bar, four settings
 * with defaults, and Fight — which lays the arena, asks the parked rc to
 * enrol one agent per pick from its pack's template, and hands each its brief
 * in its lane. No rc, no Fight: the sentence says what to start instead, and
 * the arena can still be laid for `isocan competition start` later.
 */
function FighterPicker({ canvasId, canvas, selection, args, rcParked, canEdit, host }: DialogFacts) {
  const roster = useMemo(() => {
    const all = fighters();
    const clashes = new Set(rosterClashes(all).map((c) => c.id));
    return all.filter((f) => !clashes.has(f.pack.id));
  }, []);
  const [picks, setPicks] = useState<string[]>([]);
  const [focus, setFocus] = useState(0);
  const [brief, setBrief] = useState(args.trim());
  const [entry, setEntry] = useState<EntryKind>("screen");
  const [minutes, setMinutes] = useState(20);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  // The canvas this dialog is handed is re-rendered as ops land; the Fight
  // handler reads the latest through this, not the one it closed over.
  const latest = useRef(canvas);
  latest.current = canvas;
  const attach = selection.length === 1 ? canvas.items[selection[0]!] ?? null : null;
  const shown = roster[focus] ?? roster[0];

  const toggle = (id: string) =>
    setPicks((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_FIGHTERS ? p : [...p, id]));

  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const cols = 3;
    const move = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
    if (move === undefined) return;
    e.preventDefault();
    const next = Math.max(0, Math.min(roster.length - 1, focus + move));
    setFocus(next);
    grid.current?.querySelectorAll<HTMLButtonElement>("button.dc-tile")[next]?.focus();
  };

  const random = () => {
    const pool = [...roster].sort(() => Math.random() - 0.5).slice(0, 3);
    setPicks(pool.map((f) => f.pack.id));
  };

  const chosen = picks.flatMap((id) => roster.filter((f) => f.pack.id === id));
  const ready = chosen.length >= 2 && brief.trim().length > 0 && canEdit && busy === null;

  async function lay(andStart: boolean) {
    setError(null);
    try {
      setBusy("Laying the arena…");
      const mint = async (text: string, mimeType: string, filename: string): Promise<Minted> => {
        const put = await host.putBlob(new Blob([text], { type: mimeType }), filename);
        return { ...put, mimeType, filename };
      };
      const lanes: Record<string, { area: Minted; card: Minted; design: Minted; shelf: Minted }> = {};
      for (const f of chosen) {
        const [avatar, design, shelf] = await Promise.all([packFile(f, "avatar.svg"), packFile(f, "DESIGN.md"), packFile(f, "references.md")]);
        lanes[f.pack.id] = {
          area: await mint(laneMarkdown(f.pack), "text/markdown", "area.md"),
          card: await mint(cardJson(f.pack, avatar), FIGHTER_MIME, `${f.pack.id}.fighter`),
          design: await mint(design, "text/markdown", "DESIGN.md"),
          shelf: await mint(shelf, "text/markdown", "references.md"),
        };
      }
      const briefText = brief.trim();
      const plan = arenaPlan({
        at: arenaOrigin(latest.current),
        brief: briefText,
        fighters: chosen.map((f) => ({ source: f.module, pack: f.pack })),
        entryKind: entry,
        mode: "exhibition",
        minutes,
        decider: host.viewer.id,
        target: attach,
        blobs: {
          brief: await mint(briefMarkdown({ brief: briefText, packs: chosen.map((f) => f.pack), entryKind: entry, minutes, mode: "exhibition" }), "text/markdown", "area.md"),
          lanes,
        },
      });
      await host.send(plan.ops, newGroupId());
      if (!andStart) {
        host.reveal([plan.boutId, ...plan.lanes.map((l) => l.areaId)]);
        host.close();
        return;
      }
      const packs: Record<string, FighterPack> = {};
      const actors: Record<string, { id: string; name: string }> = {};
      for (const f of chosen) {
        setBusy(`Asking your rc for ${f.pack.agentName}…`);
        packs[f.pack.id] = f.pack;
        const { actorId } = await host.enrol({
          name: f.pack.agentName,
          template: "design-competition.fighter",
          args: { pack: f.pack.id, module: f.module, bout: plan.boutId, lane: f.pack.agentName, canvas: canvasId },
        });
        actors[f.pack.id] = { id: actorId, name: f.pack.agentName };
      }
      const bout = findBout(latest.current, plan.boutId);
      if (!bout) throw new Error("the arena did not land — try again");
      await host.send(startPlan({ bout, packs, actors, now: new Date() }), newGroupId());
      host.reveal([plan.boutId, ...plan.lanes.map((l) => l.areaId)]);
      host.close();
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  return (
    <div className="dc-picker">
      <div className="dc-select">
        <div className="dc-grid" ref={grid} role="group" aria-label="Fighters" onKeyDown={onGridKey}>
          {roster.map((f, i) => {
            const slot = picks.indexOf(f.pack.id);
            const avatar = packUrl(f, "avatar.svg");
            return (
              <button
                key={f.pack.id}
                type="button"
                className={`dc-tile${slot >= 0 ? " picked" : ""}`}
                aria-pressed={slot >= 0}
                aria-label={`${f.pack.title}, ${f.pack.credit}`}
                tabIndex={i === focus ? 0 : -1}
                onFocus={() => setFocus(i)}
                onMouseEnter={() => setFocus(i)}
                onClick={() => toggle(f.pack.id)}
              >
                {avatar && <img className="dc-tile-art" src={avatar} alt="" />}
                {slot >= 0 && <span className="dc-slot">P{slot + 1}</span>}
                <span className="dc-tile-title">{f.pack.title}</span>
                <span className="dc-tile-credit">{f.pack.credit}</span>
              </button>
            );
          })}
        </div>
        {shown && (
          <aside className="dc-who" aria-live="polite">
            <span className="dc-homage">homage · as {shown.pack.agentName}</span>
            <b className="dc-who-title">{shown.pack.title}</b>
            <span className="dc-who-credit">{shown.pack.credit}</span>
            <ul>
              {shown.pack.beliefs.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <span className="dc-who-fine">{shown.pack.homage}</span>
          </aside>
        )}
      </div>
      <div className="dc-bar">
        {Array.from({ length: MAX_FIGHTERS }, (_, i) => {
          const f = chosen[i];
          return (
            <div key={i} className={`dc-bar-slot${f ? " filled" : ""}`} style={f ? { borderColor: f.pack.colour } : undefined}>
              <span className="dc-bar-n">P{i + 1}</span>
              <span>{f ? f.pack.agentName : i < 2 ? "pick" : "optional"}</span>
            </div>
          );
        })}
        <button type="button" className="dc-quiet" onClick={random}>
          🎲 Random
        </button>
      </div>
      <label className="dc-field">
        <span>The brief</span>
        <input value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="what are we designing, and for whom" />
      </label>
      <div className="dc-settings">
        <label className="dc-field">
          <span>Entry</span>
          <select value={entry} onChange={(e) => setEntry(e.target.value as EntryKind)}>
            <option value="screen">one screen</option>
            <option value="flow">a flow of three</option>
          </select>
        </label>
        <label className="dc-field">
          <span>Clock</span>
          <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            {[10, 20, 30, 45].map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </label>
        <div className="dc-field">
          <span>Vote</span>
          <span>exhibition — live, named</span>
        </div>
        <div className="dc-field">
          <span>About</span>
          <span>{attach ? `#${attach.title}` : "no screen selected"}</span>
        </div>
      </div>
      <div className="dc-actions">
        {rcParked ? (
          <button type="button" className="dc-fight" disabled={!ready} onClick={() => void lay(true)}>
            Fight
          </button>
        ) : (
          <button type="button" className="dc-quiet" disabled={!ready} onClick={() => void lay(false)}>
            Lay the arena
          </button>
        )}
        <span className="dc-note">
          {error ??
            busy ??
            (!canEdit
              ? "You are reading this canvas — a competition needs somebody who can write here."
              : rcParked
                ? `${chosen.length || "No"} agent${chosen.length === 1 ? "" : "s"}, ${minutes} minutes, on your own rc and harness — each bounded by the rc's turn limits.`
                : "Start `isocan rc` on your machine to run fighters — they run on your compute, under your harness. You can lay the arena now and `isocan competition start` later.")}
        </span>
      </div>
    </div>
  );
}

// ---------- the bout tray ----------

/** A clock that ticks only while something is counting down. */
function useNow(running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  return now;
}

/** The blob an item currently shows. */
const currentHash = (item: { versions: readonly { id: string; blobHash: string }[]; currentVersionId: string }) =>
  (item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0])?.blobHash;

/** The bout worth showing: the newest one still going, else the newest. */
function activeBout(canvas: CanvasContents): Bout | null {
  const all = bouts(canvas);
  return [...all].reverse().find((b) => b.phase !== "decided") ?? all[all.length - 1] ?? null;
}

/**
 * **The bout, beside the canvas** — the live side of the arena. While
 * building: each lane's state and the clock, and the bell. While voting: your
 * ballot, and nothing of anybody else's (the curtain). After the bell: both
 * tallies, and the Decider's choice. Decided: the winner, and Take it.
 */
function BoutTray({ canvas, host }: OverlayFacts) {
  const bout = useMemo(() => activeBout(canvas), [canvas]);
  const running = bout !== null && (bout.phase === "building" || bout.phase === "voting");
  const now = useNow(running);
  const [open, setOpen] = useState(true);
  if (!bout) return null;
  const me = host.viewer.id;
  const left = timeLeft(bout, new Date(now));
  const entries = entriesOf(bout);
  const mine = laneOfActor(bout, me);
  const decider = bout.decider === me;
  const laneName = (packId: string | undefined) => bout.lanes.find((l) => l.packId === packId)?.area.title ?? "entry";
  const title = bout.brief.title.replace(/^Design competition — /, "");
  const tallyOpen = bout.phase === "decided" || (bout.phase === "voting" && !left);
  const agentIds = new Set(Object.keys(canvas.agents ?? {}));
  const tally = tallyOpen ? competitionTally(bout, agentIds) : null;

  const medal = async (entryId: string, m: string) => {
    const ops = [];
    const holder = entries.find((e) => (e.reactions?.[m] ?? []).includes(me));
    if (holder) ops.push({ type: "item.react" as const, itemId: holder.id, emoji: m, on: false });
    if (holder?.id !== entryId) ops.push({ type: "item.react" as const, itemId: entryId, emoji: m, on: true });
    await host.send(ops, newGroupId());
  };
  const toggle = (entryId: string, m: string, on: boolean) => host.send([{ type: "item.react", itemId: entryId, emoji: m, on }]);
  const decide = (entryId: string) => {
    const winner = entries.find((e) => e.id === entryId)!;
    return host.send([{ type: "item.react", itemId: entryId, emoji: TROPHY, on: true }, ...decidePlan(bout, winner)], newGroupId());
  };
  const take = () => {
    const winner = tally?.decided;
    const target = bout.target ? canvas.items[bout.target] : undefined;
    if (!winner || !target) return;
    const v = winner.versions.find((x) => x.id === winner.currentVersionId) ?? winner.versions[0]!;
    return host.send([{ type: "item.addVersion", itemId: target.id, version: { id: newVersionId(), blobHash: v.blobHash, size: v.size, mimeType: v.mimeType, filename: v.filename } }]);
  };

  return (
    <section className="dc-tray" aria-label="Design competition">
      <header className="dc-tray-head">
        <button type="button" className="dc-quiet" aria-expanded={open} onClick={() => setOpen(!open)}>
          🥊 {title}
        </button>
        <span className="dc-tray-phase">
          {bout.phase === "building" ? `building${left ? ` · ${left}` : " · time"}` : bout.phase === "voting" ? (left ? `voting · ${left}` : "the bell has rung") : bout.phase === "decided" ? "decided" : "laid"}
        </span>
      </header>
      {open && (
        <div className="dc-tray-body">
          {(bout.phase === "laid" || bout.phase === "building") && (
            <>
              <ul className="dc-lanes">
                {bout.lanes.map((lane) => (
                  <li key={lane.area.id}>
                    <button type="button" className="dc-quiet" onClick={() => host.reveal([lane.area.id])}>
                      {lane.area.title}
                    </button>
                    <span>{laneState(canvas, bout, lane)}</span>
                  </li>
                ))}
              </ul>
              {bout.phase === "laid" && <p className="dc-note">Laid, not started — `isocan competition start` casts the fighters on your rc.</p>}
              {bout.phase === "building" && (
                <button type="button" className="dc-fight" onClick={() => void host.send(bellPlan(bout, new Date(), 5), newGroupId())}>
                  Ring the bell · 5 min vote
                </button>
              )}
            </>
          )}
          {bout.phase === "voting" && !tallyOpen && (
            <>
              <p className="dc-note">Rank by <i>which best answers the brief</i>. Not shown while voting — names and counts stay hidden until the bell.</p>
              <ul className="dc-ballot">
                {entries.map((entry) => {
                  const own = mine !== null && entry.properties["competition.fighter"] === mine.packId;
                  return (
                    <li key={entry.id}>
                      <button type="button" className="dc-quiet" onClick={() => host.reveal([entry.id])}>
                        {laneName(entry.properties["competition.fighter"])}
                      </button>
                      <span className="dc-marks">
                        {MEDALS.map((m) => (
                          <button
                            key={m}
                            type="button"
                            className={`dc-mark${(entry.reactions?.[m] ?? []).includes(me) ? " on" : ""}`}
                            disabled={own}
                            aria-pressed={(entry.reactions?.[m] ?? []).includes(me)}
                            title={own ? "a fighter never ranks its own entry" : `rank it ${m}`}
                            onClick={() => void medal(entry.id, m)}
                          >
                            {m}
                          </button>
                        ))}
                        <button
                          type="button"
                          className={`dc-mark${(entry.reactions?.[MISS] ?? []).includes(me) ? " on" : ""}`}
                          aria-pressed={(entry.reactions?.[MISS] ?? []).includes(me)}
                          title="misses the brief"
                          onClick={() => void toggle(entry.id, MISS, !(entry.reactions?.[MISS] ?? []).includes(me))}
                        >
                          {MISS}
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
              {entries.length === 0 && <p className="dc-note">No entry was handed in.</p>}
            </>
          )}
          {tally && (
            <>
              <table className="dc-tally">
                <thead>
                  <tr>
                    <th>Entry</th>
                    <th title="Borda from people">People</th>
                    <th title="Borda from agents — shown beside, never summed">Agents</th>
                    <th>🔴</th>
                    <th>{MISS}</th>
                  </tr>
                </thead>
                <tbody>
                  {tally.entries.map((row) => (
                    <tr key={row.entry.id} className={tally.decided?.id === row.entry.id ? "won" : undefined}>
                      <td>
                        {tally.decided?.id === row.entry.id ? `${TROPHY} ` : ""}
                        {laneName(row.packId)}
                      </td>
                      <td>{row.people}</td>
                      <td>{row.agents}</td>
                      <td>{row.dots}</td>
                      <td>{row.misses.people + row.misses.agents}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tally.dropped.length > 0 && <p className="dc-note">{tally.dropped.length} mark{tally.dropped.length === 1 ? "" : "s"} not counted — `isocan competition result` says why.</p>}
              {!tally.decided &&
                (decider ? (
                  <div className="dc-decide">
                    <span>Your call:</span>
                    {tally.entries.map((row) => (
                      <button key={row.entry.id} type="button" className="dc-quiet" onClick={() => void decide(row.entry.id)}>
                        {TROPHY} {laneName(row.packId)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="dc-note">Waiting for the Decider's 🏆.</p>
                ))}
              {tally.decided && (
                <div className="dc-result">
                  <span>
                    {TROPHY} <b>{laneName(tally.decided.properties["competition.fighter"])}</b> wins — the Decider's call.
                  </span>
                  {bout.target && canvas.items[bout.target] && (
                    // Taken already when the screen's current bytes ARE the
                    // winner's — a second press would stack an identical version.
                    currentHash(canvas.items[bout.target]!) === currentHash(tally.decided) ? (
                      <span className="dc-note">Taken onto #{canvas.items[bout.target]!.title}.</span>
                    ) : (
                      <button type="button" className="dc-quiet" onClick={() => void take()}>
                        Take it onto #{canvas.items[bout.target]!.title}
                      </button>
                    )
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

export const competitionWeb: WebModule<
  never,
  ComponentType<RendererFacts>,
  never,
  never,
  ComponentType<OverlayFacts>,
  ComponentType<DialogFacts>
> = {
  core: competitionCore,
  renderers: [{ mimes: [FIGHTER_MIME], component: FighterCard }],
  actions: [{ id: "design-competition", name: "Start a design competition", hint: "choose your fighters — rival designers, one brief, a vote", opens: "fighters" }],
  dialogs: [{ id: "fighters", title: "Choose your fighter", wide: true, component: FighterPicker }],
  overlays: [{ region: "right", label: "Design competition", component: BoutTray }],
};

export default competitionWeb;
