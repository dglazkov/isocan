---
status: designed
since: 2026-09-07
issue: 199
see: personas, ui-refresh
note: low priority and deliberately not built — the interesting finding is that this codebase has two audiences for its words, and only one of them is human
---

# Internationalization: which words, for whom

**7 September 2026.** Research. Nothing built, and nothing should be yet —
asked for explicitly as low priority.

The ordinary version of this question is a library choice and a string
extraction. That part is boring and solved. What is worth writing down is the
part specific to this project, which surfaced immediately and is not obvious:

**isocan writes for two audiences, and only one of them wants translating.**

## The two audiences

`packages/cli/src/agent-guide.md` is read by *agents*, and
`packages/cli/test/surface.test.ts` enforces that every verb appears in it.
The CLI's 369 `console.log` calls are mostly read by agents too — refusals,
receipts, narration into a terminal an agent is driving.

The web app's ~160 `aria-label`/`title` attributes and its visible strings are
read by people.

Those are different problems with different right answers. **Localising the
agent surface is close to actively harmful**: an agent's prompt, its tools and
this repo's own vocabulary are English, a refusal an agent must parse is a
contract rather than a courtesy, and a translated `isocan --agent-help` would
be a second dialect of a language the guide exists to keep singular. The
`--json` surface is the real answer for anything a machine consumes, and it is
already there.

So the scope worth having is narrower than "the app": **the human surface of
the web app, plus the handful of CLI lines a person actually reads** (`setup`,
`doctor`, the errors a person hits before an agent is involved).

## What makes this harder here than usual

**The words are a designed surface with an owner.** `copy` is a persona with a
standing ratchet (`copy-tells`, at most 0), and `lessons.md` records repeatedly
that the wording IS the feature — `summonsLine` lives in core precisely so the
thread and a future `isocan comment --wait` cannot drift. Translation forks
every one of those sentences, and each carries reasoning that a translator will
not see. The honest version of this project's copy rules in another language is
not a `.po` file; it is a second copy persona.

**Some strings live in core.** `summonsLine`, `waitingLine`, `wokenLine`,
`kindLabel` and friends are shared folds, deliberately, so both surfaces say
one thing. A naive extraction would either pull a translation layer into
`@isocan/core` — which holds a ratcheted runtime-dependency count of 1 — or
break the single-fold rule that put them there. Neither is acceptable as
stated, and resolving it is the actual design work in this issue.

## What is already right

Dates and times go through `toLocaleString` / `toLocaleDateString` with no
locale argument, which is the correct default: the viewer's own.

## What is already wrong

`packages/web/src/lib/edgeradar.ts:221` hardcodes `toLocaleString("en-US")`,
so that one number is formatted American for everybody regardless of locale.
That is a real bug today, independent of any translation work, and it is one
line. **It is also greppable**, which makes it the shape of a guard: a rule
that no `toLocale*` call names a locale literal would have caught it and would
keep catching it, and that rule is worth having whether or not this issue is
ever built.

## The questions a build would have to answer first

- **Does the canvas flip in RTL?** The chrome should. The canvas almost
  certainly should not — it is a map, not a document, and mirroring a spatial
  arrangement moves everybody's work. This boundary is the one genuinely novel
  design question here and it has no established answer to copy.
- **What happens to a canvas whose contents are in another language?** Nothing
  — content is content. Worth stating so nobody conflates the two.
- **Who reviews a translation?** See the copy persona above.

## Recommendation

Do the `en-US` fix and its guard whenever somebody is nearby. Leave the rest
until there is a person who needs it, because the expensive half is not the
plumbing — it is deciding that a second language gets the same care as the
first, and this project's whole approach to words says a half-cared-for
translation would be worse than none.
