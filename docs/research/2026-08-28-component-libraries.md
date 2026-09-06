---
status: partial
since: 2026-08-30
issue: 143
note: `design import` built 29 Aug; motion-as-CSS and the no-house-look rule are not
---
# Component libraries, and what survives the trip to a canvas

**28 August 2026**

The question: *can we wire these up to give agents the smarts to do great
design out of the box?* — seven links, handed over together:
`ui.shadcn.com`, `elements.ai-sdk.dev`, `beui.dev`, `rareui.com`,
`beautifului.dev`, `transitions.dev`, `glasscn-components.vercel.app`.

The short version: **six of the seven ship React components, and an isocan
screen has nowhere to put them.** One ships CSS and is usable today. And the
part of all seven that does transfer is the part nobody thinks of as the
product — the tokens.

## What was measured

Each fetched today. Where a page did not state something, this says so rather
than inferring it.

| | What it ships | Stack | Licence |
| --- | --- | --- | --- |
| **ui.shadcn.com** | Components you copy into your project; "a foundation for design systems" rather than a library | React, Tailwind, Radix | "Open Source. Open Code"; terms not stated on the page |
| **beui.dev** | 111+ animated components, installed through shadcn's registry | React 19, Next.js, Tailwind 4, Framer Motion | MIT |
| **rareui.com** | 14+ animated components, one file each, installed by the shadcn CLI | React (+ Tailwind, implied by the shadcn model) | "free, open-source"; specific terms on GitHub |
| **elements.ai-sdk.dev** | AI-interface components (the attachments page: grid/inline/list variants, media detection, hover previews) | React, Next.js (`"use client"`, `app/page.tsx`), Tailwind implied | Not stated on the page |
| **beautifului.dev** | 20+ AI-native primitives — streaming text, approval cards, task rows, diff tables | Not stated | MIT |
| **transitions.dev** | Copy-paste UI transitions, **CSS or React**, and an agent skill | CSS, or React | Free tier + **paid Pro** |
| **glasscn-components** | **Could not verify** — the fetch failed with a certificate error | — | — |

Two things stand out beyond the table. shadcn's **registry has become the
distribution mechanism** for the others: beui and rareui are both installed by
the shadcn CLI, so "adopting shadcn" is closer to adopting a package manager
than a look. And transitions.dev already ships **an agent-facing skill**,
which is the only one of the seven built with the assumption that a model, not
a person, is doing the pasting.

## The fact that decides it

An isocan screen is a single self-contained HTML file. Inline `<style>`, CSS
custom properties, occasionally a Google Fonts link, and no build step — this
is the top of a real one from a real canvas:

```html
<!doctype html><html lang="en"><head>…
<style>
:root{--ink:#222;--mute:#6a6a6a;--line:#e8e8e8;--accent:#e0565b;--r:16px}
body{font:15px/1.55 "Plus Jakarta Sans",system-ui,sans-serif;…}
```

No npm. No React. No Tailwind runtime. A screen is a blob an iframe renders,
which is what lets it be versioned, diffed, saved to a file and opened by
anything.

So "wire up shadcn" does not typecheck against the artifact. There is no
`package.json` to add a dependency to and no bundler to resolve an import. A
React component library is not *hard* to use here; there is nowhere to put it.

## What actually transfers

**Tokens — and this is the real answer.** shadcn's theming is CSS custom
properties, and `DESIGN.md` already models exactly those categories: colors,
typography, rounded, spacing, components. A theme from any of these is a
mechanical conversion into a canvas's design system, and from there it reaches
every screen an agent builds, because the guide already says to read the
design system first. The 24 August research (`design-systems-and-tokens.md`)
already picked at the interop question from the other end.

**CSS-only patterns.** transitions.dev's CSS path pastes into a `<style>`
block unchanged. It is the one item on the list usable today with no
translation, and its Pro tier is the reason that has to be a licence check
rather than a copy.

**Recipes, as prose.** What belongs in an empty state, when motion helps, how
a card is composed. That is knowledge, and it transfers as writing — into the
design system's prose sections, or into the guide's list of the moves
machine-made design reaches for.

**The components themselves do not transfer**, and they are the bulk of what
these seven are.

## Two risks, and a ceiling

**A component library is a house style.** If every canvas is built from one,
every canvas looks like it — which is the exact failure the agent guide
already fights, where it names the purple-to-blue hero and one radius for
every object. A design system exists so a canvas can look like *itself*.
Importing a theme should be a choice somebody makes per canvas, never a
default look this product ships.

**Licences are not a footnote.** MIT where stated, but transitions.dev has a
paid tier, and an agent pasting Pro CSS into somebody's canvas hands them a
licence problem they did not choose. If any of this is automated, the free/paid
line has to be encoded, not remembered.

**And the ceiling is worth being straight about.** This codebase already
argues, in `designsystem.ts`, that the fix "is not better adjectives in a
prompt ('clean, modern' describes nothing); it is a written-down system with
NUMBERS in it" — and says of the design audit that clearing it "makes a screen
unembarrassing, not good". A component library raises the floor. It does not
produce great design, and it cannot, because what makes a screen good is being
specific about *this* product, which is exactly what a library cannot know.

Raising the floor is worth doing. It is just not what "great design out of the
box" means.

## What to build

1. **`isocan design import <source>`** — **BUILT 29 Aug 2026.** Take a theme (a
   shadcn theme, a `:root` block of custom properties, W3C DTCG tokens) and
   land it as this canvas's DESIGN.md.

   Two things the survey did not surface, both found by importing a real
   shadcn theme: it keeps its dark palette in `.dark` rather than `:root`, so
   reading only the first block takes half a theme and says nothing; and its
   colours are BARE HSL TRIPLETS — `222.2 47.4% 11.2%` — which are colours
   only because the stylesheet wraps them somewhere the importer never sees.
   A value-only classifier loses the entire palette of the most popular theme
   format there is.

   What it cannot place is named rather than dropped. `--duration-fast: 150ms`
   has no home in a design system yet, and the person should hear that now
   rather than wonder later. This is the one change that makes all seven of these
   sites useful, and it converges with work landed the same day: components in
   a design system are now drawn as real components, so an imported theme
   arrives as something you can look at rather than a table of hexes.
2. **Motion as CSS in the design system.** Harvest the free transitions into
   the prose and component sections, licence-checked, so an agent reaches for
   the canvas's own motion rather than inventing an ease curve per screen.
3. **No default house look.** Import stays a per-canvas choice.

What is deliberately not proposed: a build step, a component runtime, or
anything that stops a screen being one file that opens anywhere.
