import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Actor, Item } from "@isocan/core";
import { newGroupId } from "@isocan/core";
import {
  RIPPLE_PROP,
  readBackOf,
  rippleAsk,
  rippleAsked,
  rippleAt,
  rippleRead,
  rippleRun,
  rippleSections,
  rippleVersions,
  systemAsk,
  systemAsked,
  type RippleChange,
  type RippleRead,
} from "@isocan/core/ripple";
import { canEditNow } from "../lib/capability.ts";
import { readRippleTexts, rippleText } from "../lib/rippletexts.ts";
import { revealItem } from "../lib/zoomactions.ts";
import { flashNotice, sendEchoed, setNotice, useCanvasStore } from "../stores/canvasStore.ts";
import "./ripple.css";

/**
 * **Changes ripple** (proactive-agent phase 6, design §8) — a panel beside
 * the live canvas, as Explain's is: the canvas stays put and Escape closes it.
 * Opened from the pulse strip, the item menu (**Ripple…**) and ⌘K, and loaded
 * on that click.
 *
 * Everything it says is core's (`rippleRead`, `rippleSections`) — what
 * `isocan ripple <item>` prints: the lead's read-back (or why it waits), what
 * changed, every screen that uses it in one of three states, the altitudes,
 * and the sketch, set apart. A screen that would change shows the lead's
 * preview, drawn with the changed regions outlined and tagged, and **Keep**.
 *
 * **It writes nothing until the person acts**: **Keep** (`choose`) on a
 * preview; **Ripple this** ("I like this") and **Put it in the design
 * system**, ordinary summonses to the lead; **This one is a one-off**, the
 * source's `ripple=off` with its open previews cleared, in one undo.
 * **Screen by screen** is the default and writes nothing at all.
 */
interface RippleRequest {
  canvasId: string;
  actor: Actor;
  itemId: string;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

/** Open the panel for one source screen — the strip's, the menu's and the palette's door. */
export function openRipple(request: RippleRequest): void {
  if (!host) {
    host = document.createElement("div");
    host.dataset.rippleHost = "";
    document.body.appendChild(host);
    root = createRoot(host);
  }
  root!.render(<RipplePanel key={request.itemId} {...request} onClose={closeRipple} />);
}

function closeRipple(): void {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
}

/**
 * The frame's half of "outlined and tagged": inside the preview, every
 * element painted with a changed token's or value's new form, or holding a
 * changed term's new words, gets a dashed outline and the change's tag. Read
 * from computed styles, so a token set on `:root` marks what it paints — the
 * diff's own marks skip `:root`, which would leave a token change unmarked.
 */
function markedPreview(html: string, changes: RippleChange[]): string {
  const want = changes.map((c) => ({ kind: c.kind, name: c.name, after: c.after, tag: c.tag.length > 40 ? `${c.tag.slice(0, 39)}…` : c.tag }));
  const script = `(function(){var W=${JSON.stringify(want).replace(/</g, "\\u003c")};var probe=document.createElement("i");document.body.appendChild(probe);function css(p,v){probe.style.cssText="";probe.style.setProperty(p,v);return getComputedStyle(probe).getPropertyValue(p)}var props=["color","background-color","border-top-color"];var marked=0;var all=document.body.querySelectorAll("*");for(var i=0;i<all.length&&marked<24;i++){var el=all[i];if(el===probe)continue;var cs=getComputedStyle(el);for(var j=0;j<W.length;j++){var w=W[j];var hit=false;if(w.kind==="token"){var c=css("color",w.after[0]);hit=props.some(function(p){return cs.getPropertyValue(p)===c})}else if(w.kind==="value"){hit=w.after.some(function(v){return cs.getPropertyValue(w.name)===css(w.name,v)})}else{var own="";for(var k=0;k<el.childNodes.length;k++)if(el.childNodes[k].nodeType===3)own+=el.childNodes[k].textContent;own=own.toLowerCase();hit=w.after.every(function(t){return own.indexOf(t)>=0})}if(hit){el.setAttribute("data-ripple-tag",w.tag);marked++;break}}}probe.remove();parent.postMessage({rippleMarked:marked},"*")})();`;
  const extra = `<style data-ripple>[data-ripple-tag]{outline:2px dashed #2563eb!important;outline-offset:2px;position:relative}[data-ripple-tag]::after{content:attr(data-ripple-tag);position:absolute;left:0;top:-16px;z-index:9;font:600 10px/14px system-ui;background:#2563eb;color:#fff;padding:0 4px;border-radius:3px;white-space:nowrap;pointer-events:none}</style><script data-ripple>addEventListener("load",function(){${script}})</script>`;
  const close = html.toLowerCase().lastIndexOf("</body>");
  return close < 0 ? `${html}${extra}` : `${html.slice(0, close)}${extra}${html.slice(close)}`;
}

const SCALE = 0.4;

function Preview({ item, changes }: { item: Item; changes: RippleChange[] }) {
  const version = item.versions.find((v) => v.id === item.currentVersionId);
  const html = version && rippleText(version);
  const frame = useRef<HTMLIFrameElement>(null);
  // How many regions the frame outlined, as it says back — its origin is opaque, so it is told, not read.
  const [marked, setMarked] = useState<number | null>(null);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source && e.source === frame.current?.contentWindow && typeof e.data?.rippleMarked === "number") setMarked(e.data.rippleMarked);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  if (!html) return <p className="ripple-quiet">Loading the preview…</p>;
  return <div className="ripple-preview" data-ripple-marked={marked ?? undefined} style={{ width: item.width * SCALE, height: item.height * SCALE }}>
    {/* An opaque origin: the preview's own scripts and the marking script run with no cookie and no API. */}
    <iframe ref={frame} title={`Preview of ${item.title}`} sandbox="allow-scripts" srcDoc={markedPreview(html, changes)} style={{ width: item.width, height: item.height, transform: `scale(${SCALE})` }} />
  </div>;
}

function RipplePanel({ canvasId, actor, itemId, onClose }: RippleRequest & { onClose: () => void }) {
  const canvas = useCanvasStore((s) => s.canvas);
  const [, setLoaded] = useState(0);
  const [lead, setLead] = useState<{ lead: Actor | null; cannot: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const canEdit = canEditNow();

  const run = useMemo(() => (canvas ? rippleRun(canvas, itemId, Date.now(), true) : null), [canvas, itemId]);
  const back = canvas && run ? readBackOf(canvas, rippleAt(run)) : null;
  const read: RippleRead | null = canvas && run ? rippleRead(canvas, run, rippleText, back?.exceptions ?? []) : null;

  // Every version the read and its previews need: the run, the screens, and each preview.
  const previewItems = canvas && read ? read.screens.flatMap((s) => (s.previewId && canvas.items[s.previewId] ? [canvas.items[s.previewId]!] : [])) : [];
  const versions = canvas && run ? [...rippleVersions(canvas, [run]), ...previewItems.flatMap((p) => p.versions.filter((v) => v.id === p.currentVersionId))] : [];
  const key = versions.map((v) => v.blobHash).join(",");
  useEffect(() => {
    if (!key) return;
    let live = true;
    void readRippleTexts(canvasId, versions).then((any) => live && any && setLoaded((n) => n + 1));
    return () => { live = false; };
    // `key` names exactly the versions; the array itself is rebuilt each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId, key]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector(".palette, .context-menu, [aria-modal=true]")) return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  // Who would read it back: the night watch's own reading of the lead.
  useEffect(() => {
    let live = true;
    void import("../lib/goodnight.ts")
      .then((m) => m.goodnightLead(canvasId, actor.id))
      .then((found) => live && setLead({ lead: found.lead, cannot: found.cannot?.replace(" to work overnight", "") ?? null }))
      .catch(() => live && setLead({ lead: null, cannot: "the canvas's agents could not be read" }));
    return () => { live = false; };
  }, [canvasId, actor.id]);

  const shell = (body: ReactNode) => <aside className="ripple-panel" data-ripple-panel={itemId} aria-label="Ripple">
    <button className="ripple-close" aria-label="Close" onClick={onClose}>✕</button>
    {body}
  </aside>;
  if (!canvas || !run) return shell(<p className="ripple-quiet">{canvas ? "This screen has no run of edits to ripple: it ripples after somebody edits it, and its newest version is the one showing." : "The canvas is not loaded."}</p>);
  if (!read) return shell(<><h3>Ripple from “{run.title}”</h3><p className="ripple-quiet">Reading the screens…</p></>);

  const asked = rippleAsked(canvas, read.at);
  const waits = back || asked ? null : lead?.cannot ?? (lead ? "nobody has asked the lead yet — press Ripple this" : "finding the canvas's lead…");
  const sections = rippleSections(read, back, waits);
  const changesOf = (tags: string[]) => read.changes.filter((c) => tags.includes(c.tag));
  const source = canvas.items[itemId];
  const off = source?.properties[RIPPLE_PROP] === "off";
  const toSystem = systemAsked(canvas, read.at);

  const ask = async (body: string, said: string) => {
    setBusy(true);
    const { postToMain } = await import("../lib/mainthread.ts");
    const sent = await postToMain(canvasId, actor, body, [read.source.itemId]).catch((e: Error) => ({ status: "refused" as const, message: e.message }));
    setBusy(false);
    if (sent.status === "refused") setNotice(sent.message ?? "the Chat refused the message");
    else flashNotice(said);
  };
  const oneOff = async () => {
    setBusy(true);
    const group = newGroupId();
    try {
      await sendEchoed(canvasId, actor, { type: "item.update", itemId, patch: { properties: { [RIPPLE_PROP]: "off" } } }, group);
      const open = read.screens.flatMap((s) => (s.previewId ? [s.previewId] : []));
      if (open.length) await sendEchoed(canvasId, actor, { type: "items.delete", itemIds: open }, group);
      flashNotice(`“${read.source.title}” is a one-off — undo takes it back`);
    } catch (e) {
      setNotice(`Not marked: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  const keep = (previewId: string) => void import("../lib/choose.ts").then((m) => m.chooseVariation(canvasId, actor, previewId));

  const r = read.run;
  return shell(<>
    <h3>Ripple from “{read.source.title}”</h3>
    <p className="ripple-quiet">{r.by.name}'s run, {r.edits} edit{r.edits === 1 ? "" : "s"} · {r.settled ? "settled" : "settling"} · nothing changes until you keep something</p>
    {sections.map((s) => {
      if (s.key === "altitude") {
        return <section key={s.key} data-ripple-section="altitude">
          <h4>{s.heading}</h4>
          <div className="ripple-altitude" role="group" aria-label="Where it goes">
            <button className={`btn secondary${!off && !toSystem ? " active" : ""}`} aria-pressed={!off && !toSystem} data-ripple-altitude="screens" disabled>Screen by screen</button>
            <button className={`btn secondary${toSystem ? " active" : ""}`} aria-pressed={toSystem} data-ripple-altitude="system" disabled={!canEdit || busy || toSystem || !lead?.lead || Boolean(lead.cannot)} onClick={() => lead?.lead && void ask(systemAsk(lead.lead, read), `Asked ${lead.lead.name} to put it in the design system`)}>Put it in the design system</button>
            <button className={`btn secondary${off ? " active" : ""}`} aria-pressed={off} data-ripple-altitude="one-off" disabled={!canEdit || busy || off} onClick={() => void oneOff()}>This one is a one-off</button>
          </div>
          <ul className="ripple-list">{s.lines.map((l, i) => <li key={i}>{l.text}</li>)}</ul>
        </section>;
      }
      if (s.key === "sketch") {
        return <aside key={s.key} className="ripple-sketch" data-ripple-section="sketch"><h4>{s.heading}</h4><p>{s.lines[0]?.text}</p></aside>;
      }
      if (!s.lines.length) return null;
      return <section key={s.key} data-ripple-section={s.key}>
        <h4>{s.heading}</h4>
        <ul className="ripple-list">
          {s.lines.map((l, i) => {
            const row = l.itemId ? read.screens.find((x) => x.itemId === l.itemId) : undefined;
            const preview = l.previewId ? canvas.items[l.previewId] : undefined;
            return <li key={i} data-ripple-screen={l.itemId} data-state={row?.state}>
              {s.key === "changes" ? <span className="ripple-tag">{l.text}</span> : l.text}
              {l.itemId && <> <button className="ripple-link" onClick={() => revealItem(l.itemId!)}>Show</button></>}
              {preview && row && <div className="ripple-previewed" data-ripple-preview={preview.id}>
                <Preview item={preview} changes={changesOf(row.would)} />
                <div className="ripple-tags">{row.would.map((t) => <span key={t} className="ripple-tag">{t}</span>)}</div>
                {canEdit && <button className="btn secondary" data-ripple-keep={preview.id} onClick={() => keep(preview.id)}>Keep</button>}
              </div>}
            </li>;
          })}
        </ul>
      </section>;
    })}
    {canEdit && !back && !asked && !read.off && <footer className="ripple-acts">
      <button className="btn secondary" data-ripple-ask disabled={busy || !lead?.lead || Boolean(lead.cannot)} onClick={() => lead?.lead && void ask(rippleAsk(lead.lead, read), `Asked ${lead.lead.name} to read it back`)}>Ripple this</button>
    </footer>}
  </>);
}
