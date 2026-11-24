/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * **Things that are on because you turned them on** (9 Sep 2026).
 *
 * > "have a 'Settings' section for experiments and have 'Stickers' as a
 * > boolean that people can turn on and then we can merge all of this"
 *
 * The mechanism that lets unfinished work reach `main` without reaching
 * everybody. A module behind an experiment ships in the bundle, is off, and
 * costs a person who never turns it on nothing but the bytes — which is the
 * trade that makes merging an exploration honest rather than a decision to
 * support it forever.
 *
 * ## It is the same mechanism the API needs, which is why it is worth having
 *
 * VS Code's answer to "move fast without breaking extensions" is two API
 * surfaces: a stable one that is append-only and has essentially never broken
 * since 1.0, and **proposed** APIs that change without notice, must be named
 * in the extension's manifest, only run when the user has explicitly enabled
 * them, and cannot be published to the marketplace at all. Fast on one side,
 * frozen on the other, and the boundary is a list a person opts into.
 *
 * This is that list. A module using a slot we are still shaping — overlays,
 * drops, the host — is an experiment for the same reason a proposed API is:
 * not because it is buggy, but because **we intend to change it**, and
 * somebody should have said yes to that before it is on their screen.
 *
 * ## Per person, not per canvas
 *
 * An experiment is this browser's, like `hiddenChrome` and unlike a theme: it
 * changes what YOU see, not what the canvas IS. A sticker somebody made with
 * the experiment on is an ordinary item with a mime, and it stays on the
 * canvas for everybody — readable by anyone whose build knows the kind, and a
 * file with a legible mime to anyone whose does not. That is #156's removal
 * story, and it is what makes an experiment safe to turn off again.
 *
 * ## Only Settings reads this list
 *
 * So it is only in Settings' lazy chunk, sentences and all. Whether one is on
 * is the ui store's `experiments` — read where it is needed (`modules.ts`,
 * `CanvasPage`) without pulling this file into a first visit.
 */
interface Experiment {
  id: string;
  /** What it is called where a person reads it. */
  name: string;
  /** One sentence: what turning it on gets you, and what is unfinished. */
  what: string;
  /** Shown only while this other experiment is on: a refinement meaningless without it. */
  under?: string;
  /**
   * Offered only where the home's text model looks at pictures
   * (`TEXT_PICTURES_ROUTE`); elsewhere the row says why, and stays off.
   */
  needsPictures?: true;
  /**
   * Ticked along with the experiment it is `under`, the moment that one is
   * ticked — a refinement that is the default once you asked for its parent,
   * and stays a switch you can untick (exact phase 2: Live frames).
   */
  withParent?: true;
}

/** Every experiment this build offers, in the order Settings lists them. */
export const EXPERIMENTS: readonly Experiment[] = [
  {
    id: "modules.stickers",
    name: "Stickers",
    what: "A tray of emoji you drag onto the canvas — the first module built on the overlay, drop and host APIs, which are still changing.",
  },
  {
    id: "modules.talk",
    name: "Voice",
    what: "A mic in the Chat composer that flips it into a live conversation, and a floating one for when the Chat is closed — a Gemini Live session from this browser with your own key. The composer and dialogs slots are proposed, undo is not carried here, and the tool wiring covers the fast set.",
  },
  {
    id: "design.partner",
    name: "Design partner",
    what: "Start a design task from any message, and publish design questions into a thread. Off while its shape settles: today it puts a control under EVERY comment and one at the foot of every thread, which is a lot of surface for something a reader cannot yet explain.",
  },
  {
    id: "inbox",
    name: "Inbox",
    what: "Everything addressed to you, across every canvas at this home. Off while its shape settles: what a row shows, what the count counts, and what a whole-home read costs on a busy home are all still moving.",
  },
  {
    id: "modules.anatomy",
    name: "Anatomy",
    what: "Explore a codebase as a map of concepts, files and evidence on the canvas. The workspace slot and its four lenses are still taking shape.",
  },
  {
    id: "critique",
    name: "Critique",
    what: "Critics on the canvas: a critic card shows its name, credit line, colour and three questions. Asking one to critique a screen, and the web's doors to add and write critics, are not built yet — `isocan critic` adds them today.",
  },
  {
    id: "moodboard",
    name: "Mood board",
    what: "Explore how a thing should feel with generated pictures, drawn with your Gemini key. Keep favourites into a Mood board, drop the rest from the candidate tray, branch with More like this or Push dials, and drop in reference photos.",
  },
  {
    id: "motion",
    name: "Motion",
    what: "Make SVGs move: `isocan motion new` turns selected SVGs into a motion item that plays on the canvas, from one clock that a movie will be rendered from too. The web's own doors — Animate…, the scrubber, Render movie… — are not built yet.",
  },
  {
    id: "exact",
    name: "Exact",
    what: "Exact apps on the canvas: `isocan exact open <app>` lays an Exact app out as a flow map of captured screens, and `isocan exact live` keeps it true as you save — with live frames, Alt-click to the line, and compile errors as comments. Other hosts, proposals and shipping are not built yet.",
  },
  {
    id: "exact.local",
    name: "Live frames",
    what: "Exact screens can run your app's dev page live, through a bridge on this machine you pair with once. Off, this browser opens no connection to your machine at all: every screen is a capture refreshed on each save, and Alt-click still points at its line from the capture.",
    under: "exact",
    withParent: true,
  },
  {
    id: "modules.describe",
    name: "Describe for agents",
    what: "Generate caption-first `agentDescription` text on images, videos, documents, and screens using your Gemini key so agents can reason about visual items.",
  },
  {
    id: "modules.video",
    name: "Video generation",
    what: "Generate video clips as home-polled async jobs from the palette or CLI — closing the tab never stops a running generation, and finished MP4s land as new versions.",
  },
  {
    id: "modules.audio",
    name: "Audio, music & speech",
    what: "Audio clip cards with inline playback, Lyria 3 music generation, Gemini TTS speech synthesis, and audio transcription into canvas context.",
  },
  {
    id: "modules.model3d",
    name: "3D models (GLB 2.0)",
    what: "Self-contained GLB 2.0 3D model items with binary containment validation, a lightweight orbit viewer card, and camera pose capture.",
  },
  {
    id: "modules.workbench",
    name: "Workbench (Agent Sessions)",
    what: "Run and steer local agent and terminal sessions (Antigravity, Gemini CLI, Claude Code, PTY) on the canvas with live dev-server preview and OpenNode emit.",
  },
  {
    id: "modules.memory",
    name: "Memory as items",
    what: "Canvas reflections, private personal observations, pointer cards that hydrate only for their owner, and cross-canvas memory search.",
  },
  {
    id: "modules.image",
    name: "Single image generation & edit",
    what: "Generate a single image or stack an edited version onto a selected image item using your Gemini key, with idempotent retries.",
  },
  {
    id: "modules.research",
    name: "Grounded research jobs",
    what: "Run home-polled grounded research queries that land cited Markdown reports with source links on the canvas.",
  },
  {
    id: "modules.media-edit",
    name: "Media editing (FFmpeg)",
    what: "Trim, stitch, mux, and extract still frames from video and audio items locally on the home with full provenance.",
  },
  {
    id: "modules.design-system",
    name: "Design system & mockups",
    what: "Generate structured design system sticker sheets with DESIGN.md, run fresh-context design critiques, and explore 2–4 direction mockups.",
  },
  {
    id: "modules.workspace",
    name: "Workspace (Docs, Sheets, Slides)",
    what: "Import Google Docs, Sheets, and Slides onto the canvas and re-sync them into new item versions with source provenance.",
  },
  {
    id: "modules.clipper",
    name: "Browser clipper",
    what: "Capture web pages, text selections, HTML snapshots, and images onto the canvas via CLI, MCP, or the Chrome MV3 extension.",
  },
  {
    id: "modules.prototype",
    name: "HTML prototype tiers",
    what: "Generate self-contained sandboxed HTML prototypes across quick and standard tiers, or delegate app-tier builds to a workbench session.",
  },
  {
    id: "presentation.transitions",
    name: "Presentation Transitions",
    what: "Choose how full screen moves between slides — Push, Fade, Zoom, Depth, Cube, Flip, Morph or None — from the bar and the drawer. Off while the motions settle: a deck of screens does not push smoothly yet. Off, a deck of screens dissolves and a deck of pictures pushes, as it always has.",
  },
  {
    id: "semantic.zoom",
    name: "Semantic Zoom",
    what: "Far away, a long note, a group or an area shows a short model-written summary instead of words too small to read, marked ≈.",
  },
  {
    id: "semantic.zoom.vision",
    name: "Semantic Zoom: look at pictures",
    what: "Screens and pictures — alone, or in a group or an area — are summarised from what they show, not only their titles. One costs about ten text summaries, so a canvas makes at most 15 an hour.",
    under: "semantic.zoom",
    needsPictures: true,
  },
];


