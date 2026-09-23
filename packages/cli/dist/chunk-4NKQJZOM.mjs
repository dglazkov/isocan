import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  contributions
} from "./chunk-JM775MAC.mjs";

// packages/modules/design-competition/src/packs.ts
function packPath(pack, file) {
  const dir = (pack.dir ?? `assets/packs/${pack.id}`).replace(/\/+$/, "");
  return `${dir}/${file}`;
}
var TRAVELLING_LICENCES = ["CC0-1.0", "public-domain", "CC-BY-4.0", "CC-BY-3.0", "CC-BY-2.0"];
var NOT_A_NAME = /* @__PURE__ */ new Set(["and", "the", "design", "studio", "after"]);
var nonEmpty = (v) => typeof v === "string" && v.trim().length > 0;
function packProblems(value) {
  if (!value || typeof value !== "object") return ["a pack is an object"];
  const p = value;
  const problems = [];
  for (const key of ["id", "title", "agentName", "credit", "name", "tagline", "bio", "colour", "homage"]) {
    if (!nonEmpty(p[key])) problems.push(`${key} is missing`);
  }
  if (problems.length > 0) return problems;
  if (!/^[a-z][a-z0-9-]{1,31}$/.test(p.id)) problems.push(`id "${p.id}" is not a short lowercase slug`);
  if (!/^#[0-9a-fA-F]{6}$/.test(p.colour)) problems.push(`colour "${p.colour}" is not #rrggbb`);
  for (const key of ["beliefs", "moves", "critique"]) {
    const list = p[key];
    if (!Array.isArray(list) || list.length !== 3 || !list.every(nonEmpty)) problems.push(`${key} is three lines`);
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9 ]{0,40}$/.test(p.agentName)) {
    problems.push(`agentName "${p.agentName}" must be words \u2014 letters, digits and spaces`);
  }
  if (!p.self) {
    const nameWords = p.name.toLowerCase().split(/[^a-zà-ÿ0-9]+/).filter((w) => w.length >= 3 && !NOT_A_NAME.has(w));
    const agentWords = p.agentName.toLowerCase().split(/\s+/);
    const shared = agentWords.filter((w) => nameWords.includes(w));
    if (shared.length > 0) {
      problems.push(`agentName "${p.agentName}" carries "${shared.join(" ")}" from "${p.name}" \u2014 a fighter is named for its principle, never its person`);
    }
    if (!/not affiliated/i.test(p.homage)) problems.push("the homage line must say the pack is not affiliated with or endorsed by its person");
  }
  if (!Array.isArray(p.references) || p.references.length === 0) {
    problems.push("a pack studies at least one reference");
  } else {
    for (const ref of p.references) {
      if (!ref || !nonEmpty(ref.title) || !nonEmpty(ref.learn) || !/^https?:\/\//.test(ref.url ?? "")) {
        problems.push(`reference "${ref?.title ?? "?"}" needs a title, what to learn, and a link`);
        continue;
      }
      if (ref.image && !TRAVELLING_LICENCES.includes(ref.image.licence)) {
        problems.push(`reference "${ref.title}" has a picture under ${ref.image.licence}, which does not travel \u2014 link it instead`);
      }
    }
  }
  if (p.quote !== null && p.quote !== void 0) {
    if (!nonEmpty(p.quote.text) || !/^https?:\/\//.test(p.quote.source ?? "")) problems.push("a quote carries its text and its source");
    else if (p.quote.text.split(/\s+/).length > 15) problems.push("a quote is short \u2014 fifteen words at most");
  }
  return problems;
}
var FIGHTERS_POINT = "design-competition.fighters";
function fighters() {
  return contributions(FIGHTERS_POINT).map(({ module, value }) => ({ module, pack: value }));
}
function rosterClashes(list) {
  const seen = /* @__PURE__ */ new Map();
  const out = [];
  for (const { pack } of list) {
    const first = pack.agentName.split(/\s+/)[0].toLowerCase();
    const holder = seen.get(first);
    if (holder && holder !== pack.id) out.push({ id: pack.id, problem: `"${pack.agentName}" starts with the same word as ${holder}'s agent \u2014 @${first} would be ambiguous` });
    else seen.set(first, pack.id);
  }
  return out;
}
function findFighter(list, ref) {
  const q = ref.trim().toLowerCase();
  if (!q) return null;
  return list.find(({ pack }) => pack.id === q) ?? list.find(({ pack }) => pack.agentName.toLowerCase() === q || pack.title.toLowerCase() === q) ?? list.find(({ pack }) => pack.name.toLowerCase().split(/[^a-zà-ÿ0-9]+/).includes(q)) ?? list.find(({ pack }) => pack.agentName.toLowerCase().startsWith(q)) ?? null;
}

export {
  packPath,
  TRAVELLING_LICENCES,
  packProblems,
  FIGHTERS_POINT,
  fighters,
  rosterClashes,
  findFighter
};
