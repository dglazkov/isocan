import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);

// packages/core/src/copy-voice.ts
var VOICE_HEADING = /^(voice|tone|tone of voice|voice (?:&|and) tone|voice (?:&|and) words|words)$/i;
var LABELS = [
  [/^tone$/i, "tone"],
  [/^(use|words to use|say|prefer|preferred)$/i, "use"],
  [/^(avoid|words to avoid|don'?t say|do not say|never say|banned)$/i, "avoid"],
  [/^(glossary|terms|terminology|names)$/i, "glossary"]
];
var fieldOf = (label) => LABELS.find(([re]) => re.test(label.trim()))?.[1];
var bare = (s) => s.trim().replace(/^[\s"'“”‘’`*_]+|[\s"'“”‘’`*_.]+$/g, "").replace(/\s+/g, " ");
var listItem = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/;
var terms = (s) => s.split(/\s*(?:[,;/]|\bor\b)\s*/i).map(bare).filter(Boolean);
function glossaryLine(raw) {
  const line = raw.trim();
  const arrow = /^(.+?)\s*(?:→|->|=>)\s*(.+)$/.exec(line);
  if (arrow) {
    const term2 = bare(arrow[2]);
    const banned2 = terms(arrow[1]);
    return term2 && banned2.length ? { term: term2, banned: banned2 } : null;
  }
  const said = /^(.+?)\s*(?:[—–:(,]|\s-\s)?\s*\b(?:never|not|instead of|rather than)\b\s*:?\s*(.+?)\)?\s*$/i.exec(line);
  if (!said) return null;
  const term = bare(said[1].replace(/[—–:(,-]\s*$/, ""));
  const banned = terms(said[2]);
  return term && banned.length ? { term, banned } : null;
}
function parseVoiceSection(body) {
  const voice = { tone: "", use: [], avoid: [], glossary: [], problems: [] };
  const tone = [];
  let field = "tone";
  let sticky = false;
  const take = (into, text) => {
    if (into === "tone") tone.push(text.trim());
    else if (into === "glossary") {
      const g = glossaryLine(text);
      if (g) voice.glossary.push(g);
      else voice.problems.push(`glossary line ${JSON.stringify(text.trim())} names no banned form \u2014 write it "sign in \u2014 never log in"`);
    } else voice[into].push(...terms(text));
  };
  for (const line of body.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const sub = /^#{3,6}\s+(.+?)\s*$/.exec(line);
    if (sub) {
      const named2 = fieldOf(sub[1]);
      if (named2) {
        field = named2;
        sticky = true;
      } else voice.problems.push(`"### ${sub[1]}" is not a part of a Voice section \u2014 use Tone, Use, Avoid or Glossary`);
      continue;
    }
    const item = listItem.exec(line);
    const text = item ? item[1] : line;
    const labelled = /^\s*\**([A-Za-z' ]{2,24}?)\**\s*:\s*(.*)$/.exec(text);
    const named = labelled ? fieldOf(labelled[1]) : void 0;
    if (labelled && named) {
      field = named;
      sticky = false;
      if (labelled[2].trim()) {
        if (named === "glossary") for (const one of labelled[2].split(/\s*;\s*/)) take("glossary", one);
        else take(named, labelled[2]);
      }
      continue;
    }
    if (!item && !sticky) field = "tone";
    take(field, text);
  }
  voice.tone = tone.join(" ").replace(/\s+/g, " ").trim();
  voice.use = [...new Set(voice.use)];
  voice.avoid = [...new Set(voice.avoid)];
  const preferred = new Map(voice.glossary.map((g) => [g.term.toLowerCase(), g.term]));
  for (const g of voice.glossary) {
    for (const b of g.banned) {
      if (preferred.has(b.toLowerCase())) voice.problems.push(`"${b}" is both a glossary term and banned for "${g.term}" \u2014 say which`);
    }
  }
  for (const u of voice.use) {
    if (voice.avoid.some((a) => a.toLowerCase() === u.toLowerCase())) voice.problems.push(`"${u}" is under both Use and Avoid \u2014 say which`);
  }
  if (!voice.tone && !voice.use.length && !voice.avoid.length && !voice.glossary.length && !voice.problems.length) voice.problems.push("the Voice section says nothing yet \u2014 a tone in a sentence, words to use and avoid, a glossary");
  return voice;
}
function voiceOf(doc) {
  const section = doc.sections.find((s) => VOICE_HEADING.test(s.title.trim()));
  return section ? parseVoiceSection(section.body) : null;
}
function voicePrompt(voice) {
  if (!voice) return "";
  const parts = [
    voice.tone && `Tone: ${voice.tone}`,
    voice.use.length > 0 && `Words to use: ${voice.use.join(", ")}.`,
    voice.avoid.length > 0 && `Words to avoid \u2014 never write them: ${voice.avoid.join(", ")}.`,
    ...voice.glossary.map((g) => `Say "${g.term}", never ${g.banned.map((b) => `"${b}"`).join(" or ")}.`)
  ].filter(Boolean);
  return parts.join("\n");
}
var escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function phrase(p) {
  const body = p.trim().split(/\s+/).map(escape).join("[\\s\\u00a0]+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, "giu");
}
function saysPhrase(text, p) {
  return [...text.matchAll(phrase(p))].map((m) => m[0]);
}
function voiceSlips(voice, text) {
  if (!voice) return [];
  const out = [];
  for (const g of voice.glossary) {
    for (const b of g.banned) {
      for (const m of text.matchAll(phrase(b))) out.push({ kind: "glossary", said: m[0], preferred: g.term });
    }
  }
  for (const a of voice.avoid) {
    for (const m of text.matchAll(phrase(a))) out.push({ kind: "avoid", said: m[0] });
  }
  return out;
}
function voiceSlipText(slip) {
  return slip.kind === "glossary" ? `says "${slip.said}" \u2014 the voice says "${slip.preferred}", never "${slip.said.toLowerCase()}"` : `says "${slip.said}" \u2014 the voice avoids it`;
}
function newVoiceSlips(voice, from, to) {
  const had = /* @__PURE__ */ new Map();
  for (const s of voiceSlips(voice, from)) had.set(s.said.toLowerCase(), (had.get(s.said.toLowerCase()) ?? 0) + 1);
  return voiceSlips(voice, to).filter((s) => {
    const k = s.said.toLowerCase();
    const n = had.get(k) ?? 0;
    if (n > 0) {
      had.set(k, n - 1);
      return false;
    }
    return true;
  });
}

export {
  parseVoiceSection,
  voiceOf,
  voicePrompt,
  saysPhrase,
  voiceSlips,
  voiceSlipText,
  newVoiceSlips
};
