import { ARCHETYPE_IDS } from "./archetypes.ts";

/**
 * **Every archetype in plain words** — what a model reads, never what a
 * spec stores (wireframes phase 6's Open, measured 24 Sep 2026).
 *
 * The ids (`list`, `gallery`, `sign-in`) are the catalog's names for its
 * own tables, and the recipes that describe them are component ids
 * (`stacked-list or card-grid or data-table`). Put to Jev as the options of
 * a question, those words confuse siblings that share a shape — a gallery
 * read as a list, sign-in as welcome, a menu as home. Each line here says
 * what a person sees on the screen and, where a sibling is close, what
 * tells them apart. They are used only inside a question: `plainOptions`
 * offers them as the options and maps the answer back to the id.
 */
export const ARCHETYPE_WORDS: Readonly<Record<(typeof ARCHETYPE_IDS)[number], string>> = {
  welcome: "the first screen a new person sees: a big picture, the app's name and a button to get started",
  onboarding: "one step of a short tour before using the app: a picture, a sentence, dots for the steps, Next or Skip",
  "sign-in": "signing in to an account that exists: email or username, password, a sign-in button",
  "sign-up": "creating a new account: name, email, password and more fields, a button to create it",
  verify: "checking who you are: typing a code that was sent, or an email to reset a password",
  home: "the main screen after signing in: a summary of what matters, with the way to every other part",
  list: "a list of things you can scroll: rows of text, one under another, each opening one thing",
  gallery: "a grid of pictures or thumbnails to browse",
  detail: "one thing shown in full: its title, picture, facts and what you can do with it",
  form: "a form to fill in and submit that is not about an account: fields, choices and a save or send button",
  settings: "settings: rows of options with switches and choices that change how the app behaves",
  menu: "a menu of places to go: a drawer or sheet listing the sections of the app",
  profile: "one person's page: their photo, name and what they have posted or done",
  feed: "a stream of posts or stories from people or sources, newest first",
  search: "searching: a search field with results or suggestions under it",
  confirm: "a small dialog over the screen asking to confirm or pick one thing",
  state: "a message where content would be: nothing here yet, something went wrong, or done",
  legal: "long text to read and accept: terms, a privacy policy or licences",
  storefront: "a shop's front page: featured products, categories and offers",
  cart: "a shopping cart: the things chosen to buy, quantities, a total and a checkout button",
  checkout: "paying for an order: delivery, payment and a review before buying",
  "order-placed": "the confirmation that a purchase went through",
  pricing: "plans side by side with their prices and a button to upgrade",
  landing: "a marketing page: a big headline, features and a call to action",
  about: "about the app: who made it, what it is, the version and credits",
  contact: "getting in touch: ways to reach someone, a message form, an address",
  blog: "articles to read: a list of articles or one article",
  "master-detail": "a list beside the selected thing's details, both at once",
  chat: "a conversation: message bubbles and a field to type a reply",
  notifications: "a list of alerts and recent activity",
  player: "playing music or video: artwork, a progress bar, play and pause",
  map: "a map with places marked on it",
  editor: "making or changing something: a picture, drawing or document with a toolbar of tools",
  comments: "a thread of replies with a field to add one",
};

/**
 * A choice question's options for these archetype ids in plain words, and
 * the way back: `criteria` is what the question offers (words as the
 * options, no description), `idOf` reads an answer's option as the id.
 */
export function plainOptions(ids: readonly string[]): { criteria: Record<string, null>; idOf: (option: string) => string } {
  const back = new Map<string, string>();
  const criteria: Record<string, null> = {};
  for (const id of ids) {
    const words = ARCHETYPE_WORDS[id as keyof typeof ARCHETYPE_WORDS] ?? id;
    back.set(words, id);
    criteria[words] = null;
  }
  return { criteria, idOf: (option) => back.get(option) ?? option };
}
