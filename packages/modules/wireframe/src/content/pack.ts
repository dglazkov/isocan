/**
 * **What a content pack is** (design §10, *Sample content comes from packs,
 * because Jev cannot write*).
 *
 * A pack is one domain's believable nouns, numbers and phrases — synthetic,
 * with no real brand, person or address in it (`content.test.ts` scans every
 * string for a denylist). Strings may carry small templates the filler
 * expands deterministically:
 *
 * | token        | expands to                                        |
 * | ------------ | ------------------------------------------------- |
 * | `{#a-b}`     | a whole number from a to b (`{#00-59}` pads)      |
 * | `{A-F}`      | a letter from A to F                              |
 * | `{name}`     | a first name with an initial — `Priya S.`         |
 * | `{first}`    | a first name alone                                |
 * | `{time}`     | a clock time — `10:40`                            |
 * | `{day}`      | a relative day — `Today`, `Tue`                   |
 * | `{date}`     | a short date — `Sep 14`                           |
 * | `{ago}`      | a recent time — `12 min ago`                      |
 *
 * Every field is a list the filler draws from by seed — never free text
 * written at draw time.
 */
export interface Metric {
  label: string;
  /** A template: `{#12-40}`, `{#88-99}%`, `$${#2-9},{#100-999}`. */
  value: string;
  /** A change, when the metric has one: `+{#2-6}`. */
  delta?: string;
  /** The delta is a fall (drawn ▼), not a rise. */
  down?: boolean;
}

export interface Pack {
  id: string;
  /** For people and for Jev's criteria: what the pack is for. */
  name: string;
  /** The kinds of product it fits — Jev reads this to choose. */
  about: string;
  /** The domain's thing, singular and plural: `Delivery`, `Deliveries`. */
  noun: readonly [string, string];
  /** Home's heading: `Today's route`. */
  home: string;
  /** At least 20 item titles (templates allowed). */
  titles: readonly string[];
  /** Secondary lines under a title. */
  subs: readonly string[];
  statuses: readonly string[];
  categories: readonly string[];
  /** A short trailing value on a row: a time, a distance, a count. */
  meta: readonly string[];
  /** The domain's amount — a price, a weight, a duration. */
  amount: readonly string[];
  /**
   * A table's column headers, for the entity's fields in this order:
   * title, sub, status, meta, category, person, date, amount.
   */
  columns: readonly [string, string, string, string, string, string, string, string];
  /** At least 4 domain metrics with units. */
  metrics: readonly Metric[];
  /** At least 6 form fields: label, sample value. */
  fields: ReadonlyArray<readonly [string, string]>;
  /** At least 4 label/value pairs for a description list. */
  details: ReadonlyArray<readonly [string, string]>;
  /** At least 6 short sentences of body copy. */
  lines: readonly string[];
  /** At least 6 short remarks people leave — comments, posts, notes. */
  remarks: readonly string[];
  /** What a person in this app is: `Driver · Route 12`. */
  roles: readonly string[];
  /** A profile's three stats: label, value template. */
  profile: readonly [readonly [string, string], readonly [string, string], readonly [string, string]];
  /** Onboarding's headline and line. */
  pitch: readonly [string, string];
  /** An empty list's title and line. */
  empty: readonly [string, string];
  /** A done screen's title and line. */
  success: readonly [string, string];
  /** 4–8 pictogram ids (`pictograms.ts`), the domain's own first. */
  motifs: readonly string[];
}

/** First names, diverse by design, each shown with an initial — never a whole real name. */
export const FIRST_NAMES: readonly string[] = [
  "Priya", "Tomás", "Aisha", "Kenji", "Maya", "Luca", "Zanele", "Omar", "Ingrid", "Mateo", "Leila", "Chen",
  "Amara", "Jonas", "Sofia", "Ravi", "Nia", "Felix", "Yuki", "Diego", "Hana", "Kofi", "Elena", "Arjun",
  "Freya", "Malik", "Rosa", "Tariq", "Lena", "Emeka", "Mei", "Nikolai", "Ana", "Idris", "Clara", "Sanjay",
  "Imani", "Oskar", "Lucía", "Ahmed", "Wren", "Tuan", "Farah", "Bruno", "Ayo", "Greta", "Ishaan", "Noor",
];

export const INITIALS = "ABCDEFGHJKLMNOPRSTVWY";
export const DAYS: readonly string[] = ["Today", "Today", "Yesterday", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Tomorrow"];
export const MONTHS: readonly string[] = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Generic settings rows every app has — label, value; a switch where the value is empty. */
export const SETTINGS_ROWS: ReadonlyArray<readonly [string, string]> = [
  ["Notifications", ""], ["Language", "English"], ["Dark mode", ""], ["Account", "{first}"], ["Privacy", ""],
  ["Units", "Metric"], ["Sound", ""], ["Help and feedback", ""], ["Storage", "{#1-9}.{#0-9} GB"], ["Sign-in and security", ""],
];

/** Generic words the auth and wizard blocks use, which belong to no domain. */
export const GENERIC = {
  email: "{lower}@example.com",
  password: "••••••••••",
  phone: "+1 555 01{#10-99}",
  code: "{#100000-999999}",
  steps: ["Details", "Address", "Schedule", "Review", "Payment", "Done"],
  noResults: ["No matches", "Try a different word or clear a filter."],
  cleared: ["All caught up", "Nothing left here — new ones will appear as they arrive."],
  signInLead: ["Welcome back", "Sign in to pick up where you left off."],
  signUpLead: ["Create your account", "It takes less than a minute."],
  verifyLead: ["Check your phone", "Enter the code we sent to •••• {#10-99}."],
  forgotLead: ["Reset your password", "We'll email you a link to choose a new one."],
  sentLead: ["Check your email", "A reset link is on its way."],
  errors: {
    "404": "This page has moved or never existed.",
    offline: "You're offline. Check your connection and try again.",
    generic: "Something went wrong on our side. Try again in a moment.",
    permission: "Ask the owner for access to see this.",
  } as Record<string, string>,
  filterGroups: ["Status", "Category", "Date"],
  sectionHeads: ["Today", "Earlier this week", "Last week"],
  crumbs: ["Home", "All"],
  newsletter: "Get updates",
} as const;
