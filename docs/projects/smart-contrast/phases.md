---
status: designed
since: 2026-10-19
see: living-grounds
note: "the walk: the one-line selected-name fix, the tone function and the guard, the ground-ink tier switched by one attribute with a crossfade, the plate and sampled pictures, both surfaces, and a person's eyes on every ground."
---

# Smart contrast — the walk

**19 October 2026.** Held to [journey.md](journey.md) and [design.md](design.md).

**Where we are, 19 Oct 2026: phases 0–2 are CLOSED. The ink on the canvas follows the ground: names, kind icons, text notes, captions and the selection ring take a ground tier switched by `data-ground-tone`, crossfading, while cards and the dot grid are unchanged. Phase 3, the plate for Desert and sampled pictures, is next.**

Rules for every phase, on top of `AGENTS.md`:

- **Measured, not judged.** Every claim that ink reads is a ratio from
  `core/src/contrast.ts`, against the colour the ground is actually drawn in.
- **Cards do not move.** A phase that changes the ink inside a card, a paper,
  a glass surface or an identity colour has left this project's scope.
- **The dot grid is unchanged.** A canvas with no ground renders byte-for-byte
  as before in both app themes; a screenshot diff says so.
- **Synthetic fixtures.** Grounds by id, pictures generated in the test
  (flat white, flat black, half and half); never a real canvas's names.

## Phase 0 — The selected name reads

**Status: CLOSED** (19 Oct 2026) — `.item.selected .item-titlebar` wears `--accent-text`; headless Chrome read #1f3fd0 in light (7.56, unchanged) and #8fa8ff in dark (8.41), and `groundaccent.test.ts` fails on the old line.

`.item.selected .item-titlebar { color: var(--accent) }` becomes
`var(--accent-text)` in `styles.css`. In light the two tokens are the same
value, so nothing moves; in dark the selected name goes from 3.32 to 8.41 on
the dot grid and from 3.51 to 8.88 on Galaxy. Dion's screenshot, fixed, before
any of the machinery exists.

**Proof:** a test that no selector sets `color: var(--accent)` on text that
stands on the ground (the seed of phase 1's inventory guard); computed colour
of a selected titlebar read in headless Chrome in both app themes; `npm run
test:deep`.

**Trajectory**

- **2026-10-19** — The bug was already known and ratcheted: `accent.test.ts` listed `.item.selected .item-titlebar` in `KNOWN_UNREADABLE_IN_DARK`. It let it through because that guard forgives a rule that sets a chip under its text, and a name on the canvas has none, so the new guard asks where the text stands, not what else the rule sets.

## Phase 1 — The tone, and the guard

**Status: CLOSED** (19 Oct 2026) — `core/src/groundtone.ts` decides dark for nine grounds and the brightest picture, light for Snow and Zen, and mid for Desert only. `GROUND_MEAN` is held equal to both stylesheet blocks, the 24-entry inventory is written down, and the entry chunk is unchanged (743,979 bytes).

- `core/src/groundtone.ts`: `GroundTone`, `GROUND_MEAN`, `toneOfColour`,
  `groundColour`, `toneOfGround` (design §1), exported from core.
- `web/src/lib/groundtone.ts`'s `groundTone` renamed `groundToken`.
- The inventory: every rule in `styles.css` and component CSS whose ink sits
  on the ground, by design §2's rule, written down as a list the guard reads.
- `web/test/groundcontrast.test.ts` (design §6), with the proposed ground-ink
  values as constants. It is expected to fail on some named text-colour dark
  shades against Ocean and the brightest picture; this phase lifts them.
- The two decisions at the end of design.md are taken (19 Oct, by the
  conductor). This phase builds `toneOfGround`'s `mid` list with Desert in it
  and records the reason in the guard.

**Proof:** `toneOfGround` returns `dark` for the nine dark grounds and the
brightest picture, `light` for Snow and Zen, `mid` for Desert, and the app's
own tone for the dot grid; the guard is green; `GROUND_MEAN` matches the
stylesheet.

**Trajectory**

- **2026-10-19** — The canvas title is not ground-standing chrome. It sits on the glass of `.bar-cluster.floats`, so design §2's rule keeps it on app tokens, and design §2 now says so.
- **2026-10-19** — The per-token check cannot fail on its own: the tone is decided by the same `GROUND_INK`, so a weak token flips its ground to `mid` instead. The tone table and the mid list are what bite until phase 2 holds the CSS tier equal to `GROUND_INK`.

## Phase 2 — The ink follows the ground

**Status: CLOSED** (19 Oct 2026) — `scripts/journey-smart-contrast.mjs` passes 15 checks in headless Chrome: every ratio at its floor on Galaxy, Ocean, Snow and Zen in both themes, cards unchanged, the Snow → Night crossfade mid-way at 80ms and instant under reduced motion, and the dot grid identical to HEAD.

- The five-token tier, defaulting to the app's tokens on `.canvas-page` and
  re-declared under `[data-ground-tone="dark"|"light"]` (design §2).
- `CanvasPage` stamps `data-ground-tone` from `toneOfGround`.
- Every inventory selector moved onto the tier; the guard's inventory check
  turned on.
- `@property` registration and the 200ms crossfade, off under reduced motion
  (design §5).
- Named text colours on chromeless nodes resolve by ground tone.

**Proof:** in headless Chrome, a selected and an unselected titlebar, a text
note and its speaker-note caption, read off computed style on Galaxy, Ocean,
Snow, Zen and the dot grid, in both app themes — every ratio at its floor,
cards' computed colours identical to before. Switching Snow → Night with the
menu crossfades, and a reduced-motion run does not. Screenshots in the report.

**Trajectory**

- **2026-10-19** — No named text colour reaches 4.5:1 on Zen, Ocean or a bright picture (paper shades ~3.3 on Zen), and lifting one far enough renames it (red goes pink). So named shades are held at 3:1, WCAG's large-text floor, on every ground, and at 4.5 on the dot grid as before.
- **2026-10-19** — Brown is excused on Ocean (2.39) and the brightest picture (2.10). A brown that reaches 3:1 there is ochre (#cb8f00 was tried), which `spokenColour` would not call brown. Red is lifted in the ground tier only (`GROUND_TEXT_SHADES`, #f2727c), so the dot grid's shades are untouched.
- **2026-10-19** — The attribute takes no app theme. A ground of its own has the same tone in both themes, and the dot grid gets no attribute, so the page need not subscribe to the theme. Subscribing broke a jsdom test that has no `matchMedia`.

## Phase 3 — The plate, and pictures

**Status: NOT STARTED**

- The `mid` plate on ground chrome (design §3), and whatever phase 1 decided
  for text nodes on Desert.
- Picture sampling on decode, cached by sha256, worst case until then
  (design §4).
- Identity-coloured text on the ground (a remote cursor's name) on a plate.

**Proof:** Desert's names on a plate in both themes, measured against the
plate; three generated pictures (flat white, flat black, half and half) all
resolve `dark` under the 0.7 scrim and the sampled hex is within 2% of the
pixel mean; a test with the scrim set to 0.2 resolves the white picture
`light` — the "take a look" path proved without changing what ships.

## Phase 4 — Both surfaces

**Status: NOT STARTED**

- `isocan canvas background` says the tone; `canvas show --json` carries
  `groundTone`.
- `textColourWarnings` measures a hex against the canvas's ground colour.
- One sentence in `agent-guide.md`'s backgrounds topic; one line in the README.

**Proof:** `surface.test.ts` and `agent-guide.test.ts` green; `isocan text
"Acme" --color '#333333'` on a Night canvas warns with Night's ratio and on a
Snow canvas does not. The guide's `--color` paragraph ("a shade chosen for the
light ground, the dark ground and paper … for a collaborator in either theme")
is rewritten to say the shade follows the canvas's ground.

## Phase 5 — Eyes

**Status: NOT STARTED**

`docs/verify/<date>-smart-contrast.md`: a person opens every ground in both
app themes, selects a card, writes a note, switches grounds mid-session with a
second person watching, and says whether anything reads as wrong — including
the things a ratio cannot see, like the lifted accent no longer feeling like
the accent (design.md's second decision) and the halo on Desert (its first).

**Proof:** the walk's page, answered.

## Later, on evidence only

Sampling the ground *under each name* rather than the ground's mean — for a
photograph with a bright band, or Aurora's ribbons lighting a corner — waits
for a measured failure on a real ground. It is not a phase until then.
