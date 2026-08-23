# Reviews

Standing reviews of this repo, by the four personas in
[`.claude/agents/`](../../.claude/agents/). Each one is a pass by somebody
whose only job is that lens: design, architecture, tests, and the market.

They exist because the work moves fast and the things that rot quietly —
a token nobody used, a test that asserts nothing, a dependency that stopped
being justified — are exactly the things nobody notices while shipping.

## How the memory works

Every run **reads before it looks**. The index below is the first thing a
persona opens, so a run in October knows what a run in August already
measured and can say "still true", "fixed", or "worse" instead of rediscovering
it. A finding that keeps reappearing across runs is a finding that needs a test,
not a third mention.

- **Findings** land here as `YYYY-MM-DD-<persona>.md`, newest first in the table.
- **[lessons.md](lessons.md)** is different and more valuable: the standing list
  of failure modes this codebase has actually produced, each with the guard that
  now catches it. It is append-only in spirit — a lesson leaves only when the
  thing it describes has become impossible.
- **Market research** goes to [`docs/research/`](../research/) instead, which
  already exists for exactly that and has its own index.

## What makes a finding worth writing down

The same bar the `/design-audit` command holds: cite the line, or the measured
value, or the command whose output you pasted. "Improve consistency" is not a
finding. "`--chip-hover` is declared in both themes and referenced nowhere
since 0e51081" is.

Say what is GOOD too, specifically. A review with no green is a review people
stop believing, and it is the half that tells you what not to break.

| Date | Persona | What it found |
| --- | --- | --- |
| *(no runs yet)* | | |
