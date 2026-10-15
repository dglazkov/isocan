import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-JYOOXWJZ.mjs";

// packages/core/src/vague-words.ts
var INT = String.raw`(?:(?:a\s+(?:bit|little|lot|touch)|too|so|really|very|kind\s+of|kinda|quite|pretty|rather|super|way|overly|more|less|much|even|still|just|bit|somewhat|slightly|visually)\s+)*`;
var NOUNS = String.raw`(?:screen|screens|page|layout|header|footer|menu|design|card|cards|hero|section|sidebar|nav|navigation|homepage|home\s+page|form|list|dashboard|ui|view|background|palette|colou?rs?|type|typography|font|fonts|button|buttons|banner|grid|modal|dialog|panel|checkout|logo|icon|icons|illustration|landing\s+page|onboarding|copy|text|title|headline|tile|tiles|table|chart)`;
var SUBJECT = String.raw`(?:\b(?:it|this|that|everything)\s+(?:feels|looks|seems)|\b(?:the|this|that|our|my)\s+(?:[a-z]+\s+)?${NOUNS}\s+(?:is|are|feels?|looks?|seems?|gets)|(?:^|[,.;:!?(]\s*|\b(?:and|but|so|still|also|now|just|really|all|think|kinda)\s+)(?:feels?|looks?|seems?|feeling|looking))\s+`;
var NOT_LOOKS = String.raw`(?![^,.;:!?\n]{0,40}?\b(?:code|api|build|tests?|function|logic|diff|implementation|repo|script|module|query|data|commit|history|schema|cache|server|pipeline|sql|config|branch|refactor)\b)`;
var MAKE = String.raw`\b(?:make|making|let)\s+(?!sure\b)${NOT_LOOKS}[^,.;:!?\n]{1,40}?\s+(?:look\s+|feel\s+)?`;
var COORD = String.raw`\b(?:cramped|busy|heavy|bland|boring|dull|crowded|cluttered|dark|flat|cold|clean|modern|soft|warm)\s*(?:,|and|but|yet|or)\s+`;
var stated = (word, after = "") => new RegExp(String.raw`(?<=(?:${SUBJECT}|${MAKE}|${COORD})${INT})(?:${word})\b${after}`, "gi");
var STATE_FRAME = (word) => new RegExp(String.raw`(?:\b(?<what>it|this|that|everything|(?:the|this|that|our|my)\s+(?:[a-z]+\s+)?${NOUNS})(?:'s|’s|\s+(?:is|feels|looks|seems|gets))|\b(?:feels?|looks?|seems?))\s+${INT}(?:${word})\b`, "i");
var MAKE_FRAME = (word) => new RegExp(String.raw`\b(?:make|let|have|get)\s+(?<what>[^,.;:!?\n]{1,40}?)\s+(?:look\s+|feel\s+)?${INT}(?:${word})(?:\s+out)?(?:\s+(?:a\s+(?:bit|little|lot)|more))*\b`, "i");
var VAGUE = [
  {
    word: "pop",
    // Not a pop-up, a popover, a stack's pop() or pop music.
    match: /(?<![.\w/-])pop(?:s|py)?\b(?![-‐]|\s*\(|\s+(?:up|ups|over|overs|in|into|onto|under|open|back|by|round|off|out\s+of|the|a|an|it\s+(?:off|in|into)|music|art|culture|songs?|stars?|quiz)\b)/gi,
    readings: [
      { name: "contrast", means: "How far it stands apart from what is around it in lightness \u2014 what is seen first.", say: "raise {its} contrast", bare: "contrast" },
      { name: "scale", means: "How big it is beside its neighbours \u2014 size says what matters most.", say: "make {what} larger", bare: "size" },
      { name: "colour", means: "A stronger, brighter hue \u2014 standing out by colour rather than by light or size.", say: "give {what} a stronger colour", bare: "colour" }
    ]
  },
  {
    word: "cramped",
    match: /\bcramped\b/gi,
    readings: [
      { name: "spacing", means: "The empty space between things, which separates groups so each reads on its own.", say: "add space between {its} parts", bare: "tightly spaced" },
      { name: "density", means: "How much sits in one space; less at once reads calmer.", say: "show less in {what} at once", bare: "too dense" },
      { name: "size", means: "The container itself: a bigger box gives the same things room.", say: "give {what} more room", bare: "too small" }
    ]
  },
  {
    word: "busy",
    match: stated("busy"),
    readings: [
      { name: "density", means: "How much sits in one space; fewer things at once read calmer.", say: "show fewer things in {what} at once", bare: "too dense" },
      { name: "noise", means: "Decoration competing for attention: borders, colours, weights and icons.", say: "quiet {its} decoration: fewer colours, borders and weights", bare: "noisy" },
      { name: "hierarchy", means: "The order the eye takes; one thing leads and the rest step back.", say: "let one thing in {what} lead and the rest step back", bare: "without a clear lead" }
    ]
  },
  {
    word: "clean",
    match: new RegExp(String.raw`(?:${stated("clean(?:er)?", String.raw`(?!\s+(?:up|out|build|install|code|slate|copy|exit|state|tree))`).source})|\bclean(?=\s+(?:look|feel|design|layout|style|aesthetic|lines)\b)`, "gi"),
    readings: [
      { name: "alignment", means: "Edges and centres on one grid, so nothing looks placed by accident.", say: "align {what} to one grid", bare: "aligned" },
      { name: "reduction", means: "Fewer elements, each earning its place.", say: "remove what in {what} does not earn its place", bare: "simpler" },
      { name: "white space", means: "Empty space used on purpose, around and between groups.", say: "give {what} more white space", bare: "more spacious" }
    ]
  },
  {
    word: "modern",
    match: new RegExp(String.raw`(?:${stated("modern", String.raw`(?!\s+(?:browsers?|javascript|js|css|apis?|syntax|tooling|standards?|devices?|hardware|versions?|stack|frameworks?))`).source})|\bmodern(?=\s+(?:look|feel|design|style|aesthetic|vibe)\b)`, "gi"),
    readings: [
      { name: "type", means: "The typeface and the steps between sizes \u2014 what most dates a screen.", say: "give {what} a current typeface and a tighter type scale", bare: "current in its type" },
      { name: "shape", means: "Surfaces, corners and borders: flatter, softer and fewer reads as recent.", say: "flatten {its} surfaces, soften the corners and drop the borders", bare: "flatter" },
      { name: "colour", means: "A brighter palette with one confident accent.", say: "give {what} a brighter palette with one confident accent", bare: "brighter" }
    ]
  },
  {
    word: "punchy",
    match: /\bpunch(?:y|ier)\b|(?<=\b(?:more|some|extra|less|no|bit\s+of|little)\s+)punch\b/gi,
    readings: [
      { name: "copy", means: "The words: shorter, more direct, verbs first.", say: "make {its} words shorter and more direct", bare: "more direct" },
      { name: "weight", means: "Type weight \u2014 heavier strokes carry more force.", say: "set {its} type heavier", bare: "heavier" },
      { name: "contrast", means: "How far it stands apart from what is around it in lightness \u2014 what is seen first.", say: "raise {its} contrast", bare: "contrast" }
    ]
  },
  {
    word: "heavy",
    match: stated("heavy", String.raw`(?!\s+(?:lifting|load|use|traffic))`),
    readings: [
      { name: "weight", means: "Type weight: lighter strokes read lighter.", say: "set {its} type lighter", bare: "heavy in its type" },
      { name: "colour", means: "Dark, saturated fills weigh more than light ones.", say: "lighten {its} fills and colours", bare: "dark in its fills" },
      { name: "density", means: "How much sits in one space; room between things lifts it.", say: "give {what} more white space", bare: "dense" }
    ]
  },
  {
    word: "warm",
    match: new RegExp(String.raw`(?:${stated("warm(?:er)?", String.raw`(?!\s+(?:up|start|cache|pool|standby|restart))`).source})|(?<=\b(?:more|some|bit\s+of|little|add|needs?|lacks?|no)\s+)warmth\b`, "gi"),
    readings: [
      { name: "colour", means: "Colour temperature: reds, oranges and yellows read warm; blues and greys read cool.", say: "shift {its} palette toward reds and yellows", bare: "warmer colour" },
      { name: "tone of voice", means: "The words: friendlier, more personal, said to one person.", say: "make {its} words friendlier and more personal", bare: "a friendlier tone" },
      { name: "shape", means: "Rounder corners and softer edges read gentler.", say: "round {its} corners and soften its edges", bare: "softer shapes" }
    ]
  },
  {
    word: "bland",
    match: stated("bland|boring|dull"),
    readings: [
      { name: "colour", means: "One accent colour gives a quiet screen a point of interest.", say: "bring one accent colour into {what}", bare: "without colour" },
      { name: "type", means: "Contrast between type sizes and weights gives a page rhythm.", say: "give {its} type more contrast in size and weight", bare: "flat in its type" },
      { name: "imagery", means: "Pictures, illustration or icons that carry character.", say: "add an image or illustration to {what}", bare: "without imagery" }
    ]
  },
  {
    word: "soft",
    match: stated("soft(?:er)?", String.raw`(?!\s+(?:delete|launch|limit|wrap|reset|lock|cap|deadline|skills?))`),
    readings: [
      { name: "shape", means: "Rounder corners read gentler than square ones.", say: "round {its} corners", bare: "rounder" },
      { name: "contrast", means: "Less distance between light and dark reads quieter.", say: "lower {its} contrast", bare: "lower in contrast" },
      { name: "colour", means: "Paler, less saturated colours read softer.", say: "move {its} colours toward pastels", bare: "paler" }
    ]
  }
];
var FRAMES = {
  pop: [MAKE_FRAME("pop")],
  cramped: [STATE_FRAME("cramped"), MAKE_FRAME("cramped")],
  busy: [STATE_FRAME("busy"), MAKE_FRAME("busy")],
  clean: [MAKE_FRAME("clean(?:er)?"), STATE_FRAME("clean(?:er)?")],
  modern: [MAKE_FRAME("modern"), STATE_FRAME("modern")],
  punchy: [MAKE_FRAME("punch(?:y|ier)"), STATE_FRAME("punch(?:y|ier)")],
  heavy: [STATE_FRAME("heavy"), MAKE_FRAME("heavy")],
  warm: [MAKE_FRAME("warm(?:er)?"), STATE_FRAME("warm(?:er)?")],
  bland: [STATE_FRAME("bland|boring|dull"), MAKE_FRAME("bland|boring|dull")],
  soft: [MAKE_FRAME("soft(?:er)?"), STATE_FRAME("soft(?:er)?")]
};
function vagueWords(text) {
  const found = [];
  for (const v of VAGUE) {
    for (const m of text.matchAll(new RegExp(v.match.source, v.match.flags))) {
      const start = m.index ?? 0;
      if (found.some((f) => start < f.end && start + m[0].length > f.start)) continue;
      found.push({ start, end: start + m[0].length, said: m[0], word: v.word, readings: v.readings });
    }
  }
  return found.sort((a, b) => a.start - b.start);
}
function possessive(what) {
  const w = what.trim();
  if (/^(?:it|this|that|everything)$/i.test(w)) return "its";
  if (/^(?:them|these|those)$/i.test(w)) return "their";
  return /s$/i.test(w) ? `${w}'` : `${w}'s`;
}
function designerSentence(text, picks = {}) {
  const spans = vagueWords(text);
  if (spans.length === 0) return null;
  const edits = [];
  for (const span of spans) {
    const reading = span.readings.find((r) => r.name === picks[span.word]) ?? span.readings[0];
    let edit = { start: span.start, end: span.end, with: reading.bare, clause: false };
    for (const frame of FRAMES[span.word] ?? []) {
      for (const m of text.matchAll(new RegExp(frame.source, "gi"))) {
        const start = m.index ?? 0;
        const end = start + m[0].length;
        if (start > span.start || end < span.end) continue;
        if (edits.some((e) => start < e.end && end > e.start)) continue;
        const what = (m.groups?.["what"] ?? "it").trim();
        edit = { start, end, with: reading.say.replaceAll("{what}", what).replaceAll("{its}", possessive(what)), clause: true };
        break;
      }
      if (edit.clause) break;
    }
    edits.push(edit);
  }
  let out = text;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) {
    let start = e.start;
    let said = e.with;
    const before = out.slice(0, start);
    if (e.clause && /,\s*$/.test(before) && edits.some((x) => x.clause && x.end <= e.start)) {
      start = before.replace(/,\s*$/, "").length;
      said = ` and ${said}`;
    }
    if (e.clause && /^\s*$|[.!?]\s+$/.test(out.slice(0, start)) && /[A-Z]/.test(text[e.start] ?? "")) said = said[0].toUpperCase() + said.slice(1);
    out = out.slice(0, start) + said + out.slice(e.end);
  }
  return out;
}
function learnedWords(taste) {
  const out = [];
  for (const line of (taste ?? "").split("\n")) {
    const m = /^\s*(?:[-*]\s+)?["“'‘]([^"”'’]{1,60})["”'’]\s+(?:means|is|=|→)\s+(.{2,200})$/.exec(line);
    if (m) out.push({ said: m[1].trim(), means: m[2].trim().replace(/\.$/, "") });
  }
  return out;
}
function vocabularyTerms(glossary) {
  return [.../* @__PURE__ */ new Set([...glossary, ...VAGUE.flatMap((v) => v.readings.map((r) => r.name))])].sort((a, b) => b.length - a.length);
}
function asksBy(canvas, actorId) {
  return Object.values(canvas.threads ?? {}).flatMap((t) => t.comments).filter((c) => c.author.id === actorId && !c.record).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
function vocabulary(canvas, actorId, taste, glossary) {
  const terms = vocabularyTerms(glossary);
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const termsIn = (text) => {
    let rest = text;
    return terms.filter((t) => {
      const pattern = new RegExp(`\\b${escape(t)}\\b`, "gi");
      const hit = pattern.test(rest);
      if (hit) rest = rest.replace(pattern, " ");
      return hit;
    });
  };
  const mine = asksBy(canvas, actorId);
  const use = new Set(mine.flatMap((c) => termsIn(c.body)));
  const theirs = [
    ...Object.values(canvas.threads ?? {}).flatMap((t) => t.comments).filter((c) => c.author.id !== actorId).map((c) => c.body),
    ...Object.values(canvas.items).map((i) => i.properties?.["proposalWhy"] ?? "")
  ];
  const seen = new Set(theirs.flatMap(termsIn).filter((t) => !use.has(t)));
  const recent = mine.slice(-20);
  return {
    use: [...use].sort(),
    seen: [...seen].sort(),
    learned: learnedWords(taste),
    sharp: { asks: recent.length, plain: recent.filter((c) => vagueWords(c.body).length === 0).length }
  };
}
function offerVague(when, canvas, actorId) {
  if (when === "never") return false;
  if (when === "always") return true;
  const last = asksBy(canvas, actorId).slice(-10);
  return !(last.length >= 10 && last.filter((c) => vagueWords(c.body).length === 0).length >= 8);
}
function readingRefusal(pick) {
  const v = VAGUE.find((x) => x.word === pick.word);
  if (!v) return `"${pick.word}" is not one of the words with readings (${VAGUE.map((x) => x.word).join(", ")})`;
  if (!v.readings.some((r) => r.name === pick.reading)) return `"${pick.word}" reads as ${v.readings.map((r) => r.name).join(", ")} \u2014 not "${pick.reading}"`;
  return null;
}
export {
  designerSentence,
  learnedWords,
  offerVague,
  readingRefusal,
  vagueWords,
  vocabulary
};
