import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  loadTargetTokens,
  targetTokens
} from "./chunk-H64NEZRS.mjs";
import "./chunk-QWZHH6EQ.mjs";
import "./chunk-RIAJPPUS.mjs";
import "./chunk-ERSF5LUL.mjs";
import "./chunk-QSPCCLE6.mjs";
import "./chunk-VMZRQO4Z.mjs";
import "./chunk-GUY4UN4O.mjs";
import "./chunk-K4TDP4L5.mjs";
import "./chunk-JYOOXWJZ.mjs";

// packages/modules/exact/src/makes.ts
import { promises as fs } from "node:fs";
import path from "node:path";

// packages/modules/exact/src/make.ts
var words = (s) => s.replace(/[^A-Za-z0-9 ]+/g, " ").trim().split(/\s+/).filter(Boolean);
var camel = (s) => words(s).map((w, i) => i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()).join("");
var pascal = (s) => words(s).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join("");
var kebab = (s) => words(s).map((w) => w.toLowerCase()).join("-");
function parseFlow(text) {
  const v = JSON.parse(text);
  if (!v || typeof v.flow !== "string" || !Array.isArray(v.screens) || !Array.isArray(v.links)) throw new Error("a flow file is what `isocan wire links --json` prints: {flow, screens, links}");
  if (v.screens.length < 2 || v.screens.length > 8) throw new Error(`a flow to make Exact has 2 to 8 screens, not ${v.screens.length}`);
  return v;
}
function scaffold(flowFile, target) {
  const flow = flowFile.flow.trim() || "Flow";
  const F = pascal(flow), f = camel(flow);
  const ids = flowFile.screens.map((s) => s.itemId);
  const arrows = flowFile.links.filter((l) => l.to && l.to !== l.from && ids.includes(l.to) && ids.includes(l.from) && !l.nav && l.transition !== "pop");
  const first = flowFile.screens[0];
  const routes = flowFile.screens.map((s, i) => {
    const name = i === 0 ? f : camel(s.title) === f ? `${f}${i + 1}` : camel(s.title);
    const into = arrows.find((a) => a.to === s.itemId);
    const fromRow = !!into && /#row$/.test(into.key);
    return { name, pattern: i === 0 ? `/${kebab(flow)}` : `/${kebab(s.title)}${fromRow ? "/:id" : ""}`, screen: s.itemId, component: `${pascal(s.title)}Screen`, tab: i === 0, title: s.title, fromRow };
  });
  const route = (itemId) => routes.find((r) => r.screen === itemId);
  void first;
  const colours = target.tokens.filter((t) => t.kind === "color").map((t) => t.name);
  const lengths = target.tokens.filter((t) => t.kind === "length").map((t) => t.name);
  const ink = colours[0] ?? "-exact-label", soft = colours[1] ?? "-exact-secondary-label", radius = lengths[0] ?? 12;
  const radiusAttr = typeof radius === "number" ? `border-radius=${radius}` : `border-radius="${radius}"`;
  const shape = `${F}Item`;
  const lines = [
    `// ${flow}, made Exact from the wireframe flow "${flow}" (${flowFile.screens.length} screens) by \`isocan exact make\`: a scaffold \u2014 a`,
    `// component per screen on the app's own tokens (${[ink, soft, typeof radius === "string" ? radius : null].filter(Boolean).join(", ")}) and the platform's roles, a shape and a stub source.`,
    `// It names no colour of its own. Fill in the views; the routes and the test came from the flow's arrows.`,
    "",
    `shape ${shape}`,
    "  id: string",
    "  name: string",
    "  note: string",
    ""
  ];
  for (const r of routes) {
    const out = arrows.filter((a) => a.from === r.screen);
    const row = out.find((a) => /#row$/.test(a.key));
    const act = out.find((a) => !/#row$/.test(a.key));
    const isList = !!row;
    lines.push(`// "${r.title}" (wireframe ${r.screen}).`, `component ${r.component}`);
    if (isList || r.fromRow) lines.push("  props", `    items: ${shape}[]`);
    lines.push("  view", `    column testId="${kebab(r.title)}" padding="12px 16px" gap=12 flex=1`);
    lines.push(`      text "${r.title.replace(/"/g, "'")}" role="heading" aria-level=2 font="-exact-title2" color="${ink}"`);
    if (isList) {
      const to = route(row.to);
      lines.push(
        `      for w in items key=w.id`,
        `        link href=path("${to.name}", w.id) testId=\`${f}-\${w.id}\``,
        `          column flex=1 padding="12px 16px" gap=2 background-color="-exact-secondary-background" ${radiusAttr}`,
        `            text w.name color="${ink}"`,
        `            text w.note font="-exact-footnote" color="${soft}"`
      );
    } else if (r.fromRow) {
      lines.push(
        `      for w in items key=w.id`,
        `        column gap=4 padding="12px 16px" background-color="-exact-secondary-background" ${radiusAttr}`,
        `          text w.name font="-exact-headline" color="${ink}" testId="${f}-name"`,
        `          text w.note color="${soft}"`
      );
    } else lines.push(`      text "Done." color="${soft}" testId="${f}-done"`);
    if (act) {
      const to = route(act.to);
      lines.push(`      link href=path("${to.name}") testId="${f}-${kebab(act.label ?? act.intent ?? "next")}"`, `        text "${(act.label ?? "Next").replace(/"/g, "'")}" font="-exact-headline" color="${ink}"`);
    }
    lines.push("");
  }
  const flowContract = lines.join("\n");
  const contract = target.contract.split("\n");
  const need = (ok, what) => {
    if (!ok) throw new Error(`Make it Exact wires a flow into an app laid out as Exact's \`tabs\` pattern; this app.contract has no ${what}`);
  };
  const routesAt = contract.findIndex((l) => /^routes\s+[A-Za-z_]\w*\s*$/.test(l));
  need(routesAt >= 0, "`routes <name>` block");
  let end = routesAt + 1;
  while (end < contract.length && /^\s+\S/.test(contract[end])) end++;
  const tabIndent = /^(\s*)tab\s/.exec(contract.slice(routesAt + 1, end).find((l) => /^\s*tab\s/.test(l)) ?? "")?.[1];
  need(tabIndent !== void 0, "tab in its routes block");
  const routeLines = routes.map((r) => `${r.tab ? tabIndent : `${tabIndent}  `}${r.tab ? "tab " : ""}${r.name} "${r.pattern}"`);
  contract.splice(end, 0, ...routeLines);
  const lastResource = contract.reduce((at2, l, i) => /^\s+resource\s+\w+\s*=/.test(l) ? i : at2, -1);
  need(lastResource >= 0, "`resource` in its App component");
  const resIndent = /^(\s*)/.exec(contract[lastResource])[1];
  contract.splice(lastResource + 1, 0, `${resIndent}// The ${flow} flow's rows (isocan exact make): a stub source in app.ts.`, `${resIndent}resource ${f}Items = load${F}() as shape ${shape}[] else empty()`);
  const indentOf = (l) => /^(\s*)/.exec(l)[1].length;
  const chain = contract.findIndex((l, i) => {
    if (!/^\s+if e\.name == "/.test(l)) return false;
    const next = contract.slice(i + 1).find((m) => m.trim() && !m.trim().startsWith("//") && indentOf(m) <= indentOf(l));
    return !!next && indentOf(next) === indentOf(l) && /^\s*else if e\.name/.test(next);
  });
  need(chain >= 0, "`if e.name == \u2026 else if e.name \u2026` chain drawing its stack");
  const ci = /^(\s*)/.exec(contract[chain])[1];
  const branches = [];
  routes.forEach((r, i) => {
    branches.push(`${ci}${i === 0 ? "if" : "else if"} e.name == "${r.name}"`);
    const items = r.fromRow ? `items=${f}Items.filter(w => w.id == e.params.id)` : arrows.some((a) => a.from === r.screen && /#row$/.test(a.key)) ? `items=${f}Items` : "";
    branches.push(`${ci}  ${r.component}(${items})`);
  });
  contract[chain] = contract[chain].replace(/^(\s*)if /, "$1else if ");
  contract.splice(chain, 0, ...branches);
  const bar = contract.findIndex((l) => /role="tablist"/.test(l));
  need(bar >= 0, 'row role="tablist"');
  const bi = /^(\s*)/.exec(contract[bar])[1].length;
  let barEnd = bar + 1;
  while (barEnd < contract.length && (/^\s*$/.test(contract[barEnd]) ? false : /^(\s*)/.exec(contract[barEnd])[1].length > bi)) barEnd++;
  const pad = " ".repeat(bi + 2);
  need(/press=pick\(/.test(contract.slice(bar, barEnd).join("\n")), "tab button pressing pick(\u2026)");
  contract.splice(
    barEnd,
    0,
    `${pad}button role="tab" aria-controls="panel-${f}" aria-selected=(nav.tab == "${f}") press=pick("${f}")`,
    `${pad}  testId="tab-${f}" flex=1`,
    `${pad}  image "symbol:heart"`,
    `${pad}  text "${flow}"`
  );
  const lastUse = contract.reduce((at2, l, i) => /^use\s/.test(l) ? i : at2, -1);
  contract.splice(lastUse + 1, 0, `use ${shape}, ${routes.map((r) => r.component).join(", ")} from "./${kebab(flow)}.contract"`);
  const ts = target.ts.split("\n");
  const src = ts.findIndex((l) => /const sources\s*(:\s*Sources)?\s*=\s*\{/.test(l));
  if (src < 0) throw new Error("Make it Exact adds a stub source to app.ts's `const sources: Sources = {`, which this app.ts does not have");
  ts.splice(
    src + 1,
    0,
    `  // The ${flow} flow's stub rows (isocan exact make): replace with the real source.`,
    `  load${F}: () => [`,
    `    { id: '1', name: '${flow} one', note: 'The first of the ${flow.toLowerCase()}.' },`,
    `    { id: '2', name: '${flow} two', note: 'The second of the ${flow.toLowerCase()}.' },`,
    `  ],`
  );
  const test = `the ${flow} flow from its wireframes`;
  const steps = [`test "${test}"`, `  tap "tab-${f}"`, "  clock settle", `  expect tree has "${kebab(routes[0].title)}"`];
  const said = [];
  let at = routes[0];
  for (let guard = 0; guard < routes.length; guard++) {
    const a = arrows.find((x) => x.from === at.screen && route(x.to) && route(x.to) !== at);
    if (!a) break;
    const to = route(a.to);
    const control = /#row$/.test(a.key) ? `${f}-1` : `${f}-${kebab(a.label ?? a.intent ?? "next")}`;
    steps.push(`  tap "${control}"`, "  clock settle", `  expect tree has "${kebab(to.title)}"`);
    if (to.fromRow) steps.push(`  expect text "${f}-name" == "${flow} one"`);
    said.push(`${at.title} \u2192 ${to.title} (${control})`);
    at = to;
  }
  if (said.length === 0) throw new Error(`the flow "${flow}" has no arrow from one of its screens to another: nothing to test`);
  return {
    flow,
    branch: `exact/make-${kebab(flow)}`,
    files: { [`${kebab(flow)}.contract`]: flowContract, [`${kebab(flow)}.test.contract`]: `${steps.join("\n")}
`, "app.contract": contract.join("\n"), "app.ts": ts.join("\n") },
    routes: routes.map(({ name, pattern, screen, component, tab }) => ({ name, pattern, screen, component, tab })),
    test,
    arrows: said
  };
}
var COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\(/;

// packages/modules/exact/src/makes.ts
async function makeVerb(kit, host, app, flowPath, opts, cmd) {
  const ctx = await host.ctxOf(cmd);
  const canvas = await host.resolveCanvas(ctx);
  const flow = parseFlow(await fs.readFile(path.resolve(flowPath), "utf8"));
  const info = await kit.appOf(app);
  const snapshot = await ctx.client.snapshot(canvas.id);
  await loadTargetTokens(ctx, canvas.id, snapshot, info.id);
  const tokens = targetTokens(snapshot, info.id);
  if (!tokens) throw new Error(`${info.name}'s design is not on this canvas \u2014 \`isocan exact open ${app}\` first: the scaffold draws with its tokens`);
  const s = scaffold(flow, { contract: await fs.readFile(path.join(app, "app.contract"), "utf8"), ts: await fs.readFile(path.join(app, "app.ts"), "utf8"), tokens });
  const own = s.files[Object.keys(s.files).find((f) => f.endsWith(".contract") && f !== "app.contract" && !f.endsWith(".test.contract"))];
  if (COLOUR_LITERAL.test(own)) throw new Error("the scaffold names a colour of its own: refused (design \xA713's rule, Scene 8)");
  const r = await kit.bridge(host, "make-branch", ["--app", app, "--job", await job(s)], "the scaffold's branch", ctx.json);
  if (!r.ok) throw new Error(r.error ?? "the scaffold was not committed");
  if (!ctx.json) {
    console.log(`${r.branch} @ ${r.commit?.slice(0, 8)}  the ${s.flow} flow made Exact: ${s.routes.map((x) => `${x.name} "${x.pattern}"`).join(", ")}`);
    console.log(`  test "${s.test}": ${s.arrows.join("; ")}`);
    console.error("capturing the branch beside the current screens\u2026");
  }
  const { branchVerb } = await import("./branch-3J25PZSZ.mjs");
  await branchVerb(kit, host, app, r.branch, { ...opts.canvas ? { canvas: opts.canvas } : {}, ...opts.hosts ? { hosts: opts.hosts } : {}, ...opts.sim ? { sim: opts.sim } : {}, devices: "phone", schemes: "light" }, cmd);
  if (!ctx.json) console.log(`merge ${r.branch} to accept it (a person's step); then \`isocan exact run ${app} "${s.test}"\` runs its test`);
  async function job(x) {
    const file = path.join(await fs.mkdtemp(path.join((await import("node:os")).tmpdir(), "isocan-exact-make-job-")), "job.json");
    await fs.writeFile(file, JSON.stringify({ branch: x.branch, files: x.files, message: `Make it Exact: the ${x.flow} flow from its wireframes (isocan exact make)

${x.routes.map((y) => `${y.name} "${y.pattern}" \u2190 wireframe ${y.screen}`).join("\n")}
test "${x.test}": ${x.arrows.join("; ")}` }));
    return file;
  }
}
export {
  makeVerb
};
