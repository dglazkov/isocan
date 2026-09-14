import type { CssNode } from "css-tree";
import type { DefaultTreeAdapterMap } from "parse5";
import { contractLonghands } from "./design-contract.ts";

type Element = DefaultTreeAdapterMap["element"];
const children = (node: CssNode): CssNode[] => "children" in node && node.children ? node.children.toArray() : [];

/** Match only direct static selectors; unsupported relationships never masquerade as a non-match. */
export function matchContractSelector(selector: CssNode, element: Element): { matches: boolean; specificity: number } | null {
  if (selector.type === "SelectorList") {
    let specificity = -1;
    for (const one of children(selector)) {
      const result = matchContractSelector(one, element);
      if (!result) return null;
      if (result.matches) specificity = Math.max(specificity, result.specificity);
    }
    return { matches: specificity >= 0, specificity: Math.max(0, specificity) };
  }
  if (selector.type !== "Selector") return null;
  let matches = true, specificity = 0;
  const attribute = (name: string) => element.attrs.find(one => one.name === name)?.value;
  for (const part of children(selector)) {
    if (part.type === "TypeSelector" && /^[a-z][\w-]*$/i.test(part.name)) { specificity += 1; matches &&= element.tagName.toLowerCase() === part.name.toLowerCase(); }
    // CSS-tree decodes String values, but retains escapes in identifiers.
    // Until identifier decoding is supported, these paths are unexamined.
    else if (part.type === "ClassSelector") { if (part.name.includes("\\")) return null; specificity += 1000; matches &&= (attribute("class") ?? "").split(/\s+/).includes(part.name); }
    else if (part.type === "IdSelector") { if (part.name.includes("\\")) return null; specificity += 1_000_000; matches &&= attribute("id") === part.name; }
    else if (part.type === "AttributeSelector" && part.name.type === "Identifier" && part.matcher === "=" && part.value && !part.flags) {
      if (part.value.type !== "String" && part.value.type !== "Identifier") return null;
      if (part.name.name.includes("\\") || (part.value.type === "Identifier" && part.value.name.includes("\\"))) return null;
      specificity += 1000; matches &&= attribute(element.namespaceURI === "http://www.w3.org/1999/xhtml" ? part.name.name.toLowerCase() : part.name.name) === (part.value.type === "String" ? part.value.value : part.value.name);
    } else return null;
  }
  return { matches, specificity };
}

const quad = <T>(items: T[]): T[] => [items[0]!, items[1] ?? items[0]!, items[2] ?? items[0]!, items[3] ?? items[1] ?? items[0]!];

/** Expand every physical axis, retaining the values that prove reference use and source ownership. */
export function expandContractValues<T>(property: string, values: T[], spelling: (value: T) => string): Map<string, T[]> | null {
  const clean = values.filter(value => spelling(value).trim());
  const slash = clean.findIndex(value => spelling(value) === "/");
  if (property === "padding") {
    if (clean.length < 1 || clean.length > 4 || slash !== -1) return null;
    return new Map(contractLonghands(property).map((name, index) => [name, [quad(clean)[index]!]]));
  }
  if (property === "border-radius") {
    const x = slash === -1 ? clean : clean.slice(0, slash), y = slash === -1 ? x : clean.slice(slash + 1);
    if (x.length < 1 || x.length > 4 || y.length < 1 || y.length > 4 || y.some(value => spelling(value) === "/")) return null;
    const horizontal = quad(x), vertical = quad(y);
    return new Map(contractLonghands(property).map((name, index) => [name, [horizontal[index]!, vertical[index]!]]));
  }
  if (/^border-(?:top|bottom)-(?:left|right)-radius$/.test(property)) {
    if (clean.length < 1 || clean.length > 2 || slash !== -1) return null;
    return new Map([[property, [clean[0]!, clean[1] ?? clean[0]!]]]);
  }
  return clean.length === 1 ? new Map([[property, clean]]) : null;
}
