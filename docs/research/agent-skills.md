# Skills worth stealing: what the ecosystem has built

**22 August 2026** · [full write-up](https://claude.ai/code/artifact/a380ba2c-2cbe-44dc-b3b4-ef0a3ae2b38b)

A survey of the most-starred agent-skill repositories, and which of them belong
on a canvas. Star counts pulled from the GitHub API on the date above; every
import path checked against the live repo.

## Read the numbers with suspicion

This ecosystem is a year old and half the leaderboard is *aggregators* — lists
of skills, not skills. Popularity decided what to look at; content decided what
to recommend.

| Repo | Stars | Licence | What it is |
| --- | --- | --- | --- |
| `obra/superpowers` | 276k | MIT | 14 methodology skills |
| `mattpocock/skills` | 232k | MIT | ~30 engineering skills, incl. `grilling` |
| `anthropics/skills` | 171k | **none** | 20 official skills: documents, design, testing |
| `addyosmani/agent-skills` | 89k | MIT | 24 engineering-practice skills |
| `ComposioHQ/awesome-claude-skills` | 73k | none | directory |
| `pbakaus/impeccable` | 62k | Apache-2.0 | design language: 7 reference files, 17 commands |
| `mvanhorn/last30days-skill` | 59k | MIT | research across social + news |
| `kepano/obsidian-skills` | 47k | MIT | 5 skills, incl. **json-canvas** |
| `github/awesome-copilot` | 38k | MIT | directory |
| `blader/humanizer` | 37k | MIT | strip AI tells from prose |
| `VoltAgent/awesome-agent-skills` | 31k | MIT | directory, 1000+ entries |
| `google-labs-code/design.md` | 27k | Apache-2.0 | the DESIGN.md format (adopted) |
| `obsidianmd/jsoncanvas` | 3.7k | MIT | the open canvas file format |

**`anthropics/skills` has no LICENSE file and no licence note.** Read it, learn
the shape, write our own. Do not vendor it, and do not let `/skill find`
recommend it without saying so.

## The distinction that decides everything

**Methodology skills** (TDD, systematic debugging, verification) change how an
agent *behaves*. They need nothing from a canvas. Import them for the agents;
build no product around them.

**Capability skills** (make a document, audit a screen, produce a deck) change
what an agent can *make*. A canvas transforms these, because the output stops
being a file in a folder and becomes an item with lineage, versions and a thread
beside it. That is what isocan adds and nobody else in the list has.

## Import today

```sh
isocan command add --from obra/superpowers/skills/verification-before-completion/SKILL.md
isocan command add --from obra/superpowers/skills/systematic-debugging/SKILL.md
isocan command add --from blader/humanizer/SKILL.md
isocan command add --from kepano/obsidian-skills/skills/json-canvas/SKILL.md
```

- **verification-before-completion** — don't claim it works, run it and paste
  what came back. Matters more here than in a terminal: a claim on a canvas is a
  comment somebody else acts on.
- **systematic-debugging** — instrument before concluding.
- **humanizer** — the prose half of our slop list, from Wikipedia's *Signs of AI
  writing*. `/design-audit` checks seventeen visual tells and nothing checks the
  copy, which is most of every screen. Fold it in as a section.
- **json-canvas** — so "give me this as a canvas file" produces a spec-correct one.

Also worth taking, from `addyosmani/agent-skills` (MIT):
`code-review-and-quality` (a canvas of screens is a codebase nobody reviews) and
`browser-testing-with-devtools` (measures contrast and focus order on the
*rendered* thing, which a source read cannot).

## Read, do not install

- **`anthropics/skills`** — especially `docx`, `pdf`, `xlsx`, `pptx`: real
  document capability, and a genuine gap. Licence blocks vendoring.
- **`pbakaus/impeccable`** — the seven reference files (typography, colour,
  spatial, motion, interaction, responsive, UX writing) are the part with the
  most content. Apache-2.0, adaptable with attribution. Mine them for rules that
  are *checkable* (→ slop list) versus rules about taste (→ DESIGN.md template).
- **`obra/superpowers`** — `brainstorming` overlaps `/grill-me`;
  `subagent-driven-development` overlaps upstream's conductor protocol in
  `docs/phases.md`; `writing-skills` is worth reading before we add built-ins.

## Skip

The awesome-* lists themselves — indexes, not skills, and VoltAgent's is mostly
vendor SDK skills. Useful as a **search target**: point `/skill find` at them so
it proposes from a real index rather than a web search that returns ten reprints
of the same repo. One line in the command body, and the cheapest improvement in
this survey.

Also skip second copies of jobs we already do (`interview-me`, `idea-refine` vs
`/grill-me`). **One skill per job.** Nine built-ins that each mean something
beats forty that overlap.

## The thing this says that is not about skills

Every repo on that leaderboard is a file that changes how an agent behaves, and
not one has anywhere for the work to land. The skills are commodity and
improving for free; the canvas — lineage, versions, a thread beside the thing,
presence saying who is on it — is the part nobody else is building. Import
generously; build the canvas.
