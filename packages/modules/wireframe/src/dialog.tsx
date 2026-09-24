import { useEffect, useRef, useState } from "react";
import { newGroupId, type CanvasContents, type DialogFacts, type DialogHost, type Item } from "@isocan/core";
import { chatRecordOp } from "./chat.ts";
import { PROTOTYPE_PROP } from "./prototype.ts";
import { rerender, rerenderSummary } from "./rerender.ts";
import { isNoJudge } from "./answerer.ts";
import { composeFlow, costLine, wiresOn } from "./flow.ts";
import { keptFlowsOf, writePrototype, type KeptFlow } from "./kept-flows.ts";
import { StyleResolver, restyle, restyleSummary } from "./restyle.ts";
import { flesh, fleshLines, fleshSummary } from "./flesh.ts";
import { webAnswerer, webPort } from "./web-port.ts";
// ── phase 8, builder A: /wire links ──
import { WireLinks } from "./links-panel.tsx";

/**
 * **The Wireframes dialog** — `/wire` on the web (phase 5, journey scenes
 * 1, 5 and 6 from the canvas itself).
 *
 * `/wire <request>` composes at once: the request's blueprint lands, the
 * dialog closes onto it, and the rounds fill it in place while the person
 * watches — the same `composeFlow` the CLI runs, over the dialog's host, with
 * the home's judge answering (the key never reaches the browser). How it
 * went arrives in the notice bar, because the dialog is gone by then.
 * `/wire prototype`, `/wire style [--default]` and `/wire flesh [--pack
 * <id>|--bars]` run the CLI's own `writePrototype`, `restyle` and `flesh`.
 * `/wire` alone asks what to do.
 */

type Mode =
  | { kind: "form" }
  | { kind: "compose"; request: string }
  | { kind: "prototype" }
  | { kind: "style"; toDefault: boolean }
  | { kind: "flesh"; pack?: string; bars: boolean }
  | { kind: "rerender" }
  | { kind: "prototypes" }
  // ── phase 8, builder A: /wire links — every hotspot with a target picker (links-panel.tsx) ──
  | { kind: "links" };

export function modeOf(args: string): Mode {
  const words = args.trim();
  if (!words) return { kind: "form" };
  const [first, ...rest] = words.split(/\s+/);
  if (first === "prototype" && rest.length === 0) return { kind: "prototype" };
  if (first === "prototypes" && rest.length === 0) return { kind: "prototypes" };
  if (first === "rerender" && rest.length === 0) return { kind: "rerender" };
  // ── phase 8, builder A: /wire links ──
  if (first === "links" && rest.length === 0) return { kind: "links" };
  if (first === "style" && rest.every((w) => w === "--default" || w === "default")) return { kind: "style", toDefault: rest.length > 0 };
  if (first === "flesh") {
    const bars = rest.length === 1 && (rest[0] === "--bars" || rest[0] === "bars");
    const pack = rest.length === 2 && rest[0] === "--pack" ? rest[1] : rest.length === 1 && !bars && !rest[0]!.startsWith("-") ? rest[0] : undefined;
    if (rest.length === 0 || bars || pack !== undefined) return { kind: "flesh", bars, ...(pack !== undefined ? { pack } : {}) };
  }
  return { kind: "compose", request: words };
}

/** A refusal in words a person can act on. */
export function refusalWords(error: unknown): string {
  if (isNoJudge(error)) return "This home has no judge (no TYPESAFE_API_KEY), so nothing can be composed from here. The blueprint is waiting on round 1: an agent can answer it with `isocan wire questions` / `isocan wire answer`.";
  return (error as Error)?.message ?? String(error);
}

/**
 * `/wire <request>`, whole — exported so a test can hold the web's ops to the
 * CLI's. Resolves when the flow is drawn; `onBlueprint` fires once the first
 * frame is on the canvas, before any answer.
 */
export async function composeOnWeb(canvasId: string, host: DialogHost, request: string, onBlueprint: (itemId: string) => void) {
  const port = webPort(canvasId, host);
  return composeFlow(port, request, webAnswerer(canvasId, host), { onBlueprint: (first) => onBlueprint(first.item) });
}

export async function prototypeOnWeb(canvasId: string, host: DialogHost, flow?: KeptFlow) {
  const port = webPort(canvasId, host);
  const canvas = await port.canvas();
  const flows = keptFlowsOf(canvas, await wiresOn(port, canvas));
  const chosen = flow ?? (flows.length === 1 ? flows[0]! : null);
  if (!chosen) return { flows };
  const group = newGroupId();
  return { flows, flow: chosen, group, written: await writePrototype(port, canvas, chosen, group) };
}

/** `/wire rerender` — every wire drawn again from its spec (phase 8): a renderer change reaching screens already here. */
export async function rerenderOnWeb(canvasId: string, host: DialogHost) {
  const port = webPort(canvasId, host);
  const canvas = await port.canvas();
  const all = await wiresOn(port, canvas);
  if (all.length === 0) throw new Error("There are no wireframes on this canvas yet — `/wire <what the screens are for>` composes some.");
  return rerender(port, canvas, all, all);
}

/** The prototypes on the canvas — `/wire prototypes` and ⌘K's "Find prototypes". */
export function prototypesOn(canvas: CanvasContents): Item[] {
  return Object.values(canvas.items ?? {}).filter((i) => i.properties?.[PROTOTYPE_PROP] !== undefined);
}

/**
 * Say what an act made in the Chat, in the act's own op group (`chat.ts`). A
 * record that cannot be posted (a dropped connection) is not a failed act:
 * the act landed, and the notice bar already said so.
 */
function record(host: DialogHost, group: string, lines: readonly string[], items: readonly string[] = []): void {
  host.send([chatRecordOp(host.getCanvas(), lines, items)], group).catch(() => {});
}

export async function restyleOnWeb(canvasId: string, host: DialogHost, toDefault: boolean) {
  const port = webPort(canvasId, host);
  const canvas = await port.canvas();
  const all = await wiresOn(port, canvas);
  if (all.length === 0) throw new Error("There are no wireframes on this canvas yet — `/wire <what the screens are for>` composes some.");
  const resolver = new StyleResolver(port, webAnswerer(canvasId, host), async () => all.map((s) => s.spec));
  return restyle(port, canvas, all, all, resolver, { toDefault });
}

/** `/wire flesh` — every wire on the canvas, with the home's judge choosing the pack. */
export async function fleshOnWeb(canvasId: string, host: DialogHost, opts: { pack?: string; bars: boolean }) {
  const port = webPort(canvasId, host);
  const canvas = await port.canvas();
  const all = await wiresOn(port, canvas);
  if (all.length === 0) throw new Error("There are no wireframes on this canvas yet — `/wire <what the screens are for>` composes some.");
  return flesh(port, canvas, all, all, webAnswerer(canvasId, host), { ...(opts.pack !== undefined ? { pack: opts.pack } : {}), bars: opts.bars });
}

export function WireDialog({ canvasId, args, canEdit, host, selection }: DialogFacts) {
  const [mode, setMode] = useState<Mode>(() => modeOf(args));
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choices, setChoices] = useState<KeptFlow[] | null>(null);
  const started = useRef(false);
  const open = useRef(true);
  useEffect(() => () => {
    open.current = false;
  }, []);

  const fail = (e: unknown) => {
    const words = refusalWords(e);
    if (open.current) {
      setError(words);
      setStatus(null);
    } else host.notice(words, true);
  };

  const runPrototype = async (flow?: KeptFlow) => {
    setStatus("Assembling the kept screens…");
    const result = await prototypeOnWeb(canvasId, host, flow);
    if (!result.written) {
      if (result.flows.length === 0) throw new Error("Nothing is kept yet — mark the screens the prototype should play with 📐 (⇧K, or Keep in the item's menu).");
      setChoices(result.flows);
      setStatus(null);
      return;
    }
    const { itemId, links, what } = result.written;
    const dashed = links.filter((l) => l.to === null && l.needs).length;
    const said = `Prototype ${what === "added" ? "added beside the kept screens" : what === "versioned" ? "rebuilt as a new version" : "unchanged — nothing kept has changed"} · ${links.length} links${dashed ? `, ${dashed} dashed` : ""}`;
    host.notice(said);
    if (what !== "unchanged") record(host, result.group!, [`${said}. It plays ${result.flow!.screens.length} screens: ${result.flow!.screens.map((s) => s.title).join(" · ")}.`], [itemId]);
    host.close();
    host.reveal([itemId]);
  };

  const run = async (m: Mode) => {
    setError(null);
    if (m.kind === "compose") {
      setStatus("Drawing the blueprint…");
      const composed = await composeOnWeb(canvasId, host, m.request, (itemId) => {
        host.reveal([itemId]);
        host.close();
      });
      const cost = costLine(composed.tallies, composed.by, composed.screens.length);
      host.notice(`${cost} — one undo takes the whole flow back`);
      const made = composed.variants.length ? `, and ${composed.variants.length} variation${composed.variants.length === 1 ? "" : "s"}` : "";
      record(host, composed.flow, [`composed "${m.request}": ${composed.screens.map((s) => s.spec.title).join(" · ")}${made}.`, `${cost} — one undo takes the whole flow back.`], composed.screens.map((s) => s.item));
      host.reveal([...composed.screens, ...composed.variants].map((s) => s.item));
    } else if (m.kind === "prototype") {
      await runPrototype();
    } else if (m.kind === "style") {
      setStatus(m.toDefault ? "Back to the default look…" : "Mapping the design system onto the wires…");
      const r = await restyleOnWeb(canvasId, host, m.toDefault);
      host.notice(restyleSummary(r));
      if (r.changed.length) record(host, r.group, [`${m.toDefault ? "back to the default look" : "restyled in the design system that governs each wire"}: ${restyleSummary(r)}.`]);
      host.close();
      if (r.changed.length) host.reveal(r.changed.map((t) => t.item.id));
    } else if (m.kind === "flesh") {
      setStatus(m.bars ? "Back to bars…" : "Choosing sample content…");
      const r = await fleshOnWeb(canvasId, host, m);
      host.notice([...fleshLines(r).slice(0, 1), fleshSummary(r, m.bars)].join(" · "));
      if (r.changed.length) record(host, r.group, [...fleshLines(r), `${fleshSummary(r, m.bars)}.`]);
      host.close();
      if (r.changed.length) host.reveal(r.changed.map((t) => t.screen.item));
    } else if (m.kind === "rerender") {
      setStatus("Drawing every wire again from its spec…");
      const r = await rerenderOnWeb(canvasId, host);
      host.notice(rerenderSummary(r));
      if (r.changed.length) record(host, r.group, [`re-rendered from their specs: ${rerenderSummary(r)}.`]);
      host.close();
    }
  };

  useEffect(() => {
    // ── phase 8, builder A: /wire links is a panel, not a run ──
    if (started.current || !canEdit || mode.kind === "form" || mode.kind === "prototypes" || mode.kind === "links") return;
    started.current = true;
    run(mode).catch(fail);
    // One run per opening: the mode is fixed once it starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Finding the prototypes writes nothing, so somebody reading the canvas may do it too.
  if (mode.kind === "prototypes") return <PrototypeFinder host={host} />;
  // ── phase 8, builder A: /wire links — a reader sees the table, its pickers disabled ──
  if (mode.kind === "links") return <WireLinks canvasId={canvasId} host={host} selection={selection} canEdit={canEdit} />;
  if (!canEdit) return <p className="wire-note">You are reading this canvas — wireframes are composed by someone who can edit it.</p>;

  const go = (m: Mode) => {
    setMode(m);
    started.current = true;
    run(m).catch(fail);
  };

  return (
    <div className="wire-dialog">
      {mode.kind === "form" && !status && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) go({ kind: "compose", request: draft.trim() });
          }}
        >
          <label className="wire-label" htmlFor="wire-request">What are the screens for?</label>
          <textarea
            id="wire-request"
            className="text-input wire-request"
            rows={3}
            placeholder="a stock-receiving app for warehouse staff — sign in, scan deliveries, see what's outstanding"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="wire-actions">
            <button className="btn primary" type="submit" disabled={!draft.trim()}>Compose</button>
            <button className="btn" type="button" onClick={() => go({ kind: "prototype" })}>Make prototype</button>
            <button className="btn" type="button" onClick={() => go({ kind: "style", toDefault: false })}>Restyle wires</button>
            <button className="btn" type="button" onClick={() => go({ kind: "style", toDefault: true })}>Default look</button>
            <button className="btn" type="button" onClick={() => go({ kind: "flesh", bars: false })}>Flesh out</button>
            <button className="btn" type="button" onClick={() => go({ kind: "rerender" })}>Re-render</button>
            {/* ── phase 8, builder A: /wire links ── */}
            <button className="btn" type="button" onClick={() => setMode({ kind: "links" })}>Links…</button>
          </div>
          <p className="wire-note">Blueprints land at once and fill in place; one undo takes a flow back. Also from a terminal: <code>isocan wire</code>.</p>
        </form>
      )}
      {choices && (
        <div className="wire-actions" role="group" aria-label="Which flow">
          <p className="wire-note">Kept screens come from {choices.length} flows — which one should the prototype play?</p>
          {choices.map((f) => (
            <button key={f.flow} className="btn" type="button" onClick={() => { setChoices(null); runPrototype(f).catch(fail); }}>
              {f.request || "hand-drawn screens"} ({f.screens.length} kept)
            </button>
          ))}
        </div>
      )}
      {status && <p className="wire-status" role="status">{status}</p>}
      {error && <p className="wire-error" role="alert">{error}</p>}
    </div>
  );
}

/**
 * **Finding the prototypes on a busy canvas** (phase 8, part C) — `/wire
 * prototypes`, and ⌘K's *Find prototypes*. Each by its title; *Show* selects
 * it and glides to it, *Select all* lights every one at once. A selection is
 * the canvas's strongest highlight and it is one person's own, so nothing is
 * written.
 */
function PrototypeFinder({ host }: { host: DialogHost }) {
  const found = prototypesOn(host.getCanvas());
  const show = (ids: string[]) => {
    host.select(ids);
    host.reveal(ids);
    host.close();
  };
  if (found.length === 0) return <p className="wire-note">No prototypes on this canvas yet — keep some screens (📐) and <code>/wire prototype</code> assembles one.</p>;
  return (
    <div className="wire-dialog">
      <p className="wire-note">{found.length} prototype{found.length === 1 ? "" : "s"} on this canvas — each plays one flow&rsquo;s kept screens.</p>
      <ul className="wire-list">
        {found.map((p) => (
          <li key={p.id}>
            <span>{p.title}</span>
            <button className="btn" type="button" onClick={() => show([p.id])}>Show</button>
          </li>
        ))}
      </ul>
      {found.length > 1 && (
        <div className="wire-actions">
          <button className="btn primary" type="button" onClick={() => show(found.map((p) => p.id))}>Select all {found.length}</button>
        </div>
      )}
    </div>
  );
}
