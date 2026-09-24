/**
 * **The intent vocabulary — 52 values** (research §3's 49, *The intent vocabulary*, and three tab targets).
 *
 * Jev writes no prose, and a prototype's links hang on exactly the words a
 * button carries. So an actionable element carries a typed intent, and its
 * label is the intent's default wording: that is how a wireframe gets "Sign
 * in" on its button without anything writing a word.
 *
 * Grouped as the research groups them, by what they do to navigation. `nav`
 * is the transition rule the research's *obvious transitions* table gives;
 * link inference (a later phase) reads it, and nothing here acts on it yet.
 */

export type IntentGroup = "forward" | "auth" | "back" | "detail" | "form" | "overlay" | "jump" | "in-place";

/** The four transitions the research settles on, which carry information rather than decoration. */
export type Transition = "none" | "push" | "pop" | "overlay" | "dissolve";

export type IntentNav =
  /** The next kept screen in reading order. */
  | { to: "next"; transition: Transition }
  /** The first kept screen after an onboarding run. */
  | { to: "after-run"; transition: Transition }
  /** The previous screen in history, or the screen under an overlay. */
  | { to: "history"; transition: Transition }
  /** The first kept post-auth screen (`home`, `list` or `feed`). */
  | { to: "post-auth"; transition: Transition }
  /** The nearest screen of an archetype (the id may be a later wave's). */
  | { to: "archetype"; archetype: string; transition: Transition }
  /** An overlay on this screen, drawn by the named component. */
  | { to: "overlay"; component: string; transition: Transition }
  /** Nothing — state within the screen. */
  | { to: "none"; transition: Transition };

export interface Intent {
  id: string;
  label: string;
  group: IntentGroup;
  nav: IntentNav;
}

const next = { to: "next", transition: "push" } as const;
const history = { to: "history", transition: "pop" } as const;
const none = { to: "none", transition: "none" } as const;
const arch = (archetype: string, transition: Transition = "push") => ({ to: "archetype", archetype, transition }) as const;
const overlay = (component: string) => ({ to: "overlay", component, transition: "overlay" }) as const;

export const INTENTS = [
  // forward (10)
  { id: "continue", label: "Continue", group: "forward", nav: next },
  { id: "next", label: "Next", group: "forward", nav: next },
  { id: "get-started", label: "Get started", group: "forward", nav: next },
  { id: "done", label: "Done", group: "forward", nav: next },
  { id: "submit", label: "Submit", group: "forward", nav: next },
  { id: "save", label: "Save", group: "forward", nav: next },
  { id: "apply", label: "Apply", group: "forward", nav: next },
  { id: "confirm", label: "Confirm", group: "forward", nav: next },
  { id: "accept", label: "Accept", group: "forward", nav: next },
  { id: "skip", label: "Skip", group: "forward", nav: { to: "after-run", transition: "dissolve" } },
  // auth (4)
  { id: "sign-in", label: "Sign in", group: "auth", nav: { to: "post-auth", transition: "dissolve" } },
  { id: "sign-up", label: "Sign up", group: "auth", nav: arch("sign-up") },
  { id: "forgot-password", label: "Forgot password?", group: "auth", nav: arch("verify") },
  { id: "log-out", label: "Log out", group: "auth", nav: arch("sign-in", "dissolve") },
  // back (4)
  { id: "back", label: "Back", group: "back", nav: history },
  { id: "cancel", label: "Cancel", group: "back", nav: history },
  { id: "close", label: "Close", group: "back", nav: history },
  { id: "dismiss", label: "Dismiss", group: "back", nav: history },
  // detail (1)
  { id: "open", label: "Open", group: "detail", nav: arch("detail") },
  // form (2)
  { id: "add", label: "Add", group: "form", nav: arch("form") },
  { id: "edit", label: "Edit", group: "form", nav: arch("form") },
  // overlay (7)
  { id: "filter", label: "Filter", group: "overlay", nav: overlay("filter-panel") },
  { id: "sort", label: "Sort", group: "overlay", nav: overlay("sheet") },
  { id: "share", label: "Share", group: "overlay", nav: overlay("sheet") },
  { id: "delete", label: "Delete", group: "overlay", nav: arch("confirm", "overlay") },
  { id: "more", label: "More", group: "overlay", nav: overlay("dropdown-menu") },
  { id: "menu", label: "Menu", group: "overlay", nav: overlay("drawer") },
  { id: "info", label: "Info", group: "overlay", nav: overlay("popover") },
  // jump to an archetype (16: the research's 13, and three tab targets)
  { id: "search", label: "Search", group: "jump", nav: arch("search") },
  { id: "settings", label: "Settings", group: "jump", nav: arch("settings") },
  { id: "profile", label: "Profile", group: "jump", nav: arch("profile") },
  { id: "notifications", label: "Notifications", group: "jump", nav: arch("notifications") },
  { id: "cart", label: "Cart", group: "jump", nav: arch("cart") },
  { id: "checkout", label: "Checkout", group: "jump", nav: arch("checkout") },
  { id: "buy", label: "Buy", group: "jump", nav: arch("order-placed") },
  { id: "home", label: "Home", group: "jump", nav: arch("home", "none") },
  { id: "terms", label: "Terms", group: "jump", nav: arch("legal") },
  { id: "contact", label: "Contact", group: "jump", nav: arch("contact") },
  { id: "upgrade", label: "Upgrade", group: "jump", nav: arch("pricing") },
  { id: "help", label: "Help", group: "jump", nav: arch("contact") },
  { id: "messages", label: "Messages", group: "jump", nav: arch("chat") },
  // A tab that IS one of the flow's screens (24 Sep 2026, wireframes phase 3's Open): Jev labelled a
  // tab "Profile" and the tab rule sent it to the list, because nothing here could say "this tab is
  // the list". These three can. A fleshed one reads in the pack's words ("Deliveries").
  { id: "open-list", label: "List", group: "jump", nav: arch("list", "none") },
  { id: "open-feed", label: "Feed", group: "jump", nav: arch("feed", "none") },
  { id: "open-gallery", label: "Gallery", group: "jump", nav: arch("gallery", "none") },
  // in place (8)
  { id: "like", label: "Like", group: "in-place", nav: none },
  { id: "follow", label: "Follow", group: "in-place", nav: none },
  { id: "play", label: "Play", group: "in-place", nav: none },
  { id: "select", label: "Select", group: "in-place", nav: none },
  { id: "copy", label: "Copy", group: "in-place", nav: none },
  { id: "retry", label: "Retry", group: "in-place", nav: none },
  { id: "upload", label: "Upload", group: "in-place", nav: none },
  { id: "remember", label: "Remember me", group: "in-place", nav: none },
] as const satisfies readonly Intent[];

export type IntentId = (typeof INTENTS)[number]["id"];

export const INTENT_BY_ID: ReadonlyMap<string, Intent> = new Map(INTENTS.map((i) => [i.id, i as Intent]));

export function intentsIn(...groups: IntentGroup[]): IntentId[] {
  return INTENTS.filter((i) => (groups as string[]).includes(i.group)).map((i) => i.id);
}

export const ALL_INTENTS: IntentId[] = INTENTS.map((i) => i.id);
