import { useEffect, useState } from "react";
import { newGroupId, type CanvasContents, type DialogHost } from "@isocan/core";
import { wiresOn } from "./flow.ts";
import { keptFlowsOf, type KeptFlow } from "./kept-flows.ts";
import { linkOverrideOp, overrideValue, type ArrowWrite } from "./link-override.ts";
import { LINK_BACK, LINK_NONE, inferLinks, type WireLink } from "./links.ts";
import { webPort } from "./web-port.ts";

/**
 * **`/wire links` — every hotspot, with a target picker** (phase 8; research
 * *Flow arrows* §3, "Keyboard"). The list-shaped door to what the arrows on
 * the canvas do: a spatial graph never fully works for a keyboard or a screen
 * reader, and a table does. It is `isocan wire links` on the web — the same
 * `inferLinks`, grouped by the same `keptFlowsOf` — and each picker writes
 * the one op `isocan wire link` sends (`link-override.ts`), through the
 * dialog's own `host.send`.
 *
 * With a kept screen selected it shows that screen's hotspots; otherwise
 * every kept flow's.
 */

export interface LinkRow {
  flow: string;
  link: WireLink;
  /** The picker's value: "" while the rules decide, else the override (`back`, `none`, a screen id). */
  value: string;
  /** What the rules alone would say — the "" option's words. */
  rules: string;
}

/** The rows `/wire links` shows, for the given kept flows — pure, so a test can hold them to `wire links`. */
export function linkRows(flows: readonly KeptFlow[], only: ReadonlySet<string> | null = null): LinkRow[] {
  const rows: LinkRow[] = [];
  for (const flow of flows) {
    const title = (id: string) => flow.screens.find((s) => s.id === id)?.title ?? id;
    const bare = inferLinks(flow.screens.map((s) => ({ ...s, overrides: {} })));
    const where = (l: WireLink | undefined) => (!l ? "nowhere" : l.to === LINK_BACK ? "back" : l.to ? title(l.to) : l.needs ? `needs ${l.needs}` : "nowhere");
    for (const l of inferLinks(flow.screens, { withNone: true })) {
      if (only && !only.has(l.from)) continue;
      const override = flow.screens.find((s) => s.id === l.from)?.overrides?.[l.key];
      rows.push({ flow: flow.flow, link: l, value: override ?? "", rules: where(bare.find((b) => b.from === l.from && b.key === l.key)) });
    }
  }
  return rows;
}

/** A picker's value as the write it asks for. */
export function pickedWrite(value: string): ArrowWrite {
  if (value === "") return { kind: "reset" };
  if (value === LINK_BACK) return { kind: "back" };
  if (value === LINK_NONE) return { kind: "remove" };
  return { kind: "retarget", to: value };
}

export function WireLinks({ canvasId, host, selection, canEdit }: { canvasId: string; host: DialogHost; selection: readonly string[]; canEdit: boolean }) {
  const [flows, setFlows] = useState<KeptFlow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let live = true;
    const port = webPort(canvasId, host);
    const canvas: CanvasContents = host.getCanvas();
    wiresOn(port, canvas)
      .then((wires) => live && setFlows(keptFlowsOf(canvas, wires)))
      .catch((e: unknown) => live && setError((e as Error)?.message ?? String(e)));
    return () => {
      live = false;
    };
  }, [canvasId, host, round]);

  if (error) return <p className="wire-error" role="alert">{error}</p>;
  if (!flows) return <p className="wire-status" role="status">Reading the kept screens…</p>;
  if (flows.length === 0) return <p className="wire-note">Nothing is kept yet — mark the screens a prototype should play with 📐 (⇧K), and their links show here.</p>;

  const picked = new Set(selection.filter((id) => flows.some((f) => f.screens.some((s) => s.id === id))));
  const rows = linkRows(flows, picked.size ? picked : null);

  const change = async (row: LinkRow, value: string) => {
    const item = host.getCanvas().items[row.link.from];
    if (!item) return;
    await host.send([linkOverrideOp(item, row.link.key, overrideValue(pickedWrite(value)))], newGroupId());
    const screen = item.title;
    const to = value === "" ? `back to the rules (${row.rules})` : value === LINK_BACK ? "goes back" : value === LINK_NONE ? "switched off" : `goes to "${host.getCanvas().items[value]?.title ?? value}"`;
    setSaid(`${row.link.label} on "${screen}" ${to} · undo takes it back`);
    setRound((n) => n + 1);
  };

  return (
    <div className="wire-links">
      {flows.map((flow) => {
        const mine = rows.filter((r) => r.flow === flow.flow);
        if (mine.length === 0) return null;
        return (
          <table key={flow.flow} className="wire-links-table">
            <caption>{flow.request || "Hand-drawn screens"} — {mine.length} hotspot{mine.length === 1 ? "" : "s"}</caption>
            <thead>
              <tr><th scope="col">Screen</th><th scope="col">Hotspot</th><th scope="col">Goes to</th></tr>
            </thead>
            <tbody>
              {mine.map((row) => {
                const from = flow.screens.find((s) => s.id === row.link.from);
                const id = `wire-link-${row.link.from}-${row.link.key}`.replace(/[^A-Za-z0-9_-]/g, "-");
                return (
                  <tr key={`${row.link.from}|${row.link.key}`}>
                    <td>{from?.title}</td>
                    <td><label htmlFor={id}>{row.link.label}</label> <code>{row.link.key}</code></td>
                    <td>
                      <select id={id} value={row.value} disabled={!canEdit} onChange={(e) => change(row, e.target.value).catch((err: unknown) => setError((err as Error)?.message ?? String(err)))}>
                        <option value="">Rules: {row.rules}</option>
                        {flow.screens.filter((s) => s.id !== row.link.from).map((s) => (
                          <option key={s.id} value={s.id}>{s.title}</option>
                        ))}
                        {row.value !== "" && row.value !== LINK_BACK && row.value !== LINK_NONE && !flow.screens.some((s) => s.id === row.value) && (
                          <option value={row.value}>A screen that is not kept ({row.value})</option>
                        )}
                        <option value={LINK_BACK}>Back</option>
                        <option value={LINK_NONE}>Nowhere</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        );
      })}
      {said && <p className="wire-status" role="status">{said}</p>}
      <p className="wire-note">One row per hotspot — the arrows on the canvas are the rows that go to a screen. Also from a terminal: <code>isocan wire links</code> and <code>isocan wire link</code>.</p>
    </div>
  );
}
