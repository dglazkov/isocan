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
 * does not produce the good thing. The good thing comes from the house style
 * being specific (housestyle.ts) and from somebody rejecting drafts.
 *
 * Every rule has to say how to SPOT it, or an agent will report a vibe.
 */

export interface SlopRule {
  name: string;
  /** How to find it in the source, concretely. */
  spot: string;
  /** What to do about it. */
  instead: string;
}

export const SLOP_RULES: SlopRule[] = [
  {
    name: "The default typeface",
    spot: "font-family lists Inter, Space Grotesk, or the bare system stack, and no second face is declared anywhere",
    instead: "Two faces with different jobs, or one with real weight contrast. A page set entirely in one sans at one weight reads as unstyled.",
  },
  {
    name: "Italic serif display",
    spot: "font-style: italic on an h1/h2 in a serif face",
    instead: "It signals 'editorial' and nothing else, and every generated landing page has it. Earn the seriousness with scale and spacing.",
  },
  {
    name: "Purple-to-blue gradient hero",
    spot: "linear-gradient in a hero or header with hues between 240 and 280",
    instead: "A gradient the subject asks for, or a flat ground with one accent. This one is the single most identifiable AI tell.",
  },
  {
    name: "Glassmorphism everywhere",
    spot: "backdrop-filter: blur on cards or panels that do not overlap anything",
    instead: "Blur is for something showing through. Over a flat background it is decoration that costs contrast.",
  },
  {
    name: "One radius for everything",
    spot: "the same border-radius on cards, buttons, inputs, avatars, and images",
    instead: "Radius is hierarchy: a button and a page section are not the same object. Pick two or three and mean them.",
  },
  {
    name: "Everything centered",
    spot: "text-align: center on more than the hero, or every section a centered column",
    instead: "Centred text is hard to read past two lines and flattens hierarchy. Left-align body copy; centre what is genuinely a statement.",
  },
  {
    name: "Emoji as section markers",
    spot: "emoji at the start of headings, list items, or feature cards",
    instead: "They read as filler, they break in Windows and in print, and they are not iconography. Use type weight, a rule, or a real icon.",
  },
  {
    name: "Generic call to action",
    spot: "button text of 'Get Started', 'Learn More', 'Click Here', or 'Discover'",
    instead: "Say what happens: 'Send the invite', 'See this month's bill'. A CTA that fits any product is a CTA for none.",
  },
  {
    name: "Three feature cards, always three",
    spot: "a grid of exactly three equal cards, each an icon, a two-word heading, and a sentence",
    instead: "The layout came before the content. Say what there actually is, and let the count follow.",
  },
  {
    name: "Marketing adjectives instead of facts",
    spot: "seamless, revolutionise, unlock, elevate, effortless, cutting-edge, 'take it to the next level'",
    instead: "A number, a noun, or a verb the reader recognises. Specific beats aspirational.",
  },
  {
    name: "Lorem or invented content",
    spot: "lorem ipsum, 'John Doe', 'Company Name', placeholder avatars, fabricated testimonials or logos",
    instead: "Real content, or clearly-labelled empty states. Fake reviews and fake logos are worse than blank space.",
  },
  {
    name: "Contrast sacrificed to taste",
    spot: "grey body text under 4.5:1 on its background, or a light-grey placeholder standing in for a label",
    instead: "Compute the ratio. #999 on white is a design decision that excludes people.",
  },
  {
    name: "Type with no scale",
    spot: "font-size values that do not follow a ratio, or more than six distinct sizes on one page",
    instead: "A scale, stated in the house style, and every size taken from it.",
  },
  {
    name: "Spacing by eyeball",
    spot: "margins and paddings in unrelated values (13px, 22px, 7px) rather than steps of a unit",
    instead: "One spacing unit and multiples of it. Inconsistent gaps read as sloppiness even when nobody can name why.",
  },
  {
    name: "Shadow as a substitute for structure",
    spot: "box-shadow on every card, at the same blur, doing the work a border or a background would do better",
    instead: "Depth should mean something is above something. Flat groups with a hairline read cleaner.",
  },
  {
    name: "Hover states only",
    spot: ":hover styled, :focus-visible absent",
    instead: "Half your users are on a keyboard or a touchscreen. A focus ring is not optional.",
  },
  {
    name: "The dark mode that was not designed",
    spot: "colours defined only inside a prefers-color-scheme block, or a light palette inverted wholesale",
    instead: "Tokens at the root, re-valued for dark. Check that the accent still works on the dark ground.",
  },
];

/** The list as an agent should read it. */
export function slopRulesAsText(): string {
  return SLOP_RULES.map(
    (rule, i) => `${i + 1}. **${rule.name}** — spot it: ${rule.spot}. ${rule.instead}`,
  ).join("\n");
}
