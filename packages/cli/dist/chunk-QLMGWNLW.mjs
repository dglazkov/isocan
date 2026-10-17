import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  wireframeModule
} from "./chunk-XBCICSRJ.mjs";
import {
  ARCHETYPE_WORDS,
  CAPTION_HEIGHT,
  LEAVE_OUT,
  LINKS_PROP,
  PLATFORMS,
  RECIPES,
  blueprint,
  component,
  defaultSlotRegion,
  densityFromScore,
  esc,
  hotspots,
  inferLinks,
  presentElements,
  readOverrides,
  recipe,
  renderFrame,
  renderWire,
  resolveSlot,
  startScreen,
  styleOf,
  surfaceCss,
  surfaceOf,
  template,
  templateCss,
  templatesFor,
  themeDecls,
  wireCss,
  wireSize,
  wireTitle
} from "./chunk-TERLGXWE.mjs";
import {
  JEV_MODEL,
  chosenOption,
  readResponse
} from "./chunk-ODKP6MPE.mjs";
import {
  FIDELITY_PROP,
  markOffered,
  moduleMarkPatch,
  newGroupId,
  newItemId,
  newVersionId,
  readingOrder
} from "./chunk-CVBHXI2X.mjs";

// packages/modules/wireframe/src/port.ts
function currentVersionOf(item) {
  return item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[item.versions.length - 1];
}

// packages/modules/wireframe/src/prototype.ts
var PROTOTYPE_MARKER = "<!-- isocan:wireframe-prototype -->";
var PROTOTYPE_PROP = "wirePrototype";
var BAR_HEIGHT = 32;
var PAD = 8;
function prototypeSize(kept2) {
  const { width, height } = stageSize(kept2);
  return { width: width + PAD * 2, height: height + BAR_HEIGHT + PAD * 3 };
}
function stageSize(kept2) {
  let width = 0;
  let height = 0;
  for (const s of kept2) {
    const size = wireSize(s.spec);
    width = Math.max(width, size.width);
    height = Math.max(height, size.height - CAPTION_HEIGHT);
  }
  return { width, height };
}
var PROTO_CSS = `
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
var ROUTER = `(function(){
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
var id=stack[stack.length-1];document.body.setAttribute("data-at",id);name.textContent=next.getAttribute("data-title");note.textContent=stack.length>1?"\xB7 "+stack.length+" deep":""}
function go(to,kind){if(to==="back"){if(stack.length<2){note.textContent="\xB7 nothing to go back to";return}var step=show(stack[stack.length-2],kind==="overlay"?"overlay-out":"pop");stack.pop();paint(step);return}
if(!by(to))return;var s=show(to,kind);if(kind==="dissolve")stack=[to];else if(kind==="none"&&stack.length)stack[stack.length-1]=to;else stack.push(to);paint(s)}
function restart(){var s=show(data.start,"none");stack=[data.start];paint(s)}
function at(){var q={};(location.hash||"").replace(/^#/,"").split("&").forEach(function(p){var i=p.indexOf("=");if(i>0)q[p.slice(0,i)]=decodeURIComponent(p.slice(i+1))});return q}
function flash(key,id){if(!key)return;var sc=by(id);if(!sc)return;[].slice.call(sc.querySelectorAll("[data-hot]")).forEach(function(el){if(el.getAttribute("data-hot")!==key)return;el.classList.add("pflash");setTimeout(function(){el.classList.remove("pflash")},1800)})}
function jump(){var q=at();if(!q.screen||!by(q.screen))return false;var s=show(q.screen,"none");stack=[q.screen];paint(s);flash(q.hot,q.screen);return true}
document.addEventListener("click",function(e){var el=e.target.closest&&e.target.closest("[data-hot]");if(!el||!el.closest(".pscreen"))return;e.preventDefault();
var needs=el.getAttribute("data-needs");if(needs){note.textContent="\xB7 needs "+needs+" \u2014 not in the prototype yet";return}
var to=el.getAttribute("data-go");if(to)go(to,el.getAttribute("data-t")||"push")});
document.getElementById("restart").addEventListener("click",restart);
[].slice.call(document.querySelectorAll("[data-needs]")).forEach(function(el){el.setAttribute("title","needs: "+el.getAttribute("data-needs"))});
window.addEventListener("hashchange",jump);
if(!jump())restart()})();`;
function bind(frame, links) {
  let out = frame;
  for (const l of links) {
    const attr = ` data-hot="${esc(l.key)}"`;
    const extra = l.to ? ` data-go="${esc(l.to)}" data-t="${l.transition}"` : l.needs ? ` data-needs="${esc(l.needs)}"` : "";
    if (extra) out = out.split(attr).join(`${attr}${extra}`);
  }
  return out;
}
function json(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
function assemblePrototype(kept2, links, opts = {}) {
  if (kept2.length === 0) throw new Error("no screen is in the prototype \u2014 it plays the screens marked \u{1F4D0}");
  const start = startScreen(kept2);
  const { width, height } = stageSize(kept2);
  const title = opts.title ?? "Prototype";
  const undecided = kept2.find((s) => s.spec.slots.some((x) => x.block === null));
  const first = kept2.find((s) => s.id === start) ?? kept2[0];
  const lead = styleOf(first.spec);
  const leadSpec = { ...(undecided ?? first).spec, ...lead ? { style: lead } : {} };
  const leadSurface = surfaceOf(styleOf(leadSpec));
  const needsTemplate = (!leadSpec.template || leadSpec.template === "single") && kept2.some((s) => s.spec.template && s.spec.template !== "single");
  const sheet = wireCss(leadSpec) + surfaceCss(kept2.map((s) => surfaceOf(styleOf(s.spec))).filter((s) => s !== leadSurface)) + (needsTemplate ? templateCss("split") : "");
  const sections = kept2.map((s) => {
    const mine = links.filter((l) => l.from === s.id);
    const density = s.spec.slots.every((x) => x.block === null) ? void 0 : s.spec.density;
    return `<section class="pscreen" data-screen="${esc(s.id)}" data-title="${esc(s.title)}" style="${esc(themeDecls(styleOf(s.spec), density))}" hidden>${bind(renderFrame(s.spec), mine)}</section>`;
  });
  const table = {
    start,
    screens: kept2.map((s) => ({ id: s.id, title: s.title, hotspots: hotspots(s.spec).length })),
    links: links.map((l) => ({ from: l.from, key: l.key, to: l.to, ...l.needs ? { needs: l.needs } : {}, t: l.transition, rule: l.rule }))
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
function playAnchor(screen, hot) {
  return `screen=${encodeURIComponent(screen)}${hot ? `&hot=${encodeURIComponent(hot)}` : ""}`;
}

// packages/modules/wireframe/src/compose.ts
function requestBlueprint(request, flow) {
  return { ...blueprint("home", { request, flow, title: request }), round: 0 };
}
function platformFor(r, platform) {
  if (r.platforms.includes(platform)) return platform;
  const twin = platform === "web" ? "site" : platform === "site" ? "web" : null;
  return twin && r.platforms.includes(twin) ? twin : null;
}
var HEADER_OPTIONS = [
  ...new Set(RECIPES.flatMap((r) => r.sections.filter((s) => s.region === "header" && s.options.length > 1).flatMap((s) => s.options)))
];
var NAV_OPTIONS = [
  .../* @__PURE__ */ new Set([...RECIPES.flatMap((r) => r.sections.filter((s) => s.region === "nav").flatMap((s) => s.options)), "navbar", "none"])
];
var PLATFORM_WORDS = {
  app: "a phone app",
  web: "a web app used at a desk",
  site: "a public, scrolling website"
};
var CHROME_WORDS = {
  "tab-bar": "tabs along the bottom of the screen",
  "side-nav": "a navigation column down the side",
  navbar: "a navigation bar across the top",
  none: "no persistent navigation",
  "app-bar": "a compact bar: a title and icon actions",
  "page-header": "a large page title with actions"
};
function flowRequest(request) {
  const questions = {};
  for (const r of RECIPES) {
    questions[`needs:${r.id}`] = {
      type: "noul",
      // Plain words, not the recipe's component ids: on Enrico they read 1–3 points more accurately for ~20% fewer tokens (24 Sep 2026).
      instructions: `Does the product in the request need this screen: ${ARCHETYPE_WORDS[r.id]}? Yes only if the request implies one.`
    };
  }
  questions.platform = {
    type: "choice",
    instructions: "Which platform is this product for?",
    criteria: Object.fromEntries(PLATFORMS.map((p) => [p, PLATFORM_WORDS[p]]))
  };
  questions.nav = {
    type: "choice",
    instructions: "Which persistent navigation should every screen of this product share?",
    criteria: Object.fromEntries(NAV_OPTIONS.map((n) => [n, CHROME_WORDS[n] ?? null]))
  };
  questions.header = {
    type: "choice",
    instructions: "Which header should every screen of this product share?",
    criteria: Object.fromEntries(HEADER_OPTIONS.map((h) => [h, CHROME_WORDS[h] ?? null]))
  };
  return { model: JEV_MODEL, state: { request }, questions };
}
var NEEDS_YES = 0.5;
var MAYBE_FLOOR = 0.3;
function decideFlow(req, res) {
  const answer = (id) => chosenOption(req.questions[id], res.answers[id]);
  const platform = answer("platform");
  const nav = answer("nav");
  const header = answer("header");
  const archetypes = [];
  const declined = [];
  let best = null;
  for (const r of RECIPES) {
    const yes = res.answers[`needs:${r.id}`].noul;
    if (!best || yes > best.p) best = { id: r.id, p: yes };
    if (yes < MAYBE_FLOOR) declined.push({ id: r.id, p: yes, why: "no" });
    else if (!platformFor(r, platform.value)) declined.push({ id: r.id, p: yes, why: "platform" });
    else archetypes.push({ id: r.id, p: yes, ...yes < NEEDS_YES ? { maybe: true } : {} });
  }
  if (archetypes.length === 0 && best) {
    const r = recipe(best.id);
    if (platformFor(r, platform.value)) {
      archetypes.push({ ...best, ...best.p < NEEDS_YES ? { maybe: true } : {} });
      declined.splice(declined.findIndex((d) => d.id === best.id), 1);
    }
  }
  if (archetypes.length === 0) throw new Error(`no wave-1 archetype draws on ${platform.value} for this request`);
  return {
    platform: platform.value,
    chrome: { nav: nav.value, header: header.value },
    archetypes,
    declined,
    distributions: { platform: platform.distribution, nav: nav.distribution, header: header.distribution }
  };
}
function alternativesOf(distribution, options, chosen) {
  return options.filter((o) => o !== chosen && (distribution[o] ?? 0) > 0).map((o) => ({ block: o, p: distribution[o] })).sort((a, b) => b.p - a.p);
}
function chromeFor(section, chrome) {
  if (section.region === "header" && section.options.includes(chrome.header)) return { block: chrome.header };
  if (section.region === "nav") {
    if (section.options.includes(chrome.nav)) return { block: chrome.nav };
    if (chrome.nav === "none" && section.optional) return "declined";
  }
  return null;
}
function flowScreen(archetype, request, flow, decision) {
  const r = recipe(archetype);
  const platform = platformFor(r, decision.platform);
  const spec = blueprint(archetype, { request, flow, platform });
  const slots = [];
  for (const section of r.sections) {
    const fixed = chromeFor(section, decision.chrome);
    if (fixed === "declined") continue;
    if (fixed === null) {
      slots.push({ slot: section.slot, block: null, props: {} });
      continue;
    }
    const distribution = section.region === "header" ? decision.distributions.header : decision.distributions.nav;
    const alternatives = alternativesOf(distribution, section.options, fixed.block);
    slots.push({
      ...resolveSlot(r.id, section.slot, fixed.block),
      p: distribution[fixed.block] ?? 0,
      ...alternatives.length ? { alternatives } : {}
    });
  }
  const asked = decision.archetypes.find((a) => a.id === archetype);
  return {
    ...spec,
    slots,
    round: 1,
    chrome: decision.chrome,
    ...asked ? { need: asked.p } : {},
    ...asked?.maybe ? { maybe: true } : {}
  };
}
function structureRequest(spec, flowTitles, opts = {}) {
  const r = recipe(spec.archetype);
  const questions = {};
  const candidates = opts.layout ? templatesFor(spec.archetype, spec.platform) : [];
  if (opts.layout && !spec.template && candidates.length > 1) {
    questions.template = {
      type: "choice",
      instructions: `Which layout template best organizes the main body of the ${spec.title} screen?`,
      criteria: Object.fromEntries(candidates.map((t) => [t.id, t.description]))
    };
  }
  if (opts.layout && !spec.density) {
    questions.density = {
      type: "score",
      instructions: `How dense should the spacing on the ${spec.title} screen be?`,
      criteria: ["1: compact", "2: default", "3: spacious"]
    };
  }
  const regionPool = opts.layout ? spec.template ? template(spec.template).regions : [...new Set(candidates.filter((t) => t.id !== "single" && t.regions.length > 1).flatMap((t) => t.regions))] : [];
  for (const slot of spec.slots) {
    if (slot.block !== null) continue;
    const section = r.sections.find((s) => s.slot === slot.slot);
    if (section.optional) {
      questions[`${section.slot}:include`] = {
        type: "noul",
        instructions: `Does the ${spec.title} screen need ${section.options.join(" or ")} in its ${section.region}?`
      };
    }
    if (section.options.length > 1) {
      questions[section.slot] = {
        type: "choice",
        instructions: `Which block fills the ${section.region} of the ${spec.title} screen here?`,
        criteria: Object.fromEntries(section.options.map((o) => [o, `a ${component(o).category} block`]))
      };
    }
    if (opts.layout && section.region === "main" && !slot.region && regionPool.length > 1) {
      questions[`${section.slot}:region`] = {
        type: "choice",
        instructions: `Which template region does ${section.slot} sit in on the ${spec.title} screen?`,
        criteria: Object.fromEntries(regionPool.map((reg) => [reg, `the ${reg} region`]))
      };
    }
  }
  return {
    model: JEV_MODEL,
    state: { request: spec.request, platform: spec.platform, screens: flowTitles, screen: spec.title, chrome: spec.chrome },
    questions
  };
}
function applyStructure(spec, req, res) {
  const r = recipe(spec.archetype);
  const chosenTemplate = req.questions.template && res.answers.template ? chosenOption(req.questions.template, res.answers.template).value : spec.template;
  const chosenDensity = req.questions.density && res.answers.density ? densityFromScore(chosenOption(req.questions.density, res.answers.density).value) : spec.density;
  const slots = [];
  const declined = [...spec.declined ?? []];
  for (const slot of spec.slots) {
    if (slot.block !== null) {
      slots.push(slot);
      continue;
    }
    const section = r.sections.find((s) => s.slot === slot.slot);
    const pick = section.options.length > 1 ? chosenOption(req.questions[section.slot], res.answers[section.slot]) : null;
    const block = pick?.value ?? section.options[0];
    let pOut = 0;
    if (section.optional) {
      const include = chosenOption(req.questions[`${section.slot}:include`], res.answers[`${section.slot}:include`]);
      pOut = include.distribution.false;
      if (include.value === "false") {
        declined.push({ slot: section.slot, p: pOut, block });
        continue;
      }
    }
    const alternatives = [
      ...pick ? alternativesOf(pick.distribution, section.options, block) : [],
      ...pOut > 0 ? [{ block: LEAVE_OUT, p: pOut }] : []
    ].sort((a, b) => b.p - a.p);
    const p = pick ? pick.p : section.optional ? 1 - pOut : void 0;
    const regionQ = req.questions[`${section.slot}:region`];
    const regionA = res.answers[`${section.slot}:region`];
    const pickedRegion = regionQ && regionA ? chosenOption(regionQ, regionA).value : slot.region;
    slots.push({
      ...resolveSlot(r.id, section.slot, block),
      ...p !== void 0 ? { p } : {},
      ...alternatives.length ? { alternatives } : {},
      ...pickedRegion !== void 0 ? { region: pickedRegion } : {}
    });
  }
  const mainSlots = slots.filter((s) => r.sections.find((sec) => sec.slot === s.slot)?.region === "main");
  if (chosenTemplate && chosenTemplate !== "single") {
    const tpl = template(chosenTemplate);
    mainSlots.forEach((s, idx) => {
      if (!s.region || !tpl.regions.includes(s.region)) {
        s.region = defaultSlotRegion(tpl.id, s, idx, mainSlots.length);
      }
    });
  } else {
    mainSlots.forEach((s) => {
      delete s.region;
    });
  }
  return {
    ...spec,
    slots,
    round: 2,
    ...chosenTemplate !== void 0 ? { template: chosenTemplate } : {},
    ...chosenDensity !== void 0 ? { density: chosenDensity } : {},
    ...declined.length ? { declined } : {}
  };
}
function propQuestion(label, def) {
  switch (def.kind) {
    case "choice":
      if (def.values.length < 2) return null;
      return { q: { type: "choice", instructions: `${label}: which?`, criteria: Object.fromEntries(def.values.map((v) => [v, null])) }, read: (v) => v };
    case "flag":
      return { q: { type: "noul", instructions: `${label}: yes or no?` }, read: (v) => v === "true" };
    case "count": {
      const levels = Array.from({ length: def.max - def.min + 1 }, (_, i) => String(def.min + i));
      if (levels.length < 2) return null;
      const q = levels.length <= 10 ? { type: "score", instructions: `${label}: how many?`, criteria: levels } : { type: "choice", instructions: `${label}: how many?`, criteria: Object.fromEntries(levels.map((l) => [l, null])) };
      return { q, read: (v) => Number(v) };
    }
    case "index": {
      if (def.max < 2) return null;
      const levels = Array.from({ length: def.max }, (_, i) => String(i + 1));
      return { q: { type: "choice", instructions: `${label}: which one, counted from 1?`, criteria: Object.fromEntries(levels.map((l) => [l, null])) }, read: (v) => Number(v) };
    }
  }
}
var PER_SCREEN_NAV_PROPS = /* @__PURE__ */ new Set(["selected"]);
function isNavChrome(r, slot) {
  return r.sections.find((s) => s.slot === slot.slot)?.region === "nav";
}
function propsRequest(spec, sharedNav = /* @__PURE__ */ new Set()) {
  const r = recipe(spec.archetype);
  const questions = {};
  for (const slot of spec.slots) {
    if (slot.block === null) continue;
    const c = component(slot.block);
    const settled = r.props?.[c.id] ?? {};
    const shared = isNavChrome(r, slot) && sharedNav.has(c.id);
    for (const [key, def] of Object.entries(c.props)) {
      if (key in settled || shared && !PER_SCREEN_NAV_PROPS.has(key)) continue;
      const pq = propQuestion(`The ${c.id} in the ${slot.slot} of the ${spec.title} screen \u2014 ${key}`, def);
      if (pq) questions[`${slot.slot}:${c.id}.${key}`] = pq.q;
    }
    for (const [element, el] of Object.entries(c.elements ?? {})) {
      if (el.accepts.length < 2 || shared) continue;
      questions[`${slot.slot}:${c.id}#${element}`] = {
        type: "choice",
        instructions: `What does ${element} of the ${c.id} on the ${spec.title} screen do?`,
        criteria: Object.fromEntries(el.accepts.map((i) => [i, null]))
      };
    }
  }
  return {
    model: JEV_MODEL,
    state: {
      request: spec.request,
      platform: spec.platform,
      screen: spec.title,
      blocks: Object.fromEntries(spec.slots.filter((s) => s.block).map((s) => [s.slot, s.block]))
    },
    questions
  };
}
function applyProps(spec, req, res) {
  const r = recipe(spec.archetype);
  const slots = spec.slots.map((slot) => {
    if (slot.block === null) return slot;
    const c = component(slot.block);
    const settled = r.props?.[c.id] ?? {};
    const props = {};
    for (const [key, def] of Object.entries(c.props)) {
      if (key in settled) continue;
      const id = `${slot.slot}:${c.id}.${key}`;
      const pq = propQuestion("", def);
      if (!pq || !req.questions[id]) continue;
      props[key] = pq.read(chosenOption(req.questions[id], res.answers[id]).value);
    }
    const resolved = resolveSlot(r.id, slot.slot, slot.block, props);
    const present = presentElements(c, resolved.props);
    const intents = { ...resolved.intents ?? {} };
    const used = /* @__PURE__ */ new Set();
    for (const element of present) {
      const id = `${slot.slot}:${c.id}#${element}`;
      if (req.questions[id]) {
        const pick = chosenOption(req.questions[id], res.answers[id]);
        const ranked = [pick.value, ...Object.entries(pick.distribution).sort((a, b) => b[1] - a[1]).map(([k]) => k)];
        intents[element] = ranked.find((k) => !used.has(k)) ?? pick.value;
      }
      used.add(intents[element]);
    }
    const out = { ...resolved };
    if (present.length > 0) out.intents = intents;
    if (slot.p !== void 0) out.p = slot.p;
    if (slot.alternatives) out.alternatives = slot.alternatives;
    if (slot.region !== void 0) out.region = slot.region;
    return out;
  });
  return { ...spec, slots, round: 3 };
}
function navOwners(specs) {
  const owners = /* @__PURE__ */ new Map();
  specs.forEach((spec, i) => {
    const r = recipe(spec.archetype);
    for (const slot of spec.slots) if (slot.block && isNavChrome(r, slot) && !owners.has(slot.block)) owners.set(slot.block, i);
  });
  return owners;
}
function propsRequests(specs) {
  const owners = navOwners(specs);
  return specs.map((spec, i) => propsRequest(spec, new Set([...owners].filter(([, owner]) => owner !== i).map(([block]) => block))));
}
function shareNav(specs) {
  const owners = navOwners(specs);
  return specs.map((spec, i) => {
    const r = recipe(spec.archetype);
    const slots = spec.slots.map((slot) => {
      if (!slot.block || !isNavChrome(r, slot)) return slot;
      const owner = owners.get(slot.block);
      if (owner === i) return slot;
      const from = specs[owner].slots.find((s) => s.block === slot.block && isNavChrome(recipe(specs[owner].archetype), s));
      const props = { ...from.props, ...Object.fromEntries([...PER_SCREEN_NAV_PROPS].filter((k) => k in slot.props).map((k) => [k, slot.props[k]])) };
      const c = component(slot.block);
      const present = presentElements(c, props);
      const out = { ...slot, props };
      if (present.length > 0) out.intents = Object.fromEntries(present.map((e) => [e, from.intents[e]]));
      else delete out.intents;
      for (const key of PER_SCREEN_NAV_PROPS) {
        const def = c.props[key];
        const cap = typeof props.items === "number" ? props.items : def?.kind === "index" ? def.max : void 0;
        if (typeof out.props[key] === "number" && cap !== void 0 && out.props[key] > cap) out.props = { ...out.props, [key]: cap };
      }
      return out;
    });
    return { ...spec, slots };
  });
}
function applyPropsRound(specs, requests, responses) {
  return shareNav(specs.map((spec, i) => applyProps(spec, requests[i], responses[i])));
}
function pendingRound(specs) {
  const rounds = specs.map((s) => s.round ?? 3);
  const lowest = Math.min(...rounds);
  return lowest >= 3 ? null : lowest + 1;
}
function roundCalls(round, screens) {
  if (round === 1) return [{ item: screens[0].item, request: flowRequest(screens[0].spec.request) }];
  const titles = screens.map((s) => s.spec.title);
  if (round === 3) {
    const requests = propsRequests(screens.map((s) => s.spec));
    return screens.map(({ item }, i) => ({ item, request: requests[i] }));
  }
  return screens.map(({ item, spec }) => ({ item, request: structureRequest(spec, titles, { layout: spec.platform !== "app" }) }));
}
function answeredResponse(call, from) {
  return readResponse(call.request, call.response, from);
}

// packages/modules/wireframe/src/keep.ts
var KEEP_MARK = wireframeModule.marks[0];
var KEEP_PROP = KEEP_MARK.property;
var KEEP_EMOJI = KEEP_MARK.emoji;
var KEEP_BY_PROP = `${KEEP_PROP}By`;
function isKept(item) {
  return Boolean(item.properties?.[KEEP_PROP]);
}
function keepable(item) {
  return markOffered(KEEP_MARK, item);
}
function keepPatch(on, who) {
  return moduleMarkPatch(KEEP_PROP, on, who);
}
function firstChoices(screens) {
  return screens.filter((s) => !s.spec.variantOf && !s.spec.maybe && (s.spec.need ?? 1) >= NEEDS_YES);
}
function kept(canvas) {
  return readingOrder(Object.values(canvas.items).filter(isKept));
}

// packages/modules/wireframe/src/link-override.ts
var LINK_PREFIX = "wireLink:";
function linkProp(key) {
  return `${LINK_PREFIX}${key}`;
}
function overridesOf(properties) {
  const out = readOverrides(properties?.[LINKS_PROP]);
  for (const [prop, value] of Object.entries(properties ?? {})) {
    if (prop.startsWith(LINK_PREFIX) && value) out[prop.slice(LINK_PREFIX.length)] = value;
  }
  return out;
}
function linkPatch(item, key, value) {
  const properties = {};
  const removeProperties = [];
  const legacy = item.properties?.[LINKS_PROP];
  if (legacy !== void 0) {
    for (const [k, v] of Object.entries(readOverrides(legacy))) {
      if (k !== key && item.properties?.[linkProp(k)] === void 0) properties[linkProp(k)] = v;
    }
    removeProperties.push(LINKS_PROP);
  }
  if (value === null) removeProperties.push(linkProp(key));
  else properties[linkProp(key)] = value;
  return { ...Object.keys(properties).length ? { properties } : {}, ...removeProperties.length ? { removeProperties } : {} };
}
function linkChanges(item, key, value) {
  if (item.properties?.[LINKS_PROP] !== void 0) return true;
  return value === null ? item.properties?.[linkProp(key)] !== void 0 : item.properties?.[linkProp(key)] !== value;
}
async function setLinkOverride(port, item, key, value, group) {
  const patch = linkPatch(item, key, value);
  const after = { ...item.properties ?? {}, ...patch.properties ?? {} };
  for (const prop of patch.removeProperties ?? []) delete after[prop];
  const overrides = overridesOf(after);
  if (!linkChanges(item, key, value)) return { overrides, wrote: false };
  await port.send({ type: "item.update", itemId: item.id, patch }, group);
  return { overrides, wrote: true };
}

// packages/modules/wireframe/src/route.ts
var LANE0 = 96;
var LANE = 26;
var MAX_LANES = 4;
var LABEL_H = 16;

// packages/modules/wireframe/src/kept-flows.ts
function keptFlowsOf(canvas, screens) {
  const wires = new Map(screens.map((w) => [w.item, w]));
  const flows = /* @__PURE__ */ new Map();
  for (const item of kept(canvas)) {
    const wire = wires.get(item.id);
    if (!wire) continue;
    const flow = wire.spec.flow;
    const entry = flows.get(flow) ?? { flow, request: wire.spec.request, screens: [], items: [], guests: [] };
    entry.screens.push({ id: item.id, title: item.title, spec: wire.spec, overrides: overridesOf(item.properties) });
    entry.items.push(item);
    flows.set(flow, entry);
  }
  const all = [...flows.values()];
  const home = new Map(all.flatMap((f) => f.screens.map((s, i) => [s.id, { screen: s, item: f.items[i] }])));
  for (const f of all) {
    const own = new Set(f.screens.map((s) => s.id));
    for (const target of f.screens.flatMap((s) => Object.values(s.overrides ?? {}))) {
      const guest = home.get(target);
      if (!guest || own.has(target)) continue;
      own.add(target);
      f.screens.push(guest.screen);
      f.items.push(guest.item);
      f.guests.push(target);
    }
  }
  return all;
}
function prototypeScreens(canvas, prototype, screens) {
  const flow = prototype.properties?.[PROTOTYPE_PROP];
  if (flow === void 0) return [];
  return keptFlowsOf(canvas, screens).find((f) => f.flow === flow)?.items ?? [];
}
function pickKeptFlow(flows, wanted, flag = "--flow") {
  if (flows.length === 0) throw new Error("no screen is in a prototype \u2014 `isocan wire use <screens...>` marks the screens a prototype plays");
  if (wanted !== void 0) {
    const found = flows.find((f) => f.flow === wanted);
    if (!found) throw new Error(`no screen of flow "${wanted}" is in a prototype \u2014 flows with screens in one: ${flows.map((f) => `${f.flow || "(hand-drawn)"} "${f.request}"`).join(", ")}`);
    return found;
  }
  if (flows.length > 1) {
    throw new Error(`the screens in a prototype come from ${flows.length} flows \u2014 say which with ${flag}:
  ${flows.map((f) => `${flag} ${f.flow || '""'}  "${f.request}" (${f.screens.length} in the prototype)`).join("\n  ")}`);
  }
  return flows[0];
}
function prototypeTitle(flow) {
  return `Prototype \xB7 ${flow.request.length > 60 ? `${flow.request.slice(0, 59)}\u2026` : flow.request || "hand-drawn screens"}`;
}
function sharedGroup(items) {
  const first = items[0]?.containerId;
  return first && items.every((i) => i.containerId === first) ? { containerId: first, groupPlacement: "exact" } : void 0;
}
var PROTOTYPE_AT_PROP = "wirePrototypeAt";
var PROTOTYPE_CLEAR = LANE0 + (MAX_LANES + 1) * LANE + LABEL_H + 24;
var meets = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
function prototypeSpot(canvas, flow, size, self) {
  const own = flow.items.filter((i) => !flow.guests.includes(i.id));
  const left = Math.min(...own.map((i) => i.x));
  const right = Math.max(...own.map((i) => i.x + i.width));
  const top = Math.min(...own.map((i) => i.y));
  const x = Math.round((left + right) / 2 - size.width / 2);
  let y = Math.round(top - PROTOTYPE_CLEAR - size.height);
  const others = Object.values(canvas.items ?? {}).filter((i) => i.id !== self && i.properties?.kind !== "group");
  for (let i = 0; i < 50; i++) {
    const want = { x: x - 20, y: y - 60, width: size.width + 40, height: size.height + 80 };
    const hit = others.filter((o) => meets(want, { x: o.x, y: o.y, width: o.width, height: o.height }));
    if (hit.length === 0) break;
    y = Math.round(Math.min(...hit.map((o) => o.y)) - 80 - size.height);
  }
  return { x, y };
}
var atOf = (p) => `${Math.round(p.x)},${Math.round(p.y)}`;
function placedByComposer(item) {
  const at = item.properties?.[PROTOTYPE_AT_PROP];
  return typeof at !== "string" || at === atOf(item);
}
async function writePrototype(port, canvas, flow, group) {
  const links = inferLinks(flow.screens);
  const title = prototypeTitle(flow);
  const html = assemblePrototype(flow.screens, links, { title });
  const { width, height } = prototypeSize(flow.screens);
  const filename = "prototype.html";
  const upload = await port.put(html, "text/html", filename);
  const version = { id: newVersionId(), blobHash: upload.blobHash, mimeType: "text/html", filename, size: upload.size };
  const existing = Object.values(canvas.items ?? {}).find((i) => i.properties?.[PROTOTYPE_PROP] === flow.flow);
  const own = flow.items.filter((i) => !flow.guests.includes(i.id));
  if (existing) {
    const same = currentVersionOf(existing)?.blobHash === upload.blobHash;
    if (!same) await port.send({ type: "item.addVersion", itemId: existing.id, version }, group);
    if (existing.width !== width || existing.height !== height) await port.send({ type: "item.resize", itemId: existing.id, width, height }, group);
    if (existing.title !== title) await port.send({ type: "item.update", itemId: existing.id, patch: { title } }, group);
    const moved = placedByComposer(existing) ? await place(port, canvas, flow, existing.id, { width, height }, existing, group) : false;
    return { itemId: existing.id, title, links, what: !same ? "versioned" : moved ? "moved" : "unchanged" };
  }
  const itemId = newItemId();
  const spot = prototypeSpot(canvas, flow, { width, height });
  const landed = await port.send({
    type: "item.add",
    itemId,
    version,
    width,
    height,
    placement: { ...spot, chosen: true },
    title,
    // A wireframe's fidelity, so the design-system gate does not count it as an undesigned screen.
    properties: { [FIDELITY_PROP]: "wireframe", [PROTOTYPE_PROP]: flow.flow, [PROTOTYPE_AT_PROP]: atOf(spot) },
    // In the group its screens live in, when they share one (Porchlight #6).
    ...sharedGroup(own) ?? {}
  }, group);
  if (landed && atOf(landed) !== atOf(spot)) await port.send({ type: "item.update", itemId, patch: { properties: { [PROTOTYPE_AT_PROP]: atOf(landed) } } }, group);
  return { itemId, title, links, what: "added" };
}
async function place(port, canvas, flow, itemId, size, item, group) {
  const spot = prototypeSpot(canvas, flow, size, itemId);
  const recorded = item.properties?.[PROTOTYPE_AT_PROP];
  if (atOf(item) === atOf(spot) && recorded === atOf(spot)) return false;
  if (atOf(item) !== atOf(spot)) await port.send({ type: "item.move", itemId, x: spot.x, y: spot.y }, group);
  const now = (await port.canvas()).items[itemId];
  await port.send({ type: "item.update", itemId, patch: { properties: { [PROTOTYPE_AT_PROP]: atOf(now ?? spot) } } }, group);
  return true;
}
async function rebuildPrototypes(port, canvas, all, changed, group) {
  const out = [];
  const touched = new Set(changed.map((s) => s.spec.flow));
  const now = all.map((s) => changed.find((c) => c.item === s.item) ?? s);
  for (const flow of keptFlowsOf(canvas, now)) {
    if (!touched.has(flow.flow)) continue;
    if (!Object.values(canvas.items).some((i) => i.properties?.[PROTOTYPE_PROP] === flow.flow)) continue;
    const written = await writePrototype(port, canvas, flow, group);
    out.push({ itemId: written.itemId, what: written.what });
  }
  return out;
}

// packages/modules/wireframe/src/rerender.ts
async function writeWire(port, item, spec, group, was) {
  const current = currentVersionOf(item);
  const filename = current?.filename ?? "wireframe.html";
  const upload = await port.put(renderWire(spec), "text/html", filename);
  const { width, height } = wireSize(spec);
  const resize = item.width !== width || item.height !== height;
  const retitle = was !== void 0 && item.title === wireTitle(was) && wireTitle(spec) !== wireTitle(was);
  if (current?.blobHash === upload.blobHash && !resize && !retitle) return false;
  if (current?.blobHash !== upload.blobHash) {
    await port.send({ type: "item.addVersion", itemId: item.id, version: { id: newVersionId(), blobHash: upload.blobHash, mimeType: "text/html", filename, size: upload.size } }, group);
  }
  if (resize) await port.send({ type: "item.resize", itemId: item.id, width, height }, group);
  if (retitle) await port.send({ type: "item.update", itemId: item.id, patch: { title: wireTitle(spec) } }, group);
  return true;
}
async function rerender(port, canvas, all, screens, opts = {}) {
  const group = opts.group ?? newGroupId();
  const changed = [];
  let resized = 0;
  for (const s of screens) {
    const item = canvas.items[s.item];
    if (!item) continue;
    const { width, height } = wireSize(s.spec);
    if (await writeWire(port, item, s.spec, group)) {
      changed.push(s);
      if (item.width !== width || item.height !== height) resized += 1;
    }
  }
  const prototypes = await rebuildPrototypes(port, canvas, all, screens, group);
  return { group, screens, changed, resized, prototypes };
}
function rerenderSummary(r) {
  const protos = r.prototypes.filter((p) => p.what !== "unchanged").length;
  const n = r.screens.length;
  const head = `${r.changed.length} of ${n} wire${n === 1 ? "" : "s"} re-rendered \xB7 ${n - r.changed.length} unchanged`;
  const resized = r.resized ? ` \xB7 ${r.resized} resized to the screen alone` : "";
  const proto = r.prototypes.length ? ` \xB7 ${protos} of ${r.prototypes.length} prototype${r.prototypes.length === 1 ? "" : "s"} rebuilt` : "";
  const tail = r.changed.length || protos ? " \u2014 one op group: one undo takes it back" : " \u2014 nothing written";
  return `${head}${resized}${proto}${tail}`;
}
function rerenderLines(r) {
  return r.changed.map((s) => `${s.item}  ${wireTitle(s.spec)} \u2014 re-rendered`);
}

export {
  requestBlueprint,
  decideFlow,
  chromeFor,
  flowScreen,
  applyStructure,
  applyPropsRound,
  pendingRound,
  roundCalls,
  answeredResponse,
  KEEP_MARK,
  KEEP_EMOJI,
  isKept,
  keepable,
  keepPatch,
  firstChoices,
  kept,
  currentVersionOf,
  PROTOTYPE_PROP,
  playAnchor,
  overridesOf,
  setLinkOverride,
  keptFlowsOf,
  prototypeScreens,
  pickKeptFlow,
  PROTOTYPE_CLEAR,
  writePrototype,
  rebuildPrototypes,
  writeWire,
  rerender,
  rerenderSummary,
  rerenderLines
};
