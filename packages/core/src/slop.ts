/**
 * The tells of a machine-made interface.
 *
 * Taste does not fit in a prompt, but its opposite very nearly does: there is
 * a short list of moves that generated designs reach for over and over, and
 * every one of them is CHECKABLE — a selector, a declared value, a repeated
 * shape — rather than a matter of opinion. That is what makes this worth
 * writing down and worth automating: an audit can cite the line.
 *
 * It is a FLOOR, not taste. Removing these reliably stops the bad thing; it
 * does not produce the good thing. The good thing comes from the design system
 * being specific (designsystem.ts) and from somebody rejecting drafts.
 *
 * Every rule has to say how to SPOT it, or an agent will report a vibe.
 *
 * WORDS COUNT AS DESIGN. Copy is most of what is on a screen and it has its
 * own tells, which are just as checkable as a gradient — a phrase, a
 * construction, a heading style you can point at. The `copy` rules below owe
 * their shape to `blader/humanizer` and, behind it, Wikipedia's *Signs of AI
 * writing*; they are kept here rather than in a separate skill because an
 * audit that grades the type scale and ignores the sentences has graded half a
 * screen. `slopRulesAsText(kind)` narrows the list when only one half is
 * wanted.
 */

/** What the tell is made of. The two halves of a screen. */
type SlopKind = "visual" | "copy";

interface SlopRule {
  name: string;
  kind: SlopKind;
  /** How to find it in the source, concretely. */
  spot: string;
  /** What to do about it. */
  instead: string;
}

export const SLOP_RULES: SlopRule[] = [
  {
    name: "The default typeface",
    kind: "visual",
    spot: "font-family lists Inter, Space Grotesk, or the bare system stack, and no second face is declared anywhere",
    instead: "Two faces with different jobs, or one with real weight contrast. A page set entirely in one sans at one weight reads as unstyled.",
  },
  {
    name: "Italic serif display",
    kind: "visual",
    spot: "font-style: italic on an h1/h2 in a serif face",
    instead: "It signals 'editorial' and nothing else, and every generated landing page has it. Earn the seriousness with scale and spacing.",
  },
  {
    name: "Purple-to-blue gradient hero",
    kind: "visual",
    spot: "linear-gradient in a hero or header with hues between 240 and 280",
    instead: "A gradient the subject asks for, or a flat ground with one accent. This one is the single most identifiable AI tell.",
  },
  {
    name: "Glassmorphism everywhere",
    kind: "visual",
    spot: "backdrop-filter: blur on cards or panels that do not overlap anything",
    instead: "Blur is for something showing through. Over a flat background it is decoration that costs contrast.",
  },
  {
    name: "One radius for everything",
    kind: "visual",
    spot: "the same border-radius on cards, buttons, inputs, avatars, and images",
    instead: "Radius is hierarchy: a button and a page section are not the same object. Pick two or three and mean them.",
  },
  {
    name: "Everything centered",
    kind: "visual",
    spot: "text-align: center on more than the hero, or every section a centered column",
    instead: "Centred text is hard to read past two lines and flattens hierarchy. Left-align body copy; centre what is genuinely a statement.",
  },
  {
    name: "Emoji as section markers",
    kind: "visual",
    spot: "emoji at the start of headings, list items, or feature cards",
    instead: "They read as filler, they break in Windows and in print, and they are not iconography. Use type weight, a rule, or a real icon.",
  },
  {
    name: "Generic call to action",
    kind: "copy",
    spot: "button text of 'Get Started', 'Learn More', 'Click Here', or 'Discover'",
    instead: "Say what happens: 'Send the invite', 'See this month's bill'. A CTA that fits any product is a CTA for none.",
  },
  {
    name: "Three feature cards, always three",
    kind: "visual",
    spot: "a grid of exactly three equal cards, each an icon, a two-word heading, and a sentence",
    instead: "The layout came before the content. Say what there actually is, and let the count follow.",
  },
  {
    name: "Marketing adjectives instead of facts",
    kind: "copy",
    spot: "seamless, revolutionise, unlock, elevate, effortless, cutting-edge, 'take it to the next level'",
    instead: "A number, a noun, or a verb the reader recognises. Specific beats aspirational.",
  },
  {
    name: "Lorem or invented content",
    kind: "copy",
    spot: "lorem ipsum, 'John Doe', 'Company Name', placeholder avatars, fabricated testimonials or logos",
    instead: "Real content, or clearly-labelled empty states. Fake reviews and fake logos are worse than blank space.",
  },
  {
    name: "Contrast sacrificed to taste",
    kind: "visual",
    spot: "grey body text under 4.5:1 on its background, or a light-grey placeholder standing in for a label",
    instead: "Compute the ratio. #999 on white is a design decision that excludes people.",
  },
  {
    name: "Type with no scale",
    kind: "visual",
    spot: "font-size values that do not follow a ratio, or more than six distinct sizes on one page",
    instead: "A scale, stated in the design system, and every size taken from it.",
  },
  {
    name: "Spacing by eyeball",
    kind: "visual",
    spot: "margins and paddings in unrelated values (13px, 22px, 7px) rather than steps of a unit",
    instead: "One spacing unit and multiples of it. Inconsistent gaps read as sloppiness even when nobody can name why.",
  },
  {
    name: "Shadow as a substitute for structure",
    kind: "visual",
    spot: "box-shadow on every card, at the same blur, doing the work a border or a background would do better",
    instead: "Depth should mean something is above something. Flat groups with a hairline read cleaner.",
  },
  {
    name: "Hover states only",
    kind: "visual",
    spot: ":hover styled, :focus-visible absent",
    instead: "Half your users are on a keyboard or a touchscreen. A focus ring is not optional.",
  },
  {
    name: "The dark mode that was not designed",
    kind: "visual",
    spot: "colours defined only inside a prefers-color-scheme block, or a light palette inverted wholesale",
    instead: "Tokens at the root, re-valued for dark. Check that the accent still works on the dark ground.",
  },
  {
    name: "Not just X — it's Y",
    kind: "copy",
    spot: "the escalation template: 'not just a todo app, it's a system for thinking', 'more than a X — a Y'",
    instead: "Say the second thing and drop the first. The construction works by denying a claim nobody made.",
  },
  {
    name: "The opener that says nothing",
    kind: "copy",
    spot: "a hero or intro beginning 'In today's fast-paced world', 'In an era of', 'Whether you're a X or a Y'",
    instead: "Open on the specific thing this product does. The reader arrived already knowing the world is fast-paced.",
  },
  {
    name: "Apology as an error message",
    kind: "copy",
    spot: "'Oops!', 'Something went wrong', 'We're sorry' — with no cause and no next step",
    instead: "What failed, and what to do: 'That file is over 24 MB. Try a smaller one.' An apology is not information.",
  },
  {
    name: "Copy that narrates the interface",
    kind: "copy",
    spot: "'Click the button below to get started', 'Use this section to manage your team', 'Here you can'",
    instead: "The interface is on screen; describing it is a sentence the reader has to skip. Say what the thing does.",
  },
  {
    name: "Title Case On Everything",
    kind: "copy",
    spot: "headings, buttons, labels and menu items all in Title Case, with no sentence case anywhere",
    instead: "Pick one and mean it. Sentence case for anything longer than a couple of words reads faster and dates less.",
  },
  {
    name: "The tricolon on repeat",
    kind: "copy",
    spot: "three-item lists throughout — 'fast, simple, and reliable' — where the third item adds nothing the first two did not",
    instead: "Two if there are two, four if there are four. A rhythm applied to every claim is a rhythm doing the claiming.",
  },
];

/** The list as an agent should read it. */
/** The rules as prompt text — all of them, or one half. */
export function slopRulesAsText(kind?: SlopKind): string {
  const rules = kind ? SLOP_RULES.filter((rule) => rule.kind === kind) : SLOP_RULES;
  return rules
    .map((rule, i) => `${i + 1}. **${rule.name}** — spot it: ${rule.spot}. ${rule.instead}`)
    .join("\n");
}
