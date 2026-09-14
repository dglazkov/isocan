import { parse as parseHtml, parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { decodeHTMLAttribute } from "entities";
import type { CssNode, Declaration } from "css-tree";
// @types/css-tree declares the complete library, but not its documented browser subpaths.
// @ts-expect-error public parser subpath has no upstream declaration
import parser from "css-tree/parser";
// @ts-expect-error public walker subpath has no upstream declaration
import walker from "css-tree/walker";
const parseCss: typeof import("css-tree").parse = parser;
const walk: typeof import("css-tree").walk = walker;
import type { DesignTokens } from "./designmd.ts";
import { parseSrgb, toCss } from "./tokens.ts";
import { compileDesignContract, contractLonghands, resolveContractValue, type DesignContractPolicy } from "./design-contract.ts";
import { expandContractValues, matchContractSelector } from "./design-contract-rules.ts";

/** Identifies the interpretation of a report so cached findings can be invalidated when rules change. */
export const DESIGN_AUDIT_VERSION = "1.1.0";
/** These token categories define the audit boundary; unrelated geometry is not a spacing decision. */
export type DesignValueKind = "colour" | "type size" | "radius" | "spacing";
/** Original-source coordinates let either editor select the same value after HTML entity decoding. */
export interface AuditPosition { offset: number; line: number; column: number }
/** UTF-16 offsets, one-based lines/columns, exclusive end; always in the original HTML. */
export interface AuditRange { start: AuditPosition; end: AuditPosition }
/** A replacement needs a semantic choice and sometimes CSS declarations; neither is implicit approval. */
export interface AuditRepair { value: string; token: string; explanation: string; prerequisites: string[]; requiresReview: true }
/** Carries one actionable finding across CLI and browser without asking either client to infer a repair. */
export interface AuditDiagnostic {
  code: string;
  severity: "warning" | "info";
  range: AuditRange;
  actual: string;
  explanation: string;
  candidates: AuditRepair[];
  property?: string;
  kind?: DesignValueKind;
}
/** Records a static-analysis boundary so an unread value cannot impersonate a conforming one. */
export interface AuditUnexamined { code: string; range: AuditRange; explanation: string }
/** Keeps findings and coverage beside legacy counts; zero departures alone cannot establish a clean screen. */
export interface ScreenAudit {
  ruleVersion: typeof DESIGN_AUDIT_VERSION;
  diagnostics: AuditDiagnostic[];
  policy: DesignContractPolicy;
  coverage: {
    /** Completeness within the declared categories, not visual or general CSS correctness. */
    complete: boolean;
    declarations: number;
    checkedValues: number;
    omittedCategories: DesignValueKind[];
    unexamined: AuditUnexamined[];
  };
  /** Compatibility: distinct normalized off-scale values, grouped with first line and occurrence count.
   * Missing variables and unexamined regions are separate diagnostics, never off-scale literals. */
  offSystem: { value: string; kind: DesignValueKind; count: number; line: number }[];
  /** Compatibility: resolved conforming value occurrences, not every syntactic var() call. */
  onSystem: number;
}

type Element = DefaultTreeAdapterMap["element"];
type HtmlNode = DefaultTreeAdapterMap["node"];
interface SourcePart { text: string; offset: (index: number) => number; generated?: boolean }
interface Block { part: SourcePart; declarations: Declaration[]; root: boolean; conditional: boolean; element?: Element; selector?: CssNode }
interface Binding { node: CssNode; part: SourcePart }
interface Located { node: CssNode; part: SourcePart; via?: string[]; use?: Located }
const children = (node: CssNode): CssNode[] => "children" in node && node.children ? node.children.toArray() : [];
const spelling = ({ node, part }: Located) => part.text.slice(node.loc?.start.offset ?? 0, node.loc?.end.offset ?? part.text.length);
const COLOUR_PROPERTIES = /^(?:color|background(?:-color|-image)?|(?:border|outline)(?:-(?:top|right|bottom|left|block|inline|block-start|block-end|inline-start|inline-end))?(?:-color)?|box-shadow|text-shadow|fill|stroke|stop-color|flood-color|lighting-color|caret-color|accent-color|text-decoration(?:-color)?)$/;
const SPACING_PROPERTIES = /^(?:padding|margin)(?:-(?:top|right|bottom|left|block|inline|block-start|block-end|inline-start|inline-end))?$|^(?:gap|row-gap|column-gap)$/;
const RADIUS_PROPERTIES = /^border-(?:(?:top|bottom)-(?:left|right)-|(?:start|end)-(?:start|end)-)?radius$/;
const LENGTH_UNITS = /^(?:px|em|rem|ex|rex|cap|rcap|ch|rch|ic|ric|lh|rlh|vw|vh|vi|vb|vmin|vmax|svw|svh|svi|svb|svmin|svmax|lvw|lvh|lvi|lvb|lvmin|lvmax|dvw|dvh|dvi|dvb|dvmin|dvmax|cqw|cqh|cqi|cqb|cqmin|cqmax|cm|mm|q|in|pt|pc)$/i;
const NEUTRAL = /^(?:inherit|initial|unset|revert|revert-layer|currentcolor|transparent|none|auto|normal)$/i;
const COLOUR_FUNCTIONS = /^(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)$/i;
const NAMED_COLOURS = new Set(("aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen").split(" "));

function normalize(value: string, kind: DesignValueKind): string {
  const text = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (kind === "colour") {
    if (/^#[\da-f]{3,4}$/.test(text)) return normalize(`#${[...text.slice(1)].map(c => c + c).join("")}`, kind);
    if (/^#[\da-f]{6}ff$/.test(text)) return text.slice(0, 7);
    return text;
  }
  const length = /^(-?(?:\d*\.)?\d+)([a-z%]*)$/.exec(text);
  return length ? `${Number(length[1])}${Number(length[1]) === 0 ? "" : length[2]}` : text;
}

/** Parse static styling without executing scripts, fetching URLs or pretending to compute the cascade. */
export function auditScreen(source: string, tokens: DesignTokens): ScreenAudit {
  const diagnostics: AuditDiagnostic[] = [];
  const unexamined: AuditUnexamined[] = [];
  const blocks: Block[] = [];
  const elements: Element[] = [];
  const policy = compileDesignContract(tokens);
  const invalid = new WeakSet<CssNode>();
  const registered = new Set<string>();
  const starts = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === "\n") starts.push(i + 1);
  const position = (offset: number): AuditPosition => {
    offset = Math.max(0, Math.min(offset, source.length));
    let low = 0, high = starts.length;
    while (low + 1 < high) { const mid = (low + high) >>> 1; if (starts[mid]! <= offset) low = mid; else high = mid; }
    return { offset, line: low + 1, column: offset - starts[low]! + 1 };
  };
  const range = (start: number, end: number): AuditRange => ({ start: position(start), end: position(end) });
  const location = ({ node, part }: Located) => range(part.offset(node.loc?.start.offset ?? 0), part.offset(node.loc?.end.offset ?? part.text.length));
  const uncovered = (code: string, where: AuditRange, explanation: string) => {
    if (!unexamined.some(v => v.code === code && v.range.start.offset === where.start.offset && v.range.end.offset === where.end.offset)) unexamined.push({ code, range: where, explanation });
  };
  const wholePart = (part: SourcePart) => range(part.offset(0), part.offset(part.text.length));
  function css(part: SourcePart, inline = false, conditional = false, element?: Element) {
    let ast: CssNode;
    try {
      ast = parseCss(part.text, { context: inline ? "declarationList" : "stylesheet", positions: true, parseCustomProperty: true,
        onParseError: error => uncovered("malformed-css", range(part.offset(error.offset), part.offset(error.offset + 1)), error.message),
      });
    } catch (error) { uncovered("malformed-css", wholePart(part), String(error)); return; }
    const collect = (node: CssNode, conditional: boolean) => {
      if (node.type === "Raw") { uncovered("malformed-css", location({ node, part }), "This CSS region could not be parsed."); return; }
      if (node.type === "Atrule") {
        if (node.name.toLowerCase() === "property") {
          uncovered("unsupported-registration", location({ node, part }), "Custom-property registration and its inheritance/initial-value rules are unexamined.");
          const name = node.prelude ? spelling({ node: node.prelude, part }).trim() : "";
          if (name.startsWith("--")) registered.add(name);
          return;
        }
        if (["import", "namespace"].includes(node.name.toLowerCase())) uncovered("external-style", location({ node, part }), "External stylesheet or namespace was not fetched.");
        if (node.block) collect(node.block, true);
        return;
      }
      const list = children(node);
      const declarations = list.filter((one): one is Declaration => one.type === "Declaration");
      if (node.type === "Rule") {
        const selector = node.prelude.loc ? part.text.slice(node.prelude.loc.start.offset, node.prelude.loc.end.offset).trim() : "";
        blocks.push({ part, declarations: children(node.block).filter((one): one is Declaration => one.type === "Declaration"), root: selector === ":root" && !conditional, conditional, selector: node.prelude });
        for (const child of children(node.block)) if (child.type !== "Declaration") collect(child, true);
        return;
      }
      if (declarations.length) blocks.push({ part, declarations, root: false, conditional, ...(element ? { element } : {}) });
      for (const child of list) if (child.type !== "Declaration") collect(child, conditional);
    };
    collect(ast, conditional);
    walk(ast, node => {
      if (node.type === "Raw" || (node.type === "Function" && !spelling({ node, part }).endsWith(")"))) invalid.add(node);
      if ((node.type === "Function" && invalid.has(node)) || (node.type === "Block" && !spelling({ node, part }).endsWith("}"))) uncovered("malformed-css", location({ node, part }), "An unclosed CSS function or block was recovered by the parser.");
    });
  }
  function attribute(el: Element, name: string): SourcePart | null {
    const loc = el.sourceCodeLocation?.attrs?.[name];
    const attr = el.attrs.find(a => a.name === name);
    if (!loc || !attr) return null;
    const raw = source.slice(loc.startOffset, loc.endOffset);
    const start = /^[^=]+?\s*=\s*(["']?)/.exec(raw);
    if (!start) return null;
    const quote = start[1]!;
    const encoded = raw.slice(start[0].length, quote && raw.endsWith(quote) ? -1 : undefined);
    const base = loc.startOffset + start[0].length;
    // Attribute decoding can shorten a character reference. Map decoded boundaries back to the source.
    const offsets: number[] = [base]; let decoded = "";
    for (let i = 0; i < encoded.length;) {
      const entity = encoded[i] === "&" ? /^&(?:#x[\da-f]+;?|#\d+;?|[a-z][\da-z]*;?)/i.exec(encoded.slice(i))?.[0] : undefined;
      const input = entity ?? encoded[i]!;
      const tail = encoded[i + input.length] ?? "";
      const decodedInput = decodeHTMLAttribute(input + tail);
      const value = decodedInput.slice(0, decodedInput.length - tail.length);
      const piece = entity && value !== input ? value : input;
      for (let n = 0; n < piece.length; n++) offsets.push(base + i + (n === piece.length - 1 ? input.length : 0));
      decoded += piece; i += input.length;
    }
    if (decoded !== attr.value) { uncovered("encoded-attribute", range(loc.startOffset, loc.endOffset), "Attribute decoding could not be mapped exactly to original source."); return null; }
    return { text: decoded, offset: index => offsets[Math.max(0, Math.min(index, offsets.length - 1))]! };
  }
  const onParseError = (error: { code: string; startOffset: number; endOffset: number }) => {
    if (error.code !== "missing-doctype") uncovered("malformed-html", range(error.startOffset, error.endOffset), `HTML parser recovery: ${error.code}.`);
  };
  const document = /<!doctype|<html(?:\s|>)/i.test(source) ? parseHtml(source, { sourceCodeLocationInfo: true, onParseError }) : parseFragment(source, { sourceCodeLocationInfo: true, onParseError });
  function visit(node: HtmlNode) {
    if ("tagName" in node) {
      elements.push(node);
      const loc = node.sourceCodeLocation;
      if (node.tagName === "template") {
        if (loc) uncovered("dynamic-style", range(loc.startOffset, loc.endOffset), "Template content is inert until instantiated; its styling is unexamined.");
        return;
      }
      if (node.tagName === "style" && loc?.startTag) {
        const type = node.attrs.find(a => a.name === "type")?.value;
        const start = loc.startTag.endOffset, end = loc.endTag?.startOffset ?? loc.endOffset;
        const part = { text: source.slice(start, end), offset: (i: number) => start + i };
        if (type && type.toLowerCase() !== "text/css") uncovered("unsupported-style", wholePart(part), `Style type ${type} is not CSS.`);
        else {
          const conditional = node.attrs.some(a => a.name === "media" && a.value.trim() && a.value.trim().toLowerCase() !== "all");
          css(part, false, conditional);
        }
      }
      if (node.tagName === "link" && node.attrs.some(a => a.name === "rel" && a.value.toLowerCase().split(/\s+/).includes("stylesheet")) && loc) uncovered("external-style", range(loc.startOffset, loc.endOffset), "Linked CSS was not fetched; its declarations and overrides are unexamined.");
      if (node.tagName === "script" && !node.attrs.some(a => a.name === "type" && /^(?:application\/(?:ld\+)?json|importmap|speculationrules)$/i.test(a.value)) && loc) uncovered("dynamic-style", range(loc.startOffset, loc.endOffset), "Executable script may alter styles; it was not executed or inspected as CSS.");
      for (const attr of node.attrs) {
        if (/^on/i.test(attr.name) && loc?.attrs?.[attr.name]) { const a = loc.attrs[attr.name]!; uncovered("dynamic-style", range(a.startOffset, a.endOffset), "Event handler may alter styles; it was not executed."); }
        if (attr.name === "style") { const part = attribute(node, attr.name); if (part) css(part, true, false, node); }
        else if (node.namespaceURI === "http://www.w3.org/2000/svg" && /^(?:fill|stroke|stop-color|flood-color|lighting-color|font-size)$/.test(attr.name)) {
          const part = attribute(node, attr.name);
          if (part) { const prefix = `${attr.name}:`; css({ text: prefix + part.text, offset: i => part.offset(Math.max(0, i - prefix.length)) }, true, false, node); }
        }
      }

    }
    if ("childNodes" in node) for (const child of node.childNodes) visit(child);
  }
  visit(document);

  const exported = new Map<string, Binding>();
  let exportText = "";
  try { exportText = toCss(tokens); }
  catch (error) { uncovered("unsupported-system-token", range(0, 0), `The governing token export is unavailable: ${String(error)}`); }
  const exportAst = parseCss(exportText, { positions: true, parseCustomProperty: true });
  walk(exportAst, node => { if (node.type === "Declaration" && node.property.startsWith("--")) exported.set(node.property, { node: node.value, part: { text: exportText, offset: () => 0, generated: true } }); });
  const category = (name: string): DesignValueKind | undefined => name.startsWith("--color-") ? "colour" : name.startsWith("--space-") ? "spacing" : name.startsWith("--radius-") ? "radius" : name.startsWith("--size-") ? "type size" : undefined;
  const categories: DesignValueKind[] = ["colour", "type size", "radius", "spacing"];
  const palette = new Map<DesignValueKind, { token: string; value: string }[]>(categories.map(kind => [kind, []]));
  const roots = new Map<string, Binding[]>(), locals = new Map<string, Block[]>();
  for (const block of blocks) for (const d of block.declarations) if (d.property.startsWith("--")) {
    if (block.root) roots.set(d.property, [...(roots.get(d.property) ?? []), { node: d.value, part: block.part }]);
    else locals.set(d.property, [...(locals.get(d.property) ?? []), block]);
  }
  type Env = Map<string, Binding | null>;
  const envFor = (block?: Block, exportedOnly = false): Env => {
    const env: Env = exportedOnly ? new Map(exported) : new Map();
    if (exportedOnly) return env;
    for (const name of registered) env.set(name, null);
    for (const [name, defs] of roots) env.set(name, defs.length === 1 ? defs[0]! : null);
    for (const [name, defining] of locals) {
      const own = block?.declarations.filter(d => d.property === name) ?? [];
      env.set(name, block && own.length === 1 && defining.length === 1 && !block.conditional ? { node: own[0]!.value, part: block.part } : null);
    }
    return env;
  };
  const cycles = (env: Env): Set<string> => {
    const cyclic = new Set<string>(), done = new Set<string>();
    const scan = (name: string, stack: string[]) => {
      if (stack.length > 128) return;
      const at = stack.indexOf(name); if (at >= 0) { for (const key of stack.slice(at)) cyclic.add(key); return; }
      if (done.has(name)) return;
      const binding = env.get(name); if (!binding) return;
      walk(binding.node, n => { if (n.type === "Function" && n.name.toLowerCase() === "var") { const ref = children(n)[0]; if (ref?.type === "Identifier") scan(ref.name, [...stack, name]); } });
      done.add(name);
    };
    for (const name of env.keys()) scan(name, []);
    return cyclic;
  };
  const invalidValue = Symbol("invalid-variable-value");
  function resolve(value: Located, env: Env, cyclic: Set<string>, property: string, report: boolean, depth = 0, origin?: Located): Located[] | typeof invalidValue | null {
    if (depth > 64) { if (report) uncovered("unsupported-expression", location(value), "Variable expansion exceeded the static depth limit."); return null; }
    const { node, part } = value;
    const where = part.generated && origin ? origin : value;
    if (invalid.has(node)) return null;
    if (node.type === "Value") {
      const out: Located[] = [];
      for (const child of children(node)) { const result = resolve({ node: child, part }, env, cyclic, property, report, depth + 1, origin); if (result === null || result === invalidValue) return result; out.push(...result); }
      return out;
    }
    if (node.type !== "Function" || node.name.toLowerCase() !== "var") return [value];
    const args = children(node), identifier = args[0];
    if (identifier?.type !== "Identifier" || !identifier.name.startsWith("--")) { if (report) uncovered("malformed-css", location(where), "var() requires a custom-property name."); return null; }
    const name = identifier.name, binding = env.get(name);
    if (binding === null) { if (report) uncovered("ambiguous-cascade", location(where), `${name} has selector-dependent or competing declarations; its computed value is unexamined.`); return null; }
    if (binding && !cyclic.has(name)) {
      // Custom properties compute where they are declared, before inheritance. Reusing
      // an inherited alias under an element's override would otherwise credit the wrong value.
      const inherited = binding.part.generated || roots.get(name)?.some(one => one.node === binding.node);
      let dependentLocal = false;
      if (inherited) walk(binding.node, n => {
        if (n.type !== "Function" || n.name.toLowerCase() !== "var") return;
        const ref = children(n)[0];
        if (ref?.type === "Identifier" && locals.has(ref.name) && env.get(ref.name)?.node !== exported.get(ref.name)?.node) dependentLocal = true;
      });
      if (dependentLocal) {
        if (report) uncovered("ambiguous-cascade", location(where), `${name} is inherited and refers to a locally overridden property; its declaration-time value is unexamined.`);
        return null;
      }
      const result = resolve(binding, env, cyclic, property, report, depth + 1, binding.part.generated ? (origin ?? value) : undefined);
      if (result !== invalidValue) return result?.map(one => ({ ...one, via: [...(one.via ?? []), name], use: origin ?? value })) ?? null;
      // A declared variable can itself be invalid. The consumer's fallback still applies.
    }
    const fallback = args[1]?.type === "Operator" && args[1].value === "," ? args.slice(2) : [];
    if (report) diagnostics.push({ code: cyclic.has(name) ? "design/cyclic-variable" : binding ? "design/invalid-variable" : exported.has(name) ? "design/missing-token-declaration" : "design/missing-variable", severity: "warning", range: location(where), actual: name, property,
      explanation: `${name} ${cyclic.has(name) ? "belongs to a custom-property cycle" : binding ? "has an invalid referenced value" : exported.has(name) ? "is named by DESIGN.md but has no declaration in this artifact; include the governing CSS export (isocan design --css)" : "has no declaration in this artifact’s static scope"}.${fallback.length ? " Its fallback is checked separately." : " No value can be checked."}`, candidates: [...exported.keys()].filter(token => {
        const kind = category(token);
        return kind && (COLOUR_PROPERTIES.test(property) ? kind === "colour" : SPACING_PROPERTIES.test(property) ? kind === "spacing" : RADIUS_PROPERTIES.test(property) ? kind === "radius" : kind === "type size") && env.get(token) !== null;
      }).slice(0, 5).map(token => ({ value: `var(${token})`, token, explanation: "This is an exported system reference; confirm its role and rerun the audit after replacement.", prerequisites: env.has(token) ? [] : [`Include the governing CSS export (isocan design --css); ${token} is not declared here.`], requiresReview: true as const })) });
    if (!fallback.length) return invalidValue;
    const out: Located[] = [];
    for (const child of fallback) { const result = resolve({ node: child, part }, env, cyclic, property, report, depth + 1, origin); if (result === null || result === invalidValue) return result; out.push(...result); }
    return out;
  }
  const exportEnv = envFor(undefined, true), exportCycles = cycles(exportEnv);
  const unknownCategories = new Set<DesignValueKind>();
  for (const [name, binding] of exported) {
    const kind = category(name); if (!kind) continue;
    const resolved = resolve(binding, exportEnv, exportCycles, "", false);
    if (Array.isArray(resolved) && resolved.length === 1) {
      const located = resolved[0]!, node = located.node;
      palette.get(kind)!.push({ token: name, value: normalize(spelling(located), kind) });
      if (kind !== "colour" && !((node.type === "Dimension" && LENGTH_UNITS.test(node.unit)) || node.type === "Percentage" || (node.type === "Number" && Number(node.value) === 0))) unknownCategories.add(kind);
    } else unknownCategories.add(kind);
  }
  const marker = (el: Element, name: string) => el.attrs.find(attr => attr.name === `data-isocan-${name}`)?.value;
  const elementRange = (el: Element) => range(el.sourceCodeLocation?.startTag?.startOffset ?? el.sourceCodeLocation?.startOffset ?? 0, el.sourceCodeLocation?.startTag?.endOffset ?? el.sourceCodeLocation?.endOffset ?? 0);
  const markerFinding = (el: Element, name: string, explanation: string) => {
    const loc = el.sourceCodeLocation?.attrs?.[`data-isocan-${name}`];
    diagnostics.push({ code: `design/unknown-${name}`, severity: "warning", range: loc ? range(loc.startOffset, loc.endOffset) : elementRange(el), actual: marker(el, name) ?? "", explanation, candidates: [] });
  };
  const exceptions = new Map<Element, Set<string>>();
  const marked = elements.filter(el => ["recipe", "treatment", "exception"].some(name => marker(el, name) !== undefined));
  for (const problem of policy.problems) uncovered("unsupported-policy", range(0, 0), `${problem.path}: ${problem.message}`);
  for (const el of marked) {
    if (!policy.effective) { uncovered("unsupported-contract", elementRange(el), "The governing contract version is unsupported; these marker meanings are unexamined."); continue; }
    const name = marker(el, "recipe"), recipe = name && Object.prototype.hasOwnProperty.call(policy.effective.recipes, name) ? policy.effective.recipes[name] : undefined;
    if (!recipe) { markerFinding(el, "recipe", "This element does not name a supported recipe in its governing design."); continue; }
    const treatment = marker(el, "treatment"), exception = marker(el, "exception");
    if (treatment !== undefined) {
      if (!Object.prototype.hasOwnProperty.call(recipe.treatments, treatment)) markerFinding(el, "treatment", `Unknown treatment ${treatment} for ${name}.`);
      else policy.appliedTreatments.push({ recipe: name!, name: treatment, range: elementRange(el) });
    }
    if (exception !== undefined) {
      const rule = Object.prototype.hasOwnProperty.call(policy.effective.exceptions, exception) ? policy.effective.exceptions[exception] : undefined;
      if (!rule || rule.recipe !== name) markerFinding(el, "exception", `Exception ${exception} is not an approved, reasoned exception for ${name}.`);
      else {
        exceptions.set(el, new Set(rule.properties.flatMap(contractLonghands)));
        policy.appliedExceptions.push({ recipe: name!, name: exception, properties: rule.properties, reason: rule.reason, range: elementRange(el) });
      }
    }
  }
  const exempt = (el: Element, property: string) => contractLonghands(property).every(name => exceptions.get(el)?.has(name));
  const targets = (block: Block) => block.element ? [block.element] : block.selector ? elements.filter(el => matchContractSelector(block.selector!, el)?.matches) : [];
  const found = new Map<string, ScreenAudit["offSystem"][number]>();
  let onSystem = 0, checkedValues = 0, declarations = 0;
  let referenceExempt = false;
  const note = (located: Located, kind: DesignValueKind, property: string, env: Env) => {
    const actual = spelling(located), value = normalize(actual, kind);
    if (NEUTRAL.test(value) || (kind !== "colour" && /^0[a-z%]*$/.test(value))) return;
    const known = palette.get(kind)!;
    const where = location(located);
    if (!known.length && !unknownCategories.has(kind)) return;
    const rgb = kind === "colour" ? parseSrgb(value) : null;
    const matches = known.filter(one => one.value === value || (rgb && (() => { const other = parseSrgb(one.value); return other && Math.round(other.r) === Math.round(rgb.r) && Math.round(other.g) === Math.round(rgb.g) && Math.round(other.b) === Math.round(rgb.b); })()));
    const match = matches.length > 0;
    if (!match && unknownCategories.has(kind)) {
      uncovered("unsupported-system-token", where, `Some declared ${kind} tokens cannot be resolved to static values; nonmembership cannot be determined.`);
      return;
    }
    if (kind === "colour" && !match && (!rgb || known.some(one => !parseSrgb(one.value)))) {
      uncovered("unsupported-color-equivalence", where, "This color cannot be compared to every declared color with the supported sRGB conversion. Its conformance is unexamined.");
      return;
    }
    checkedValues++;
    if (match) {
      onSystem++;
      if (policy.effective?.literals === "require-references" && !referenceExempt && !matches.some(one => located.via?.includes(one.token))) {
        diagnostics.push({ code: "design/reference-required", severity: "warning", range: location(located.use ?? located), actual: spelling(located.use ?? located), property, kind, candidates: matches.slice(0, 5).map(one => ({ value: `var(${one.token})`, token: one.token, explanation: `This exported token supplies the matching ${kind}; confirm its intended role.`, prerequisites: env.has(one.token) ? [] : [`Include the governing CSS export (isocan design --css); ${one.token} is not declared here.`], requiresReview: true as const })), explanation: `The governing policy requires a declared exported token reference for this ${kind}; a matching literal or local literal alias is insufficient.` });
      }
      return;
    }
    const existing = found.get(`${kind}:${value}`);
    if (existing) existing.count++; else found.set(`${kind}:${value}`, { value, kind, count: 1, line: where.start.line });
    const candidates = known.filter(one => {
      if (!env.has(one.token)) return true;
      const binding = env.get(one.token);
      const resolved = binding ? resolve(binding, env, cycles(env), property, false) : null;
      return Array.isArray(resolved) && resolved.length === 1 && normalize(spelling(resolved[0]!), kind) === one.value;
    }).sort((a, b) => {
      if (kind === "colour" && rgb) {
        const distance = (s: string) => { const x = parseSrgb(s); return x ? (rgb.r - x.r) ** 2 + (rgb.g - x.g) ** 2 + (rgb.b - x.b) ** 2 : Infinity; };
        return distance(a.value) - distance(b.value);
      }
      return Math.abs(parseFloat(value) - parseFloat(a.value)) - Math.abs(parseFloat(value) - parseFloat(b.value));
    }).slice(0, 5).map(one => ({ value: `var(${one.token})`, token: one.token, explanation: `${one.value} is a declared ${kind}; confirm its intended role before replacing.`, prerequisites: env.has(one.token) ? [] : [`Include the governing CSS export (isocan design --css); ${one.token} is not declared here.`], requiresReview: true as const }));
    diagnostics.push({ code: `design/off-scale-${kind === "type size" ? "font-size" : kind === "colour" ? "color" : kind}`, severity: "warning", range: where, actual, kind, property, explanation: `${actual} is outside the governing system's declared ${kind} values.`, candidates });
  };
  const values = (list: Located[], kind: DesignValueKind, property: string, env: Env, colorShorthand = false) => {
    for (const located of list) {
      const n = located.node, actual = spelling(located);
      if (n.type === "Operator" || n.type === "WhiteSpace" || n.type === "Comment" || n.type === "Url" || n.type === "String") continue;
      if (NEUTRAL.test(actual)) continue;
      if (kind === "colour") {
        if (n.type === "Hash" || (n.type === "Identifier" && NAMED_COLOURS.has(n.name.toLowerCase()))) { note(located, kind, property, env); continue; }
        if (n.type === "Function") {
          if (COLOUR_FUNCTIONS.test(n.name) && !/[a-z-]+\(/i.test(actual.slice(actual.indexOf("(") + 1))) note(located, kind, property, env);
          else if (/^(?:repeating-)?(?:linear|radial|conic)-gradient$/i.test(n.name)) values(children(n).map(node => ({ node, part: located.part })), kind, property, env, true);
          else uncovered("unsupported-expression", location(located), `${n.name}() cannot be resolved statically for ${property}.`);
        } else if (!colorShorthand) uncovered("unsupported-expression", location(located), `This ${property} color expression is unsupported.`);
      } else if ((n.type === "Dimension" && LENGTH_UNITS.test(n.unit)) || n.type === "Percentage" || (n.type === "Number" && Number(n.value) === 0)) note(located, kind, property, env);
      else if (n.type === "Identifier" && palette.get(kind)!.some(one => one.value === normalize(actual, kind))) note(located, kind, property, env);
      else uncovered("unsupported-expression", location(located), `This ${property} expression requires evaluation; its value is unexamined.`);
    }
  };
  for (const block of blocks) {
    const env = envFor(block), cyclic = cycles(env);
    for (const d of block.declarations) {
      declarations++;
      const property = d.property.toLowerCase();
      if (property.startsWith("--")) continue;
      const affected = targets(block);
      referenceExempt = affected.length > 0 && affected.every(el => exempt(el, property));
      let kind: DesignValueKind | undefined;
      if (COLOUR_PROPERTIES.test(property)) kind = "colour";
      else if (property === "font-size" || property === "font") kind = "type size";
      else if (RADIUS_PROPERTIES.test(property)) kind = "radius";
      else if (SPACING_PROPERTIES.test(property)) kind = "spacing";
      if (!kind) continue;
      const result = resolve({ node: d.value, part: block.part }, env, cyclic, property, true);
      if (!Array.isArray(result)) continue;
      if (property === "font") {
        const size = result.find(one => one.node.type === "Dimension" || one.node.type === "Percentage" || one.node.type === "Function" || (one.node.type === "Identifier" && /^(?:xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large|smaller|larger)$/.test(one.node.name)));
        if (size) values([size], kind, property, env); else uncovered("unsupported-expression", location({ node: d.value, part: block.part }), "The font shorthand's size could not be resolved.");
      } else values(result, kind, property, env, kind === "colour" && !/(?:color|fill|stroke)$/.test(property));
    }
  }
  // Contract ownership is evaluated on marked elements, after the native
  // value audit. A declaration shared by several elements keeps its source,
  // while each element has its own effective recipe and reasoned exception.
  const atom = (value: Located, property: string): string | null => {
    const text = spelling(value).trim().toLowerCase(), node = value.node;
    if (property === "font-weight") {
      if (text === "normal") return "400";
      if (text === "bold") return "700";
      return node.type === "Number" && Number(text) >= 1 && Number(text) <= 1000 ? String(Number(text)) : null;
    }
    if ((node.type === "Dimension" && LENGTH_UNITS.test(node.unit) && Number(node.value) >= 0) || node.type === "Percentage" || (node.type === "Number" && Number(node.value) === 0)) return normalize(text, property === "font-size" ? "type size" : "spacing");
    return property === "font-size" && /^(?:xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large)$/.test(text) ? text : null;
  };
  const contractProblem = (path: string, explanation: string) => {
    if (!policy.problems.some(problem => problem.path === path && problem.message === explanation)) policy.problems.push({ code: "unsupported-policy", path, message: explanation });
    policy.status = "partial";
    uncovered("unsupported-policy", range(0, 0), `${path}: ${explanation}`);
  };
  const unknownStyles = unexamined.some(one => ["external-style", "dynamic-style", "malformed-css", "unsupported-style"].includes(one.code));
  type EffectiveValue = { values: Located[]; declaration: Declaration; block: Block; priority: number[] };
  const higher = (a: number[], b: number[]) => a.some((value, index) => value !== b[index] && a.slice(0, index).every((v, i) => v === b[i]) && value > b[index]!);
  for (const el of marked) {
    const recipeName = marker(el, "recipe");
    const recipe = recipeName && policy.effective && Object.prototype.hasOwnProperty.call(policy.effective.recipes, recipeName) ? policy.effective.recipes[recipeName] : undefined;
    if (!recipe || !policy.effective) continue;
    const chosen = marker(el, "treatment");
    const treatment = chosen && Object.prototype.hasOwnProperty.call(recipe.treatments, chosen) ? recipe.treatments[chosen] : undefined;
    const rules = { ...recipe.owns, ...treatment };
    const expected = new Map<string, { values: Located[]; rule: string }>();
    for (const [property, raw] of Object.entries(rules)) {
      const text = resolveContractValue(tokens, raw);
      const path = `isocan.lint.recipes.${recipeName}.${treatment && Object.prototype.hasOwnProperty.call(treatment, property) ? `treatments.${chosen}` : "owns"}.${property}`;
      if (text === null) { contractProblem(path, "The owned value cannot be resolved to scalar CSS."); continue; }
      const part: SourcePart = { text, offset: () => 0, generated: true };
      let resolved: ReturnType<typeof resolve> = null;
      try { resolved = resolve({ node: parseCss(text, { context: "value", positions: true }), part }, exportEnv, exportCycles, property, false); } catch { /* Report the unsupported governing value below. */ }
      const expanded = Array.isArray(resolved) ? expandContractValues(property, resolved, spelling) : null;
      if (!expanded || [...expanded].some(([name, values]) => values.some(value => atom(value, name) === null))) { contractProblem(path, "The owned value or exported variable cannot be statically compared."); continue; }
      for (const [name, values] of expanded) {
        if (expected.has(name) && expected.get(name)!.values.map(one => atom(one, name)).join(" ") !== values.map(one => atom(one, name)).join(" ")) contractProblem(path, `Overlapping ownership gives ${name} competing expected values.`);
        expected.set(name, { values, rule: property });
      }
    }
    const winning = new Map<string, EffectiveValue>();
    const uncertain = new Set<string>();
    let unknownCascade = unknownStyles;
    for (let order = 0; order < blocks.length; order++) {
      const block = blocks[order]!;
      const match = block.element ? { matches: block.element === el, specificity: 0 } : block.selector ? matchContractSelector(block.selector, el) : null;
      if (match && !match.matches) continue;
      if (!match || block.conditional) {
        if (block.declarations.some(declaration => !declaration.property.startsWith("--"))) {
          unknownCascade = true;
          uncovered("unsupported-contract-cascade", wholePart(block.part), "This selector or conditional rule cannot be assigned safely to the marked element; ownership remains unexamined.");
        }
        continue;
      }
      const env = envFor(block), cyclic = cycles(env);
      for (let index = 0; index < block.declarations.length; index++) {
        const declaration = block.declarations[index]!, property = declaration.property.toLowerCase();
        if (property.startsWith("--")) continue;
        const related = contractLonghands(property);
        const owned = related.some(name => expected.has(name));
        const allowed = (name: string) => recipe.allow.some(control => contractLonghands(control).includes(name) || (control === "margin" && /^margin-(?:top|right|bottom|left)$/.test(name)));
        if (!related.every(name => expected.has(name) || allowed(name))) diagnostics.push({ code: "design/unapproved-property", severity: "warning", range: location({ node: declaration, part: block.part }), actual: property, property, explanation: `${recipeName} does not declare ${property} as owned styling or an approved caller control.`, candidates: [] });
        if (property === "font" || property === "all" || /^(?:padding|border)-(?:inline|block|start|end)/.test(property)) {
          for (const name of expected.keys()) if (property === "all" || (property === "font" && name.startsWith("font-")) || (property.startsWith("padding") && name.startsWith("padding")) || (property.startsWith("border") && name.includes("radius"))) uncertain.add(name);
          uncovered("unsupported-contract-property", location({ node: declaration, part: block.part }), `The effect of ${property} on owned physical values is unexamined.`);
          continue;
        }
        if (!owned) continue;
        const resolved = resolve({ node: declaration.value, part: block.part }, env, cyclic, property, false);
        const expanded = Array.isArray(resolved) ? expandContractValues(property, resolved, spelling) : null;
        const priority = [declaration.important ? 1 : 0, block.element ? 1 : 0, match.specificity, order, index];
        for (const name of related) {
          if (!expected.has(name)) continue;
          const existing = winning.get(name);
          if (existing && !higher(priority, existing.priority)) continue;
          const values = expanded?.get(name);
          if (!values || values.some(value => atom(value, name) === null)) {
            uncertain.add(name);
            uncovered("unsupported-contract-value", location({ node: declaration.value, part: block.part }), `The effective ${name} cannot be compared within the static contract boundary.`);
          } else { uncertain.delete(name); winning.set(name, { values, declaration, block, priority }); }
        }
      }
    }
    if (unknownCascade) uncovered("unsupported-contract-cascade", elementRange(el), "External, dynamic, conditional or unsupported selector paths may change this element; matching local values do not establish complete ownership coverage.");
    for (const [property, required] of expected) {
      if (exempt(el, property)) continue;
      const actual = winning.get(property);
      if (uncertain.has(property)) continue;
      if (!actual) {
        let inherited = false;
        if (property === "font-weight" || property === "font-size") {
          let ancestor = el.parentNode;
          while (ancestor) {
            if ("tagName" in ancestor) {
              const parent = ancestor;
              inherited ||= blocks.some(block => (block.element === parent || (block.selector && matchContractSelector(block.selector, parent)?.matches)) && block.declarations.some(declaration => [property, "font", "all"].includes(declaration.property.toLowerCase())));
            }
            ancestor = "parentNode" in ancestor ? ancestor.parentNode : null;
          }
        }
        if (inherited) { uncovered("unsupported-contract-inheritance", elementRange(el), `An ancestor authors ${property}; inherited ownership is outside the direct-selector boundary.`); continue; }
        if (!unknownCascade) diagnostics.push({ code: "design/missing-owned-property", severity: "warning", range: elementRange(el), actual: property, property, candidates: [], explanation: `${recipeName} requires ${property}: ${required.values.map(one => atom(one, property)).join(" ")}; no supported authored declaration supplies it.` });
        continue;
      }
      if (unknownCascade) continue;
      const expectedAtoms = required.values.map(one => atom(one, property)), actualAtoms = actual.values.map(one => atom(one, property));
      if (expectedAtoms.join(" ") !== actualAtoms.join(" ")) diagnostics.push({ code: "design/owned-value", severity: "warning", range: location({ node: actual.declaration.value, part: actual.block.part }), actual: spelling({ node: actual.declaration.value, part: actual.block.part }), property, candidates: [], explanation: `${recipeName}${treatment ? ` / ${chosen}` : ""} owns ${property}: expected ${expectedAtoms.join(" ")}, found ${actualAtoms.join(" ")}.` });
      if (policy.effective.literals === "require-references" && property === "font-weight") {
        const known = [...exported].filter(([name]) => name.startsWith("--weight-")).flatMap(([name, binding]) => {
          const values = resolve(binding, exportEnv, exportCycles, property, false);
          return Array.isArray(values) && values.length === 1 && atom(values[0]!, property) !== null ? [{ name, value: atom(values[0]!, property) }] : [];
        });
        if (known.some(one => expectedAtoms.includes(one.value)) && !actual.values.every(value => known.some(one => value.via?.includes(one.name) && atom(value, property) === one.value))) diagnostics.push({ code: "design/reference-required", severity: "warning", range: location({ node: actual.declaration.value, part: actual.block.part }), actual: spelling({ node: actual.declaration.value, part: actual.block.part }), property, candidates: [], explanation: "This owned font weight requires a declared exported token reference; a matching literal or local literal alias is insufficient." });
      }
    }
  }
  diagnostics.sort((a, b) => a.range.start.offset - b.range.start.offset || a.code.localeCompare(b.code));
  unexamined.sort((a, b) => a.range.start.offset - b.range.start.offset || a.code.localeCompare(b.code));
  return { ruleVersion: DESIGN_AUDIT_VERSION, diagnostics, policy, coverage: { complete: unexamined.length === 0, declarations, checkedValues, omittedCategories: categories.filter(kind => !palette.get(kind)!.length && !unknownCategories.has(kind)), unexamined }, offSystem: [...found.values()].sort((a, b) => b.count - a.count || a.line - b.line), onSystem };
}

/** Sum distinct off-scale values per screen; does not include missing references or unexamined source. */
export function offSystemTotal(audits: ScreenAudit[]): number { return audits.reduce((sum, audit) => sum + audit.offSystem.length, 0); }
