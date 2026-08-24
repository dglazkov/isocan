# Design systems an agent writes, tokens a machine can read

**24 August 2026**

The question: *what is the state of the art in agent-authored design systems and
design tokens?* — and three sub-questions carried in deliberately, because
isocan already ships in this space and the point was to find out whether what
it ships is any good: **who else renders a token file as a living document**,
**what is happening with W3C DTCG tokens in 2026**, and **is there anything
here to adopt or interoperate with**.

The short version: isocan is further ahead on this than the survey expected and
also more broken than it looks. Nobody else renders DESIGN.md — not Google,
whose format it is, and not the 110k-star library of DESIGN.md files, which
ships no viewer at all. But `isocan design --tokens` promises "W3C design
tokens — Figma, Style Dictionary, Tailwind" in its own `--help`, and what it
emits does not conform to the spec it names. That was measured against the
official JSON Schema and against Google's own reference exporter, on a corpus of
74 real files, and the whole fix lives in one file and costs zero operations.

## Standing findings, re-checked

- **[Agents on the canvas](2026-08-23-agents-on-the-canvas.md) (23 Aug)** — one
  day old, so nothing has aged. Three of its claims get evidence from this run
  rather than revision:
  - *"the category converged on MCP + a skill"* — **still true, extended.**
    Figma shipped **agent skills authored inside Figma** on 13 Aug 2026, and at
    [Config 2026](https://www.figma.com/blog/config-2026-recap/) (24 Jun)
    packaged them as a first-class primitive alongside Connectors, plus **agent
    chats visible to teammates by default**. That last one is the same bet
    isocan made when it put the conversation in canvas state.
  - *"vendors ship the divergence half and not the convergence half"* —
    **still true, and now visible in the token layer too.** See §5.
  - *"an idea that assumes a model isocan does not ship is a different
    product"* — **reinforced.** Everything in this run is a file format. None
    of it needs a model.
- **[Agent skills](agent-skills.md) (22 Aug)** — **changed, and the change is
  large.** That survey measured the skill-repo leaderboard and found the
  official Anthropic set at 171k stars. It did not see this category coming:
  [`VoltAgent/awesome-design-md`](https://github.com/voltagent/awesome-design-md),
  a repo of nothing but DESIGN.md files, **110,075 stars and 12,552 forks**,
  created 31 March 2026, MIT (GitHub API, 24 Aug 2026). A pile of *design*
  documents is now within striking distance of the leaderboard that survey
  built. The observation it closed on — *every repo on that leaderboard is a
  file that changes agent behaviour, and not one has anywhere for the work to
  land* — applies exactly as written, and harder, because a design system is
  more obviously a thing that wants to sit next to what it governs.
- **[JSON Canvas](json-canvas.md) (22 Aug)** — untouched. Different format,
  different question.
- **[Feature readiness](feature-readiness.md) (21 Aug)** — untouched by this
  run; no row re-graded.

## 1. What actually happened to design tokens

**The spec stopped moving, on purpose.** The Design Tokens Community Group
published [2025.10 on 28 October 2025](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/),
its **first stable version**. It is a Community Group report, not a W3C
Recommendation — stable and widely implemented, but not on the Standards Track,
and any claim that tokens "became a real W3C standard" this year is wrong on
the process. Nothing dated 2026 appears on designtokens.org's news.

Two things in the stable version matter here, because they are exactly what
isocan's exporter gets wrong:

- **A color value is an object, not a hex string.** Required `colorSpace` and
  `components`; `alpha` and `hex` are optional, and `hex` is explicitly a
  *fallback*, not the value ([color-type.md](https://github.com/design-tokens/community-group/blob/main/technical-reports/color/color-type.md)).
- **A dimension value is an object, not a CSS length.** `{ "value": 0.5, "unit":
  "rem" }`, and the unit MUST be `px` or `rem` ([format/types.md](https://www.designtokens.org/tr/drafts/format/)).

Both are breaking changes from the shape everyone wrote in 2023, and both are
the whole content of "adopting DTCG" in 2026.

**The second module is theming.** The [Resolver Module](https://www.designtokens.org/tr/drafts/resolver/)
addresses the thing the format module deliberately left out: alternate values
per context — light/dark, mobile/desktop, reduced-motion — expressed as
*dimensions* and *modifiers* over token sets, so N contexts do not become N
copies. Its own [CHANGELOG](https://github.com/design-tokens/community-group/blob/main/technical-reports/resolver/CHANGELOG.md)
is honest that 2.1.0 (23 Jul 2025) was "editorial improvements and community
feedback… rather than normative specification changes", with open questions
still listed on merge order, precedence and modifier structure. It is real, it
is not finished, and it is the single largest hole in DESIGN.md. See runner-up 1.

**Adoption is where you would expect.** Penpot bills itself as the first design
tool with native DTCG support; Figma Variables export to a DTCG-aligned JSON;
Style Dictionary, Tokens Studio, Terrazzo, Supernova, zeroheight and Knapsack
all read the format. A widely repeated figure — 84% of teams using tokens, up
from 56%, from a zeroheight survey of ~300 people — could not be traced to a
zeroheight primary source in this run and is therefore **not** quoted here as
fact.

## 2. DESIGN.md, one year in — and the fault line inside it

[`google-labs-code/design.md`](https://github.com/google-labs-code/design.md)
(Apache-2.0, created 10 Apr 2026, **27,478 stars**, last push 27 Jul 2026) is
still what `packages/core/src/designmd.ts` says it is. Its CLI reached **0.4.0
on 27 July** with four commands — `lint`, `diff`, `export`, `spec` — and four
export formats: `json-tailwind`, `css-tailwind`, `css-vars`, and **`dtcg`**.

Two things follow from that release list that are worth stating plainly.

**There is no viewer.** Not in the CLI, not in the repo. `spec` generates
*markdown*. The format's authors ship a linter, a differ and four exporters, and
have not shipped a way to look at a DESIGN.md as the thing it describes.

**And there is a reference DTCG exporter**, which means isocan's `toDtcg` can be
checked against an implementation rather than against a reading of the spec.
That is §4.

The fault line: the most-used corpus of DESIGN.md files does not all speak the
format. Of the 74 files in `awesome-design-md` (the badge says 73; there are 74
directories), **10 have no YAML front matter at all** — kraken, lamborghini,
lovable, mastercard, runwayml, sanity, spotify, starbucks, tesla, theverge are
pure prose under numbered headings (`## 1. Visual Theme & Atmosphere` …
`## 9. Agent Prompt Guide`), with hex values embedded in sentences and no
machine-readable token anywhere. The repo's README states the philosophy
outright: *"No Figma exports, no JSON schemas, no special tooling… Markdown is
the format LLMs read best, so there's nothing to parse or configure."*

That is the opposite of the bet isocan made. isocan parses the file and renders
it, and everything `DesignSystemView` and `design check` and `--css` do depends
on the tokens being normative. **On 10 of 74 real files in the most popular
library, they are not.** Worth knowing before anyone treats that corpus as a
source of truth.

## 3. Measured: 74 real DESIGN.md files through isocan's own linter

Every file in `awesome-design-md` was downloaded and run through
`parseDesign` + `checkDesign` from `packages/core`. Reproduction at the bottom.

```
files=74   files with ≥1 error=42   errors=308   warnings=40
```

Errors by cause:

| count | cause | where it lives |
| --- | --- | --- |
| 214 | **compound token references** — `padding: "{spacing.sm} {spacing.md}"` read as one reference and reported dangling | `designmd.ts` / `resolveToken` |
| 43 | **YAML block scalars** — `description: \|` reported as "unexpected indentation" | `designmd.ts`, the YAML subset |
| 38 | **CSS colour functions** — `rgba(255,255,255,0.7)` as a colour token value, rejected as "not a CSS colour" | `designcheck.ts` / `contrast.ts` |
| 13 | genuine: 10 × "no colour tokens" (the prose-only files above), 3 × real contrast failures | not a bug |

**29 of the 42 failing files fail only for the first three reasons.** All three
are cases the DESIGN.md spec explicitly permits: it allows references inside
composite values, it is YAML so block scalars are legal, and it names
`rgb()`, `hsl()`, `oklch()` and `color-mix()` as valid colour forms alongside
hex. So `isocan design check` currently reports a red **error** on valid input,
and `DesignSystemView` shows a "Could not be read" panel for a `description:`
written across two lines.

None of these are operations. All three are pure functions in `@isocan/core`,
which means one fix lands on both surfaces at once — the rare change where the
isomorphism is free rather than a tax.

## 4. Measured: isocan's W3C export against the official schema

`isocan design --tokens` says, in its own help text: *"W3C design tokens
(designtokens.org) — Figma, Style Dictionary, Tailwind"*. That promise was
tested three ways on the same input (`stripe`'s DESIGN.md, 20 colours,
15 type styles, 8 spacing steps, 6 radii, 30 components).

**Against Google's reference exporter** (`npx @google/design.md@0.4.0 export
DESIGN.md --format dtcg`):

| | reference | isocan `toDtcg` |
| --- | --- | --- |
| `$schema` | `…/schemas/2025.10/format.json` | absent |
| colour group | `color` | `colors` |
| colour value | `{"colorSpace":"srgb","components":[0.325,0.227,0.992],"hex":"#533afd"}` | `"#533afd"` |
| dimension value | `{"value":2,"unit":"px"}` | `"2px"` |
| `$type` placement | on each typography leaf | on the group |
| `lineHeight` | **dropped** | kept (as `1.03`) |
| `fontFeature` | dropped | kept |
| components | **omitted entirely** | emitted, in a group with no `$type` |

**Against the official JSON Schema** (`https://www.designtokens.org/schemas/2025.10/format.json`,
ajv, all errors):

```
isocan  → invalid, 1398 errors — all 1398 in `typography`
Google  → invalid,  198 errors — all  198 in `typography`
```

Two findings, and the second is the interesting one.

**Google's own reference implementation does not validate**, because it drops
`lineHeight`, which the typography composite lists as required. Perfect
conformance is not the bar here; nobody has cleared it.

**isocan's colours and dimensions pass — vacuously.** Strip typography and
isocan's output validates with zero errors. That is not because hex strings are
legal; it is because **the published schema does not implement group-level
`$type` inheritance**, so a leaf with no `$type` of its own is never checked
against any type at all. Tested directly:

```
PASS  group $type "color",     leaf $value "#533afd"
FAIL  leaf  $type "color",     leaf $value "#533afd"
PASS  leaf  $type "color",     leaf $value {colorSpace…}
PASS  group $type "dimension", leaf $value "16px"
FAIL  leaf  $type "dimension", leaf $value "16px"
```

The prose spec *requires* that inheritance ("the token's type is inherited from
the closest parent group… otherwise the token becomes invalid"). So every
consumer that implements the spec correctly — Style Dictionary v4, Terrazzo —
sees exactly the values in the FAIL rows. isocan's export is **schema-valid by
accident and spec-invalid in fact**.

**And the import side is worse.** Feeding the reference exporter's own output
back through `fromDtcg`:

```
colors:  0        (group is `color`, isocan looks for `colors`)
spacing: {"xxs":{"value":2,"unit":"px"}, …}   ← objects, into a field typed string|number
```

which then flows straight into `toCss`:

```css
:root {
  --space-xxs: [object Object];
  --space-xs: [object Object];
```

That is a live bug with a one-line repro. It has never bitten because
**`fromDtcg` is unreachable from either surface** — grep finds it in
`packages/core/src/tokens.ts` and in its own test file, and nowhere else.
`isocan design set` takes "markdown or CSS"; there is no `--from-tokens`. The
function is tested, exported, and dead.

## 5. Who renders a token file as a living document

The honest answer to the sub-question: **almost nobody, and nobody for this
format.**

- **Google's design.md CLI** — linter, differ, four exporters, a markdown spec
  generator. No renderer.
- **`awesome-design-md`** — 74 DESIGN.md files, each in a directory containing
  `DESIGN.md` and `README.md` and nothing else (checked via the GitHub contents
  API on four brands). No previews, no viewer, no tooling by stated policy.
- **Storybook** — the design-token addons are real and mature, but they parse
  *CSS comments* in your stylesheets, not a token file, and the ecosystem
  around them predates DTCG.
- **Terrazzo** — the closest thing, and it is deliberately not a viewer. Its
  [`plugin-token-listing`](https://github.com/terrazzoapp/terrazzo/tree/main/packages/plugin-token-listing)
  emits a `terrazzo.listing.json` whose stated purpose is *"used by design token
  tool makers to understand the relationship between your source design tokens
  and your style files"* — a manifest **for** documentation tools, with `modes`
  and `platforms` metadata so somebody else can build the mode selector.
- **zeroheight, Supernova, Knapsack** — do render tokens as documentation, with
  swatches and type specimens, and are the state of the art for this. They are
  also hosted SaaS with an editor, a publishing pipeline and an account, aimed
  at a design-system team publishing to an organisation. Their unit of work is
  a documentation site, not an item on a canvas beside the screens.

So `DesignSystemView.tsx` occupies a genuinely empty spot: it parses the
format's canonical file, resolves `{colors.x}` through the same `resolveToken`
the CLI uses, draws each token *as the thing it describes*, and computes
contrast with the repo's own `contrastRatio` — live, from the current version of
an item, with no build step and no account. **Nothing else does this, for this
format.** That is not a reason to build anything; it is a reason to stop
treating it as a nice extra and start treating it as the differentiated thing
it is, which is what makes the §3 and §4 bugs worth fixing rather than shrugging
at.

## 6. Convergence, briefly

The prior survey is one day old, so the honest report is: **nothing shipped that
bears on it.** Config 2026 (24 Jun) contains no design-system or token
announcement at all, and Figma's own solutions page still describes the same
asymmetry the last survey named — "go wide" to generate distinct stylistic
approaches, then "go deep by picking a direction", where *picking* is a
sentence rather than a feature.

One new piece of evidence, from an unexpected direction. The DTCG **Resolver**
module is the same combinatorial problem in token space — N alternatives to the
same thing, threatening to explode — and the field's answer there is explicitly
*"deduplicating all repeat values across all contexts as well as enumerating all
permutations"*. Keep them all, index them well. Nobody's instinct, in either
domain, is to record that a decision was made.

That is mild support for the awkward half of
[`docs/design/convergence.md`](../design/convergence.md): folding the *losing*
siblings into the parent's version stack rather than trashing them is not a
sentimental choice, it is the same instinct the token world has already
committed to — with the difference that isocan would also record which one won,
which is the part nobody has.

## Recommendation

**Make the two formats isocan claims to speak actually round-trip, and adopt the
74-file corpus as the fixture that proves it.**

One piece of work, in two files, with a number attached to it:

1. **`packages/core/src/tokens.ts` — emit real DTCG 2025.10.**
   - Colours become `{colorSpace:"srgb", components:[r,g,b], alpha?, hex}`.
     `parseHex` in `contrast.ts` already does the arithmetic; this needs no
     dependency and no new dependency is acceptable in core anyway.
   - Dimensions become `{value, unit}`. Unitless spacing — which DESIGN.md
     permits as a ratio — has **no** DTCG dimension representation; report it
     as a finding rather than guessing a unit. Say so in the code.
   - Move `$type` onto the leaf for typography, make `fontSize` and
     `letterSpacing` dimension objects, and **keep `lineHeight`** as a number.
     That makes isocan's typography export more conformant than Google's, which
     is a claim this run can substantiate: 198 schema errors, all of them that.
   - `fontFeature`, `fontVariation` and the whole `components` group have no
     DTCG home. The spec provides `$extensions` with a vendor key for exactly
     this. Use it rather than dropping them the way the reference does — a
     design system that loses its components on export is not exported.
   - Emit `$schema`, so a consumer knows which version it is holding.
   - `fromDtcg` accepts both shapes — object and legacy string — and both group
     names, so it reads real-world files, Figma exports, and isocan's own
     history. Then **give it a surface**: `isocan design set --from-tokens
     tokens.json`, and it stops being dead code.
2. **`packages/core/src/designmd.ts` + `designcheck.ts` — stop failing valid
   input.** Resolve references by substitution inside a string rather than
   whole-string match (214 of the corpus's 308 errors); read `|` and `>` block
   scalars (43); accept `rgb()`/`hsl()`/`oklch()`/`color-mix()` as colour values
   and skip the contrast check where the ratio cannot be computed rather than
   calling the value invalid (38).
3. **Land the corpus as a fixture.** MIT, 74 files, no dependency — check in a
   subset or a fetch script, and assert the error count. Today: 42 of 74 files
   error. The target is 13 errors across 3 files, all of them true findings.

Why this one:

- It is **zero operations**. No reducer change, no inverse, no new op in the
  union, nothing for the multiuser work in flight to collide with. It is pure
  functions in core, which means CLI, web app and `grade.mjs` all get it at
  once — the isomorphism paying out instead of costing.
- It closes a **promise the product already makes in its own `--help`**. Every
  other item on any roadmap is a new promise.
- It is **testable against an external authority** rather than against our
  taste: the official JSON Schema, the reference exporter, and 74 files nobody
  here wrote. That is what `docs/research/`'s own rule asks for and what
  [`docs/evals.md`](../evals.md) Stage 2 is built on — this is another
  deterministic grader, over the design system instead of over a screen.
- It makes the thing isocan is **alone in shipping** — a design system rendered
  as itself, live, on the canvas beside what it governs — stop tripping over
  files that other people's tools read fine.

## Runner-up 1: token modes, via the DTCG Resolver

**The mechanism.** A resolver file names *dimensions* (theme, density, contrast)
and, under each, *modifiers* pointing at token-set files. Resolution merges a
base set with the selected modifiers in a defined precedence order, producing
one flat token set per context. It exists because the alternative — a copy of
the palette per theme — is a combinatorial explosion.

**What it would mean here.** DESIGN.md has no modes. `DesignSystemView` renders
one palette. Every real design system in 2026 has at least light and dark, and
`designcheck`'s contrast rules are computed against a single ground, which means
a system that is correct in dark mode can be reported as failing.

**Why it lost.** Three reasons, in order of how much they matter.

The resolver is **multi-file by construction**, and isocan's design system is
one item with one blob and one version stack. Threading a dimension×modifier
matrix through that is not an import, it is a second state model that neither
the reducer nor `item.addVersion` knows about — the exact shape the last survey
refused for edges. The cheap isocan-shaped alternative, two `role=design-system`
items with a `mode` property, is blocked by a deliberate decision:
`designSystem()` returns most-recently-updated because *"two are a mistake
rather than a feature"*. Changing that is a real design argument, not a patch.

Second, the spec is **not stable**. Its own changelog's most recent entry is
editorial, and lists unresolved questions on merge order and precedence — the
two things an implementation must get right.

Third, there is a **cheaper 80%** that costs nothing structural: DESIGN.md
already permits references, so a second colour group and a documented naming
convention gets a dark palette into the same file, and `designcheck` could grade
contrast against whichever ground a token names rather than assuming one. That
is a linter change, not an architecture change. Do that; revisit the resolver
when it stops changing.

## Runner-up 2: seed a design system from the corpus

**The mechanism.** 74 MIT-licensed DESIGN.md files, one per recognisable brand.
`isocan design set` already exists and already versions rather than replaces.
`isocan design set --from stripe` — or, matching the shape `isocan command add
--from <owner/repo/path>` already uses — turns "this canvas has no design
system" from an agent round-trip into one command, and gives `/design-system` a
worked example to imitate instead of a blank page.

**Why it lost.** It is convenience over capability: `curl … -o DESIGN.md &&
isocan design set DESIGN.md` works today, and the interesting half — deriving a
system from the screens already on the canvas — is what `/design-system`
already does and is strictly better, because it describes what this canvas
*is* rather than what somebody else's website is.

It is also **downstream of the recommendation**: 42 of those 74 files currently
throw errors in `design check`, so shipping the shortcut first would ship the
bugs to every new canvas.

And there is a posture question worth naming rather than discovering later.
These files are "inspired by" analyses of live commercial brands — Stripe,
Tesla, Nintendo — and the repo disclaims ownership of any of those visual
identities. A person choosing to copy one into their project is their call. A
flag inside isocan named `--from tesla` is isocan making that call for them, and
it is a different thing. If this is ever built, build it as `--from <url|path>`
and let the person name the source.

## What to be suspicious of, from this run

- **Chasing perfect DTCG conformance.** Google's own exporter fails the schema
  198 times on one file. The bar is "a real consumer can read it", not "zero
  errors" — and the honest place to stop is: valid colours, valid dimensions,
  typography with `lineHeight`, everything else in `$extensions`.
- **Treating a star count as a spec.** `awesome-design-md` has more stars than
  most standards and 10 of its 74 files contain no tokens at all. Popularity is
  not conformance.
- **"84% of teams use design tokens."** Widely repeated this year, not traced
  to a primary source in this run, and therefore not stated as fact anywhere
  above.
- **Building a token *editor*.** Tempting, adjacent, and a different product.
  DESIGN.md's whole premise is that the file is the interface and an agent
  writes it; a form for editing tokens is what isocan already has — it is called
  a text item and an agent.

## Reproducing this

```bash
# the corpus
for b in $(curl -s "https://api.github.com/repos/VoltAgent/awesome-design-md/contents/design-md" \
           | python3 -c "import json,sys;[print(x['name']) for x in json.load(sys.stdin)]"); do
  curl -sf -o "dmd/$b.md" \
    "https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/design-md/$b/DESIGN.md"
done

# the reference exporter, and isocan's, on the same file
npx -y @google/design.md@0.4.0 export dmd/stripe.md --format dtcg > ref-dtcg.json
isocan design --tokens > iso-dtcg.json    # or call toDtcg(parseDesign(text).tokens)

# the official schema
curl -s -o schema.json https://www.designtokens.org/schemas/2025.10/format.json
# validate both with ajv (strict:false, allErrors:true)
```

Everything numeric above came from one of those commands, from the GitHub API
on 24 Aug 2026, or from a vendor page linked below. Nothing is estimated.

## Sources

- [Design Tokens Format Module 2025.10](https://www.designtokens.org/tr/drafts/format/) and the [stable-version announcement](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/), 28 Oct 2025
- [Color type](https://github.com/design-tokens/community-group/blob/main/technical-reports/color/color-type.md) and [composite types](https://github.com/design-tokens/community-group/blob/main/technical-reports/format/composite-types.md) — DTCG technical reports
- [Design Tokens Resolver Module](https://www.designtokens.org/tr/drafts/resolver/) and its [CHANGELOG](https://github.com/design-tokens/community-group/blob/main/technical-reports/resolver/CHANGELOG.md)
- [Official JSON Schema](https://www.designtokens.org/schemas/2025.10/format.json) — 2025.10
- [`google-labs-code/design.md`](https://github.com/google-labs-code/design.md), [spec](https://github.com/google-labs-code/design.md/blob/main/docs/spec.md), [releases](https://github.com/google-labs-code/design.md/releases) — Apache-2.0, CLI 0.4.0, 27 Jul 2026
- [`VoltAgent/awesome-design-md`](https://github.com/voltagent/awesome-design-md) — MIT, 74 files, 110,075 stars (GitHub API, 24 Aug 2026)
- [Terrazzo `plugin-token-listing`](https://github.com/terrazzoapp/terrazzo/tree/main/packages/plugin-token-listing) and [DTCG guide](https://terrazzo.app/docs/guides/dtcg/)
- [Config 2026 recap](https://www.figma.com/blog/config-2026-recap/) — Figma, 24 Jun 2026
- [Design Systems and AI: why MCP servers are the unlock](https://www.figma.com/blog/design-systems-ai-mcp/) — Figma
- [Documenting design tokens](https://help.zeroheight.com/hc/en-us/articles/35886930025755-Documenting-design-tokens) — zeroheight
