## Critics

A **critic** is a persona that lives on the canvas: a markdown card in the
persona format, marked `critic: true`, that points and explains and never
edits. Its card holds who it is (`agentName`, a principle, never a person),
a `credit` line saying who it is after and that it is not affiliated, its
`color`, a `budget` per critique, three numbered questions, and two headings
— *What it looks for first* and *How it ranks*.

- `isocan critic ls` — the roster this build offers, and the critics on this
  canvas with their questions and budget (`--json` for both). A card whose
  name breaks the rules is listed with what is wrong.
- `isocan critic add <critic>` — a roster critic onto the canvas, by id or
  name (`critic add inevitable`), its lens copied from its pack's
  `critique.md`. Refused, in words, when that critic is already here or its
  first word is another critic's (mentions resolve by first word).
- `isocan critic new "<name>"` — a skeleton to fill in. `--after "<person>"`
  credits who it is an homage to, and its name may not carry theirs;
  `--self` is for a critic you made of yourself.
- Editing is `isocan edit <card> critic.md` — the card is the critic, so the
  next critique reads what you wrote. `critic ls` re-reads it.

Asking a critic for a critique is not built yet (critique phase 1). In the
app the cards draw as critic cards behind **Settings → Experiments →
Critique**, and as plain markdown without it.
