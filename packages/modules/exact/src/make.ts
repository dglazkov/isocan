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

/**
 * **Make it Exact** (exact phase 9; journey Scene 8): a wireframe flow → a
 * Contract scaffold. Pure and deterministic: the same flow and app give the
 * same bytes, so the scaffold is reviewable and its test means something.
 *
 * The flow is what `isocan wire links --json` prints — its screens in reading
 * order and every hotspot's arrow — a file a person or agent hands over, so
 * this module reads nothing of the wireframe module's. The scaffold is:
 *
 * - a route per screen (the first a tab of its own, the rest pushed in it);
 * - a component per screen, in `<flow>.contract`, drawn with the app's own
 *   tokens and the platform's roles — it names no colour of its own;
 * - a `shape` and a stub source (`load<Flow>`, two sample rows in `app.ts`);
 * - a test from the arrows: each arrow a tap on the control that draws it.
 *
 * It lands on a git branch (a structural change is a branch, design §10),
 * captured beside the current screens; merging it is the person's accept.
 * Wiring the routes into the app's own view is the one app-shaped step: this
 * writes it for an app laid out as Exact's `tabs` pattern lays one out (a
 * `routes` block with tabs, a stack drawn by an `if e.name == …` chain, a
 * `role="tablist"` row) and refuses, naming the missing piece, otherwise.
 */

export interface FlowLink { from: string; key: string; label?: string; intent?: string; to: string | null; transition?: string; rule?: string; nav?: boolean }
export interface FlowFile { flow: string; request?: string; screens: Array<{ itemId: string; title: string }>; links: FlowLink[] }

export interface Scaffold {
  flow: string;
  branch: string;
  files: Record<string, string>;
  routes: Array<{ name: string; pattern: string; screen: string; component: string; tab: boolean }>;
  test: string;
  /** The arrows the test follows, as `from → to (control)`. */
  arrows: string[];
}

const words = (s: string) => s.replace(/[^A-Za-z0-9 ]+/g, " ").trim().split(/\s+/).filter(Boolean);
const camel = (s: string) => words(s).map((w, i) => (i === 0 ? w.toLowerCase() : w[0]!.toUpperCase() + w.slice(1).toLowerCase())).join("");
const pascal = (s: string) => words(s).map((w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase()).join("");
const kebab = (s: string) => words(s).map((w) => w.toLowerCase()).join("-");

/** A flow file, checked: its screens and the arrows between them (a push from one screen to another). */
export function parseFlow(text: string): FlowFile {
  const v = JSON.parse(text) as FlowFile;
  if (!v || typeof v.flow !== "string" || !Array.isArray(v.screens) || !Array.isArray(v.links)) throw new Error("a flow file is what `isocan wire links --json` prints: {flow, screens, links}");
  if (v.screens.length < 2 || v.screens.length > 8) throw new Error(`a flow to make Exact has 2 to 8 screens, not ${v.screens.length}`);
  return v;
}

/**
 * **The scaffold.** `target` is the app's own text (`app.contract`,
 * `app.ts`) and its tokens by kind (its design-system item's table).
 */
export function scaffold(flowFile: FlowFile, target: { contract: string; ts: string; tokens: Array<{ name: string; kind: string }> }): Scaffold {
  const flow = flowFile.flow.trim() || "Flow";
  const F = pascal(flow), f = camel(flow);
  const ids = flowFile.screens.map((s) => s.itemId);
  const arrows = flowFile.links.filter((l) => l.to && l.to !== l.from && ids.includes(l.to) && ids.includes(l.from) && !l.nav && l.transition !== "pop");
  const first = flowFile.screens[0]!;
  const routes = flowFile.screens.map((s, i) => {
    const name = i === 0 ? f : camel(s.title) === f ? `${f}${i + 1}` : camel(s.title);
    const into = arrows.find((a) => a.to === s.itemId);
    const fromRow = !!into && /#row$/.test(into.key);
    return { name, pattern: i === 0 ? `/${kebab(flow)}` : `/${kebab(s.title)}${fromRow ? "/:id" : ""}`, screen: s.itemId, component: `${pascal(s.title)}Screen`, tab: i === 0, title: s.title, fromRow };
  });
  const route = (itemId: string) => routes.find((r) => r.screen === itemId)!;
  void first;
  // The app's own tokens, by kind: what the scaffold draws with. A role where the app has none.
  const colours = target.tokens.filter((t) => t.kind === "color").map((t) => t.name);
  const lengths = target.tokens.filter((t) => t.kind === "length").map((t) => t.name);
  const ink = colours[0] ?? "-exact-label", soft = colours[1] ?? "-exact-secondary-label", radius = lengths[0] ?? 12;
  const radiusAttr = typeof radius === "number" ? `border-radius=${radius}` : `border-radius="${radius}"`;

  const shape = `${F}Item`;
  const lines: string[] = [
    `// ${flow}, made Exact from the wireframe flow "${flow}" (${flowFile.screens.length} screens) by \`isocan exact make\`: a scaffold — a`,
    `// component per screen on the app's own tokens (${[ink, soft, typeof radius === "string" ? radius : null].filter(Boolean).join(", ")}) and the platform's roles, a shape and a stub source.`,
    `// It names no colour of its own. Fill in the views; the routes and the test came from the flow's arrows.`,
    "",
    `shape ${shape}`,
    "  id: string",
    "  name: string",
    "  note: string",
    "",
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
      const to = route(row.to!);
      lines.push(
        `      for w in items key=w.id`,
        `        link href=path("${to.name}", w.id) testId=\`${f}-\${w.id}\``,
        `          column flex=1 padding="12px 16px" gap=2 background-color="-exact-secondary-background" ${radiusAttr}`,
        `            text w.name color="${ink}"`,
        `            text w.note font="-exact-footnote" color="${soft}"`,
      );
    } else if (r.fromRow) {
      lines.push(
        `      for w in items key=w.id`,
        `        column gap=4 padding="12px 16px" background-color="-exact-secondary-background" ${radiusAttr}`,
        `          text w.name font="-exact-headline" color="${ink}" testId="${f}-name"`,
        `          text w.note color="${soft}"`,
      );
    } else lines.push(`      text "Done." color="${soft}" testId="${f}-done"`);
    if (act) {
      const to = route(act.to!);
      lines.push(`      link href=path("${to.name}") testId="${f}-${kebab(act.label ?? act.intent ?? "next")}"`, `        text "${(act.label ?? "Next").replace(/"/g, "'")}" font="-exact-headline" color="${ink}"`);
    }
    lines.push("");
  }
  const flowContract = lines.join("\n");

  // ------------------------------------------------ wiring it into the app (the tabs pattern's shape)
  const contract = target.contract.split("\n");
  const need = (ok: boolean, what: string) => { if (!ok) throw new Error(`Make it Exact wires a flow into an app laid out as Exact's \`tabs\` pattern; this app.contract has no ${what}`); };
  const routesAt = contract.findIndex((l) => /^routes\s+[A-Za-z_]\w*\s*$/.test(l));
  need(routesAt >= 0, "`routes <name>` block");
  let end = routesAt + 1;
  while (end < contract.length && /^\s+\S/.test(contract[end]!)) end++;
  const tabIndent = /^(\s*)tab\s/.exec(contract.slice(routesAt + 1, end).find((l) => /^\s*tab\s/.test(l)) ?? "")?.[1];
  need(tabIndent !== undefined, "tab in its routes block");
  const routeLines = routes.map((r) => `${r.tab ? tabIndent : `${tabIndent}  `}${r.tab ? "tab " : ""}${r.name} "${r.pattern}"`);
  contract.splice(end, 0, ...routeLines);
  // The source, beside the app's last resource.
  const lastResource = contract.reduce((at, l, i) => (/^\s+resource\s+\w+\s*=/.test(l) ? i : at), -1);
  need(lastResource >= 0, "`resource` in its App component");
  const resIndent = /^(\s*)/.exec(contract[lastResource]!)![1]!;
  contract.splice(lastResource + 1, 0, `${resIndent}// The ${flow} flow's rows (isocan exact make): a stub source in app.ts.`, `${resIndent}resource ${f}Items = load${F}() as shape ${shape}[] else empty()`);
  // The stack's route chain: the flow's routes first, then the chain as it was.
  const indentOf = (l: string) => /^(\s*)/.exec(l)![1]!.length;
  const chain = contract.findIndex((l, i) => {
    if (!/^\s+if e\.name == "/.test(l)) return false;
    // Chained: the next line at its indent or less (blank lines and comments aside) is its `else`.
    const next = contract.slice(i + 1).find((m) => m.trim() && !m.trim().startsWith("//") && indentOf(m) <= indentOf(l));
    return !!next && indentOf(next) === indentOf(l) && /^\s*else if e\.name/.test(next);
  });
  need(chain >= 0, "`if e.name == … else if e.name …` chain drawing its stack");
  const ci = /^(\s*)/.exec(contract[chain]!)![1]!;
  const branches: string[] = [];
  routes.forEach((r, i) => {
    branches.push(`${ci}${i === 0 ? "if" : "else if"} e.name == "${r.name}"`);
    const items = r.fromRow ? `items=${f}Items.filter(w => w.id == e.params.id)` : arrows.some((a) => a.from === r.screen && /#row$/.test(a.key)) ? `items=${f}Items` : "";
    branches.push(`${ci}  ${r.component}(${items})`);
  });
  contract[chain] = contract[chain]!.replace(/^(\s*)if /, "$1else if ");
  contract.splice(chain, 0, ...branches);
  // A tab for it in the tab bar.
  const bar = contract.findIndex((l) => /role="tablist"/.test(l));
  need(bar >= 0, 'row role="tablist"');
  const bi = /^(\s*)/.exec(contract[bar]!)![1]!.length;
  let barEnd = bar + 1;
  while (barEnd < contract.length && (/^\s*$/.test(contract[barEnd]!) ? false : /^(\s*)/.exec(contract[barEnd]!)![1]!.length > bi)) barEnd++;
  const pad = " ".repeat(bi + 2);
  need(/press=pick\(/.test(contract.slice(bar, barEnd).join("\n")), "tab button pressing pick(…)");
  contract.splice(barEnd, 0,
    `${pad}button role="tab" aria-controls="panel-${f}" aria-selected=(nav.tab == "${f}") press=pick("${f}")`,
    `${pad}  testId="tab-${f}" flex=1`,
    `${pad}  image "symbol:heart"`,
    `${pad}  text "${flow}"`);
  // The components, by name, from their file.
  const lastUse = contract.reduce((at, l, i) => (/^use\s/.test(l) ? i : at), -1);
  contract.splice(lastUse + 1, 0, `use ${shape}, ${routes.map((r) => r.component).join(", ")} from "./${kebab(flow)}.contract"`);

  // The stub source.
  const ts = target.ts.split("\n");
  const src = ts.findIndex((l) => /const sources\s*(:\s*Sources)?\s*=\s*\{/.test(l));
  if (src < 0) throw new Error("Make it Exact adds a stub source to app.ts's `const sources: Sources = {`, which this app.ts does not have");
  ts.splice(src + 1, 0, `  // The ${flow} flow's stub rows (isocan exact make): replace with the real source.`, `  load${F}: () => [`,
    `    { id: '1', name: '${flow} one', note: 'The first of the ${flow.toLowerCase()}.' },`,
    `    { id: '2', name: '${flow} two', note: 'The second of the ${flow.toLowerCase()}.' },`,
    `  ],`);

  // The test, from the arrows.
  const test = `the ${flow} flow from its wireframes`;
  const steps: string[] = [`test "${test}"`, `  tap "tab-${f}"`, "  clock settle", `  expect tree has "${kebab(routes[0]!.title)}"`];
  const said: string[] = [];
  let at = routes[0]!;
  for (let guard = 0; guard < routes.length; guard++) {
    const a = arrows.find((x) => x.from === at.screen && route(x.to!) && route(x.to!) !== at);
    if (!a) break;
    const to = route(a.to!);
    const control = /#row$/.test(a.key) ? `${f}-1` : `${f}-${kebab(a.label ?? a.intent ?? "next")}`;
    steps.push(`  tap "${control}"`, "  clock settle", `  expect tree has "${kebab(to.title)}"`);
    if (to.fromRow) steps.push(`  expect text "${f}-name" == "${flow} one"`);
    said.push(`${at.title} → ${to.title} (${control})`);
    at = to;
  }
  if (said.length === 0) throw new Error(`the flow "${flow}" has no arrow from one of its screens to another: nothing to test`);
  return {
    flow,
    branch: `exact/make-${kebab(flow)}`,
    files: { [`${kebab(flow)}.contract`]: flowContract, [`${kebab(flow)}.test.contract`]: `${steps.join("\n")}\n`, "app.contract": contract.join("\n"), "app.ts": ts.join("\n") },
    routes: routes.map(({ name, pattern, screen, component, tab }) => ({ name, pattern, screen, component, tab })),
    test,
    arrows: said,
  };
}

/** A colour written as a literal in Contract (a hex, `rgb()`, `oklch()`…): what a scaffold must never name. */
export const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\(/;
