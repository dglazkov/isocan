/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { newCommentId, newThreadId, type LocalToolDoor, type ModuleCommentFacts, type ModuleMenuRow, type OverlayFacts, type RendererFacts } from "@isocan/core";
import { EXACT_PROPS, appIdOf, parsePoints, parseSource, pointAt, selectionSummary, sourceLine, sourcePlace, type ExactSource } from "./core.ts";

/**
 * **Live frames and pointing** (exact phase 2; design §5, §6), the browser
 * half.
 *
 * A screen is an ordinary PNG; this draws it — the capture, or, where this
 * viewer asked for Live and the shell's local-tool door is open, the running
 * dev page through the bridge `isocan exact live` started on this machine.
 * Everything that reaches the machine goes through `localTool("exact")`:
 * with the door shut (the switch off, or a home that is not on this
 * machine) nothing here fetches or frames anything, and every screen is
 * its capture.
 *
 * Pointing: hold Alt over the live frames and click — the bridge turns on
 * Tamber's inspect mode in every running build, the page selects what the
 * press lands on, and the selection comes back joined to source (file, line,
 * component, the style a row came from). The panel on the right says where,
 * outlines it in every live frame, and offers Open in editor, Comment on
 * this line (`exact.source`) and Open in Exact Design.
 */

// ---------------------------------------------------------------- shared state

interface Hello { app: { id: string; name: string }; dir: string; frames: number | null; loop: string; tamber: boolean; design: { port: number; up: boolean }; seq: number }

interface Selection {
  /** The bridge it came from, or null: pointed at on a capture, from the screen's own `exact.points`, with no bridge asked. */
  port: number | null;
  build: string;
  source: ExactSource & { end_col?: number; component?: string | null; chain?: Array<{ file: string; line: number; col: number; component?: string | null }> };
  rows: Array<{ name: string; value: unknown; origin: string | null; source: string | null }>;
  readOnly: boolean;
  itemId: string | null;
  canvasId: string | null;
}

interface FrameRecord { itemId: string; canvasId: string; port: number; appId: string }

const state = {
  door: null as LocalToolDoor | null,
  hellos: new Map<number, { at: number; hello: Hello | null; error?: string }>(),
  selection: null as Selection | null,
  /** The shields are down: Alt is held, so a press reaches the page, which is in inspect mode. */
  pointing: false,
  /** Tamber's inspect mode is on, on these bridges (it stays on while a selection is shown, so outlines draw). */
  inspecting: new Set<number>(),
  /** The frame a press last went into — `document.activeElement` when the window lost focus to it. */
  pointed: null as FrameRecord | null,
  /** The frame the pointer last crossed into: the iframe ELEMENT is the parent's, so its enter events are ours even when its page is another origin's. */
  hovered: null as FrameRecord | null,
  builds: new Map<string, FrameRecord>(),
  frames: new Map<HTMLIFrameElement, FrameRecord>(),
  /** Exact screens mounted: Alt points at captures too, live frames or not. */
  screens: 0,
  version: 0,
};
const listeners = new Set<() => void>();
const changed = () => { state.version++; for (const l of listeners) l(); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const useExact = () => useSyncExternalStore(subscribe, () => state.version);

/** Ask a bridge who it is, at most every 20 s — never while the door is shut. */
async function hello(door: LocalToolDoor, port: number, fresh = false): Promise<Hello | null> {
  const known = state.hellos.get(port);
  if (known && !fresh && Date.now() - known.at < 20_000) return known.hello;
  try {
    const r = await door.fetch(port, "/hello");
    if (r.status === 401) { door.forget(port); state.hellos.delete(port); changed(); return null; }
    const h = r.ok ? ((await r.json()) as Hello) : null;
    state.hellos.set(port, { at: Date.now(), hello: h });
    changed();
    return h;
  } catch (err) {
    state.hellos.set(port, { at: Date.now(), hello: null, error: err instanceof Error ? err.message : String(err) });
    changed();
    return null;
  }
}

/** The paired bridge serving this app, if this browser has one. */
async function bridgeFor(door: LocalToolDoor, appId: string): Promise<{ port: number; hello: Hello } | null> {
  if (door.shut) return null;
  for (const port of door.paired()) {
    const h = await hello(door, port);
    if (h?.app.id === appId) return { port, hello: h };
  }
  return null;
}

// ---------------------------------------------------------------- events, from each bridge with frames

const pollers = new Map<number, AbortController>();

function follow(door: LocalToolDoor, port: number, from: number): void {
  if (pollers.has(port)) return;
  const stop = new AbortController();
  pollers.set(port, stop);
  void (async () => {
    let after = from;
    while (!stop.signal.aborted && !door.shut) {
      try {
        const r = await door.fetch(port, `/events?after=${after}`, { signal: stop.signal });
        if (!r.ok) { await new Promise((res) => setTimeout(res, 2000)); continue; }
        const answer = (await r.json()) as { events: Array<Record<string, unknown> & { seq: number; type: string }>; next: number };
        after = answer.next;
        for (const e of answer.events) onEvent(door, port, e);
      } catch {
        if (stop.signal.aborted) break;
        await new Promise((res) => setTimeout(res, 2000));
      }
    }
    pollers.delete(port);
  })();
}

function onEvent(door: LocalToolDoor, port: number, e: Record<string, unknown> & { type: string }): void {
  if (e.type === "selection") {
    const pointed = state.pointed ?? state.hovered;
    const build = String(e.build);
    if (pointed) state.builds.set(build, pointed);
    const frame = state.builds.get(build) ?? pointed;
    state.selection = {
      port,
      build,
      source: e.source as Selection["source"],
      rows: (e.rows as Selection["rows"]) ?? [],
      readOnly: e.readOnly === true,
      itemId: frame?.itemId ?? null,
      canvasId: frame?.canvasId ?? null,
    };
    state.pointing = false;
    changed();
    // Every running build outlines the node: the server outlines on a selection, and this says it out loud.
    const s = state.selection.source;
    void door.fetch(port, "/outline", { method: "POST", body: JSON.stringify({ at: [{ file: s.file, line: s.line, col: s.col }] }) }).catch(() => {});
  } else if (e.type === "inspect" && e.on === false && state.inspecting.has(port)) {
    // The page left inspect mode itself (Escape, its close control).
    state.inspecting.delete(port);
    changed();
  }
}

function inspect(on: boolean): void {
  const door = state.door;
  if (!door || door.shut) return;
  const ports = new Set([...state.frames.values()].map((f) => f.port));
  for (const port of on ? ports : new Set([...state.inspecting])) {
    if (on) state.inspecting.add(port); else state.inspecting.delete(port);
    void door.fetch(port, "/inspect", { method: "POST", body: JSON.stringify({ on }) }).catch(() => {});
  }
  changed();
}

/** Stop pointing: inspect mode off on every bridge (which clears the outlines) and the panel closed. */
export function stopPointing(): void {
  inspect(false);
  state.selection = null;
  state.pointing = false;
  changed();
}

// ---------------------------------------------------------------- Alt: the shields come down

let keysInstalled = false;
function installKeys(): void {
  if (keysInstalled || typeof window === "undefined") return;
  keysInstalled = true;
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.selection) { stopPointing(); return; }
    if (e.key !== "Alt" || e.repeat || state.screens === 0) return;
    state.pointing = true;
    state.pointed = null;
    // Live frames take Tamber's inspect mode; captures answer from their own `exact.points`, asking nothing.
    if (state.frames.size > 0 && state.door && !state.door.shut) inspect(true);
    else changed();
  });
  window.addEventListener("keyup", (e) => {
    if (e.key !== "Alt" || !state.pointing) return;
    state.pointing = false;
    // Released without pointing at anything: inspect mode was only for this press.
    if (!state.selection) inspect(false);
    changed();
  });
  // A press into a frame takes the focus: that is how the canvas knows WHICH frame was pointed at (the frame is
  // another origin, so its events are its own). Focus comes back, so the next Alt is the canvas's again.
  window.addEventListener("blur", () => {
    const active = document.activeElement;
    if (active instanceof HTMLIFrameElement && state.frames.has(active)) {
      state.pointed = state.frames.get(active)!;
      setTimeout(() => { try { active.blur(); window.focus(); } catch { /* the frame keeps it */ } }, 400);
    }
  });
}

// ---------------------------------------------------------------- the screen

const DEVICE_SIZE: Record<string, { width: number; height: number }> = {
  phone: { width: 390, height: 844 },
  tablet: { width: 820, height: 1180 },
  desktop: { width: 1280, height: 800 },
};

/** `exact-copy-<n>`: Exact keeps a framed page's build id under its frame's name, so three frames in one tab are three builds. */
const names = new Set<number>();
function frameName(): number {
  for (let n = 1; n < 100; n++) if (!names.has(n)) { names.add(n); return n; }
  return 99;
}

const LIVE_KEY = (canvasId: string, itemId: string) => `isocan.exact.live.${canvasId}.${itemId}`;
function readLive(canvasId: string, itemId: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(LIVE_KEY(canvasId, itemId));
    return v === null ? fallback : v === "live";
  } catch {
    return fallback;
  }
}
function writeLive(canvasId: string, itemId: string, live: boolean): void {
  try { localStorage.setItem(LIVE_KEY(canvasId, itemId), live ? "live" : "still"); } catch { /* this tab only */ }
}

/** Is this element on screen, or near it? A live frame far off-screen drops back to its capture. */
function useNearScreen(ref: React.RefObject<HTMLElement | null>): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setNear(true); return; }
    const io = new IntersectionObserver((entries) => setNear(entries.some((e) => e.isIntersecting)), { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return near;
}

/** A tick for every pairing or switch change. The shell hands a fresh door object each render, so nothing keys on its identity. */
function useDoor(door: LocalToolDoor | null): number {
  const [tick, setTick] = useState(0);
  const ref = useRef(door);
  ref.current = door;
  const has = !!door;
  useEffect(() => (has ? ref.current?.watch(() => setTick((t) => t + 1)) : undefined), [has]);
  return tick;
}

export function ExactScreen(facts: RendererFacts) {
  const { item, canvasId, url, filename, entered } = facts;
  // The door is asked afresh every render: the switch can move under a mounted screen.
  const door = facts.localTool?.("exact") ?? null;
  const tick = useDoor(door);
  if (door) state.door = door;
  useExact();
  const ref = useRef<HTMLDivElement>(null);
  const near = useNearScreen(ref);
  const appId = item ? appIdOf(item) : null;
  const itemId = item?.id ?? "";
  const [live, setLiveState] = useState(() => readLive(canvasId, itemId, item?.properties?.[EXACT_PROPS.live] === "on"));
  const [bridge, setBridge] = useState<{ port: number; hello: Hello } | null>(null);
  const [asking, setAsking] = useState(false);
  const open = !!door && !door.shut;

  useEffect(() => {
    let alive = true;
    if (!open || !live || !appId) { setBridge(null); return; }
    void bridgeFor(door!, appId).then((b) => { if (alive) setBridge(b); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, live, appId, tick]);

  const setLive = (on: boolean) => { writeLive(canvasId, itemId, on); setLiveState(on); if (!on) setAsking(false); };
  const device = item?.properties?.[EXACT_PROPS.device] ?? "phone";
  const scheme = item?.properties?.[EXACT_PROPS.scheme] === "dark" ? "dark" : "light";
  const path = item?.properties?.[EXACT_PROPS.url] ?? "/";
  const showFrame = open && live && near && bridge?.hello.frames;
  useEffect(() => { state.screens++; installKeys(); return () => { state.screens--; }; }, []);
  const points = parsePoints(item?.properties?.[EXACT_PROPS.points]);
  const capW = (DEVICE_SIZE[device] ?? DEVICE_SIZE.phone!).width;
  /** Alt-click on a capture: the node under the press, from what the capture recorded — no bridge, no network. */
  const pointOnCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!points || !item) return;
    const r = e.currentTarget.getBoundingClientRect();
    const k = r.width / capW;
    const hit = pointAt(points, (e.clientX - r.left) / k, (e.clientY - r.top) / k);
    state.pointing = false;
    if (!hit) { changed(); return; }
    state.selection = {
      port: null,
      build: "capture",
      source: { file: hit.file, line: hit.line, col: hit.col, sha256: points.files[hit.file] ?? "", component: hit.component, chain: hit.chain },
      rows: (hit.classes ?? []).map((c) => ({ name: "class", value: c, origin: `class:${c}`, source: "authored" })),
      readOnly: false,
      itemId: item.id,
      canvasId,
    };
    changed();
  };

  return (
    <div ref={ref} className="exact-screen" data-exact-screen={live && open ? "live" : "still"}>
      {showFrame
        ? <LiveFrame door={door!} port={bridge!.port} framesPort={bridge!.hello.frames!} path={path} device={device} scheme={scheme} entered={entered} record={{ itemId, canvasId, port: bridge!.port, appId: appId! }} title={filename} />
        : <img className="img-view" src={url} alt={filename} draggable={false} />}
      {!showFrame && state.pointing && points && (
        <div className="exact-point-catcher" title="Point at this line" onPointerDown={(e) => e.stopPropagation()} onClick={pointOnCapture} />
      )}
      {open && appId && (
        <div className="exact-screen-bar" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" className={`exact-chip${live ? " exact-chip-on" : ""}`} aria-pressed={live} title={live ? "Show the capture" : "Run this screen live, from your machine"} onClick={() => setLive(!live)}>
            {live ? "Live" : "Still"}
          </button>
          {live && !bridge && <button type="button" className="exact-chip" onClick={() => setAsking(!asking)}>Pair…</button>}
        </div>
      )}
      {open && live && !bridge && asking && <PairForm door={door!} onPaired={() => { setAsking(false); state.hellos.clear(); changed(); }} />}
    </div>
  );
}

function LiveFrame({ door, port, framesPort, path, device, scheme, entered, record, title }: { door: LocalToolDoor; port: number; framesPort: number; path: string; device: string; scheme: string; entered: boolean; record: FrameRecord; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0.5);
  const [n] = useState(frameName);
  const size = DEVICE_SIZE[device] ?? DEVICE_SIZE.phone!;
  useExact();
  useEffect(() => () => { names.delete(n); }, [n]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / size.width || 0.5);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [size.width]);
  const doorRef = useRef(door);
  doorRef.current = door;
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const door = doorRef.current;
    state.frames.set(el, record);
    installKeys();
    void hello(door, port).then((h) => { if (h) follow(door, port, h.seq); });
    changed();
    return () => {
      state.frames.delete(el);
      if (![...state.frames.values()].some((f) => f.port === port)) { pollers.get(port)?.abort(); }
      changed();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [port, record.itemId]);
  const src = door.frameUrl(framesPort, path);
  if (!src) return null;
  return (
    <div ref={box} className="exact-live">
      <iframe
        ref={frame}
        onPointerEnter={() => { state.hovered = record; }}
        name={`exact-copy-${n}`}
        src={src}
        title={`${title} — live`}
        style={{ width: size.width, height: size.height, transform: `scale(${scale})`, colorScheme: scheme, pointerEvents: entered || state.pointing ? "auto" : "none" }}
      />
      {/* Over the page, so the card drags and selects; down while entered, and while Alt is held (pointing). A card that is not
          entered is inert (`.item-content.inert`), so the frame asks for the pointer back itself while it is wanted. */}
      <div className="exact-live-shield" style={{ pointerEvents: entered || state.pointing ? "none" : "auto" }} />
    </div>
  );
}

function PairForm({ door, onPaired }: { door: LocalToolDoor; onPaired: () => void }) {
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <form
      className="exact-pair"
      onPointerDown={(e) => e.stopPropagation()}
      onSubmit={(e) => {
        e.preventDefault();
        setProblem(null);
        door.pair(code).then(onPaired, (err: unknown) => setProblem(err instanceof Error ? err.message : String(err)));
      }}
    >
      <label>
        Pairing code from <code>isocan exact live</code>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="47811-K3M9Q-7XW2P" aria-label="Pairing code" autoFocus />
      </label>
      <button type="submit" className="btn">Pair</button>
      {problem && <p className="exact-problem">{problem}</p>}
    </form>
  );
}

// ---------------------------------------------------------------- the panel

async function openInEditor(door: LocalToolDoor, port: number, src: { file: string; line: number; col: number }): Promise<string> {
  const r = await door.fetch(port, "/open", { method: "POST", body: JSON.stringify(src) });
  const answer = (await r.json().catch(() => null)) as { url?: string; opened?: string; with?: string; error?: string } | null;
  if (!r.ok) throw new Error(answer?.error ?? `the bridge answered ${r.status}`);
  if (answer?.url) {
    const a = document.createElement("a");
    a.href = answer.url;
    a.click();
    return `asked your editor to open ${sourcePlace(src)}`;
  }
  return `opened ${answer?.opened ?? sourcePlace(src)} with ${answer?.with ?? "your editor"}`;
}

export function PointPanel({ canvasId, canvas, host }: OverlayFacts) {
  useExact();
  const door = host.localTool?.("exact") ?? state.door;
  const [text, setText] = useState("");
  const [said, setSaid] = useState<string | null>(null);
  const sel = state.selection;
  useEffect(() => { setSaid(null); setText(""); }, [sel?.build, sel?.source.line, sel?.source.col]);
  if (!sel || (sel.canvasId && sel.canvasId !== canvasId)) return null;
  // A capture's answer needs no bridge; a live one came through it, and needs it still to open anything.
  const bridged = sel.port !== null && !!door && !door.shut ? { door, port: sel.port } : null;
  const item = sel.itemId ? canvas.items[sel.itemId] : undefined;
  const classes = [...new Set(sel.rows.map((r) => r.origin ?? "").filter((o) => o.startsWith("class:")))];
  const styled = sel.rows.filter((r) => r.origin && r.origin !== "tag" && r.source === "authored").slice(0, 8);
  const run = (p: Promise<string>) => { p.then(setSaid, (err: unknown) => setSaid(err instanceof Error ? err.message : String(err))); };
  return (
    <div className="exact-panel" role="region" aria-label="Exact — pointing at a line">
      <div className="exact-panel-head">
        <strong>Pointing at</strong>
        <button type="button" className="exact-chip" aria-label="Stop pointing" onClick={stopPointing}>×</button>
      </div>
      <code className="exact-place" data-exact-place={sourcePlace(sel.source)}>{selectionSummary(sel)}</code>
      {item && <p className="exact-note">on {item.title}{sel.port === null ? " (its capture)" : ""}{sel.readOnly ? " · the file moved since this build: read-only" : ""}</p>}
      {(sel.source.chain ?? []).length > 0 && (
        <p className="exact-note">drawn by {(sel.source.chain ?? []).map((c) => `${c.component ?? "?"} at ${sourcePlace(c)}`).join(" ← ")}</p>
      )}
      {classes.length > 0 && <p className="exact-note">style: {classes.map((c) => c.slice(6)).join(", ")}</p>}
      {styled.length > 0 && (
        <ul className="exact-rows">
          {styled.map((r) => <li key={r.name}><span>{r.name}</span> <code>{typeof r.value === "string" ? r.value : JSON.stringify(r.value)}</code> <em>{r.origin}</em></li>)}
        </ul>
      )}
      <div className="exact-panel-actions">
        {bridged
          ? <button type="button" className="btn" onClick={() => run(openInEditor(bridged.door, bridged.port, sel.source))}>Open in editor</button>
          : <p className="exact-note">Open {sourcePlace(sel.source)} in your editor — {door?.shut ? "live frames are off, so the canvas does not reach your machine" : "no bridge is paired for this app"}.</p>}
        {bridged && <button
          type="button"
          className="btn"
          onClick={() => run((async () => {
            const r = await bridged.door.fetch(bridged.port, `/design?route=${encodeURIComponent(item?.properties?.[EXACT_PROPS.url] ?? "")}`);
            const d = (await r.json()) as { link: string; up: boolean; port: number };
            window.open(d.link, "_blank", "noopener");
            return d.up ? "opened Exact Design" : `Exact Design is not answering on :${d.port} — start it with \`bun run dev\` in its checkout, then open the link again`;
          })())}
        >
          Open in Exact Design
        </button>}
      </div>
      {item && (
        <form
          className="exact-comment"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            const body = [text.trim(), "", `On ${selectionSummary(sel)}.`, sourceLine(sel.source)].join("\n");
            run(host.send([{ type: "thread.create", threadId: newThreadId(), x: Math.round(item.width - 12), y: 12, anchorItemId: item.id, comment: { id: newCommentId(), body } }]).then(() => { setText(""); return `commented on ${sourcePlace(sel.source)}`; }));
          }}
        >
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Comment on this line…" aria-label="Comment on this line" rows={2} />
          <button type="submit" className="btn" disabled={!text.trim()}>Comment on this line</button>
        </form>
      )}
      {said && <p className="exact-note" role="status">{said}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- under a comment

/** "Open app.contract:110 in editor", under a comment that carries `exact.source` — only while the door is open and this browser has a bridge for its app. */
export function commentRows({ canvas, thread, comment }: ModuleCommentFacts): readonly ModuleMenuRow[] {
  const src = parseSource(comment.body);
  const door = state.door;
  if (!src || !door || door.shut || !thread.anchorItemId) return [];
  const item = canvas.items[thread.anchorItemId];
  const appId = item ? appIdOf(item) : null;
  if (!appId) return [];
  const known = [...state.hellos.entries()].find(([, h]) => h.hello?.app.id === appId);
  if (!known) return [];
  return [{ label: `Open ${src.file}:${src.line} in editor`, run: () => { void openInEditor(door, known[0], src).catch(() => {}); } }];
}
