import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

/**
 * **The editor, in this product's voice.**
 *
 * CodeMirror shipped stock: its own greys, its own blue, its own idea of a
 * gutter — a component sitting in the app rather than part of it, which is
 * exactly what it looked like beside the stage's panes.
 *
 * Two halves, deliberately split by WHERE each belongs. The chrome (surface,
 * gutter, caret, selection, active line) is CSS in `styles.css`, next to
 * every other surface in the app and reading the same tokens, so it flips
 * with the theme for free and the guards that watch this stylesheet watch it
 * too. Syntax is HERE, because it is not chrome: it is a mapping from Lezer's
 * grammar tags to colour, which no stylesheet can express.
 *
 * The colours are `var(--syn-*)` rather than literals — CodeMirror emits real
 * CSS, so a custom property resolves normally, and light and dark stay one
 * declaration apiece in the place every other colour in this app is decided.
 *
 * **Not the semantic tokens.** `--good` for a string and `--danger` for a tag
 * would read right and mean wrong: those say "this went well" and "this is a
 * problem" everywhere else in the product, and a red tag name is not a
 * problem. Syntax gets its own small palette.
 */
const isocanHighlight = HighlightStyle.define([
  // Comments recede: they are the one thing you skim past.
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: "var(--syn-comment)", fontStyle: "italic" },
  // The grammar's skeleton.
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword], color: "var(--syn-keyword)" },
  { tag: [t.definitionKeyword, t.modifier, t.self, t.null, t.atom, t.bool], color: "var(--syn-keyword)" },
  // Literals.
  { tag: [t.string, t.special(t.string), t.regexp], color: "var(--syn-string)" },
  { tag: [t.number, t.integer, t.float, t.unit], color: "var(--syn-number)" },
  // Markup's own shapes — HTML is most of what is edited here.
  { tag: [t.tagName, t.angleBracket], color: "var(--syn-tag)" },
  { tag: [t.attributeName, t.propertyName], color: "var(--syn-attr)" },
  { tag: [t.attributeValue], color: "var(--syn-string)" },
  // Names.
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.labelName], color: "var(--syn-fn)" },
  { tag: [t.typeName, t.className, t.namespace], color: "var(--syn-type)" },
  { tag: [t.variableName, t.definition(t.variableName)], color: "var(--ink)" },
  // Punctuation is structure, not content: present, and quiet.
  { tag: [t.punctuation, t.separator, t.bracket, t.operator, t.derefOperator], color: "var(--syn-punct)" },
  { tag: [t.meta, t.processingInstruction], color: "var(--syn-comment)" },
  // Markdown, which the editor also opens.
  { tag: [t.heading], color: "var(--syn-keyword)", fontWeight: "600" },
  { tag: [t.link, t.url], color: "var(--syn-attr)", textDecoration: "underline" },
  { tag: [t.emphasis], fontStyle: "italic" },
  { tag: [t.strong], fontWeight: "600" },
  { tag: [t.strikethrough], textDecoration: "line-through" },
  // Something the parser could not make sense of.
  { tag: [t.invalid], color: "var(--danger)" },
]);

/**
 * Added AFTER `basicSetup`, which brings CodeMirror's own default highlight
 * style with it. Later highlighters take precedence in CM6, so this wins
 * without having to take `basicSetup` apart — and `fallback` is deliberately
 * not set, so the default still colours any tag this palette has no opinion
 * about rather than leaving it as plain text.
 */
export const isocanSyntax: Extension = syntaxHighlighting(isocanHighlight);
