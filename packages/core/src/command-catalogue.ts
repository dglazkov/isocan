import type { CommandMetadata } from "./commands.ts";

/** The built-in menu and dispatch metadata, available synchronously without loading agent instructions. */
export const DEFAULT_COMMAND_CATALOGUE = [
  {
    name: "help",
    description: "Keyboard shortcuts, and what else you can ask for",
    usage: "",
    source: "built-in",
    // Answered where it is typed: the app knows its own keyboard.
    local: true,
  },
  {
    name: "accessibility-audit",
    description: "Audit selected screens against WCAG — from the real HTML, not a picture",
    usage: "[what to focus on]",
    source: "built-in",
  },
  {
    name: "app-store-assets",
    description: "Icon, three marketing screenshots, and the ASO metadata",
    usage: "[what to emphasise]",
    source: "built-in",
  },
  {
    name: "web-assets",
    description: "Favicon, Apple touch icon, and a manifest.json",
    usage: "[what to emphasise]",
    source: "built-in",
  },
  {
    name: "marketing-kit",
    description: "Social card, banner, email header, and the copy to go with them",
    usage: "[the angle to take]",
    source: "built-in",
  },
  {
    name: "design-audit",
    description: "Review a screen's craft and copy against the design system, then offer to fix it",
    usage: "[what to look at]",
    source: "built-in",
  },
  {
    name: "design-system",
    description: "Write down what this canvas has decided things look like — a DESIGN.md",
    usage: "[what to change]",
    source: "built-in",
  },
  {
    name: "skill",
    description: "Find a published skill, or add one to this canvas",
    usage: "find <what you want> | add <owner/repo/path>",
    source: "built-in",
  },
  {
    name: "cancel",
    description: "Call off what was asked here — stop, say where you got to",
    usage: "[why, or what to do instead]",
    source: "built-in",
  },
  {
    name: "tidy",
    aka: ["format"],
    description: "Tidy the canvas — grid (default), smart, or your own instructions",
    usage: "[grid|smart|note]",
    source: "built-in",
  },
  {
    name: "variation",
    description: "Make N variations of a screen, each explored differently",
    usage: "[n=3] <how they should differ>",
    source: "built-in",
  },
  {
    name: "grill-me",
    description: "A relentless interview that ends in a spec, not a vibe",
    usage: "[what you want to build]",
    source: "built-in",
  },
  {
    name: "sprint",
    description: "Run a design sprint here — you facilitate, people and agents sketch, one person decides",
    usage: "[what we are designing] | <phase> [8m] [note]",
    source: "built-in",
  },
] as const satisfies readonly CommandMetadata[];
