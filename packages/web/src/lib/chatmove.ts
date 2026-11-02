import "../components/chat-bar.css";
import { useUiStore } from "../stores/uiStore.ts";
import { CHAT_AT_KEY, type ChatAt, type Store } from "./chatplace.ts";
import { chatHiddenNow, openPanel } from "./panels.ts";

/**
 * **Moving the Chat between the left dock and the bar at the bottom.**
 *
 * Fetched on the first press on the Chat's header (or its Move button), never
 * on a first visit: nobody pays for a drag they have not started.
 *
 * The rules are pure functions so a test can hold them without a pointer:
 * `pickZone` says which slot a pointer is nearest and whether it is close
 * enough to land in, and `barPreview` says what a minimized bar shows of
 * what came in while it was down.
 */

/** How far a press must travel before it is a drag — under this, a press on
 *  the header is still a click on it. */
const DRAG_THRESHOLD = 5;

/** How far outside a slot a release still lands in it. */
const DROP_REACH = 80;

interface ZoneRect {
  at: ChatAt;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Distance from a point to a rectangle; zero inside it. */
export function distanceTo(zone: ZoneRect, x: number, y: number): number {
  const dx = Math.max(zone.left - x, 0, x - zone.right);
  const dy = Math.max(zone.top - y, 0, y - zone.bottom);
  return Math.hypot(dx, dy);
}

/**
 * The slot the pointer is nearest (what lights up while dragging), and the one
 * a release would land in — the nearest, but only within `reach`. Anywhere
 * else, the Chat snaps back to where it was.
 */
export function pickZone(
  zones: readonly ZoneRect[],
  x: number,
  y: number,
  reach = DROP_REACH,
): { nearest: ChatAt | null; drop: ChatAt | null } {
  let nearest: ZoneRect | null = null;
  let best = Number.POSITIVE_INFINITY;
  for (const zone of zones) {
    const d = distanceTo(zone, x, y);
    if (d < best) {
      best = d;
      nearest = zone;
    }
  }
  return { nearest: nearest?.at ?? null, drop: nearest && best <= reach ? nearest.at : null };
}

/**
 * **What a minimized bar says about what it has not shown**: the newest
 * message somebody else wrote, one line of it, with their name — or nothing
 * when there is nothing unread. Markdown punctuation at the head of the line
 * (`#`, `>`, `-`) is dropped: it is a preview, not the message.
 */
export function barPreview(
  comments: readonly { author: { id: string; name: string }; body: string }[] | undefined,
  unread: number,
  selfId: string,
  max = 120,
): string | null {
  if (!comments || unread <= 0) return null;
  for (let i = comments.length - 1; i >= 0; i--) {
    const comment = comments[i]!;
    if (comment.author.id === selfId) continue;
    const line = (comment.body.split("\n").find((one) => one.trim()) ?? "")
      .replace(/^[\s#>*-]+/, "")
      .replace(/\s+/g, " ")
      .trim();
    const said = `${comment.author.name}: ${line}`;
    return said.length > max ? `${said.slice(0, max - 1)}…` : said;
  }
  return null;
}

/** Remember where the Chat is kept. Here rather than beside `readChatAt`
 *  because only a move writes it, and a first visit never moves anything. */
export function writeChatAt(at: ChatAt, store?: Store): void {
  try {
    (store ?? localStorage).setItem(CHAT_AT_KEY, at);
  } catch {
    // The move still happens; it is just forgotten on reload.
  }
}

/**
 * Put the Chat somewhere, and remember it for this viewer.
 *
 * To the bottom: the dock lets go of it (and the canvas pans back from under
 * where it was, exactly as closing it does), and the bar starts minimized. To
 * the left: today's dock, opened, with today's rail pan.
 */
export function placeChat(canvasId: string, at: ChatAt): void {
  const ui = useUiStore.getState();
  // A pane that hides the Chat has none to move.
  if (ui.chatAt === at || chatHiddenNow()) return;
  writeChatAt(at);
  useUiStore.setState({ chatAt: at, chatBarOpen: false });
  if (at === "left") openPanel(canvasId, "main");
  else if (ui.mainPanelOpen) openPanel(canvasId, null);
}

/** The two slots, drawn while a drag is under way. */
function drawZones(): HTMLElement {
  const layer = document.createElement("div");
  layer.className = "chat-zones";
  layer.setAttribute("aria-hidden", "true");
  // The left slot is the dock itself, so it is sized as the panel is.
  const s = useUiStore.getState();
  for (const [at, label] of [["left", "Dock on the left"], ["bottom", "Bar at the bottom"]] as const) {
    const zone = document.createElement("div");
    zone.className = `chat-zone chat-zone-${at}`;
    zone.dataset.at = at;
    if (at === "left") zone.style.width = `${s.panelWidth}px`;
    zone.textContent = label;
    layer.append(zone);
  }
  document.body.append(layer);
  return layer;
}

function zoneRects(layer: HTMLElement): ZoneRect[] {
  return [...layer.querySelectorAll<HTMLElement>(".chat-zone")].map((zone) => {
    const r = zone.getBoundingClientRect();
    return { at: zone.dataset.at as ChatAt, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  });
}

/**
 * **The drag, from a press already made on the Chat's header.**
 *
 * The press arrived before this module did, so the button may already be up:
 * a move with no buttons held ends it without ever becoming a drag — the
 * press was a click. Past `DRAG_THRESHOLD` the panel follows the pointer and
 * the two slots appear; the nearest lights up; a release in reach of one puts
 * the Chat there, and anywhere else puts it back.
 */
export function dragChat(canvasId: string, from: { x: number; y: number }, el: HTMLElement | null): void {
  let layer: HTMLElement | null = null;
  let drop: ChatAt | null = null;
  const end = (land: boolean) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    layer?.remove();
    document.body.classList.remove("chat-dragging");
    if (el) el.style.transform = "";
    if (land && layer && drop) placeChat(canvasId, drop);
  };
  const move = (e: PointerEvent) => {
    if (e.buttons === 0) return end(false);
    const dx = e.clientX - from.x;
    const dy = e.clientY - from.y;
    if (!layer) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      layer = drawZones();
      document.body.classList.add("chat-dragging");
    }
    if (el) el.style.transform = `translate(${dx}px, ${dy}px)`;
    const picked = pickZone(zoneRects(layer), e.clientX, e.clientY);
    drop = picked.drop;
    for (const zone of layer.querySelectorAll<HTMLElement>(".chat-zone")) {
      zone.classList.toggle("near", zone.dataset.at === picked.nearest);
      zone.classList.toggle("hot", zone.dataset.at === picked.drop);
    }
  };
  const up = () => end(true);
  const cancel = () => end(false);
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
}
