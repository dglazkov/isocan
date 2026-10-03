import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  saysPhrase,
  voiceSlipText,
  voiceSlips
} from "./chunk-3GCZKVLQ.mjs";
import {
  copyFitByCount
} from "./chunk-SGXD6ULG.mjs";
import "./chunk-JYOOXWJZ.mjs";

// packages/core/src/copy-lint.ts
var NAME_FAMILIES = [
  ["sign in", "log in", "login", "log on", "sign on"],
  ["sign up", "register", "create an account", "create account"],
  ["sign out", "log out", "logout"],
  ["cart", "basket", "bag"],
  ["email", "e-mail"],
  ["settings", "preferences"]
];
var each = (match, roles) => (screen) => screen.deck.strings.flatMap((s) => {
  if (roles && !roles.includes(s.role)) return [];
  const said = match(s.text, s.role);
  return said ? [{ address: s.address, role: s.role, text: s.text, said }] : [];
});
var first = (re) => (text) => re.exec(text)?.[0] ?? null;
var SENTENCE = /[A-Za-z][A-Za-z'’]+/g;
var MINOR = /* @__PURE__ */ new Set(["a", "an", "the", "and", "or", "but", "of", "to", "in", "on", "at", "for", "by", "with", "from", "as", "is", "it", "your", "my", "our"]);
function titleCase(text) {
  const ws = text.match(SENTENCE) ?? [];
  const long = ws.filter((w, i) => i > 0 && !MINOR.has(w.toLowerCase()) && w.length >= 3);
  if (ws.length < 2 || long.length === 0) return null;
  if (long.some((w) => w === w.toUpperCase())) return null;
  return long.every((w) => /^[A-Z]/.test(w));
}
var COPY_TELLS = {
  "Generic call to action": each(first(/^\s*(get started|learn more|click here|discover)\b[\s!.→›>»]*$/i), ["button", "link", "nav"]),
  "Marketing adjectives instead of facts": each(first(/\b(seamless(?:ly)?|revolutioni[sz](?:e|es|ing)|unlock(?:s|ing)?|elevate(?:s|d)?|effortless(?:ly)?|cutting[- ]edge|(?:take it )?to the next level)\b/i)),
  "Lorem or invented content": each(first(/\b(lorem ipsum|dolor sit amet|john doe|jane doe|company name|your company)\b/i)),
  "Not just X \u2014 it's Y": each(first(/\b(?:not just (?:a |an |another )?[^.!?]{1,60}?[—–,;:]\s*(?:it'?s|it is|but|we'?re)\b|more than (?:just )?(?:a|an) [^.!?]{1,40}?\s*[—–:])/i)),
  "The opener that says nothing": each(first(/(?:\bin today'?s (?:fast[- ]paced|digital|modern|busy) (?:world|age)|\bin an era of\b|^\s*whether you'?re an? [^.!?]{1,40}? or an? )/i)),
  "Apology as an error message": each((text) => {
    const m = /\b(oops!?|something went wrong|we'?re sorry|sorry,? something)\b/i.exec(text);
    if (!m) return null;
    const rest = text.replace(m[0], "").match(SENTENCE) ?? [];
    return rest.length < 5 ? m[0] : null;
  }),
  "Copy that narrates the interface": each(first(/\b(click (?:the|this) (?:button|link) (?:below|above)|use this (?:section|page|screen|form) to|here you can)\b/i)),
  "Title Case On Everything": (screen) => {
    const cased = screen.deck.strings.filter((s) => ["heading", "button", "label", "nav", "link"].includes(s.role)).map((s) => ({ s, title: titleCase(s.text) })).filter((x) => x.title !== null);
    if (cased.length < 3 || !cased.every((x) => x.title)) return [];
    return [{ said: `${cased.length} headings, buttons and labels, all Title Case \u2014 ${cased.slice(0, 3).map((x) => `"${x.s.text}"`).join(", ")}` }];
  }
};
var UNCHECKED_TELLS = {
  "The tricolon on repeat": "whether the third item adds anything is a judgement, not a pattern"
};
var CHECKED_TELLS = Object.keys(COPY_TELLS);
var norm = (s) => s.toLowerCase().replace(/[-\s ]+/g, " ").trim();
var show = (s) => JSON.stringify(s.length > 48 ? `${s.slice(0, 47)}\u2026` : s);
function lintCopy(screens, voice, slopRules) {
  const out = [];
  const rules = new Map(slopRules.filter((r) => r.kind === "copy").map((r) => [r.name, r]));
  for (const screen of screens) {
    const at = { itemId: screen.itemId, title: screen.title };
    for (const s of screen.deck.strings) {
      const where = { ...at, address: s.address, role: s.role, text: s.text };
      for (const slip of voiceSlips(voice, s.text)) {
        out.push({ ...where, kind: slip.kind, what: `${s.role} ${voiceSlipText(slip)}`, fix: slip.kind === "glossary" ? `say "${slip.preferred}"` : "say it without that word" });
      }
      const fit = copyFitByCount(s.role, s.text);
      if (!fit.fits) out.push({ ...where, kind: "length", what: fit.why, fix: `shorten it \u2014 or measure it: Compare the copy\u2026 marks what does not fit the real box` });
    }
    for (const [name, detect] of Object.entries(COPY_TELLS)) {
      const rule = rules.get(name);
      if (!rule) continue;
      for (const hit of detect(screen)) {
        out.push({ ...at, ...hit.address ? { address: hit.address, role: hit.role, text: hit.text } : {}, kind: "tell", what: `${rule.name}: ${hit.address ? `says ${show(hit.said)}` : hit.said}`, fix: rule.instead });
      }
    }
  }
  const governed = new Set((voice?.glossary ?? []).flatMap((g) => [g.term, ...g.banned].map(norm)));
  for (const family of NAME_FAMILIES) {
    if (family.some((m) => governed.has(norm(m)))) continue;
    const seen = /* @__PURE__ */ new Map();
    for (const screen of screens) {
      for (const s of screen.deck.strings) {
        for (const member of family) {
          for (const said of saysPhrase(s.text.replace(/-/g, " "), member.replace(/-/g, " "))) {
            const key = norm(member);
            seen.set(key, [...seen.get(key) ?? [], { screen, address: s.address, said }]);
          }
        }
      }
    }
    if (seen.size < 2) continue;
    const names = [...seen.entries()];
    const where = names.map(([, hits]) => `${show(hits[0].said)} on "${hits[0].screen.title}" (${hits[0].address})`);
    const firstHit = names[0][1][0];
    out.push({
      kind: "one-name",
      itemId: firstHit.screen.itemId,
      title: firstHit.screen.title,
      what: `one thing, ${names.length} names: ${where.join(", ")}`,
      fix: `pick one and say it everywhere \u2014 a glossary line in DESIGN.md's Voice ("${names[0][0]} \u2014 never ${names.slice(1).map(([n]) => n).join(", ")}") keeps it`
    });
  }
  for (const problem of voice?.problems ?? []) out.push({ kind: "voice", what: `DESIGN.md's Voice section: ${problem}`, fix: "`isocan design show` prints it; `isocan design set` writes it back" });
  return out;
}
export {
  CHECKED_TELLS,
  UNCHECKED_TELLS,
  lintCopy
};
