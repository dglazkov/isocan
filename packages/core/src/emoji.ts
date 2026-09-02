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
 * The set is ~580 marks across fourteen groups, each with the words somebody
 * would actually type to find it. Keywords are lowercase and matched as
 * PREFIXES of whole words, so "fi" finds 🔥 (fire) and "re" finds ❤️ (red
 * heart) without "ire" matching either — substring search on a set this size
 * returns noise that reads as a broken search.
 *
 * **Why it grew, and where the line still is.** The first eight groups
 * answer *what do I think of this* — the reaction question. But a mark is
 * also how somebody is drawn on every face in the app, and *who am I* draws
 * on a different vocabulary: where you are from, what you sail, what you
 * keep. Reported as "I wanted an anchor, and a UK flag" — neither of which
 * is a verdict on anything. So the later six groups are the identity half:
 * Nature, Food, Travel, Activity, Symbols and Flags. Flags carry both the
 * country name and its two-letter code, because somebody reaching for theirs
 * types either one.
 *
 * It is still curation, not completeness — ~580 of Unicode's ~1,900, chosen
 * so that every one of them has words worth searching. A full dataset is the
 * 200–800KB this file exists not to ship.
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

interface EmojiGroup {
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
  {
    name: "Nature",
    entries: [
      e("🐶", "dog", "puppy", "pet", "animal"),
      e("🐱", "cat", "kitten", "pet", "animal"),
      e("🐭", "mouse", "animal"),
      e("🐹", "hamster", "animal"),
      e("🐰", "rabbit", "bunny", "animal"),
      e("🦊", "fox", "animal"),
      e("🐻", "bear", "animal"),
      e("🐼", "panda", "animal"),
      e("🐨", "koala", "animal"),
      e("🐯", "tiger", "animal"),
      e("🦁", "lion", "animal"),
      e("🐮", "cow", "animal"),
      e("🐷", "pig", "animal"),
      e("🐸", "frog", "animal"),
      e("🐵", "monkey", "animal"),
      e("🐔", "chicken", "hen", "animal"),
      e("🐧", "penguin", "animal"),
      e("🐦", "bird", "animal"),
      e("🦆", "duck", "animal"),
      e("🦉", "owl", "wise", "night", "animal"),
      e("🦇", "bat", "animal"),
      e("🐺", "wolf", "animal"),
      e("🐗", "boar", "animal"),
      e("🐴", "horse", "animal"),
      e("🐌", "snail", "slow", "animal"),
      e("🐞", "ladybug", "beetle", "animal"),
      e("🐜", "ant", "animal"),
      e("🕷️", "spider", "animal"),
      e("🦂", "scorpion", "animal"),
      e("🐍", "snake", "animal"),
      e("🦎", "lizard", "animal"),
      e("🐙", "octopus", "animal"),
      e("🦑", "squid", "animal"),
      e("🦀", "crab", "animal"),
      e("🐟", "fish", "animal"),
      e("🐠", "tropical fish", "animal"),
      e("🐬", "dolphin", "animal"),
      e("🐳", "whale", "animal"),
      e("🦈", "shark", "animal"),
      e("🐊", "crocodile", "alligator", "animal"),
      e("🐘", "elephant", "animal"),
      e("🦒", "giraffe", "animal"),
      e("🦓", "zebra", "animal"),
      e("🐪", "camel", "animal"),
      e("🐑", "sheep", "animal"),
      e("🐐", "goat", "animal"),
      e("🦌", "deer", "animal"),
      e("🌲", "evergreen", "tree", "forest", "pine"),
      e("🌴", "palm tree", "beach", "holiday", "vacation"),
      e("🌿", "herb", "leaf", "plant"),
      e("🍁", "maple leaf", "autumn", "fall", "canada"),
      e("🍂", "fallen leaves", "autumn", "fall"),
      e("🌷", "tulip", "flower"),
      e("🌹", "rose", "flower"),
      e("🌻", "sunflower", "flower"),
      e("🌸", "cherry blossom", "flower", "sakura"),
      e("🌼", "blossom", "flower", "daisy"),
      e("💐", "bouquet", "flowers", "thanks"),
      e("🌍", "globe europe", "earth", "world", "planet"),
      e("🌎", "globe americas", "earth", "world", "planet"),
      e("🌏", "globe asia", "earth", "world", "planet"),
      e("🌑", "new moon", "dark", "night"),
      e("🌗", "half moon", "night"),
      e("⛅", "partly cloudy", "weather"),
      e("☁️", "cloud", "cloudy", "weather"),
      e("🌧️", "rain", "rainy", "weather", "wet"),
      e("🌨️", "snow", "snowy", "weather", "cold"),
      e("⛄", "snowman", "winter", "cold"),
      e("🌪️", "tornado", "chaos", "disaster"),
      e("💧", "droplet", "water", "drop"),
    ],
  },
  {
    name: "Food",
    entries: [
      e("🍎", "apple", "fruit"),
      e("🍊", "orange", "fruit", "tangerine"),
      e("🍋", "lemon", "fruit", "sour"),
      e("🍌", "banana", "fruit"),
      e("🍉", "watermelon", "fruit"),
      e("🍇", "grapes", "fruit"),
      e("🍓", "strawberry", "fruit"),
      e("🫐", "blueberries", "fruit"),
      e("🍒", "cherries", "fruit"),
      e("🍑", "peach", "fruit"),
      e("🥭", "mango", "fruit"),
      e("🍍", "pineapple", "fruit"),
      e("🥥", "coconut", "fruit"),
      e("🥑", "avocado", "fruit"),
      e("🍅", "tomato", "vegetable"),
      e("🥕", "carrot", "vegetable"),
      e("🌽", "corn", "vegetable"),
      e("🌶️", "hot pepper", "chilli", "chili", "spicy"),
      e("🥦", "broccoli", "vegetable"),
      e("🥬", "leafy green", "salad", "vegetable"),
      e("🍄", "mushroom", "fungus"),
      e("🥔", "potato", "vegetable"),
      e("🍞", "bread", "loaf", "bakery"),
      e("🥐", "croissant", "bakery", "pastry"),
      e("🥖", "baguette", "bread", "bakery"),
      e("🧀", "cheese", "dairy"),
      e("🥚", "egg", "breakfast"),
      e("🥓", "bacon", "breakfast"),
      e("🥞", "pancakes", "breakfast"),
      e("🧇", "waffle", "breakfast"),
      e("🍔", "hamburger", "burger", "lunch"),
      e("🍟", "fries", "chips", "lunch"),
      e("🌭", "hot dog", "lunch"),
      e("🥪", "sandwich", "lunch"),
      e("🌮", "taco", "lunch"),
      e("🌯", "burrito", "lunch"),
      e("🥗", "salad", "healthy", "lunch"),
      e("🍝", "spaghetti", "pasta", "dinner"),
      e("🍜", "ramen", "noodles", "dinner"),
      e("🍣", "sushi", "dinner"),
      e("🍱", "bento", "lunch"),
      e("🍚", "rice", "dinner"),
      e("🍛", "curry", "dinner"),
      e("🥘", "paella", "dinner"),
      e("🍲", "stew", "pot", "dinner"),
      e("🍦", "ice cream", "dessert", "sweet"),
      e("🍩", "doughnut", "donut", "dessert", "sweet"),
      e("🍪", "cookie", "biscuit", "dessert", "sweet"),
      e("🎂", "birthday cake", "cake", "celebrate"),
      e("🧁", "cupcake", "dessert", "sweet"),
      e("🍫", "chocolate", "sweet", "dessert"),
      e("🍬", "candy", "sweet"),
      e("🍿", "popcorn", "cinema", "movie", "watching"),
      e("🧂", "salt", "seasoning"),
      e("🫖", "teapot", "tea", "brew"),
      e("🍵", "tea", "green tea", "brew"),
      e("🧃", "juice box", "drink"),
      e("🥤", "soft drink", "soda", "cup", "drink"),
      e("🍺", "beer", "pint", "drink", "pub"),
      e("🍻", "cheers", "beers", "celebrate", "drink"),
      e("🍷", "wine", "drink"),
      e("🍸", "cocktail", "drink"),
      e("🥃", "whisky", "whiskey", "drink"),
      e("🍽️", "plate", "cutlery", "dinner", "eat"),
      e("🥄", "spoon", "cutlery"),
    ],
  },
  {
    name: "Travel",
    entries: [
      e("⚓", "anchor", "ship", "port", "harbour", "harbor", "sail", "moor", "stable"),
      e("⛵", "sailboat", "sailing", "boat", "yacht"),
      e("🚤", "speedboat", "boat", "fast"),
      e("🛥️", "motor boat", "boat"),
      e("🚢", "ship", "cargo", "boat", "freight"),
      e("⛴️", "ferry", "boat"),
      e("🛶", "canoe", "paddle", "boat"),
      e("✈️", "plane", "aeroplane", "airplane", "flight", "fly", "travel"),
      e("🛫", "takeoff", "departure", "plane", "launch"),
      e("🛬", "landing", "arrival", "plane"),
      e("🚁", "helicopter", "fly"),
      e("🛰️", "satellite", "orbit", "space"),
      e("🪐", "ringed planet", "saturn", "space"),
      e("🚗", "car", "drive", "auto"),
      e("🚕", "taxi", "cab", "car"),
      e("🚙", "suv", "car"),
      e("🚌", "bus", "transit"),
      e("🚎", "trolleybus", "transit"),
      e("🏎️", "racing car", "fast", "race"),
      e("🚓", "police car", "police"),
      e("🚑", "ambulance", "emergency"),
      e("🚒", "fire engine", "emergency"),
      e("🚚", "truck", "delivery", "lorry"),
      e("🚛", "lorry", "truck", "freight", "haul"),
      e("🚜", "tractor", "farm"),
      e("🏍️", "motorcycle", "motorbike", "bike"),
      e("🛵", "scooter", "moped"),
      e("🚲", "bicycle", "bike", "cycle"),
      e("🛴", "kick scooter", "scooter"),
      e("🚂", "locomotive", "train", "steam"),
      e("🚆", "train", "rail"),
      e("🚇", "metro", "subway", "underground", "tube"),
      e("🚊", "tram", "transit"),
      e("🚉", "station", "train", "rail"),
      e("🗺️", "map", "atlas", "plan", "route"),
      e("🗿", "moai", "statue", "stone"),
      e("🗽", "statue of liberty", "new york", "usa"),
      e("🗼", "tower", "tokyo"),
      e("🏰", "castle", "fortress"),
      e("🏯", "japanese castle", "shiro", "pagoda", "fortress"),
      e("🏟️", "stadium", "arena"),
      e("🎡", "ferris wheel", "fair"),
      e("🎢", "roller coaster", "fair", "ride"),
      e("⛲", "fountain", "park"),
      e("🏖️", "beach", "holiday", "vacation", "sand"),
      e("🏝️", "desert island", "island", "holiday", "alone"),
      e("⛰️", "mountain", "peak", "climb"),
      e("🌋", "volcano", "eruption", "hot"),
      e("🏕️", "camping", "tent", "outdoors"),
      e("🏞️", "national park", "nature", "outdoors"),
      e("🌅", "sunrise", "dawn", "morning", "start"),
      e("🌇", "sunset", "dusk", "evening", "end"),
      e("🌃", "night city", "evening", "late"),
      e("🌆", "city dusk", "skyline", "city"),
      e("🏙️", "cityscape", "skyline", "city", "urban"),
      e("🌉", "bridge", "night", "crossing"),
      e("🏠", "house", "home"),
      e("🏡", "house with garden", "home"),
      e("🏢", "office", "building", "work", "company"),
      e("🏭", "factory", "industry", "plant"),
      e("🏥", "hospital", "health"),
      e("🏦", "bank", "money"),
      e("🏫", "school", "education"),
      e("🏨", "hotel", "stay", "travel"),
      e("⛺", "tent", "camp"),
      e("🚦", "traffic light", "signal", "wait"),
      e("🅿️", "parking", "park"),
      e("🛂", "passport control", "border", "immigration"),
      e("🧳", "luggage", "suitcase", "travel", "packing"),
      e("🎫", "ticket", "admission", "entry"),
      e("🛎️", "bell hop", "service", "reception"),
    ],
  },
  {
    name: "Activity",
    entries: [
      e("⚽", "football", "soccer", "ball", "sport"),
      e("🏀", "basketball", "ball", "sport"),
      e("🏈", "american football", "ball", "sport"),
      e("⚾", "baseball", "ball", "sport"),
      e("🎾", "tennis", "ball", "sport"),
      e("🏐", "volleyball", "ball", "sport"),
      e("🏉", "rugby", "ball", "sport"),
      e("🎱", "pool", "8 ball", "billiards", "snooker"),
      e("🏓", "table tennis", "ping pong", "sport"),
      e("🏸", "badminton", "sport"),
      e("🥅", "goal", "net", "sport", "score"),
      e("⛳", "golf", "hole", "sport"),
      e("🏹", "bow and arrow", "archery", "aim", "target"),
      e("🎣", "fishing", "angling", "catch"),
      e("🥊", "boxing", "fight", "glove"),
      e("🥋", "martial arts", "judo", "karate"),
      e("⛸️", "ice skate", "skating", "winter"),
      e("🎿", "ski", "skiing", "winter", "snow"),
      e("🛹", "skateboard", "skating"),
      e("🏂", "snowboard", "winter", "snow"),
      e("🏋️", "lifting", "gym", "weights", "strong", "workout"),
      e("🤸", "cartwheel", "gymnastics", "flexible"),
      e("🏊", "swimming", "swim", "pool"),
      e("🚴", "cycling", "bike", "ride"),
      e("🏃", "running", "run", "fast", "go"),
      e("🚶", "walking", "walk", "slow"),
      e("🧘", "meditation", "calm", "zen", "yoga", "breathe"),
      e("🧗", "climbing", "climb", "hard"),
      e("🏆", "trophy", "win", "won", "champion", "prize"),
      e("🥈", "silver medal", "second", "runner up"),
      e("🥉", "bronze medal", "third"),
      e("🎖️", "medal", "honour", "honor", "award"),
      e("🎽", "running shirt", "race", "marathon"),
      e("🎮", "game controller", "gaming", "play", "video game"),
      e("🕹️", "joystick", "arcade", "game"),
      e("🎲", "dice", "random", "chance", "luck", "roll"),
      e("♟️", "chess pawn", "chess", "strategy", "move"),
      e("🃏", "joker", "wildcard", "card"),
      e("🎰", "slot machine", "gamble", "luck"),
      e("🎳", "bowling", "strike"),
      e("🎪", "circus", "tent", "show"),
      e("🎭", "theatre", "theater", "drama", "masks", "acting"),
      e("🎤", "microphone", "mic", "sing", "speak", "podcast"),
      e("🎧", "headphones", "listen", "music", "focus"),
      e("🎵", "note", "music", "song"),
      e("🎶", "notes", "music", "song", "tune"),
      e("🎸", "guitar", "music", "rock"),
      e("🎹", "piano", "keyboard", "music"),
      e("🥁", "drum", "drums", "music", "beat"),
      e("🎺", "trumpet", "music", "brass", "fanfare"),
      e("🎻", "violin", "music", "strings"),
      e("🪕", "banjo", "music"),
      e("🎟️", "admission ticket", "event", "entry"),
    ],
  },
  {
    name: "Symbols",
    entries: [
      e("⚛️", "atom", "science", "physics", "react"),
      e("♾️", "infinity", "endless", "loop", "forever"),
      e("🔱", "trident", "emblem"),
      e("⚜️", "fleur de lis", "emblem"),
      e("🔰", "beginner", "new", "learner", "novice"),
      e("⭕", "circle", "o", "correct", "hollow"),
      e("🚫", "prohibited", "no", "forbidden", "banned", "denied"),
      e("⛔", "no entry", "stop", "blocked", "forbidden"),
      e("📛", "name badge", "name", "identity"),
      e("🔞", "eighteen", "adult", "restricted"),
      e("✔️", "tick", "check", "done", "yes"),
      e("☑️", "ballot check", "checked", "done", "tick"),
      e("✖️", "multiply", "times", "cross", "no"),
      e("➕", "plus", "add", "more", "new"),
      e("➖", "minus", "subtract", "less", "remove"),
      e("➗", "divide", "division"),
      e("🟰", "equals", "same", "equal"),
      e("〰️", "wavy dash", "squiggle", "approx"),
      e("‼️", "double exclamation", "urgent", "very important"),
      e("⁉️", "interrobang", "what", "surprise", "confused"),
      e("🔠", "letters", "uppercase", "abc", "text"),
      e("🔢", "numbers", "digits", "1234", "count"),
      e("🔣", "symbols", "special characters"),
      e("🅰️", "a button", "blood a", "letter a"),
      e("🆎", "ab button", "blood ab"),
      e("🆑", "cl button", "clear"),
      e("🆒", "cool button", "cool", "nice"),
      e("🆓", "free button", "free", "no cost"),
      e("🆖", "ng button", "no good", "bad"),
      e("🆙", "up button", "level up", "upgrade", "improve"),
      e("🆚", "versus", "vs", "against", "compare"),
      e("🔟", "ten", "10"),
      e("⏹️", "stop", "halt", "end"),
      e("⏺️", "record", "recording", "capture"),
      e("⏮️", "previous track", "back", "rewind"),
      e("⏩", "fast forward", "faster", "speed up"),
      e("⏪", "rewind", "back", "slower"),
      e("🔂", "repeat one", "loop once", "again"),
      e("🔃", "cycle", "refresh", "sync", "reload"),
      e("🔄", "refresh", "sync", "reload", "update", "again"),
      e("🔼", "up", "increase", "raise"),
      e("🔽", "down", "decrease", "lower"),
      e("⬆️", "arrow up", "up", "north", "increase"),
      e("⬇️", "arrow down", "down", "south", "decrease"),
      e("⬅️", "arrow left", "left", "west", "back"),
      e("➡️", "arrow right", "right", "east", "forward", "next"),
      e("↩️", "return", "back", "undo", "reply"),
      e("↪️", "forward", "redo", "onward"),
      e("🔙", "back", "previous", "return"),
      e("🔚", "end", "finish", "over"),
      e("🔛", "on", "active", "enabled"),
      e("🔜", "soon", "upcoming", "later", "next"),
      e("🔝", "top", "best", "highest", "above"),
      e("🟥", "red square", "block", "bad"),
      e("🟩", "green square", "block", "ok", "pass"),
      e("🟦", "blue square", "block", "info"),
      e("🟨", "yellow square", "block", "warn"),
      e("⬛", "black square", "filled", "dark"),
      e("⬜", "white square", "empty", "light"),
      e("🔶", "orange diamond", "shape"),
      e("🔷", "blue diamond", "shape"),
    ],
  },
  {
    name: "Flags",
    entries: [
      e("🏴󠁧󠁢󠁥󠁮󠁧󠁿", "England", "english", "st george"),
      e("🏴󠁧󠁢󠁳󠁣󠁴󠁿", "Scotland", "scottish", "saltire"),
      e("🏴󠁧󠁢󠁷󠁬󠁳󠁿", "Wales", "welsh", "dragon"),
      e("🏳️‍🌈", "pride flag", "rainbow", "lgbt", "pride"),
      e("🏴‍☠️", "pirate flag", "jolly roger", "pirate"),
      e("🚩", "triangular flag", "flagged", "marker", "attention"),
      e("🏳️", "white flag", "surrender", "give up"),
      e("🏴", "black flag", "flag"),
      e("🇬🇧", "United Kingdom", "uk", "gb", "britain", "british", "england", "union jack"),
      e("🇺🇸", "United States", "usa", "us", "america", "american"),
      e("🇨🇦", "Canada", "canadian", "ca"),
      e("🇲🇽", "Mexico", "mexican", "mx"),
      e("🇧🇷", "Brazil", "brazilian", "br"),
      e("🇦🇷", "Argentina", "argentinian", "ar"),
      e("🇨🇱", "Chile", "chilean", "cl"),
      e("🇨🇴", "Colombia", "colombian", "co"),
      e("🇵🇪", "Peru", "peruvian", "pe"),
      e("🇺🇾", "Uruguay", "uy"),
      e("🇻🇪", "Venezuela", "ve"),
      e("🇮🇪", "Ireland", "irish", "ie", "eire"),
      e("🇫🇷", "France", "french", "fr"),
      e("🇩🇪", "Germany", "german", "de", "deutschland"),
      e("🇪🇸", "Spain", "spanish", "es", "espana"),
      e("🇵🇹", "Portugal", "portuguese", "pt"),
      e("🇮🇹", "Italy", "italian", "it"),
      e("🇳🇱", "Netherlands", "dutch", "holland", "nl"),
      e("🇧🇪", "Belgium", "belgian", "be"),
      e("🇨🇭", "Switzerland", "swiss", "ch"),
      e("🇦🇹", "Austria", "austrian", "at"),
      e("🇸🇪", "Sweden", "swedish", "se"),
      e("🇳🇴", "Norway", "norwegian", "no"),
      e("🇩🇰", "Denmark", "danish", "dk"),
      e("🇫🇮", "Finland", "finnish", "fi"),
      e("🇮🇸", "Iceland", "icelandic", "is"),
      e("🇵🇱", "Poland", "polish", "pl"),
      e("🇨🇿", "Czechia", "czech", "cz"),
      e("🇸🇰", "Slovakia", "slovak", "sk"),
      e("🇭🇺", "Hungary", "hungarian", "hu"),
      e("🇷🇴", "Romania", "romanian", "ro"),
      e("🇧🇬", "Bulgaria", "bulgarian", "bg"),
      e("🇬🇷", "Greece", "greek", "gr"),
      e("🇭🇷", "Croatia", "croatian", "hr"),
      e("🇷🇸", "Serbia", "serbian", "rs"),
      e("🇸🇮", "Slovenia", "slovenian", "si"),
      e("🇺🇦", "Ukraine", "ukrainian", "ua"),
      e("🇪🇪", "Estonia", "estonian", "ee"),
      e("🇱🇻", "Latvia", "latvian", "lv"),
      e("🇱🇹", "Lithuania", "lithuanian", "lt"),
      e("🇹🇷", "Turkey", "turkish", "tr", "turkiye"),
      e("🇷🇺", "Russia", "russian", "ru"),
      e("🇮🇱", "Israel", "israeli", "il"),
      e("🇦🇪", "United Arab Emirates", "uae", "dubai", "abu dhabi"),
      e("🇸🇦", "Saudi Arabia", "saudi", "sa"),
      e("🇶🇦", "Qatar", "qa"),
      e("🇪🇬", "Egypt", "egyptian", "eg"),
      e("🇿🇦", "South Africa", "south african", "za"),
      e("🇳🇬", "Nigeria", "nigerian", "ng"),
      e("🇰🇪", "Kenya", "kenyan", "ke"),
      e("🇬🇭", "Ghana", "ghanaian", "gh"),
      e("🇲🇦", "Morocco", "moroccan", "ma"),
      e("🇪🇹", "Ethiopia", "ethiopian", "et"),
      e("🇮🇳", "India", "indian", "in"),
      e("🇵🇰", "Pakistan", "pakistani", "pk"),
      e("🇧🇩", "Bangladesh", "bd"),
      e("🇱🇰", "Sri Lanka", "lk"),
      e("🇳🇵", "Nepal", "np"),
      e("🇨🇳", "China", "chinese", "cn"),
      e("🇯🇵", "Japan", "japanese", "jp", "nippon"),
      e("🇰🇷", "South Korea", "korea", "korean", "kr"),
      e("🇹🇼", "Taiwan", "taiwanese", "tw"),
      e("🇭🇰", "Hong Kong", "hk"),
      e("🇸🇬", "Singapore", "singaporean", "sg"),
      e("🇲🇾", "Malaysia", "malaysian", "my"),
      e("🇹🇭", "Thailand", "thai", "th"),
      e("🇻🇳", "Vietnam", "vietnamese", "vn"),
      e("🇵🇭", "Philippines", "filipino", "ph"),
      e("🇮🇩", "Indonesia", "indonesian", "id"),
      e("🇦🇺", "Australia", "australian", "au", "aussie"),
      e("🇳🇿", "New Zealand", "kiwi", "nz", "aotearoa"),
      e("🇫🇯", "Fiji", "fj"),
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

/** Words split out of a name or a keyword — the unit search matches against.
 *  Lowercased, because a name is allowed to be a proper noun: every curated
 *  name was lowercase until the flags arrived, and "United Kingdom" silently
 *  matched nothing at all when the query "united" was compared against a
 *  capital U. */
function wordsOf(entry: EmojiEntry): string[] {
  return [entry.name, ...entry.keywords]
    .flatMap((text) => text.split(/[\s-]+/))
    .map((word) => word.toLowerCase());
}

/**
 * Emoji whose name or keywords have a word STARTING with each term typed.
 *
 * Prefix-per-word rather than substring, and the difference is the difference
 * between a search that works and one that looks broken: "ok" as a substring
 * hits "broken", "bookmark" and "looking" before it reaches 🆗. Every term
 * must match (AND), so "green heart" narrows instead of widening.
 *
 * Ranked by how exactly the match landed. A word matched WHOLE beats a word
 * merely started, and the name beats a keyword: "star" puts ⭐ above 🤩,
 * "fire" puts 🔥 first, "uk" puts 🇬🇧 above 🇺🇦 — which it did not when a
 * name prefix outranked every keyword, because Ukraine begins with the two
 * letters somebody meant as a whole word. Ties keep the curated order, which
 * is deliberate: it is the order somebody chose.
 */
export function searchEmoji(query: string, limit = 48): EmojiEntry[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const scored: { entry: EmojiEntry; score: number; at: number }[] = [];
  ALL_EMOJI.forEach((entry, at) => {
    let score = 0;
    for (const term of terms) {
      const words = wordsOf(entry);
      const name = entry.name.toLowerCase();
      const nameWords = name.split(/[\s-]+/);
      const hit = words.some((word) => word.startsWith(term));
      if (!hit) return;
      // EXACTNESS OUTRANKS PREFIX-NESS, and the flags are why. "uk" is a
      // whole word somebody deliberately hung on 🇬🇧; it is also the first
      // two letters of Ukraine. Ranking every prefix above every keyword put
      // 🇺🇦 first for "uk" and the castle above the flag for "japan" — both
      // near-misses beating the thing that was named exactly.
      if (name === term) score += 8;
      else if (words.includes(term)) score += 5;
      else if (name.startsWith(term)) score += 4;
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
