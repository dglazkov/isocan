import { INTENT_BY_ID, component, type DrawContext, type Region, type Section } from "./catalog/index.ts";
import { esc } from "./catalog/draw.ts";
import { hotKey } from "./links.ts";
import {
  PLATFORM_SIZE, defaultIntent, propsFor, recipe, validateWire, wireTitle, type WireSlot, type WireSpec,
} from "./spec.ts";
import { themeDecls, type WireStyle } from "./theme.ts";

/**
 * **The renderer — skeleton, then wire** (design §3).
 *
 * `renderWire(spec)` is pure and runs the same on both surfaces, so the web
 * app and the CLI draw one screen identically. Two looks, one layout:
 *
 * - **Skeleton**, for a slot whose `block` is null: white ground, 1px blue
 *   rules, the slot's name in small blue caps; dashed where the slot is
 *   optional and nobody has decided.
 * - **Wire**, for a chosen block: drawn from the theme's roles (`theme.ts`) —
 *   by default the greyscale of the design-competition IDEO pack, or the
 *   governing design system's tokens once `wire style` has mapped them; real
 *   labels on actionable elements, from their intents; bars for body copy —
 *   or, on a fleshed screen (design §10), each slot's `fill`: sample words,
 *   numbers and pictograms, drawn in the same roles.
 *
 * **Just the screen** (phase 8). The file is the screen and nothing else: no
 * name strip above it (the item's own title names it on the canvas) and no
 * device outline inside the item's frame (the item's frame IS the device —
 * two sets of corners that disagree is what Dion saw). The app chrome that
 * belongs to the screen — its status bar, app bar, tab bar — stays. The
 * prototype sets several frames side by side on a stage (`renderFrame`), and
 * keeps its outlines there, where no item frame surrounds each one.
 *
 * The file is self-contained — no font, script or stylesheet it has to
 * fetch — and carries its own spec, so it outlives the module that drew it.
 * The skeleton's stylesheet is only written when a slot is undecided, which
 * is how a finished wireframe is guaranteed to hold no blue at all.
 */

export const WIRE_MARKER = "<!-- isocan:wireframe -->";
export const WIRE_SCRIPT_ID = "isocan-wireframe";

/** Every colour the skeleton draws with — the `#2f6fed` family. A resolved slot must contain none of them. */
export const SKELETON_COLORS = ["#2f6fed", "#7fa3f3", "#f3f7fe"] as const;

const [BLUE, BLUE_SOFT, BLUE_GROUND] = SKELETON_COLORS;

/** A multiple of the `space` role. */
const S = (n: number) => `calc(var(--w-space) * ${n})`;
/** The `radius` role, scaled and capped: a card can follow a system's corners without turning into a pill. */
const R = (cap: number, scale = 1) => (scale === 1 ? `min(var(--w-radius), ${cap}px)` : `min(calc(var(--w-radius) * ${scale}), ${cap}px)`);
/** Derived shades — always of roles, never a colour of their own. */
const PAGE = "color-mix(in srgb, var(--w-surface) 25%, var(--w-ground))";
const BAR_KEY = "color-mix(in srgb, var(--w-bar) 83%, var(--w-ink))";
const BAR_SOFT = "color-mix(in srgb, var(--w-bar) 70%, var(--w-ground))";
const SELECTED = "color-mix(in srgb, var(--w-primary) 80%, var(--w-ground))";
const SCRIM = "color-mix(in srgb, var(--w-ink) 28%, transparent)";

/**
 * **The wire sheet — roles only** (design §9). Every colour, the type, the
 * corners and the spacing are `var(--w-<role>)` or a mix of roles; the values
 * come from the theme block `wireCss` writes before it (`theme.ts`), which is
 * the only place a wire's colour is literal. `theme.test.ts` holds this sheet
 * to that, and `render.test.ts` holds it free of the skeleton's blue.
 */
const WIRE_CSS = `
*{box-sizing:border-box}
html,body{margin:0;background:${PAGE}}
body{font:14px/1.4 var(--w-font);color:var(--w-ink);padding:0}
.frame{position:relative;display:flex;flex-direction:column;background:var(--w-ground);border:1.5px solid var(--w-line);border-radius:4px;overflow:hidden}
.frame.app{border-radius:28px}
.frame.site{overflow:visible}
body.screen>.frame{border:0;border-radius:0}
.frame>.body{flex:1;display:flex;min-height:0}
.frame>.body>.main{flex:1;display:flex;flex-direction:column;gap:${S(1.5)};padding:${S(2)};min-width:0;overflow:hidden}
.frame.site>.body>.main{overflow:visible}
.frame>.body>.side{width:232px;border-right:1px solid var(--w-surface);display:flex;flex-direction:column}
.frame.app>.body>.side{width:84px}
.frame>.body>.aside{width:300px;border-left:1px solid var(--w-surface);padding:${S(2)};display:flex;flex-direction:column;gap:${S(1.5)}}
.frame>.foot{padding:${S(1.5)} ${S(2)};border-top:1px solid var(--w-surface);display:flex;flex-direction:column;gap:${S(1)}}
.fabs{position:absolute;right:20px;bottom:88px}
.frame.web .fabs,.frame.site .fabs{bottom:24px}
.layer{position:absolute;inset:0;background:${SCRIM};display:flex;flex-direction:column;justify-content:flex-end}
.layer.center{justify-content:center;align-items:center;padding:24px}
.layer.left{justify-content:flex-start;align-items:stretch;flex-direction:row}
.layer>.slot{width:100%}
.layer.center>.slot{max-width:340px}
.layer.left>.slot{width:78%;max-width:320px}
.slot{min-width:0}
.bar{display:block;height:8px;border-radius:4px;background:var(--w-bar);margin:5px 0;max-width:100%}
.bar.k{background:${BAR_KEY};height:10px}
.bar.title{background:var(--w-ink-muted);height:16px;margin:8px 0}
.bar.fat{background:var(--w-ink-muted);height:18px}
.bar.meta{background:${BAR_SOFT};height:7px}
.bar.in{display:inline-block;margin:0;vertical-align:middle}
.bar.ph{background:${BAR_SOFT};margin:0}
.bar.lbl-bar{height:7px;margin:0 0 6px}
.bar.cap{margin-top:8px}
.bar.rule{height:1px;background:var(--w-surface)}
.h{font-weight:700;color:var(--w-ink);line-height:1.2}
.h1{font-size:26px}.h2{font-size:22px}.h3{font-size:18px}.h4{font-size:16px}
.txt.s .bar{height:6px}.txt.l .bar{height:10px}.txt.quote{border-left:3px solid var(--w-line);padding-left:10px}.txt.caption .bar{background:${BAR_SOFT}}
.img{width:100%;border:1.5px solid var(--w-line);border-radius:${R(12)};background:var(--w-surface) linear-gradient(to top right,transparent calc(50% - 1px),var(--w-line) calc(50% - 1px),var(--w-line) calc(50% + 1px),transparent calc(50% + 1px)),linear-gradient(to bottom right,transparent calc(50% - 1px),var(--w-line) calc(50% - 1px),var(--w-line) calc(50% + 1px),transparent calc(50% + 1px))}
.img.sm{width:72px}
.logo{display:flex;justify-content:center}
.img.illustration{border-radius:50%;width:70%;margin:0 auto}
.img.cover{height:auto;border-radius:0}
.img.thumb-img{width:64px;flex:none}
.actions{display:flex;gap:8px}
.actions.stack{flex-direction:column}
.actions.row{justify-content:flex-end;flex-wrap:wrap}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:44px;padding:0 18px;border-radius:var(--w-radius);font-weight:700;font-size:15px;border:1.5px solid var(--w-primary);white-space:nowrap}
.btn.block{flex:1;width:100%}
.btn.primary{background:var(--w-primary);color:var(--w-on-primary)}
.btn.secondary{background:var(--w-ground);color:var(--w-link)}
.btn.tertiary{background:transparent;border-color:transparent;color:var(--w-link);text-decoration:underline}
.btn.destructive{background:var(--w-ground);color:var(--w-ink);border-color:var(--w-ink);border-width:3px}
.btn.s{height:32px;padding:0 12px;font-size:13px}
.btn.l{height:52px}
.btn.disabled{background:var(--w-surface);border-color:var(--w-line);color:var(--w-ink-muted)}
.btn.loading::after{content:"…"}
.ibtn{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;font-size:18px;color:var(--w-ink);flex:none}
.lnk{color:var(--w-link);font-weight:600;text-decoration:underline;font-size:14px}
.link-row{display:flex;gap:8px;justify-content:center;align-items:center;padding:6px 0}
.link-row .bar{width:90px!important}
.av{display:inline-block;border-radius:50%;background:var(--w-surface);border:1.5px solid var(--w-line);flex:none}
.av.s{width:28px;height:28px}.av.m{width:40px;height:40px}.av.l{width:88px;height:88px}
.ico{display:inline-block;width:24px;height:24px;border-radius:6px;background:var(--w-surface);border:1.5px solid var(--w-line);flex:none}
.fld{display:flex;flex-direction:column;gap:6px}
.lbl{font-size:13px;font-weight:600;color:var(--w-ink-muted)}
.fld .box,.composer .box{height:44px;border:1.5px solid var(--w-line);border-radius:var(--w-radius);display:flex;align-items:center;padding:0 12px;background:var(--w-ground)}
.fld .box .bar{width:45%!important}
.form{display:flex;flex-direction:column;gap:${S(1.75)}}
.form.center,.center{text-align:center;align-items:center}
.between{display:flex;justify-content:space-between;align-items:center}
.chk{display:flex;align-items:center;gap:8px;font-size:14px}
.chk .bar{width:90px!important}
.cb{display:inline-block;width:18px;height:18px;border:1.5px solid var(--w-ink-muted);border-radius:3px;flex:none}
.cb.on{background:${SELECTED};border-color:${SELECTED}}
.or{padding:4px 0}
.logo-dot{display:inline-block;width:16px;height:16px;border-radius:50%;background:var(--w-line)}
.code{display:flex;gap:8px;justify-content:center}
.code span{width:40px;height:48px;border:1.5px solid var(--w-line);border-radius:${R(12)}}
.glyph{font-size:40px;color:var(--w-ink-muted);line-height:1.2}
.glyph.big{font-size:44px;font-weight:800;color:var(--w-ink)}
.chips{display:flex;gap:8px;flex-wrap:wrap}
.chip{display:inline-flex;align-items:center;height:30px;padding:0 14px;border-radius:15px;border:1.5px solid var(--w-line)}
.chip .bar{width:36px!important}
.chip.on{background:${SELECTED};border-color:${SELECTED}}
.chip.on .bar{background:var(--w-on-primary)}
.tg{display:inline-block;width:40px;height:24px;border-radius:12px;background:var(--w-surface);border:1.5px solid var(--w-line);position:relative;flex:none}
.tg::after{content:"";position:absolute;top:2px;left:2px;width:17px;height:17px;border-radius:50%;background:var(--w-ground);border:1px solid var(--w-line)}
.tg.on{background:${SELECTED};border-color:${SELECTED}}.tg.on::after{left:18px}
.list .row,.settings .row{display:flex;align-items:center;gap:12px;padding:10px 0;min-height:52px}
.list.div .row+.row{border-top:1px solid var(--w-surface)}
.list.inset{border:1px solid var(--w-surface);border-radius:${R(16)};padding:0 12px}
.row-t{flex:1;min-width:0}
.chev{color:var(--w-ink-muted);font-size:22px}
.thumb{width:48px;height:48px;border-radius:${R(12)};background:var(--w-surface);border:1.5px solid var(--w-line);flex:none}
.badge{width:22px;height:18px;border-radius:9px;background:${SELECTED}}
.sec{padding-top:6px}
.search{display:flex;align-items:center;gap:8px;height:44px;border:1.5px solid var(--w-line);border-radius:22px;padding:0 14px}
.search.sm{height:34px;width:220px}
.ico-t{font-size:18px;color:var(--w-ink-muted)}
.ph-t{color:var(--w-ink-muted)}
.scope{margin-left:auto;border-left:1px solid var(--w-line);padding-left:10px}
.seg{display:flex;border:1.5px solid var(--w-line);border-radius:${R(16)};overflow:hidden}
.seg span{flex:1;display:flex;justify-content:center;align-items:center;height:36px}
.seg span+span{border-left:1.5px solid var(--w-line)}
.seg span.on{background:${SELECTED}}.seg span.on .bar{background:var(--w-on-primary)}
.seg .bar{width:50%!important}
.tabs{display:flex;gap:18px;border-bottom:1px solid var(--w-surface)}
.tabs span{padding:10px 0;min-width:56px}
.tabs .bar{width:100%!important}
.tabs span.on{border-bottom:3px solid var(--w-primary)}
.tabs span.on .bar{background:var(--w-ink-muted)}
.tabs.pill{border:0;gap:8px}.tabs.pill span{padding:8px 14px;border-radius:18px;border:1.5px solid var(--w-line)}.tabs.pill span.on{background:${SELECTED};border-color:${SELECTED}}.tabs.pill span.on .bar{background:var(--w-on-primary)}
.tabs.vertical{flex-direction:column;gap:0;border-bottom:0;border-left:1px solid var(--w-surface)}.tabs.vertical span{padding:8px 12px}
.fab-wrap{display:flex;justify-content:flex-end}
.fab{display:inline-flex;align-items:center;justify-content:center;min-width:56px;height:56px;border-radius:28px;background:var(--w-primary);color:var(--w-on-primary);font-size:24px;font-weight:700;padding:0 18px}
.fab.ext{font-size:15px;gap:6px}
.appbar{display:flex;align-items:center;gap:4px;height:56px;padding:0 8px;border-bottom:1px solid var(--w-surface)}
.appbar .t{flex:1;font-weight:700;font-size:17px;padding:0 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tabbar{display:flex;height:64px;border-top:1px solid var(--w-surface)}
.tab{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:var(--w-ink-muted)}
.tab b{font-size:20px;font-weight:400}.tab small{font-size:11px;font-weight:600}
.tab.on{color:var(--w-link)}.tab.on small{text-decoration:underline}
.sidenav{display:flex;flex-direction:column;gap:2px;padding:12px 8px;flex:1}
.sidenav hr{border:0;border-top:1px solid var(--w-surface);width:100%}
.nav-i{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:${R(12)};font-weight:600;color:var(--w-ink-muted);font-size:14px}
.nav-i b{font-weight:400;font-size:17px;width:22px;text-align:center}
.nav-i.on{background:var(--w-surface);color:var(--w-ink)}
.frame.app .sidenav .nav-i{flex-direction:column;gap:2px;font-size:10px;padding:8px 2px;text-align:center}
.dots{display:flex;gap:8px;justify-content:center;padding:8px 0}
.dots i{width:8px;height:8px;border-radius:50%;background:var(--w-line)}
.dots i.on{background:var(--w-primary);width:20px;border-radius:4px}
.steps{display:flex;gap:8px;align-items:flex-start}
.step{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px}
.step b{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;border:1.5px solid var(--w-line);font-size:12px;color:var(--w-ink-muted)}
.step.on b{border-color:var(--w-primary);color:var(--w-link)}
.step.done b{background:${SELECTED};border-color:${SELECTED};color:var(--w-on-primary)}
.step .bar{width:70%!important}
.chart{border:1px solid var(--w-surface);border-radius:${R(16)};padding:12px}
.chart svg{width:100%;height:150px;display:block}
.chart.k-sparkline svg{height:40px}
.stat .chart{border:0;padding:0}
.legend{display:flex;gap:14px;padding-top:8px}
.legend span{display:flex;align-items:center;gap:6px}
.legend i{width:10px;height:10px;border-radius:2px}
.legend .bar{width:48px!important}
.drawer{height:100%;background:var(--w-ground);padding:16px 10px;display:flex;flex-direction:column;gap:2px}
.drawer-head{display:flex;align-items:center;gap:12px;padding:8px 8px 16px;border-bottom:1px solid var(--w-surface);margin-bottom:8px}
.drawer-head .bar{flex:1}
.sheet{background:var(--w-ground);border-radius:${R(24, 2)} ${R(24, 2)} 0 0;padding:14px 16px 20px;display:flex;flex-direction:column;gap:10px}
.sheet.full{min-height:78%}
.sheet.side{border-radius:0;height:100%}
.grab{width:40px;height:5px;border-radius:3px;background:var(--w-line);margin:0 auto 6px}
.sheet-actions{display:flex;flex-direction:column;border:1px solid var(--w-surface);border-radius:${R(16)}}
.sheet-a{padding:14px;text-align:center;font-weight:600;font-size:16px}
.sheet-a+.sheet-a{border-top:1px solid var(--w-surface)}
.sheet-a.destructive{font-weight:800;text-decoration:underline}
.dialog{position:relative;background:var(--w-ground);border-radius:${R(24, 1.5)};padding:20px;display:flex;flex-direction:column;gap:10px;border:1.5px solid var(--w-line)}
.dialog.fullscreen{border-radius:0;min-height:100%}
.dialog .x{position:absolute;right:14px;top:10px;color:var(--w-ink-muted)}
.navbar{display:flex;align-items:center;gap:18px;height:64px;padding:0 20px;border-bottom:1px solid var(--w-surface)}
.navbar .brand .img{width:32px}
.navbar .links{display:flex;gap:18px}
.sp{flex:1}
.chrome{display:flex;align-items:center;gap:6px;height:24px;padding:0 20px;background:var(--w-ground)}
.chrome i{width:14px;height:8px;border-radius:2px;background:var(--w-line)}
.chrome.web{height:32px;background:var(--w-surface);padding:0 12px}
.chrome.web i{width:10px;height:10px;border-radius:50%}
.chrome.web .url{margin-left:12px;background:var(--w-ground);height:16px}
.chrome .clock{width:36px!important;background:var(--w-ink-muted)}
.pagehead{display:flex;flex-direction:column;gap:6px;padding:16px 20px;border-bottom:1px solid var(--w-surface)}
.ph-row{display:flex;align-items:center;gap:8px}
.crumbs{display:flex;gap:6px;align-items:center;color:var(--w-line)}
.crumbs .bar{width:48px!important}
.onb{display:flex;flex-direction:column;gap:18px;justify-content:center;flex:1}
.right{text-align:right}
.wizard,.filters,.settings,.comments,.long,.posts,.plist{display:flex;flex-direction:column;gap:12px}
.card{border:1.5px solid var(--w-line);border-radius:${R(16)};padding:${S(1.25)};display:flex;flex-direction:column;gap:4px;background:var(--w-ground)}
.card .img{border:0;border-radius:${R(12, 0.5)}}
.grp{display:flex;flex-direction:column;gap:6px;padding-bottom:6px;border-bottom:1px solid var(--w-surface)}
.stats{display:grid;gap:10px}
.stats.c2{grid-template-columns:repeat(2,1fr)}.stats.c3{grid-template-columns:repeat(3,1fr)}.stats.c4{grid-template-columns:repeat(4,1fr)}
.stat{border:1.5px solid var(--w-line);border-radius:${R(16)};padding:${S(1.25)}}
.stat .big{padding:4px 0}
.trend{font-size:11px;color:var(--w-ink-muted);display:flex;gap:4px;align-items:center}
.trend .bar{width:40px!important}
.grid{display:grid;gap:10px}
.grid.tight{gap:4px}
.grid.tight .img{border-radius:2px}
.masonry{column-gap:6px}.masonry .img{margin-bottom:6px;break-inside:avoid}
.table{border:1px solid var(--w-surface);border-radius:${R(16)};overflow:hidden}
.toolbar{display:flex;align-items:center;gap:6px;padding:8px;border-bottom:1px solid var(--w-surface)}
.table table{width:100%;border-collapse:collapse;table-layout:fixed}
.table th,.table td{padding:9px 10px;border-bottom:1px solid var(--w-surface);text-align:left}
.table th{background:${PAGE}}
.table .sel{width:36px}
.pager{display:flex;gap:6px;justify-content:flex-end;padding:8px;font-size:13px;color:var(--w-ink-muted)}
.pager span{min-width:24px;text-align:center;padding:2px 4px;border-radius:4px}
.pager .on{background:var(--w-primary);color:var(--w-on-primary)}
.post{display:flex;gap:12px}
.post.grid,.post.featured{flex-direction:column}
.post.list .img{width:88px;flex:none}
.post>div{flex:1;min-width:0}
.featured-top{display:flex;flex-direction:column;gap:4px}
.toc{border-left:3px solid var(--w-line);padding-left:10px}
.detail{display:flex;flex-direction:column;gap:6px}
.metas{display:flex;gap:14px;flex-wrap:wrap}
.meta-i{display:flex;gap:6px;align-items:center}
.meta-i .ico{width:16px;height:16px}
.meta-i .bar{width:60px!important}
.comment{display:flex;gap:10px}
.comment.nested{margin-left:38px}
.composer{display:flex;gap:8px;align-items:center}
.composer .box{flex:1}
.profile{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center}
.profile .bar{margin-left:auto;margin-right:auto}
.profile.covered .av{margin-top:-44px;background:var(--w-ground)}
.pstats{display:flex;gap:28px;padding:6px 0}
.pstats span{display:flex;flex-direction:column;align-items:center;width:56px}
.fpost{display:flex;flex-direction:column;gap:8px;padding-bottom:12px;border-bottom:1px solid var(--w-surface)}
.fhead{display:flex;gap:10px;align-items:center}
.factions{display:flex;gap:18px;font-size:13px;font-weight:600;color:var(--w-ink-muted)}
.video{position:relative}
.play{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:34px;color:var(--w-ink)}
.linkcard{display:flex;gap:10px;border:1.5px solid var(--w-line);border-radius:${R(16)};padding:8px}
.linkcard>div{flex:1}
.carousel{display:flex;flex-direction:column;gap:4px}
.product .stars{font-size:12px;color:var(--w-ink-muted);letter-spacing:1px}
.plist .card.product{flex-direction:row;align-items:center;gap:12px}
.plist .card.product>div{flex:1}
.state{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:6px;flex:1;padding:24px}
.state .bar{margin-left:auto;margin-right:auto}
.state .actions{margin-top:12px;min-width:200px}
.dlist{margin:0;display:flex;flex-direction:column}
.dlist>div{padding:8px 0;border-bottom:1px solid var(--w-surface)}
.dlist.inline>div{display:flex;gap:16px;align-items:center}
.dlist.inline>div .bar{flex:none}
.tx{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.35}
span.tx{display:inline}
.tx.k{font-weight:650;font-size:15px;color:var(--w-ink)}
.tx.k.wrap{white-space:normal}
.tx.meta{font-size:12.5px;color:var(--w-ink-muted)}
.tx.meta.r{flex:none;margin-left:6px}
.tx.body{white-space:normal;font-size:14px;line-height:1.45;color:var(--w-ink-muted)}
.tx.body.clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.tx.title{white-space:normal;font-weight:700;font-size:20px;line-height:1.25;color:var(--w-ink);margin:4px 0 2px}
.tx.big{font-weight:750;font-size:24px;color:var(--w-ink);letter-spacing:-.01em}
.tx.lbl{font-size:12px;font-weight:600;color:var(--w-ink-muted)}
.tx.sec-t{font-size:13px;font-weight:700;color:var(--w-ink);letter-spacing:.02em}
.tx.price{font-weight:700;font-size:15px;color:var(--w-ink);margin-top:2px}
.tx.v{font-size:14px;color:var(--w-ink)}
.tx.cap-t{margin-top:8px}
.st{display:inline-block;font-size:11px;font-weight:650;line-height:1.5;padding:1px 8px;border-radius:10px;background:var(--w-surface);color:var(--w-ink);white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis;vertical-align:middle}
.img.pic{display:flex;align-items:center;justify-content:center;background:var(--w-surface);border-color:var(--w-surface);color:var(--w-ink-muted)}
.img.pic .pg{width:34%;height:auto;aspect-ratio:1;max-width:88px;min-width:22px}
.img.pic.sm .pg,.img.pic.thumb-img .pg{width:52%}
.img.pic.round{border-radius:50%}
.img.pic.illustration .pg{width:40%}
.thumb.pic,.ico.pic,.logo-pic{display:inline-flex;align-items:center;justify-content:center;background:var(--w-surface);border-color:var(--w-surface);color:var(--w-ink-muted)}
.thumb.pic .pg{width:28px;height:28px}
.ico.pic .pg{width:16px;height:16px}
.logo-pic{width:32px;height:32px;border-radius:${R(10)};color:var(--w-ink)}
.logo-pic .pg{width:20px;height:20px}
.av.ini{display:inline-flex;align-items:center;justify-content:center;font-weight:700;color:var(--w-ink-muted);background:var(--w-surface);border-color:var(--w-surface);letter-spacing:.02em}
.av.s.ini{font-size:11px}.av.m.ini{font-size:14px}.av.l.ini{font-size:30px}
.val{color:var(--w-ink);font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lead{color:var(--w-ink-muted);font-size:14px}
.chip{font-size:13px;font-weight:600;color:var(--w-ink);white-space:nowrap}
.chip.on{color:var(--w-on-primary)}
.seg span{font-size:13px;font-weight:600;color:var(--w-ink)}
.seg span.on{color:var(--w-on-primary)}
.tabs.worded span{min-width:0;font-size:14px;font-weight:600;color:var(--w-ink-muted);white-space:nowrap}
.tabs.worded span.on{color:var(--w-ink)}
.tabs.pill.worded span.on{color:var(--w-on-primary)}
.step small{font-size:11px;font-weight:600;color:var(--w-ink-muted)}
.step.on small{color:var(--w-ink)}
.search .q{color:var(--w-ink);font-size:15px;display:inline-flex;align-items:center}
.caret{display:inline-block;width:1.5px;height:18px;background:var(--w-ink);margin-left:1px}
.search .scope .tx{font-size:13px}
.stat .tx.lbl{margin-bottom:2px}
.frame.app .stats.c3 .tx.big,.frame.app .stats.c4 .tx.big{font-size:19px}
.frame.app .stats.c3 .tx.lbl,.frame.app .stats.c4 .tx.lbl{font-size:11px}
.trend{font-size:12px;font-weight:600}
.badge.n{display:inline-flex;align-items:center;justify-content:center;width:auto;min-width:22px;padding:0 6px;font-size:11px;font-weight:700;color:var(--w-on-primary)}
.row-t .tx.meta{margin-top:2px}
.table .tx{font-size:13px}
.table .tx.k{font-size:13.5px}
.table th{font-size:12px;font-weight:650;color:var(--w-ink-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.table td{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pager .count{margin-right:auto;padding-left:4px}
.crumbs .cr{font-size:12.5px;color:var(--w-ink-muted)}
.card .tx.meta{margin-top:1px}
.card.summary{text-align:left;min-width:240px;margin-top:8px}
.comment .by{display:flex;gap:8px;align-items:baseline}
.fpost .tx.body{color:var(--w-ink)}
.pstats span .tx{text-align:center}
.pstats span .tx.big{font-size:18px}
.metas .st{font-size:12px}
.profile .tx.title{margin-top:6px}
.state .tx.body{max-width:300px}
.dlist .tx.lbl{margin-bottom:2px}
.dlist.inline .tx.lbl{flex:none;width:40%}
.onb .center .tx.body{max-width:300px;margin:0 auto}
.ticks{display:flex;justify-content:space-between;padding:4px 6px 0;font-size:11px;color:var(--w-ink-muted)}
.drawer-head .row-t{flex:1}
.clock-t{font-size:12px;font-weight:700;color:var(--w-ink)}
.url-t{margin-left:12px;background:var(--w-ground);border-radius:8px;padding:0 10px;font-size:11px;line-height:18px;color:var(--w-ink-muted);min-width:30%}
`;

/** The skeleton's sheet — written only when some slot is undecided. Every selector begins `.sk`. */
const SKELETON_CSS = `
.sk-frame{border-color:${BLUE}!important;background:#ffffff linear-gradient(${BLUE_GROUND} 1px,transparent 1px) 0 0/100% 24px}
.sk{display:flex;flex-direction:column}
.sk .sk-box{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:4px;border:1px solid ${BLUE};border-radius:3px;background:#ffffff;padding:8px;text-align:center}
.sk.opt .sk-box{border-style:dashed}
.sk .sk-name{font:600 11px/1.2 system-ui,-apple-system,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:${BLUE}}
.sk .sk-opts{font:500 10px/1.3 system-ui,-apple-system,sans-serif;color:${BLUE_SOFT}}
.sk.grow{flex:1}
`;

const SITE_MIN = PLATFORM_SIZE.site.height;

function humanize(id: string): string {
  return id.replace(/-/g, " ");
}

/** The name a skeleton box wears: its one component, or the region it is a choice in. */
function slotName(section: Section): string {
  return section.options.length === 1 ? humanize(section.options[0]!) : humanize(section.region);
}

/** Where a nav section sits: beside main, or along the bottom. */
function navPlacement(slot: WireSlot, section: Section, spec: WireSpec): "side" | "bottom" {
  if (slot.block) return slot.block === "side-nav" ? "side" : "bottom";
  if (!section.options.includes("tab-bar")) return "side";
  if (!section.options.includes("side-nav")) return "bottom";
  return spec.platform === "app" ? "bottom" : "side";
}

/** Where an overlay sits: from the left, centred, or up from the bottom. */
function overlayPlacement(slot: WireSlot, section: Section): "left" | "center" | "bottom" {
  const id = slot.block ?? section.options[0]!;
  if (id === "drawer") return "left";
  if (id === "sheet") return "bottom";
  return "center";
}

function drawSlot(spec: WireSpec, slot: WireSlot, section: Section, grow: boolean): string {
  const attrs = `data-slot="${esc(slot.slot)}" data-region="${section.region}"`;
  if (slot.block === null) {
    const c = component(section.options[0]!);
    const h = section.region === "nav" && navPlacement(slot, section, spec) === "side" ? 0 : c.h;
    const classes = ["slot", "sk", section.optional ? "opt" : "", grow ? "grow" : ""].filter(Boolean).join(" ");
    return `<section class="${classes}" ${attrs} data-block="" data-state="skeleton"><div class="sk-box" style="min-height:${h}px"><span class="sk-name">${esc(slotName(section))}</span>${
      section.options.length > 1 ? `<span class="sk-opts">${section.options.map((o) => esc(humanize(o))).join(" · ")}</span>` : ""}${
      section.optional ? `<span class="sk-opts">optional</span>` : ""}</div></section>`;
  }
  const r = recipe(spec.archetype);
  const c = component(slot.block);
  const props = propsFor(c, slot.props);
  const intentOf = (element: string): string => slot.intents?.[element] ?? defaultIntent(r, c, element);
  const ctx: DrawContext = {
    props,
    intent: intentOf,
    // A fleshed lone action says what it acts on ("Edit delivery"); anything else, its intent's own word.
    label: (element) => esc(slot.fill?.actions?.[element] ?? INTENT_BY_ID.get(intentOf(element))?.label ?? intentOf(element)),
    hot: (element) => ` data-hot="${esc(hotKey(slot.slot, element))}"`,
    title: esc(c.id === "app-bar" ? barTitleOf(spec) : headingOf(spec)),
    platform: spec.platform,
    wide: spec.platform !== "app",
    ...(slot.fill ? { fill: slot.fill } : {}),
  };
  return `<section class="slot w" ${attrs} data-block="${esc(c.id)}" data-state="wire">${c.draw(ctx)}</section>`;
}

/** The heading inside the frame: a fleshed screen's ("Deliveries"), else the spec's title ("List"). */
export function headingOf(spec: WireSpec): string {
  return spec.content?.title ?? spec.title;
}

/**
 * The title an app bar carries. Where the body already draws the fleshed
 * heading (a heading primitive, a detail header) the bar does not repeat
 * it: it says what kind of screen this is — the pack's noun on a detail
 * (`content.bar`), else the archetype's title.
 */
export function barTitleOf(spec: WireSpec): string {
  if (!spec.content) return spec.title;
  if (spec.content.bar !== undefined) return spec.content.bar;
  return spec.slots.some((s) => s.block === "heading" || (s.block === "detail-header" && s.fill?.heading !== undefined)) ? spec.title : headingOf(spec);
}

/** The embedded spec, safe inside a script element: no `<` survives to close it early. */
function specJson(spec: WireSpec): string {
  return JSON.stringify(spec).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

/**
 * Draw a spec as one self-contained HTML file with the spec inside it.
 * Throws on a spec `validateWire` refuses — a screen that draws wrong is
 * worse than one that is not drawn.
 */
export function renderWire(spec: WireSpec): string {
  const frame = renderFrame(spec);
  const state = spec.slots.every((s) => s.block === null) ? "blueprint" : spec.slots.some((s) => s.block === null) ? "drawing" : "wireframe";
  const { width } = PLATFORM_SIZE[spec.platform];
  const title = esc(wireTitle(spec));
  return `<!doctype html>
${WIRE_MARKER}
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${width}">
<title>${title}</title>
<script type="application/json" id="${WIRE_SCRIPT_ID}">${specJson(spec)}</script>
<style>${wireCss(spec)}</style>
</head>
<body class="screen" data-archetype="${esc(spec.archetype)}" data-state="${state}"${spec.varied === "none" ? ` data-varied="none" title="one way to draw this"` : ""}>
${frame}
</body>
</html>
`;
}

/**
 * The theme a screen draws in: its spec's `style`, except on a blueprint —
 * blue on white means *still being drawn* in every system, so a screen with
 * nothing chosen draws in the default whatever its spec records.
 */
export function styleOf(spec: WireSpec): WireStyle | undefined {
  return spec.slots.every((s) => s.block === null) ? undefined : spec.style;
}

/** The theme as a rule: the roles' values on `:root`, for the sheet to read. */
export function themeCss(style: WireStyle | undefined): string {
  return `:root{${themeDecls(style)}}`;
}

/** The stylesheet a screen needs: its theme, the wire sheet, and the skeleton's only while a slot is undecided. */
export function wireCss(spec: WireSpec): string {
  return `${themeCss(styleOf(spec))}${WIRE_CSS}${spec.slots.some((s) => s.block === null) ? SKELETON_CSS : ""}`;
}

/**
 * **The frame alone** — the device outline and every slot in it, with no
 * caption, document or stylesheet. `renderWire` wraps it as a screen's file;
 * the prototype (`prototype.ts`) sets several side by side in one file under
 * one sheet, which is why it is its own function. Throws as `renderWire` does.
 */
export function renderFrame(spec: WireSpec): string {
  const problems = validateWire(spec);
  if (problems.length > 0) throw new Error(`not a drawable wireframe spec:\n  ${problems.join("\n  ")}`);
  const r = recipe(spec.archetype);
  const bySlot = new Map(spec.slots.map((s) => [s.slot, s]));
  const placed = r.sections.filter((s) => bySlot.has(s.slot)).map((section) => ({ section, slot: bySlot.get(section.slot)! }));
  const undecided = spec.slots.some((s) => s.block === null);

  const regions: Record<Region | "side" | "bottom", string[]> = {
    shell: [], header: [], nav: [], main: [], aside: [], footer: [], fab: [], overlay: [], side: [], bottom: [],
  };
  const mainSlots = placed.filter((p) => p.section.region === "main" || (spec.platform === "app" && p.section.region === "aside"));
  const lastMain = mainSlots[mainSlots.length - 1];
  let overlayAt: "left" | "center" | "bottom" = "center";
  for (const p of placed) {
    const side = p.section.region === "nav" && navPlacement(p.slot, p.section, spec) === "side";
    const grow = (p === lastMain || side) && p.slot.block === null;
    const html = drawSlot(spec, p.slot, p.section, grow);
    const region = p.section.region;
    if (region === "nav") regions[navPlacement(p.slot, p.section, spec)].push(html);
    else if (region === "aside" && spec.platform === "app") regions.main.push(html);
    else {
      if (region === "overlay") overlayAt = overlayPlacement(p.slot, p.section);
      regions[region].push(html);
    }
  }

  const { width, height } = PLATFORM_SIZE[spec.platform];
  const size = spec.platform === "site" ? `width:${width}px;min-height:${SITE_MIN}px` : `width:${width}px;height:${height}px`;
  return [
    `<div class="frame ${spec.platform}${undecided ? " sk-frame" : ""}" style="${size}">`,
    ...regions.shell,
    ...regions.header,
    `<div class="body">`,
    regions.side.length ? `<div class="side">${regions.side.join("")}</div>` : "",
    `<div class="main">${regions.main.join("")}</div>`,
    regions.aside.length ? `<div class="aside">${regions.aside.join("")}</div>` : "",
    `</div>`,
    regions.footer.length ? `<div class="foot">${regions.footer.join("")}</div>` : "",
    ...regions.bottom,
    regions.fab.length ? `<div class="fabs">${regions.fab.join("")}</div>` : "",
    regions.overlay.length ? `<div class="layer ${overlayAt}">${regions.overlay.join("")}</div>` : "",
    `</div>`,
  ].join("");
}

/** The spec a rendered screen carries, or null for a file that is not one. Needs no DOM. */
export function readWire(html: string): WireSpec | null {
  if (!html.includes(WIRE_MARKER)) return null;
  const m = new RegExp(`<script type="application/json" id="${WIRE_SCRIPT_ID}">([\\s\\S]*?)</script>`).exec(html);
  if (!m) return null;
  try {
    return JSON.parse(m[1]!) as WireSpec;
  } catch {
    return null;
  }
}

/** For the tests: the greyscale sheet, which must hold no skeleton colour. */
export const __WIRE_CSS = WIRE_CSS;
export const __SKELETON_CSS = SKELETON_CSS;
