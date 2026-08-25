/**
 * The emoji a picker offers, and the words that find them.
 *
 * **Curated, not complete, and that is the design.** Unicode has ~1,900
 * emoji. Shipping all of them means shipping a keyword index for all of them —
 * the standard datasets are 200–800KB — into a bundle that is already over its
 * warning threshold, to answer a question a canvas of screens does not ask.
 * What gets asked here is a small set of things: is this the one, does it need
 * work, is it done, is it funny, who owns it. This set is built for that, wide
 * enough that nobody feels fenced in and small enough to load with the app.
 *
 * The set is ~200 marks across eight groups, each with the words somebody
 * would actually type to find it. Keywords are lowercase and matched as
 * PREFIXES of whole words, so "fi" finds 🔥 (fire) and "re" finds ❤️ (red
 * heart) without "ire" matching either — substring search on a set this size
 * returns noise that reads as a broken search.
 *
 * There is no lock-in: `item.react` takes any string, so the CLI can wear a
 * mark this file has never heard of and it renders, groups and counts exactly
 * like the rest. This is what the picker OFFERS, never what the canvas allows.
 */

export interface EmojiEntry {
  emoji: string;
  /** What it is called. Shown as the title, and searched. */
  name: string;
  /** Other words that should find it. `name` is searched too — these are the
   * ones that are not in it. */
  keywords: readonly string[];
}

export interface EmojiGroup {
  /** The tab label. Short: these sit in a row across a narrow panel. */
  name: string;
  entries: readonly EmojiEntry[];
}

const e = (emoji: string, name: string, ...keywords: string[]): EmojiEntry => ({
  emoji,
  name,
  keywords,
});

/**
 * The groups, in the order a picker shows them.
 *
 * "Verdicts" leads deliberately. It is not a standard emoji category — the
 * standard first category is smileys — but it is the one that answers the
 * question this picker exists for, and a picker whose first row is the answer
 * is a picker most people never scroll.
 */
export const EMOJI_GROUPS: readonly EmojiGroup[] = [
  {
    name: "Verdicts",
    entries: [
      e("👍", "thumbs up", "yes", "approve", "ok", "good", "like", "+1"),
      e("👎", "thumbs down", "no", "reject", "bad", "-1"),
      e("✅", "check", "done", "shipped", "approved", "yes", "tick", "complete"),
      e("❌", "cross", "no", "wrong", "reject", "fail"),
      e("🚧", "construction", "wip", "progress", "blocked", "working", "hold"),
      e("👀", "eyes", "review", "looking", "watch", "seen", "attention"),
      e("🤔", "thinking", "hmm", "unsure", "question", "maybe"),
      e("❓", "question", "ask", "unclear", "what"),
      e("❗", "exclamation", "important", "urgent", "attention"),
      e("⚠️", "warning", "careful", "risk", "caution"),
      e("🛑", "stop", "halt", "blocked", "no"),
      e("🏁", "finish", "done", "end", "goal", "ship"),
      e("⭐", "star", "favourite", "favorite", "keep", "best", "pick"),
      e("🥇", "first place", "winner", "best", "gold", "one"),
      e("🆕", "new", "fresh", "latest"),
      e("🔒", "locked", "frozen", "final", "closed"),
      e("🔓", "unlocked", "open", "editable"),
      e("♻️", "recycle", "redo", "rework", "again", "iterate"),
      e("⏳", "hourglass", "waiting", "later", "pending", "soon"),
      e("📌", "pin", "keep", "important", "save"),
      e("🔖", "bookmark", "save", "later", "keep"),
      e("🚀", "rocket", "ship", "launch", "fast", "go"),
    ],
  },
  {
    name: "Feelings",
    entries: [
      e("😀", "grin", "happy", "smile"),
      e("😂", "tears of joy", "lol", "funny", "laugh", "haha"),
      e("🤣", "rolling", "lol", "funny", "laugh", "rofl"),
      e("😊", "blush", "happy", "smile", "warm"),
      e("😍", "heart eyes", "love", "want", "adore", "gorgeous"),
      e("🤩", "starstruck", "wow", "amazing", "excited"),
      e("😎", "cool", "sunglasses", "slick", "smooth"),
      e("🥳", "party face", "celebrate", "yay", "hooray"),
      e("😅", "sweat smile", "phew", "close", "awkward"),
      e("😬", "grimace", "yikes", "awkward", "oof"),
      e("😭", "sobbing", "crying", "sad", "hurts"),
      e("😱", "screaming", "shock", "scared", "omg"),
      e("🤯", "mind blown", "wow", "whoa", "exploding"),
      e("🙃", "upside down", "irony", "sarcasm", "oh well"),
      e("😴", "sleeping", "boring", "tired", "zzz"),
      e("🥲", "tear", "bittersweet", "holding it together"),
      e("🫠", "melting", "overwhelmed", "dying", "help"),
      e("🤐", "zipper mouth", "quiet", "no comment", "secret"),
      e("🙈", "see no evil", "cringe", "hiding", "monkey"),
      e("💀", "skull", "dead", "killed me", "fatal", "rip"),
      e("🫡", "salute", "on it", "yes sir", "acknowledged"),
      e("🤝", "handshake", "agreed", "deal", "together"),
      e("🙏", "please", "thanks", "pray", "hope"),
      e("👏", "clap", "bravo", "well done", "applause"),
      e("🙌", "raised hands", "yay", "praise", "celebrate"),
      e("💪", "flex", "strong", "muscle", "can do"),
      e("🫶", "heart hands", "love", "care", "thanks"),
      e("🤌", "chef kiss", "perfect", "italian", "precise"),
    ],
  },
  {
    name: "Hearts",
    entries: [
      e("❤️", "red heart", "love", "like", "yes"),
      e("🧡", "orange heart", "love", "warm"),
      e("💛", "yellow heart", "love", "bright"),
      e("💚", "green heart", "love", "go"),
      e("💙", "blue heart", "love", "calm"),
      e("💜", "purple heart", "love"),
      e("🖤", "black heart", "love", "dark", "goth"),
      e("🤍", "white heart", "love", "clean", "pure"),
      e("🩶", "grey heart", "gray", "love", "neutral"),
      e("💖", "sparkling heart", "love", "special"),
      e("💘", "cupid", "love", "arrow", "smitten"),
      e("💔", "broken heart", "sad", "no", "hurts"),
      e("🔥", "fire", "hot", "great", "lit", "burning"),
      e("✨", "sparkles", "magic", "polish", "shiny", "delight"),
      e("💫", "dizzy", "sparkle", "wow"),
      e("⚡", "zap", "fast", "power", "lightning", "energy"),
    ],
  },
  {
    name: "Craft",
    entries: [
      e("🎨", "palette", "design", "art", "colour", "color", "paint"),
      e("🖌️", "brush", "paint", "design", "art"),
      e("✏️", "pencil", "edit", "write", "draft", "change"),
      e("📐", "triangle ruler", "layout", "measure", "geometry", "align"),
      e("📏", "ruler", "measure", "spacing", "size"),
      e("🔤", "letters", "type", "font", "typography", "text"),
      e("🖼️", "picture", "image", "frame", "art"),
      e("📷", "camera", "photo", "screenshot", "shot"),
      e("🎬", "clapper", "video", "motion", "film", "action"),
      e("🎯", "target", "on point", "goal", "bullseye", "exact"),
      e("🧩", "puzzle", "piece", "fits", "component", "part"),
      e("🪄", "wand", "magic", "auto", "generate"),
      e("🔨", "hammer", "build", "fix", "make"),
      e("🛠️", "tools", "build", "fix", "wip", "maintenance"),
      e("🔧", "wrench", "fix", "tune", "config", "adjust"),
      e("⚙️", "gear", "settings", "config", "machine", "system"),
      e("🧪", "test tube", "experiment", "test", "try", "lab"),
      e("🔬", "microscope", "detail", "inspect", "research", "close"),
      e("🔍", "magnify", "search", "find", "look", "zoom"),
      e("🧹", "broom", "cleanup", "tidy", "sweep", "refactor"),
      e("🗑️", "trash", "delete", "bin", "remove", "junk"),
      e("📦", "package", "ship", "box", "bundle", "release"),
      e("🏗️", "crane", "building", "wip", "construction", "scaffold"),
      e("🪜", "ladder", "step", "climb", "levels"),
    ],
  },
  {
    name: "Signals",
    entries: [
      e("🐛", "bug", "defect", "broken", "issue", "problem"),
      e("🔴", "red circle", "stop", "bad", "critical", "record"),
      e("🟠", "orange circle", "warning", "medium"),
      e("🟡", "yellow circle", "caution", "middling"),
      e("🟢", "green circle", "good", "go", "healthy", "pass"),
      e("🔵", "blue circle", "info", "neutral"),
      e("🟣", "purple circle", "other"),
      e("⚫", "black circle", "off", "dead", "none"),
      e("⚪", "white circle", "empty", "blank", "unset"),
      e("📈", "chart up", "growth", "better", "improved", "win"),
      e("📉", "chart down", "worse", "regression", "loss", "drop"),
      e("📊", "bar chart", "data", "metrics", "numbers", "stats"),
      e("🔺", "up triangle", "increase", "more", "higher"),
      e("🔻", "down triangle", "decrease", "less", "lower"),
      e("💯", "hundred", "perfect", "full marks", "all the way"),
      e("🆗", "ok", "fine", "acceptable"),
      e("🔁", "repeat", "loop", "again", "cycle"),
      e("🔀", "shuffle", "random", "mix", "swap"),
      e("⏸️", "pause", "hold", "wait", "stop for now"),
      e("▶️", "play", "go", "run", "start"),
      e("⏭️", "next", "skip", "forward"),
      e("🔔", "bell", "notify", "alert", "ping"),
      e("📣", "megaphone", "announce", "shout", "broadcast"),
      e("🧭", "compass", "direction", "navigate", "wayfinding", "north"),
    ],
  },
  {
    name: "People",
    entries: [
      e("👋", "wave", "hi", "hello", "bye"),
      e("🫵", "pointing at you", "you", "yours", "this one"),
      e("👇", "point down", "below", "this", "under"),
      e("👆", "point up", "above", "that", "over"),
      e("👈", "point left", "previous", "back", "before"),
      e("👉", "point right", "next", "forward", "after"),
      e("🧑‍💻", "person at computer", "dev", "engineer", "coding", "work"),
      e("🧑‍🎨", "artist", "designer", "design", "creative"),
      e("🕵️", "detective", "investigate", "find", "search", "spy"),
      e("🧙", "wizard", "magic", "expert", "guru"),
      e("🤖", "robot", "agent", "bot", "ai", "automated"),
      e("👻", "ghost", "gone", "vanished", "spooky", "haunting"),
      e("🦾", "robot arm", "strong", "machine", "power"),
      e("🧠", "brain", "smart", "think", "idea", "clever"),
      e("👑", "crown", "best", "king", "queen", "top", "royal"),
      e("🎓", "graduate", "learned", "teach", "school", "lesson"),
      e("🫂", "hug", "support", "together", "care"),
      e("🧑‍🚀", "astronaut", "space", "explorer", "moon"),
    ],
  },
  {
    name: "Life",
    entries: [
      e("🎉", "party popper", "celebrate", "yay", "launch", "hooray"),
      e("🎊", "confetti", "celebrate", "party"),
      e("🥂", "cheers", "toast", "celebrate", "drinks"),
      e("🍾", "champagne", "celebrate", "pop", "launch"),
      e("☕", "coffee", "morning", "caffeine", "break"),
      e("🍕", "pizza", "food", "lunch", "friday"),
      e("🍰", "cake", "birthday", "sweet", "treat"),
      e("🌱", "seedling", "new", "growing", "start", "sprout"),
      e("🌳", "tree", "grown", "mature", "stable"),
      e("🌊", "wave", "ocean", "flow", "water"),
      e("🌈", "rainbow", "colour", "color", "pride", "bright"),
      e("☀️", "sun", "day", "light", "bright", "clear"),
      e("🌙", "moon", "night", "late", "dark", "overnight"),
      e("⛈️", "storm", "trouble", "rough", "bad weather"),
      e("❄️", "snowflake", "frozen", "cold", "freeze", "winter"),
      e("🏔️", "mountain", "big", "hard", "climb", "peak"),
      e("🐢", "turtle", "slow", "sluggish", "performance"),
      e("🐇", "rabbit", "fast", "quick", "speed"),
      e("🦄", "unicorn", "rare", "special", "magic", "impossible"),
      e("🐉", "dragon", "big", "epic", "beast"),
      e("🦋", "butterfly", "transform", "change", "pretty"),
      e("🐝", "bee", "busy", "buzz", "work"),
      e("🌵", "cactus", "dry", "prickly", "desert"),
      e("🍀", "clover", "luck", "lucky", "fortune"),
    ],
  },
  {
    name: "Objects",
    entries: [
      e("💡", "bulb", "idea", "insight", "suggestion", "light"),
      e("📝", "memo", "note", "write", "notes", "doc"),
      e("📄", "page", "document", "file", "doc", "text"),
      e("📚", "books", "docs", "reading", "reference", "library"),
      e("🗂️", "dividers", "organize", "sort", "files", "index"),
      e("🔗", "link", "url", "connect", "chain", "reference"),
      e("📎", "paperclip", "attach", "file", "clip"),
      e("🗓️", "calendar", "date", "schedule", "when", "plan"),
      e("⏰", "alarm", "time", "deadline", "urgent", "clock"),
      e("💰", "money", "cost", "price", "budget", "cash"),
      e("💎", "gem", "precious", "quality", "diamond", "valuable"),
      e("🔑", "key", "access", "auth", "secret", "unlock"),
      e("🧲", "magnet", "attract", "pull", "draw"),
      e("🪞", "mirror", "reflect", "same", "copy"),
      e("🖥️", "monitor", "desktop", "screen", "display"),
      e("📱", "phone", "mobile", "device", "responsive"),
      e("⌨️", "keyboard", "type", "input", "keys"),
      e("🖱️", "mouse", "click", "pointer", "cursor"),
      e("🔌", "plug", "connect", "power", "integration"),
      e("🧵", "thread", "sewing", "series", "chain"),
      e("🪟", "window", "pane", "view", "frame"),
      e("🚪", "door", "entry", "exit", "way in", "leave"),
    ],
  },
];

/** Every entry, flattened — the search corpus. */
export const ALL_EMOJI: readonly EmojiEntry[] = EMOJI_GROUPS.flatMap((group) => group.entries);

/**
 * A short, opinionated starter set: what the picker shows before anybody has
 * a history, and the fallback when recents are empty.
 *
 * A canvas of screens gets asked the same handful of questions — is this the
 * one, does it need work, is it funny, is it done — and these eight answer
 * them. The rest of the set is one keystroke away for everything else.
 */
export const QUICK_REACTIONS = ["👍", "🎉", "👀", "🤔", "❤️", "🔥", "🚧", "✅"] as const;

/** Words split out of a name or a keyword — the unit search matches against. */
function wordsOf(entry: EmojiEntry): string[] {
  return [entry.name, ...entry.keywords].flatMap((text) => text.split(/[\s-]+/));
}

/**
 * Emoji whose name or keywords have a word STARTING with each term typed.
 *
 * Prefix-per-word rather than substring, and the difference is the difference
 * between a search that works and one that looks broken: "ok" as a substring
 * hits "broken", "bookmark" and "looking" before it reaches 🆗. Every term
 * must match (AND), so "green heart" narrows instead of widening.
 *
 * Ranked by where the match landed — a hit on the NAME beats a hit on a
 * keyword, and a hit at the name's start beats one in the middle — so typing
 * "star" puts ⭐ above 🤩, and typing "fire" puts 🔥 first. Ties keep the
 * curated order, which is deliberate: it is the order somebody chose.
 */
export function searchEmoji(query: string, limit = 48): EmojiEntry[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const scored: { entry: EmojiEntry; score: number; at: number }[] = [];
  ALL_EMOJI.forEach((entry, at) => {
    let score = 0;
    for (const term of terms) {
      const words = wordsOf(entry);
      const nameWords = entry.name.split(/[\s-]+/);
      const hit = words.some((word) => word.startsWith(term));
      if (!hit) return;
      if (entry.name.startsWith(term)) score += 4;
      else if (nameWords.some((word) => word.startsWith(term))) score += 2;
      else score += 1;
    }
    scored.push({ entry, score, at });
  });
  return scored
    .sort((a, b) => (b.score === a.score ? a.at - b.at : b.score - a.score))
    .slice(0, limit)
    .map((row) => row.entry);
}

/** What one emoji is called, for a tooltip. Unknown marks — anything the CLI
 * wore that this file has never heard of — answer with themselves rather than
 * with nothing, so a title is never empty. */
export function emojiName(emoji: string): string {
  return ALL_EMOJI.find((entry) => entry.emoji === emoji)?.name ?? emoji;
}
