import type { CopyDeck } from "@isocan/core/copy-deck";
import { copyFit } from "@isocan/core/copy-fit";

/**
 * **Fit, measured where the screen renders** — the renderer's half of the
 * copy-edit phase 4 fit check (journey scene 3). Loaded with *Compare the
 * copy…*, never on first paint.
 *
 * Each screen in the compare is drawn in the inspector's lone `allow-scripts`
 * frame, so the app cannot reach in to measure: the measuring has to arrive
 * inside the document, as the diff marks do (`markSource`). `withFitProbe`
 * writes a small script into the srcdoc that finds each of the deck's strings
 * in the rendered page, counts its line boxes and asks whether its box
 * overflows, and posts `{ isocanCopyFit: [...] }` up — on load, when fonts
 * arrive, and whenever the frame is resized. The DECISION is core's
 * (`copyFit`, the same rule every surface uses): the panel judges what came
 * up and posts back `{ isocanCopyFitMark: [...] }`, and the frame outlines
 * those strings in place. The item and its blob are never touched.
 *
 * A string is found by its address where that is a text node (`t<n>`, the
 * WYSIWYG splice's ordinal, checked by its words), else by its words inside
 * the `data-wf` element it draws in (a wireframe's word paths). Attribute
 * strings — a placeholder, an alt — have no line boxes of their own and are
 * not measured; neither is a string the page does not draw where it was
 * looked for. Both are left unmarked rather than guessed.
 */

/** What the frame measured for one string. */
interface FitMeasured {
  a: string;
  lines: number;
  overflow: boolean;
}

/** One string that does not fit: its address, and why in words. */
export interface FitMiss {
  address: string;
  role: string;
  why: string;
}

/** The frame's half. `T` is the targets: address, words, and where to look. */
function probeScript(targets: Array<{ a: string; t: string; n?: number; wf?: string }>): string {
  // Kept as plain ES5 in a string: it runs inside the screen's own document.
  return `(function(){
var T=${JSON.stringify(targets).replace(/</g, "\\u003c")};
var boxes={};
function trim(s){return s.replace(/^[ \\t\\n\\r\\f]+|[ \\t\\n\\r\\f]+$/g,"");}
function hidden(n){for(var e=n.parentNode;e&&e.nodeType===1;e=e.parentNode){var g=e.tagName;if(g==="SCRIPT"||g==="STYLE"||g==="NOSCRIPT"||g==="TEMPLATE"||g==="TITLE"||g==="HEAD")return true;}return false;}
function texts(root){var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),o=[],n;while((n=w.nextNode()))o.push(n);return o;}
function blockOf(n){var e=n.parentElement;while(e&&e!==document.body&&getComputedStyle(e).display==="inline")e=e.parentElement;return e;}
function measure(){
  var all=texts(document),used=[],out=[];boxes={};
  for(var i=0;i<T.length;i++){var t=T[i],node=null;
    if(t.n!=null){var c=all[t.n];if(c&&trim(c.data)===t.t&&!hidden(c))node=c;}
    if(!node){var scope=null;if(t.wf){try{scope=document.querySelector('[data-wf="'+String(t.wf).replace(/["\\\\]/g,"\\\\$&")+'"]');}catch(e){}}
      var pool=texts(scope||document.body),exact=null,part=null;
      for(var j=0;j<pool.length;j++){var p=pool[j];if(hidden(p)||used.indexOf(p)>=0)continue;var d=trim(p.data);if(!exact&&d===t.t)exact=p;if(!part&&d.length&&d.indexOf(t.t)>=0)part=p;}
      node=exact||part;}
    if(!node)continue;used.push(node);
    var r=document.createRange();r.selectNodeContents(node);var rs=r.getClientRects(),tops=[],k,q;
    var box=blockOf(node),b=box?box.getBoundingClientRect():null,over=false;
    for(k=0;k<rs.length;k++){q=rs[k];if(q.width<1||q.height<1)continue;var seen=false;for(var m=0;m<tops.length;m++)if(Math.abs(tops[m]-q.top)<q.height/2)seen=true;if(!seen)tops.push(q.top);
      if(b&&box!==document.body&&(q.right>b.right+1||q.bottom>b.bottom+1||q.left<b.left-1))over=true;}
    if(box&&box!==document.body&&box!==document.documentElement&&(box.scrollWidth>box.clientWidth+1||box.scrollHeight>box.clientHeight+1))over=true;
    if(!tops.length)continue;
    boxes[t.a]=box||node.parentElement;
    out.push({a:t.a,lines:tops.length,overflow:over});}
  parent.postMessage({isocanCopyFit:out},"*");}
var queued=false;function soon(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;measure();});}
window.addEventListener("message",function(e){var m=e.data&&e.data.isocanCopyFitMark;if(!m||typeof m.length!=="number")return;
  var was=document.querySelectorAll("[data-isocan-fit]");for(var i=0;i<was.length;i++){was[i].removeAttribute("data-isocan-fit");was[i].removeAttribute("data-isocan-fit-why");}
  for(var j=0;j<m.length;j++){var el=boxes[m[j].a];if(el){el.setAttribute("data-isocan-fit","over");el.setAttribute("data-isocan-fit-why",m[j].why);}}});
if(document.readyState==="complete")soon();else window.addEventListener("load",soon);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(soon);
window.addEventListener("resize",soon);
})();`;
}

/** The outline a string that does not fit gets inside its frame: dashed, so it reads apart from a diff mark. */
const FIT_CSS = `[data-isocan-fit=over]{outline:2px dashed #dc2626!important;outline-offset:2px!important}`;

/** A compare frame's srcdoc with the fit probe written in before `</body>`. */
export function withFitProbe(srcdoc: string, deck: CopyDeck): string {
  const targets = deck.strings
    .filter((s) => !s.address.includes("@"))
    .map((s) => {
      const ordinal = /^t(\d+)$/.exec(s.address);
      return { a: s.address, t: s.text, ...(deck.kind === "html" && ordinal ? { n: Number(ordinal[1]) } : {}), ...(s.wf !== undefined ? { wf: s.wf } : {}) };
    });
  const extra = `<style data-isocan-fit>${FIT_CSS}</style><script data-isocan-fit>${probeScript(targets)}</script>`;
  const close = srcdoc.toLowerCase().lastIndexOf("</body>");
  return close < 0 ? `${srcdoc}${extra}` : `${srcdoc.slice(0, close)}${extra}${srcdoc.slice(close)}`;
}

/** Read a frame's message: what it measured, or null when the message is not one. */
export function fitMeasuredOf(data: unknown): FitMeasured[] | null {
  const list = (data as { isocanCopyFit?: unknown } | null)?.isocanCopyFit;
  if (!Array.isArray(list)) return null;
  return list.filter((m): m is FitMeasured => !!m && typeof m.a === "string" && typeof m.lines === "number" && m.lines > 0 && m.lines < 10_000 && typeof m.overflow === "boolean");
}

/** Judge what a frame measured against each string's role — core's rule — and return the strings that do not fit. */
export function fitMisses(deck: CopyDeck, measured: readonly FitMeasured[]): FitMiss[] {
  const roles = new Map(deck.strings.map((s) => [s.address, s.role]));
  const out: FitMiss[] = [];
  for (const m of measured) {
    const role = roles.get(m.a);
    if (!role) continue;
    const fit = copyFit(role, { lines: m.lines, overflow: m.overflow });
    if (!fit.fits) out.push({ address: m.a, role, why: fit.why });
  }
  return out;
}
