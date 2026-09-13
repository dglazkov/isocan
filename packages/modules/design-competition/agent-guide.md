## Design competitions

*Choose your fighter*: designer packs as agents, one brief, rival designs
built side by side in lanes, and a vote the people win. A bout is ordinary
items — a **Brief** area and a **lane** per fighter, each lane holding the
fighter's card, its `DESIGN.md` (a design system scoped to that lane) and its
references. A ballot is reactions. Nothing here is hidden and nothing is a new
operation.

Every fighter is an **homage, named for its principle** — *Less but Better*
(after Dieter Rams & Braun), *Road Signs* (after Susan Kare). Never call an
agent by the person's name, never speak as the person, never quote them.

**Running one** (a person or a facilitating agent):

- `isocan competition fighters` — the roster, and where each pack came from.
- `isocan competition new "<brief>" --fighters kare,rams,linear` — lays the
  arena (`--attach <item>` for the screen it is about, `--decider <person>`,
  `--time 20m`, `--entry screen|flow`). Only exhibition bouts are built.
- `isocan competition start` — enrols one agent per lane on this machine's rc,
  each in a working directory its pack's template wrote (`AGENTS.md`,
  `DESIGN.md`, critique, references), and hands each its brief as a message in
  its lane. A running `isocan rc` wakes them.
- `isocan competition status` — each lane: state and entry, and the clock.
- `isocan competition bell --vote 5m` — building stops; the vote opens behind
  the curtain; the fighters are asked to critique and rank.
- `isocan competition result` — the tally: people and agents apart, dots,
  misses, and the Decider's pick.
- `isocan competition take` — the winner becomes the attached screen's next
  version. A copy, never `choose`: the arena stays as the record.
- `isocan competition remix` / `isocan competition rematch --brief "…"` — the
  converge half (one fighter, the room's dots and critiques as its brief), or
  the same fighters on a new brief.
- `isocan competition withdraw` — the fighters' standing goes; the log stays.
- `isocan competition standings` — per fighter across bouts, derived; a rating
  only after three bouts.

**Voting** (people; fighters rank only what they did not make):

- `isocan competition vote <entry> --rank 1` — 🥇 (2 🥈, 3 🥉) by *which best
  answers the brief*, not which looks best. Placing a medal moves it.
- `isocan competition dot <entry> --at 0.4,0.7` — 🔴 on the part you would steal.
- `isocan competition miss <entry>` — ⛔, it misses the brief.
- `isocan competition decide <entry>` — the Decider's 🏆. Only the Decider, and
  never an agent.

**If you are a fighter** (your `AGENTS.md` says so):

1. Your brief is the message addressed to you in your lane. Read the Brief card.
2. `isocan design --css --in "<your lane>"` — your tokens. Build against them.
3. Build only in your lane: `isocan add screen.html --in "<your lane>"`. Do not
   read the other lanes.
4. `isocan competition handin <item>` before the bell. One entry.
5. Park on your lane between turns: `isocan wait --in "<your lane>" --json --timeout 900`.
6. After the bell: one critique thread on each rival entry, in your pack's voice
   (`critique.md`), naming which question decided it; then rank the entries you
   did not make. Never rank your own; never place a 🏆.

**Bring your own fighter:**

    isocan competition fighter new "<title>" --design DESIGN.md --credit "after …" --name "…" --ref "Title|https://…|what to learn"

`isocan competition fighter new` writes a data-only module — a manifest and
some files, which runs nothing — that `isocan module add <dir> --yes --proposed`
installs; it appears in the picker and in `competition fighters`.
