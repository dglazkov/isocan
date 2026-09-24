import { esc } from "./catalog/draw.ts";
import { hotspots, startScreen, type WireLink, type WireScreen } from "./links.ts";
import { renderFrame, styleOf, wireCss } from "./render.ts";
import { CAPTION_HEIGHT, wireSize } from "./spec.ts";
import { themeDecls } from "./theme.ts";

/**
 * **The prototype — one item** (design §8, journey scene 5).
 *
 * `assemblePrototype(kept, links)` is pure and sits beside `deckHtml` in
 * spirit: one self-contained HTML file — every kept screen as a section, a
 * tiny router with a history stack, the links as attributes on the hotspots
 * the renderer already stamped (`data-hot`). A link to a screen is
 * `data-go="<item id>"` (or `back`); a missing one is `data-needs="<what>"`,
 * drawn dashed, and clicking it says what it needs. An in-place hotspot gets
 * neither and does nothing.
 *
 * It never navigates the canvas: it routes inside itself, fetches nothing,
 * and plays anywhere an HTML file plays.
 */

export const PROTOTYPE_MARKER = "<!-- isocan:wireframe-prototype -->";
/** The property on the prototype item naming the flow it plays — how a rebuild finds it to version it. */
export const PROTOTYPE_PROP = "wirePrototype";

const BAR_HEIGHT = 32;
const PAD = 8;

/** The document size an item needs to show the prototype whole: the largest frame, plus the bar. */
export function prototypeSize(kept: readonly WireScreen[]): { width: number; height: number } {
  const { width, height } = stageSize(kept);
  return { width: width + PAD * 2, height: height + BAR_HEIGHT + PAD * 3 };
}

function stageSize(kept: readonly WireScreen[]): { width: number; height: number } {
  let width = 0;
  let height = 0;
  for (const s of kept) {
    const size = wireSize(s.spec);
    width = Math.max(width, size.width);
    height = Math.max(height, size.height - CAPTION_HEIGHT);
  }
  return { width, height };
}

const PROTO_CSS = `
body.proto{display:flex;flex-direction:column;align-items:center;gap:${PAD}px;padding:${PAD}px;background:var(--w-surface)}
.pbar{display:flex;align-items:center;gap:10px;height:${BAR_HEIGHT}px;font:600 13px/1.2 var(--w-font);color:var(--w-ink)}
.pbar .sp{flex:1}
.pbar .pnote{font-weight:500;color:var(--w-ink-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pbar button{font:inherit;border:1.5px solid var(--w-ink);background:var(--w-ground);color:var(--w-ink);border-radius:4px;padding:3px 10px;cursor:pointer}
.stage{position:relative;overflow:hidden}
.pscreen{position:absolute;left:0;top:0;background:var(--w-surface)}
.pscreen[hidden]{display:none}
[data-go]{cursor:pointer}
[data-go]:hover{outline:2px solid color-mix(in srgb, var(--w-ink) 35%, transparent);outline-offset:2px}
[data-needs]{outline:2px dashed var(--w-ink-muted);outline-offset:2px;cursor:help}
.pflash{outline:3px solid var(--w-primary,var(--w-ink));outline-offset:3px;animation:pflash .6s ease-in-out 3 alternate}
@keyframes pflash{to{outline-color:transparent}}
@media (prefers-reduced-motion: reduce){.pflash{animation:none}}
`;

/** The router: a history stack, a transition by link kind, and nothing it has to fetch. */
const ROUTER = `(function(){
var data=JSON.parse(document.getElementById("isocan-prototype").textContent);
var screens=[].slice.call(document.querySelectorAll(".pscreen"));
var name=document.getElementById("pname"),note=document.getElementById("pnote");
var still=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
var stack=[];
function by(id){for(var i=0;i<screens.length;i++)if(screens[i].getAttribute("data-screen")===id)return screens[i];return null}
var MOVES={push:[["translateX(100%)","none"],null],pop:[null,["none","translateX(100%)"]],overlay:[["translateY(100%)","none"],null],"overlay-out":[null,["none","translateY(100%)"]],dissolve:[["opacity0","opacity1"],null]};
function animate(el,frames){if(!el||!frames||still||!el.animate)return null;var kf=frames[0]==="opacity0"?[{opacity:0},{opacity:1}]:[{transform:frames[0]},{transform:frames[1]}];return el.animate(kf,{duration:240,easing:"ease-out"})}
function run(el,frames,done){var a=animate(el,frames),over=false;function end(){if(over)return;over=true;if(a)try{a.finish()}catch(e){}done()}if(a){a.onfinish=end;setTimeout(end,320)}else end()}
function off(el){if(el!==by(stack[stack.length-1]))el.hidden=true}
function show(id,kind){var next=by(id),cur=stack.length?by(stack[stack.length-1]):null;return{next:next,cur:cur,kind:kind}}
function paint(step){var next=step.next,cur=step.cur,m=MOVES[step.kind]||[null,null];
screens.forEach(function(s){if(s!==next&&s!==cur)s.hidden=true;s.style.zIndex=""});
next.hidden=false;
if(cur&&cur!==next){if(m[1]){cur.style.zIndex=2;run(cur,m[1],function(){off(cur);cur.style.zIndex=""})}else{next.style.zIndex=2;run(next,m[0],function(){off(cur);next.style.zIndex=""})}}
var id=stack[stack.length-1];document.body.setAttribute("data-at",id);name.textContent=next.getAttribute("data-title");note.textContent=stack.length>1?"· "+stack.length+" deep":""}
function go(to,kind){if(to==="back"){if(stack.length<2){note.textContent="· nothing to go back to";return}var step=show(stack[stack.length-2],kind==="overlay"?"overlay-out":"pop");stack.pop();paint(step);return}
if(!by(to))return;var s=show(to,kind);if(kind==="dissolve")stack=[to];else if(kind==="none"&&stack.length)stack[stack.length-1]=to;else stack.push(to);paint(s)}
function restart(){var s=show(data.start,"none");stack=[data.start];paint(s)}
function at(){var q={};(location.hash||"").replace(/^#/,"").split("&").forEach(function(p){var i=p.indexOf("=");if(i>0)q[p.slice(0,i)]=decodeURIComponent(p.slice(i+1))});return q}
function flash(key,id){if(!key)return;var sc=by(id);if(!sc)return;[].slice.call(sc.querySelectorAll("[data-hot]")).forEach(function(el){if(el.getAttribute("data-hot")!==key)return;el.classList.add("pflash");setTimeout(function(){el.classList.remove("pflash")},1800)})}
function jump(){var q=at();if(!q.screen||!by(q.screen))return false;var s=show(q.screen,"none");stack=[q.screen];paint(s);flash(q.hot,q.screen);return true}
document.addEventListener("click",function(e){var el=e.target.closest&&e.target.closest("[data-hot]");if(!el||!el.closest(".pscreen"))return;e.preventDefault();
var needs=el.getAttribute("data-needs");if(needs){note.textContent="· needs "+needs+" — not kept yet";return}
var to=el.getAttribute("data-go");if(to)go(to,el.getAttribute("data-t")||"push")});
document.getElementById("restart").addEventListener("click",restart);
[].slice.call(document.querySelectorAll("[data-needs]")).forEach(function(el){el.setAttribute("title","needs: "+el.getAttribute("data-needs"))});
window.addEventListener("hashchange",jump);
if(!jump())restart()})();`;

/** Put each link on its hotspot: every element carrying that key (a list's rows share one). */
function bind(frame: string, links: readonly WireLink[]): string {
  let out = frame;
  for (const l of links) {
    const attr = ` data-hot="${esc(l.key)}"`;
    const extra = l.to ? ` data-go="${esc(l.to)}" data-t="${l.transition}"` : l.needs ? ` data-needs="${esc(l.needs)}"` : "";
    if (extra) out = out.split(attr).join(`${attr}${extra}`);
  }
  return out;
}

/** The embedded data, safe inside a script element. */
function json(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

/**
 * **The kept screens as one clickable app.** `kept` in reading order, `links`
 * from `inferLinks(kept)`. Throws on an empty flow: a prototype of nothing
 * is not a thing to put on a canvas.
 */
export function assemblePrototype(kept: readonly WireScreen[], links: readonly WireLink[], opts: { title?: string } = {}): string {
  if (kept.length === 0) throw new Error("nothing is kept — a prototype plays the kept screens");
  const start = startScreen(kept)!;
  const { width, height } = stageSize(kept);
  const title = opts.title ?? "Prototype";
  // One sheet serves every frame; it carries the skeleton's only if some kept screen is still undecided.
  // Its theme is the start screen's; each screen then sets its own roles on its section (design §9),
  // so a prototype of screens drawn in two systems plays each in the one that drew it.
  const undecided = kept.find((s) => s.spec.slots.some((x) => x.block === null));
  const first = kept.find((s) => s.id === start) ?? kept[0]!;
  const lead = styleOf(first.spec);
  const sheet = wireCss({ ...(undecided ?? first).spec, ...(lead ? { style: lead } : {}) });
  const sections = kept.map((s) => {
    const mine = links.filter((l) => l.from === s.id);
    return `<section class="pscreen" data-screen="${esc(s.id)}" data-title="${esc(s.title)}" style="${esc(themeDecls(styleOf(s.spec)))}" hidden>${bind(renderFrame(s.spec), mine)}</section>`;
  });
  const table = {
    start,
    screens: kept.map((s) => ({ id: s.id, title: s.title, hotspots: hotspots(s.spec).length })),
    links: links.map((l) => ({ from: l.from, key: l.key, to: l.to, ...(l.needs ? { needs: l.needs } : {}), t: l.transition, rule: l.rule })),
  };
  return `<!doctype html>
${PROTOTYPE_MARKER}
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${width + PAD * 2}">
<title>${esc(title)}</title>
<style>${sheet}${PROTO_CSS}</style>
</head>
<body class="proto">
<div class="pbar" style="width:${width}px"><span id="pname"></span><span class="pnote" id="pnote"></span><span class="sp"></span><button type="button" id="restart">Restart</button></div>
<div class="stage" style="width:${width}px;height:${height}px">
${sections.join("\n")}
</div>
<script type="application/json" id="isocan-prototype">${json(table)}</script>
<script>${ROUTER}</script>
</body>
</html>
`;
}

/**
 * **Where a prototype opens** (phase 8, *Play from here*): the fragment its
 * router reads — the screen to open at, and the hotspot to point out. The
 * canvas's arrows and `isocan wire play` both spell it here.
 */
export function playAnchor(screen: string, hot?: string): string {
  return `screen=${encodeURIComponent(screen)}${hot ? `&hot=${encodeURIComponent(hot)}` : ""}`;
}

/** Is this file a prototype (rather than a screen)? Needs no DOM. */
export function isPrototypeHtml(html: string): boolean {
  return html.includes(PROTOTYPE_MARKER);
}
