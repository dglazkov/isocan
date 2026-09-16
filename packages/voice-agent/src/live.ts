/**
 * **The Live API's provider face, browser-safe** — the one spelling of the
 * model setup, the tool surface and the call planner.
 *
 * This used to live inside `voice-harness.ts`, beside the node-only session
 * plumbing, which was fine while the harness was the only speaker. The web
 * module `@isocan/voice` opens the same provider socket from a browser and
 * must send the SAME setup, declare the SAME tools and map tool calls to the
 * SAME operations — a second spelling would be the house bug (one string,
 * two spellings) wearing a module hat.
 *
 * Everything here is pure data and pure functions: no node imports, no
 * daemon, no fetch. The harness re-exports it all so its existing callers
 * and tests do not move.
 */
import {
  BROWSER_MIME,
  DRAWING_MIME,
  DRAWING_PROPERTIES,
  drawingSvg,
  inkBounds,
  normalizeSiteUrl,
  siteLabel,
  type InkStroke,
} from "@isocan/core";

import type { ListedItem } from "@isocan/api";

/* ---- VOICE_RULES ---- */
/**
 * **The rules, in one place, because they are now editable.**
 *
 * They used to be a string literal inside `liveSetup`, which was fine while
 * nobody could see them and wrong the moment somebody could change them: an
 * inspector showing a copy of the rules is an inspector showing something the
 * model may not have been told. One constant, read by the setup builder and
 * written by the page through `/prompt`, is the only way the text on screen
 * and the text in the session can be the same text.
 */
export const VOICE_RULES =
  "You are Voice, an enrolled agent on an isocan canvas, talking out loud with the collaborator who owns it. " +
  "Keep replies concise (1-2 sentences): you are a real-time voice in the room, not a report. " +
  "MANDATORY: When the collaborator asks to create, modify, rename, delete, move, comment on, or react to anything on the canvas, " +
  "YOU MUST IMMEDIATELY CALL THE CORRESPONDING TOOL. NEVER reply in speech that you will do it, or that you did it, without calling the tool first.\n" +
  "Tool mapping rules:\n" +
  "- 'delete <item>' or 'remove <item>' -> call delete_item\n" +
  "- 'comment on <item> ...' or 'add comment ...' -> call comment_on_item\n" +
  "- 'react to <item> ...' or 'add reaction ...' or 'thumbs up on <item>' -> call item_react\n" +
  "- 'move <item> ...' -> call move_item\n" +
  "- 'rename <item> to <title>' or 'update <item> description to <desc>' -> update_item\n" +
  "- 'draw ...' or 'sketch ...' -> call drawing_add\n" +
  "The tools are the canvas's own operations, they are instant, and every one of them is undoable. " +
  "You have full read access to canvas items, versions, presence, and threads to understand project state. " +
  "If a request needs heavy asynchronous work (generating large codebases, design critiques), say you are " +
  "putting it in the Chat and use `say`. " +
  "If you cannot tell which item they mean, use `read_canvas` first or ask.";

/* ---- voiceInstruction ---- */
/**
 * **The text a live session is actually given, built in one place.**
 *
 * Two things call this: the session start, and the inspector. The inspector
 * exists to show what the model is told, so it cannot be allowed a second
 * opinion about what that is — if these ever disagree, the panel is lying.
 */
export function voiceInstruction(
  rules: string,
  instructions?: { source: string; text: string } | null,
): string {
  const block = instructions
    ? `\n\n=== PROJECT INSTRUCTIONS (${instructions.source}) ===\n${instructions.text}\n=== END PROJECT INSTRUCTIONS ===\n`
    : "";
  return rules + block;
}

/* ---- PlannedOp ---- */
export interface PlannedOp {
  /** The operation, as `@isocan/api` sends it. */
  op: { type: string; [key: string]: unknown };
  /** What to say afterwards, in the person's words. */
  said: string;
}

/* ---- LIVE_MODEL ---- */
/**
 * **Gemini's Live API, not transcribe-then-act** (Paul, 11 Sep 2026: *"it
 * should just be sending to the Gemini live api (or whatever the latest
 * is)"*). A stateful bidirectional WebSocket — `BidiGenerateContent` — where
 * audio goes up as 16 kHz PCM and comes back as 24 kHz PCM plus text, and
 * where the model can call the canvas's operations as tools.
 *
 * The custody rule does not change with the protocol: **the harness opens the
 * socket and holds the key; the page only ever sends audio to loopback.** The
 * page capture is already 16 kHz PCM, so nothing here resamples — the page
 * knows its own `AudioContext.sampleRate`, which is the side that has to.
 *
 * Function calling is synchronous: a tool call blocks the conversation until
 * it is answered, which is the right shape for canvas operations — they are
 * one local round trip — and the wrong shape for making a screen. Slow asks
 * belong in the Chat, as the research note says; the tool list here is the
 * fast set.
 *
 * `gemini-3.8-live` verified current on 15 Sep 2026 against Google's Live
 * API docs; the docs call `gemini-3.1-flash-live-preview` a legacy preview
 * and recommend 3.8 Live. A preview name moves; `--model` and
 * `LiveSessionOptions.model` exist so a person can move with it without a
 * release.
 */
export const LIVE_MODEL = "models/gemini-3.8-live";

/* ---- liveUrl ---- */
export function liveUrl(key: string, host = "generativelanguage.googleapis.com"): string {
  return (
    `wss://${host}/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent` +
    `?key=${encodeURIComponent(key)}`
  );
}

/* ---- LIVE_TOOLS ---- */
/** The tool surface: the canvas's operation vocabulary and read tools,
 * declared so the model calls them directly and decides what to do. */
export const LIVE_TOOLS = [
  // --- Canvas & Project Mutation Operations (Derived from @isocan/core Operation types) ---
  {
    name: "add_item",
    description:
      "Add something to the canvas. A note: title + text. A live web page: pass url (e.g. 'add a web page', " +
      "'put localhost:3000 on the canvas', 'show me example.com'). A page is an ordinary item whose content is a " +
      "text/uri-list, so it renders as a live site.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING", description: "The title of the new item." },
        text: { type: "STRING", description: "The note's markdown or text content." },
        url: { type: "STRING", description: "A web address to add as a live page (http(s) or host:port)." },
        kind: { type: "STRING", description: "What kind of item: 'note' (default) or 'site'." },
        x: { type: "NUMBER", description: "Optional x position on canvas." },
        y: { type: "NUMBER", description: "Optional y position on canvas." },
      },
      required: [],
    },
  },
  {
    name: "rename_item",
    description: "Rename something on the canvas. Use the item's current title, prefix, or ordinal phrase.",
    parameters: {
      type: "OBJECT",
      properties: {
        item_ref: { type: "STRING", description: "The item's title, a prefix of it, or an ordinal phrase." },
        title: { type: "STRING", description: "The new title." },
      },
      required: ["item_ref", "title"],
    },
  },
  {
    name: "update_item",
    description: "Update an item's title or description on the canvas.",
    parameters: {
      type: "OBJECT",
      properties: {
        item_ref: { type: "STRING", description: "The item's title, prefix, or id." },
        title: { type: "STRING", description: "Optional new title." },
        description: { type: "STRING", description: "Optional new description." },
      },
      required: ["item_ref"],
    },
  },
  {
    name: "delete_item",
    description: "Delete or remove an item from the canvas (e.g. 'delete the Greeting', 'remove that card'). Sends item to trash.",
    parameters: {
      type: "OBJECT",
      properties: { item_ref: { type: "STRING", description: "The item title, prefix, or id to delete." } },
      required: ["item_ref"],
    },
  },
  {
    name: "restore_item",
    description: "Restore an item from the trash back to the canvas.",
    parameters: {
      type: "OBJECT",
      properties: { item_ref: { type: "STRING", description: "The item to restore." } },
      required: ["item_ref"],
    },
  },
  {
    name: "move_item",
    description: "Move an item across the canvas (e.g. 'move Checkout screen right 50', 'move the note up 100'). Supports by_x/by_y or to_x/to_y.",
    parameters: {
      type: "OBJECT",
      properties: {
        item_ref: { type: "STRING", description: "Item title, prefix, or id." },
        by_x: { type: "NUMBER", description: "Relative horizontal shift in pixels." },
        by_y: { type: "NUMBER", description: "Relative vertical shift in pixels." },
        to_x: { type: "NUMBER", description: "Absolute target x coordinate." },
        to_y: { type: "NUMBER", description: "Absolute target y coordinate." },
      },
      required: ["item_ref"],
    },
  },
  {
    name: "resize_item",
    description: "Resize an item on the canvas to width and height.",
    parameters: {
      type: "OBJECT",
      properties: {
        item_ref: { type: "STRING" },
        width: { type: "NUMBER", description: "Width in pixels." },
        height: { type: "NUMBER", description: "Height in pixels." },
      },
      required: ["item_ref", "width", "height"],
    },
  },
  {
    name: "say",
    description: "Say something in the canvas Chat, where every parked agent hears it.",
    parameters: { type: "OBJECT", properties: { text: { type: "STRING" } }, required: ["text"] },
  },
  {
    name: "ask",
    description: "Ask the person a question on the canvas, pinned to the Chat.",
    parameters: { type: "OBJECT", properties: { text: { type: "STRING" } }, required: ["text"] },
  },
  {
    name: "comment_on_item",
    description: "Add a comment or note to an existing canvas item (e.g. 'comment on Checkout that we need a button', 'add comment to Greeting').",
    parameters: {
      type: "OBJECT",
      properties: { item_ref: { type: "STRING", description: "The item title, prefix, or id to comment on." }, text: { type: "STRING", description: "The comment text." } },
      required: ["item_ref", "text"],
    },
  },
  {
    name: "item_add_version",
    description:
      "Add a NEW version of content to an existing item — a checkpoint the person can switch back to. Use for " +
      "'add a version', 'save this as another version', 'attach this text to X'.",
    parameters: {
      type: "OBJECT",
      properties: {
        item_ref: { type: "STRING", description: "The item title, prefix, or id." },
        content: { type: "STRING", description: "The new version's full text/markdown." },
        filename: { type: "STRING", description: "Optional filename for the version." },
        mime: { type: "STRING", description: "Optional MIME type (default text/markdown)." },
      },
      required: ["item_ref", "content"],
    },
  },
  {
    name: "thread_create",
    description:
      "Start a new conversation thread — anchored to an item (item_ref) or at a canvas point (x, y). Use for " +
      "'start a thread about X', 'open a discussion here', 'make a note on X'. For a comment on an item, comment_on_item is the same act.",
    parameters: {
      type: "OBJECT",
      properties: {
        body: { type: "STRING", description: "The first comment in the thread." },
        item_ref: { type: "STRING", description: "Item to anchor the thread to." },
        x: { type: "NUMBER", description: "Canvas x if not anchored to an item." },
        y: { type: "NUMBER", description: "Canvas y if not anchored to an item." },
        main: { type: "BOOLEAN", description: "Make this the canvas's main Chat thread (only when none exists)." },
      },
      required: ["body"],
    },
  },
  {
    name: "thread_set_anchor",
    description: "Move a thread's pin: anchor it to an item, or to a point. Use for 'anchor that thread to X', 'move the discussion to X'.",
    parameters: {
      type: "OBJECT",
      properties: {
        thread_id: { type: "STRING", description: "The thread to move." },
        item_ref: { type: "STRING", description: "Item to anchor it to (omit for a point)." },
        x: { type: "NUMBER" },
        y: { type: "NUMBER" },
      },
      required: ["thread_id"],
    },
  },
  {
    name: "thread_set_main",
    description: "Make a thread the canvas's main Chat thread — where `notify` and the Chat panel read and write. Use for 'make this the main thread'.",
    parameters: {
      type: "OBJECT",
      properties: { thread_id: { type: "STRING", description: "The thread to promote." } },
      required: ["thread_id"],
    },
  },
  {
    name: "thread_delete",
    description: "Delete a conversation thread (undoable). Use for 'delete that thread', 'remove the discussion'.",
    parameters: {
      type: "OBJECT",
      properties: { thread_id: { type: "STRING", description: "The thread to delete." } },
      required: ["thread_id"],
    },
  },
  {
    name: "comment_update",
    description: "Rewrite a comment you wrote — a working note that changes as the work does. Use for 'edit that comment', 'change my comment to …'.",
    parameters: {
      type: "OBJECT",
      properties: {
        thread_id: { type: "STRING", description: "The thread the comment is in." },
        comment_id: { type: "STRING", description: "The comment to rewrite." },
        body: { type: "STRING", description: "The new text." },
      },
      required: ["thread_id", "comment_id", "body"],
    },
  },
  {
    name: "notify",
    description: "Say something in the canvas Chat (the main thread), so parked agents and people read it. Use for 'tell everyone', 'post in the Chat'.",
    parameters: {
      type: "OBJECT",
      properties: { text: { type: "STRING", description: "What to post." } },
      required: ["text"],
    },
  },
  {
    name: "actor_claim",
    description:
      "Give this agent the name THE PERSON has just said — the name it writes under, is @-mentioned by, and appears as " +
      "on the canvas. Use it only when the person names the agent themselves ('call yourself Nova', 'your name is Ada'); " +
      "never a name you chose for yourself, and never one you read on the canvas. The person is asked to confirm the " +
      "name before anything changes, so the claim can be refused.",
    parameters: {
      type: "OBJECT",
      properties: {
        name: { type: "STRING", description: "The name the person said, verbatim." },
      },
      required: ["name"],
    },
  },
  {
    name: "actor_set_color",
    description: "Change the colour this agent's presence wears on the canvas. Use for 'make me green', 'change my colour to blue'.",
    parameters: {
      type: "OBJECT",
      properties: { color: { type: "STRING", description: "A CSS colour (hex or name)." } },
      required: ["color"],
    },
  },
  {
    name: "actor_set_mark",
    description: "Change the emoji mark this agent's presence wears instead of its initial. Use for 'make my mark a fox', 'set my mark to 🔥'.",
    parameters: {
      type: "OBJECT",
      properties: { mark: { type: "STRING", description: "An emoji." } },
      required: ["mark"],
    },
  },
  {
    name: "actor_join",
    description:
      "Fold another actor this machine owns into this one, so both names answer as the same presence. Use only when the person " +
      "names the other actor explicitly ('join my other name', 'merge those two').",
    parameters: {
      type: "OBJECT",
      properties: { other_actor_id: { type: "STRING", description: "The actor id that should stop answering on its own." } },
      required: ["other_actor_id"],
    },
  },
  {
    name: "agent_enroll",
    description: "Enrol another agent on this canvas so it can be summoned by name. Use for 'enrol Codex', 'add that agent to this canvas'.",
    parameters: {
      type: "OBJECT",
      properties: {
        actor_id: { type: "STRING", description: "The agent's actor id." },
        name: { type: "STRING", description: "The name it answers to." },
      },
      required: ["actor_id", "name"],
    },
  },
  {
    name: "agent_withdraw",
    description: "Withdraw an enrolled agent from this canvas. Use for 'withdraw that agent', 'remove it from the canvas'.",
    parameters: {
      type: "OBJECT",
      properties: { actor_id: { type: "STRING", description: "The agent's actor id." } },
      required: ["actor_id"],
    },
  },
  {
    name: "drawing_add",
    description: "Draw ink or a sketch on the canvas using the pen tool (maps to item.add with kind=drawing and SVG strokes).",
    parameters: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING", description: "Title or label for the sketch (default 'Sketch')." },
        color: { type: "STRING", description: "Hex color (e.g. '#23262b' or '#ff0000')." },
        width: { type: "NUMBER", description: "Stroke width in pixels (default 3)." },
        points: {
          type: "ARRAY",
          description: "List of points {x, y} tracing the stroke.",
          items: {
            type: "OBJECT",
            properties: { x: { type: "NUMBER" }, y: { type: "NUMBER" } },
            required: ["x", "y"],
          },
        },
      },
      required: ["points"],
    },
  },
  {
    name: "item_react",
    description: "Add or remove an emoji mark/reaction on an item (e.g. 'thumbs up on Checkout', 'react with ❤️ on Greeting', 'vote dot').",
    parameters: {
      type: "OBJECT",
      properties: {
        item_ref: { type: "STRING", description: "The item to react to." },
        emoji: { type: "STRING", description: "The emoji mark (e.g. '👍', '❤️', '🔥', '⭐')." },
        on: { type: "BOOLEAN", description: "True to add the reaction, false to remove it (default true)." },
        at_x: { type: "NUMBER", description: "Optional x fraction (0..1) on the item for heat map." },
        at_y: { type: "NUMBER", description: "Optional y fraction (0..1) on the item for heat map." },
      },
      required: ["item_ref", "emoji"],
    },
  },
  {
    name: "find_items",
    description: "Search and find items on the canvas matching a query or keyword.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: { type: "STRING", description: "Search query string." },
      },
      required: ["query"],
    },
  },
  {
    name: "items_move",
    description: "Move multiple items together by a spatial delta (maps to core 'items.move').",
    parameters: {
      type: "OBJECT",
      properties: {
        item_refs: {
          type: "ARRAY",
          description: "List of item titles, prefixes, or ids to move.",
          items: { type: "STRING" },
        },
        by_x: { type: "NUMBER", description: "Horizontal delta to move by." },
        by_y: { type: "NUMBER", description: "Vertical delta to move by." },
      },
      required: ["item_refs", "by_x", "by_y"],
    },
  },
  {
    name: "items_delete",
    description: "Delete multiple items to the trash simultaneously (maps to core 'items.delete').",
    parameters: {
      type: "OBJECT",
      properties: {
        item_refs: {
          type: "ARRAY",
          description: "List of item titles, prefixes, or ids to delete.",
          items: { type: "STRING" },
        },
      },
      required: ["item_refs"],
    },
  },
  {
    name: "items_restore",
    description: "Restore multiple deleted items from the trash back to the canvas (maps to core 'items.restore').",
    parameters: {
      type: "OBJECT",
      properties: {
        item_refs: {
          type: "ARRAY",
          description: "List of item titles, prefixes, or ids to restore.",
          items: { type: "STRING" },
        },
      },
      required: ["item_refs"],
    },
  },
  {
    name: "item_set_current_version",
    description: "Switch an item's active visible version (convergence operation, maps to core 'item.setCurrentVersion').",
    parameters: {
      type: "OBJECT",
      properties: {
        item_ref: { type: "STRING", description: "Title, prefix, or id of the item." },
        version_ref: { type: "STRING", description: "Version id or ordinal like 'first' or 'last'." },
      },
      required: ["item_ref", "version_ref"],
    },
  },
  {
    name: "viewport_focus",
    description: "Center and zoom the collaborator's canvas view onto a specific item.",
    parameters: {
      type: "OBJECT",
      properties: {
        item_ref: { type: "STRING", description: "Item title or id to center on." },
      },
      required: ["item_ref"],
    },
  },
  {
    name: "viewport_pan",
    description: "Move the collaborator's camera to world coordinates and optional zoom level.",
    parameters: {
      type: "OBJECT",
      properties: {
        x: { type: "NUMBER", description: "Target world x coordinate." },
        y: { type: "NUMBER", description: "Target world y coordinate." },
        zoom: { type: "NUMBER", description: "Optional zoom level." },
      },
      required: ["x", "y"],
    },
  },
  {
    name: "selection_set",
    description: "Select one or more items on the canvas.",
    parameters: {
      type: "OBJECT",
      properties: {
        item_refs: {
          type: "ARRAY",
          description: "List of item titles, prefixes, or ids to select.",
          items: { type: "STRING" },
        },
      },
      required: ["item_refs"],
    },
  },
  {
    name: "selection_clear",
    description: "Clear active selection on the canvas.",
    parameters: { type: "OBJECT", properties: {} },
  },

  // --- Read & Inspection Tools (Answering Questions from Live Canvas State) ---
  {
    name: "project_switch",
    description:
      "Move this session to another canvas (project), without restarting — after this EVERY operation lands on the new " +
      "canvas, and the page says which one. Use for 'switch to Launch plan', 'work on the Winter canvas', 'open the other " +
      "project'. The new canvas's items are in the answer.",
    parameters: {
      type: "OBJECT",
      properties: {
        canvas_ref: { type: "STRING", description: "The canvas to move to: its title (or prefix), or its id." },
      },
      required: ["canvas_ref"],
    },
  },
  {
    name: "project_update",
    description:
      "Rename or re-describe a canvas (project). With no canvas_ref it is the canvas this session is working on; " +
      "give a title or id to change another one. Use for 'rename this canvas to Launch plan', 'call the project " +
      "Winter work', 'give it a description'.",
    parameters: {
      type: "OBJECT",
      properties: {
        canvas_ref: { type: "STRING", description: "A canvas title (or prefix) or id. Default: this session's canvas." },
        title: { type: "STRING", description: "The new title." },
        description: { type: "STRING", description: "The new one-line description." },
      },
      required: [],
    },
  },
  {
    name: "project_create",
    description:
      "Create a new canvas (project), with the title THE PERSON gave it. Use for 'make a new canvas called Launch plan', " +
      "'start a project for the redesign'. It is created, not entered: this session stays where it is until someone " +
      "switches to it.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING", description: "The canvas's title, in the person's words." },
        description: { type: "STRING", description: "Optional one-line description." },
      },
      required: ["title"],
    },
  },
  {
    name: "project_list",
    description:
      "List the canvases (projects) this home has, each with its id, and mark the one this session is working on. " +
      "Use for 'what projects are there', 'list my canvases', 'where am I'.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "read_canvas",
    description: "Inspect the canvas: list all active items, their titles, kinds, positions, and current versions.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "read_item",
    description: "Read the full text content and metadata of a specific item on the canvas.",
    parameters: {
      type: "OBJECT",
      properties: { item_ref: { type: "STRING", description: "The item's title, prefix, or id." } },
      required: ["item_ref"],
    },
  },
  {
    name: "read_threads",
    description: "Read discussion threads and comments on the canvas or on a specific item.",
    parameters: {
      type: "OBJECT",
      properties: { item_ref: { type: "STRING", description: "Optional item title or id." } },
    },
  },
  {
    name: "read_presence",
    description: "Check who is currently live on this canvas and which agents are enrolled.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "remember",
    description:
      "Store a durable note for future sessions — a fact the person asked you to remember, a decision, " +
      "a preference. It is written to the harness's own file beside its key and survives restarts. " +
      "Retrieval is case-insensitive SUBSTRING search over the text and tags (see search_memory), so " +
      "write the words you would later search for. Every memory is visible to, and deletable by, the person.",
    parameters: {
      type: "OBJECT",
      properties: {
        text: { type: "STRING", description: "The memory itself, as a sentence." },
        tags: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "Optional tags to search by later (up to 8).",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "list_dir",
    description:
      "List files and folders inside the folder the person granted to this harness through the page. " +
      "The path is relative to that folder (omit it, or use \".\", for the root); nothing outside the " +
      "grant can be listed or read. Fails with an explanation when no page is connected, or no folder " +
      "has been granted yet.",
    parameters: {
      type: "OBJECT",
      properties: {
        path: { type: "STRING", description: "Relative path inside the granted folder; omit for the root." },
      },
    },
  },
  {
    name: "read_file",
    description:
      "Read one text file from the folder the person granted, by its path relative to that folder's root. " +
      "The answer names the file it came from (folder/path) — say which file a fact came from when you use it. " +
      "Large files come back truncated with a flag rather than silently shortened.",
    parameters: {
      type: "OBJECT",
      properties: { path: { type: "STRING", description: "Relative path of the file inside the granted folder." } },
      required: ["path"],
    },
  },
  {
    name: "read_memory",
    description: "Read one stored memory in full by its id (ids come from remember and search_memory).",
    parameters: {
      type: "OBJECT",
      properties: { id: { type: "STRING", description: "The memory id, e.g. mem_…" } },
      required: ["id"],
    },
  },
  {
    name: "search_memory",
    description:
      "Find stored memories by case-insensitive SUBSTRING match over their text and tags — NOT semantic " +
      "recall: a synonym you did not write will not be found. An empty query lists everything stored, " +
      "newest last.",
    parameters: {
      type: "OBJECT",
      properties: { query: { type: "STRING", description: "Words to match; empty for everything." } },
    },
  },
];

/* ---- liveSetup ---- */
/** What the setup message is: the whole contract with the API in one object. */
export function liveSetup(
  model: string = LIVE_MODEL,
  instructions?: { source: string; text: string } | null,
  rules: string = VOICE_RULES,
): object {
  /**
   * The extended-thinking model needs its thinking depth named at setup
   * (its docs: `thinking_config`, levels low/medium/high, no minimal), and
   * the plain 3.8 Live refuses a thinkingLevel outright — so the field is
   * model-shaped, never sent generally. The level is fixed at "low"; it
   * becomes a flag when a person asks to trade latency for reasoning depth.
   */
  const thinkingConfig = model.includes("extended-thinking")
    ? { thinkingConfig: { thinkingLevel: "low" } }
    : {};
  return {
    setup: {
      model,
      generationConfig: {
        responseModalities: ["AUDIO"],
        ...thinkingConfig,
      },
      systemInstruction: {
        parts: [{ text: voiceInstruction(rules, instructions) }],
      },
      tools: [{ functionDeclarations: LIVE_TOOLS }],
    },
  };
}

/* ---- planForCall ---- */
/** A tool call, as a plan: the same vocabulary the typed grammar produces, so
 * a spoken `move` and a typed one are one implementation. */
export function planForCall(name: string, args: Record<string, unknown>): { plans: PlannedOp[]; what?: string } {
  const ref = typeof args.item_ref === "string" ? args.item_ref : "";
  const text = typeof args.text === "string" ? args.text : "";
  switch (name) {
    case "add_item": {
      const rawUrl = typeof args.url === "string" ? args.url.trim() : "";
      if (rawUrl !== "" || args.kind === "site") {
        if (rawUrl === "") {
          return { plans: [], what: "adding a site needs a url — say the address to project" };
        }
        let site: string;
        try {
          site = normalizeSiteUrl(rawUrl);
        } catch (err) {
          return { plans: [], what: `that is not a web address — ${(err as Error).message}` };
        }
        const title = String(args.title ?? siteLabel(site));
        return {
          plans: [
            {
              op: {
                type: "item.add",
                title,
                text: `${site}\n`,
                mime: BROWSER_MIME,
                x: args.x !== undefined ? Number(args.x) : undefined,
                y: args.y !== undefined ? Number(args.y) : undefined,
              },
              said: `add "${title}" as a web page`,
            },
          ],
        };
      }
      const title = String(args.title ?? "New note");
      /* **A title with no body still makes a note.** "Add a note called
         Banana" is how a person says it, and the model answers it with
         `{title: "Banana"}` and no text. An empty body is not a note the
         daemon accepts — an empty blob is refused with `empty blob body` — so
         the title becomes the body, which is what the note would say anyway.
         Found by driving the path: the model got the tool call right and the
         canvas answered with a refusal. */
      const text = String(args.text ?? "").trim() || title;
      return {
        plans: [
          {
            op: {
              type: "item.add",
              title,
              text,
              x: args.x !== undefined ? Number(args.x) : undefined,
              y: args.y !== undefined ? Number(args.y) : undefined,
            },
            said: `add "${title}"`,
          },
        ],
      };
    }
    case "update_item":
    case "rename_item": {
      const hasTitle = args.title !== undefined && args.title !== null;
      const hasDesc = args.description !== undefined && args.description !== null;
      let label: string;
      if (hasTitle && hasDesc) {
        label = `renamed "${ref}" to "${args.title}" and updated description`;
      } else if (hasTitle) {
        label = `renamed "${ref}" to "${args.title}"`;
      } else if (hasDesc) {
        label = `description updated on "${ref}"`;
      } else {
        label = `updated "${ref}"`;
      }
      return {
        plans: [
          {
            op: {
              type: "item.update",
              ref,
              title: hasTitle ? String(args.title) : undefined,
              description: hasDesc ? String(args.description) : undefined,
            },
            said: label,
          },
        ],
      };
    }
    case "delete_item":
      return { plans: [{ op: { type: "item.delete", ref }, said: `deleted ${ref}` }] };
    case "restore_item":
      return { plans: [{ op: { type: "item.restore", ref }, said: `restored ${ref}` }] };
    case "resize_item":
      return {
        plans: [
          {
            op: {
              type: "item.resize",
              ref,
              width: Number(args.width ?? 320),
              height: Number(args.height ?? 240),
            },
            said: `resized ${ref}`,
          },
        ],
      };
    case "move_item": {
      const by = args.by_x !== undefined || args.by_y !== undefined;
      return {
        plans: [
          {
            op: {
              type: "item.move",
              ref,
              by,
              x: by ? Number(args.by_x ?? 0) : Number(args.to_x ?? 0),
              y: by ? Number(args.by_y ?? 0) : Number(args.to_y ?? 0),
            },
            said: `moved ${ref}`,
          },
        ],
      };
    }
    case "say":
      return { plans: [{ op: { type: "thread.reply", body: text }, said: `said: ${text}` }] };
    case "ask":
      return { plans: [{ op: { type: "thread.reply", body: `? ${text}` }, said: `asked: ${text}` }] };
    case "comment_on_item":
      return { plans: [{ op: { type: "thread.create", ref, body: text }, said: `commented on ${ref}` }] };
    case "item_add_version": {
      const itemRef = typeof args.item_ref === "string" ? args.item_ref : "";
      return {
        plans: [
          {
            op: {
              type: "item.addVersion",
              ref: itemRef,
              body: String(args.content ?? args.text ?? ""),
              ...(args.filename !== undefined ? { filename: String(args.filename) } : {}),
              ...(args.mime !== undefined ? { mime: String(args.mime) } : {}),
            },
            said: `add a version to ${itemRef}`,
          },
        ],
      };
    }
    case "thread_create": {
      const itemRef = typeof args.item_ref === "string" && args.item_ref !== "" ? args.item_ref : undefined;
      const body = String(args.body ?? args.text ?? "");
      return {
        plans: [
          {
            op: {
              type: "thread.create",
              ...(itemRef !== undefined ? { ref: itemRef } : {}),
              body,
              ...(args.x !== undefined ? { x: Number(args.x) } : {}),
              ...(args.y !== undefined ? { y: Number(args.y) } : {}),
              ...(args.main === true ? { main: true } : {}),
            },
            said: itemRef ? `start a thread on ${itemRef}` : "start a thread",
          },
        ],
      };
    }
    case "thread_set_anchor":
      return {
        plans: [
          {
            op: {
              type: "thread.setAnchor",
              threadId: String(args.thread_id ?? ""),
              ...(typeof args.item_ref === "string" && args.item_ref !== "" ? { ref: args.item_ref } : {}),
              ...(args.x !== undefined ? { x: Number(args.x) } : {}),
              ...(args.y !== undefined ? { y: Number(args.y) } : {}),
            },
            said: `move thread ${args.thread_id}`,
          },
        ],
      };
    case "thread_set_main":
      return { plans: [{ op: { type: "thread.setMain", threadId: String(args.thread_id ?? "") }, said: `make ${args.thread_id} the main thread` }] };
    case "thread_delete":
      return { plans: [{ op: { type: "thread.delete", threadId: String(args.thread_id ?? "") }, said: `delete thread ${args.thread_id}` }] };
    case "comment_update":
      return {
        plans: [
          {
            op: {
              type: "comment.update",
              threadId: String(args.thread_id ?? ""),
              commentId: String(args.comment_id ?? ""),
              body: String(args.body ?? args.text ?? ""),
            },
            said: `edit comment ${args.comment_id}`,
          },
        ],
      };
    case "notify":
      return { plans: [{ op: { type: "thread.reply", body: text, notify: true }, said: "post in the Chat" }] };
    case "actor_set_color":
      return { plans: [{ op: { type: "actor.setColor", color: String(args.color ?? "") }, said: `change my colour to ${args.color}` }] };
    case "actor_set_mark":
      return { plans: [{ op: { type: "actor.setMark", mark: String(args.mark ?? "") }, said: `make my mark ${args.mark}` }] };
    case "actor_join":
      return { plans: [{ op: { type: "actor.join", from: String(args.other_actor_id ?? "") }, said: `join ${args.other_actor_id}` }] };
    case "agent_enroll":
      return {
        plans: [
          {
            op: { type: "agent.enroll", actorId: String(args.actor_id ?? ""), agentName: String(args.name ?? "") },
            said: `enrol ${args.name}`,
          },
        ],
      };
    case "agent_withdraw":
      return { plans: [{ op: { type: "agent.withdraw", actorId: String(args.actor_id ?? "") }, said: `withdraw ${args.actor_id}` }] };
    case "drawing_add": {
      const color = String(args.color ?? "#23262b");
      const strokeWidth = Number(args.width ?? 3);
      const rawPoints = (args.points as Array<{ x: number; y: number }>) ?? [{ x: 100, y: 100 }, { x: 200, y: 200 }];
      const strokes: InkStroke[] = [{ color, width: strokeWidth, points: rawPoints }];
      const box = inkBounds(strokes) ?? { minX: 100, minY: 100, maxX: 300, maxY: 300 };
      const svg = drawingSvg(strokes, box);
      const width = Math.max(80, box.maxX - box.minX + 16);
      const height = Math.max(80, box.maxY - box.minY + 16);
      return {
        plans: [
          {
            op: {
              type: "item.add",
              title: String(args.title ?? "Sketch"),
              content: svg,
              mime: DRAWING_MIME,
              properties: DRAWING_PROPERTIES,
              width,
              height,
              x: box.minX - 8,
              y: box.minY - 8,
            },
            said: `drew “${args.title ?? "Sketch"}” with the pen tool`,
          },
        ],
      };
    }
    case "item_react":
      return {
        plans: [
          {
            op: {
              type: "item.react",
              ref,
              emoji: String(args.emoji ?? "👍"),
              on: args.on !== false,
              ...(args.at_x !== undefined && args.at_y !== undefined ? { at: { x: Number(args.at_x), y: Number(args.at_y) } } : {}),
            },
            said: `${args.on === false ? "removed" : "added"} reaction ${args.emoji ?? "👍"} on ${ref}`,
          },
        ],
      };
    case "items_move": {
      const refs = (args.item_refs as string[]) ?? [];
      const byX = Number(args.by_x ?? 0);
      const byY = Number(args.by_y ?? 0);
      return {
        plans: refs.map((r) => ({
          op: { type: "item.move", ref: r, by: true, x: byX, y: byY },
          said: `moved ${r} by ${byX}, ${byY}`,
        })),
      };
    }
    case "items_delete": {
      const refs = (args.item_refs as string[]) ?? [];
      return {
        plans: refs.map((r) => ({
          op: { type: "item.delete", ref: r },
          said: `deleted ${r}`,
        })),
      };
    }
    case "items_restore": {
      const refs = (args.item_refs as string[]) ?? [];
      return {
        plans: refs.map((r) => ({
          op: { type: "item.restore", ref: r },
          said: `restored ${r}`,
        })),
      };
    }
    case "item_set_current_version": {
      const vRef = String(args.version_ref ?? "");
      return {
        plans: [
          {
            op: { type: "item.setCurrentVersion", ref, versionRef: vRef },
            said: `switched version of ${ref} to ${vRef}`,
          },
        ],
      };
    }
    case "viewport_focus":
    case "viewport_pan":
    case "selection_set":
    case "selection_clear":
      return { plans: [], what: `__${name}__` };
    case "find_items":
      return { plans: [], what: "__find_items__" };
    case "read_canvas":
      return { plans: [], what: "__read_canvas__" };
    case "read_item":
      return { plans: [], what: "__read_item__" };
    case "read_threads":
      return { plans: [], what: "__read_threads__" };
    case "read_presence":
      return { plans: [], what: "__read_presence__" };
    default:
      return { plans: [], what: `the model called ${name}, which this harness does not have` };
  }
}

/* ---- describeMintedOp ---- */
/**
 * **What was minted, in words — never what it turned out to do.**
 *
 * Paul's log showed an `update_item` that changed a description logged as
 * "renamed": the label had been written by the tool's author rather than read
 * off the operation, and the operation is the only thing that knows. These
 * are action phrases because the outcome is not known yet — the daemon's
 * answer is what says the change landed, and it replaces this wording rather
 * than sitting behind it.
 */
export function describeMintedOp(op: { type: string; [key: string]: unknown }, targetName?: string): string {
  const ref = targetName || (op.ref as string) || (op.itemId as string) || "item";
  switch (op.type) {
    case "item.add":
      return op.mime === BROWSER_MIME
        ? `add "${op.title ?? "Note"}" as a web page`
        : `add "${op.title ?? "Note"}"`;
    case "item.update": {
      const hasTitle = op.title !== undefined && op.title !== null;
      const hasDesc = op.description !== undefined && op.description !== null;
      if (hasTitle && hasDesc) return `update "${ref}": new title "${op.title}", new description`;
      if (hasTitle) return `update "${ref}": new title "${op.title}"`;
      if (hasDesc) return `update "${ref}": new description`;
      return `update "${ref}"`;
    }
    case "item.delete":
      return `delete "${ref}"`;
    case "item.restore":
      return `restore "${ref}"`;
    case "item.move":
      return `move "${ref}" to ${op.x}, ${op.y}`;
    case "item.resize":
      return `resize "${ref}" to ${op.width}x${op.height}`;
    case "item.setCurrentVersion":
      return `switch "${ref}" to version ${op.versionId ?? op.versionRef}`;
    case "item.react":
      return `${op.on === false ? "remove" : "add"} reaction ${op.emoji ?? ""} on "${ref}"`;
    case "thread.create":
      return `start a thread on "${ref}"`;
    case "item.addVersion":
      return `add a version to "${ref}"`;
    case "thread.reply":
      return op.notify === true ? "post in the Chat" : `reply in thread ${op.threadId ?? ""}`;
    case "thread.setAnchor":
      return `move thread ${op.threadId} to "${ref}"`;
    case "thread.setMain":
      return `make thread ${op.threadId} the main thread`;
    case "thread.delete":
      return `delete thread ${op.threadId}`;
    case "comment.update":
      return `edit comment ${op.commentId}`;
    case "actor.setColor":
      return `change my colour to ${op.color}`;
    case "actor.setMark":
      return `make my mark ${op.mark}`;
    case "actor.join":
      return `join ${op.from} into this actor`;
    case "agent.enroll":
      return `enrol ${op.agentName}`;
    case "agent.withdraw":
      return `withdraw ${op.actorId}`;
    case "drawing.add":
      return `draw "${op.title ?? "Drawing"}" with the pen tool`;
    case "trash.empty":
      return `empty the canvas trash`;
    default:
      return `${op.type} on "${ref}"`;
  }
}

