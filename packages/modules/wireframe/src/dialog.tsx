import { useEffect, useRef, useState } from "react";
import { newGroupId, type DialogFacts, type DialogHost } from "@isocan/core";
import { isNoJudge } from "./answerer.ts";
import { composeFlow, costLine, wiresOn } from "./flow.ts";
import { keptFlowsOf, writePrototype, type KeptFlow } from "./kept-flows.ts";
import { StyleResolver, restyle, restyleSummary } from "./restyle.ts";
import { webAnswerer, webPort } from "./web-port.ts";

/**
 * **The Wireframes dialog** — `/wire` on the web (phase 5, journey scenes
 * 1, 5 and 6 from the canvas itself).
 *
 * `/wire <request>` composes at once: the request's blueprint lands, the
 * dialog closes onto it, and the rounds fill it in place while the person
 * watches — the same `composeFlow` the CLI runs, over the dialog's host, with
 * the home's judge answering (the key never reaches the browser). How it
 * went arrives in the notice bar, because the dialog is gone by then.
 * `/wire prototype` and `/wire style [--default]` run the CLI's own
 * `writePrototype` and `restyle`. `/wire` alone asks what to do.
 */

type Mode = { kind: "form" } | { kind: "compose"; request: string } | { kind: "prototype" } | { kind: "style"; toDefault: boolean };

export function modeOf(args: string): Mode {
  const words = args.trim();
  if (!words) return { kind: "form" };
  const [first, ...rest] = words.split(/\s+/);
  if (first === "prototype" && rest.length === 0) return { kind: "prototype" };
  if (first === "style" && rest.every((w) => w === "--default" || w === "default")) return { kind: "style", toDefault: rest.length > 0 };
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
  return { flows, written: await writePrototype(port, canvas, chosen, newGroupId()) };
}

export async function restyleOnWeb(canvasId: string, host: DialogHost, toDefault: boolean) {
  const port = webPort(canvasId, host);
  const canvas = await port.canvas();
  const all = await wiresOn(port, canvas);
  if (all.length === 0) throw new Error("There are no wireframes on this canvas yet — `/wire <what the screens are for>` composes some.");
  const resolver = new StyleResolver(port, webAnswerer(canvasId, host), async () => all.map((s) => s.spec));
  return restyle(port, canvas, all, all, resolver, { toDefault });
}

export function WireDialog({ canvasId, args, canEdit, host }: DialogFacts) {
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
    host.notice(`Prototype ${what === "added" ? "added beside the kept screens" : what === "versioned" ? "rebuilt as a new version" : "unchanged — nothing kept has changed"} · ${links.length} links${dashed ? `, ${dashed} dashed` : ""}`);
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
      host.notice(`${costLine(composed.tallies, composed.by, composed.screens.length)} — one undo takes the whole flow back`);
      host.reveal([...composed.screens, ...composed.variants].map((s) => s.item));
    } else if (m.kind === "prototype") {
      await runPrototype();
    } else if (m.kind === "style") {
      setStatus(m.toDefault ? "Back to the default look…" : "Mapping the design system onto the wires…");
      const r = await restyleOnWeb(canvasId, host, m.toDefault);
      host.notice(restyleSummary(r));
      host.close();
      if (r.changed.length) host.reveal(r.changed.map((t) => t.item.id));
    }
  };

  useEffect(() => {
    if (started.current || !canEdit || mode.kind === "form") return;
    started.current = true;
    run(mode).catch(fail);
    // One run per opening: the mode is fixed once it starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
