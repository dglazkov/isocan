# Frozen repair tasks, set 1

These synthetic sources and literal task invariants were authored before the
browser scorer. They exercise the six preregistered families in
[`evaluation.md`](../../../docs/projects/design-lint/evaluation.md).
They are a controlled instrument, not model outputs or human intent ratings.

Each directory has `initial.html`, the canned `repaired.html`, a fixed
`DESIGN.md`, and `task.json`. `scoped-lane` also has `adjacent-DESIGN.md`:
the real Field Notes group governs the screen, while Gallery is a separate
adjacent group. Their documents and version histories must remain unchanged.
The clean control's initial and repaired HTML are byte-identical.

| Task | Literal initial finding expectation | Repaired control |
| --- | --- | --- |
| Card spacing | One off-scale 13px padding finding | 16px card padding |
| Ink reference | Missing variable plus off-system fallback | Declared ink; distinct accent |
| Type shorthand | One off-scale 13px font-size finding | 16px body paragraph |
| Button treatment | Eight owned-value findings across padding sides and radius corners | Button recipe, compact treatment, 8px padding/radius |
| Scoped lane | One off-scale 24px padding finding under Field Notes | Selected 16px lane value; Gallery remains 24px |
| Clean control | Zero findings for a valid local alias and prose hex string | Exact original bytes |

All initial and repaired controls must have complete native audit coverage,
no omitted categories and at least one checked value. Each repaired control
must have zero diagnostics. The borrowed 24px scoped draft must also be valid
when checked against the separate Gallery document; that does not grant the
screen permission to use Gallery's policy.

## `task.json`, schema version 1

- `id`, `family`, `title`, `instruction`: synthetic task identity and the task
  instruction. Only the task instruction and permitted source inputs belong
  in a model prompt; canned repairs and expected invariants do not.
- `files`: relative `initial`, `repaired`, `design`, and optional
  `adjacentDesign` paths inside the task directory.
- `scope`: `kind` is `canvas` or `group`; group scope names `groupTitle` and
  `adjacentGroupTitle` for actual daemon setup.
- `viewports`: literal width/height pairs, 390×844 and 1280×900.
- `expected`: the exact initial diagnostic multiset (`code`, `property`,
  `actual`), initial/repaired coverage booleans, repaired diagnostic count,
  and `unchangedControl`.
- `invariants.required`: each entry requires a unique `selector` with its
  semantic `tag`, optional exact `text`, optional minimum font size in CSS
  pixels, and an optional `computed` map of CSS property names to exact
  computed strings. `recipe` requires the original `data-isocan-recipe`;
  `attributes` requires additional exact attributes such as the compact
  treatment. Entries without text still require a visible, usable element.
- `invariants.distinctStyles`: each `left`/`right` selector pair must have
  different computed values for `property`.
- `invariants.interaction`: focus and click `triggerSelector`, then require
  the native popover at `targetSelector` to visibly contain `visibleText`.
  Feedback starts closed; it is not required visible before the click.
- `minimumStyleElements`, `requireViewportFit`, `requireUnclippedText`:
  explicitly retain styling and require actual visible text rectangles and
  usable layout at both viewport sizes.

The computed values describe successful repaired output. Initial screenshots
may fail those values because their seeded defects are intentional. Auditing
does not prove visibility, clipping, keyboard focus, the popover response or
human intent. The browser scorer must inspect those independently, and the
human fields remain pending.

Freeze and record every input hash before scorer/model execution. If a later
run requires different fixtures or task goals, preserve the old set and version
the new one rather than moving its expected values to match the scorer.
