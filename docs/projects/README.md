# Projects

One directory per body of work. A project holds everything about itself — the
ideal it is aiming at (`journey.md`), the walk that gets there (`phases.md`),
and the mechanisms it forced along the way, one bounded mechanism per file.
Reading a project end to end is `ls` and then reading in order; adding a doc to
one edits nothing outside it.

The rule for this directory: **a doc lives with the work that forced it.** A
design that opens by naming the debt it discharges belongs beside the doc that
owes the debt, not in a pile of designs sorted by nothing. What stays at the
top level of `docs/` is what belongs to no single project — `architecture.md`
(one physical map of one system, moved by every project and owned by none), the
guides, and the records indexed by time rather than by subject: `changelog/`,
`research/`, `reviews/`.

A project with one design names it `design.md`; a project with several names
each for what it designs.

| Project | What it is | Where it stands |
| --- | --- | --- |
| [multiuser](multiuser/) | The hosted, multi-user build: sharing a canvas, the identity desk, the innkeeper, homes and replicas. [`journey.md`](multiuser/journey.md) is the ideal and the acceptance suite; [`phases.md`](multiuser/phases.md) is the walk, and its "where we are" line is the one to read first. | **Phase 14 closed, 25 Aug 2026 — isocan.io is live.** What follows is a choice, not a queue. Phase 10.5 is the one unpaid debt: Paul and Dion have not walked `development.md`. |
| [ui-refresh](ui-refresh/) | The canvas as a stage rather than a workbench with tools bolted to the walls — a floating rail, results drawn beside the message that made them, and chrome that arrives when summoned. [`phases.md`](ui-refresh/phases.md) is the walk; the design itself lives on canvas `prj_trml8m4Zfh` (seven screens, a rationale, and a spec for two of them). | **Phases 1–6 built, 28 Aug 2026.** The rail floats and opening it PANS the canvas; shut, it is a 48px strip carrying unread and the agents that are working. The lane draws what a message made, with a tether that refuses to lie. The header dissolved into floating clusters, eight bar controls became three behind a `···`, and the agent tray gives `isocan who` a home. Full screen presents (chrome rests while you flip slides) and the workbench joins the same language. **All three harness-blocked acceptances were closed by hand on 29 Aug** — ⌘J reaches the page, the blur is fine under a pan, and follow flies. They had waited on one fact: the harness delivers no key events, never runs a frame, and reports the tab hidden. |
| [context](context/) | What an agent actually reads when it starts work here — seeing it, managing it, and whether an external memory system (Honcho, Hindsight) belongs. [`design.md`](context/design.md) settles the last one first: the canvas is the RECORD and a memory system is at most an INDEX, held to three tests — can it be undone, can everyone see it, does it work offline. | **Researched, 28 Aug 2026. Nothing built.** Stage 1 is a Context view that stores nothing new, which is why it comes first. |
| [mindmap](mindmap/) | Riffing with an agent into a mind map you can drag: real nodes, real arrows, on the canvas. [`design.md`](mindmap/design.md) records a reversal — the first draft argued against a graph by weighing it as a new op type, when the nodes already exist as text items and an edge is a property. Direct manipulation is what settles it: a dragged node needs its position to be a canvas fact. | **Researched, 28 Aug 2026. Nothing built.** Stage 1 is a graph you can drag. Of the three named costs, **per-op undo has since been paid** — op grouping shipped the same day, so an agent building a map from one sentence is already one `⌘Z`. What remains is forty items where there was one, and layout. |
| [atlas](atlas/) | Understanding a system you did not write, on a canvas, with an agent — and keeping that understanding current as the system moves. [`journey.md`](atlas/journey.md) plus the two mechanisms it forced: [convergence](atlas/convergence.md) (the canvas can diverge and cannot converge) and [the content origin](atlas/content-origin.md) (serve item content from an origin that owns nothing). | Journey written 24 Aug 2026. Both mechanisms designed, neither built. The content origin now has an [execution plan](atlas/content-origin-plan.md) (26 Aug): four stages, local half first, each stage stable on both shapes. |
| [evals](evals/) | Finding out whether isocan is any good at the thing it exists for, and then continuing to find out. [`plan.md`](evals/plan.md) is staged: observe, then measure, then judge, then intervene. | Staged plan. Stage 2's graders exist in [`scripts/grade.mjs`](../../scripts/grade.mjs) and are wired to nothing — which the night-shift research found by typing the command nobody types. |
| [workbench](workbench/) | A second top-level view that flips from the canvas: agents \| files \| artifact \| editor. Talk to every agent by @name, see what each is doing right now. | Drafted 25 Aug 2026 from a five-lens fan-out and three adversarial reviews. Not chosen. |
| [extensions](extensions/) | Making things *of* the canvas rather than *on* it: a new entry in the tool rail, a panel down the side, a view that did not ship. | Designed. The 24 Aug architecture review judged the model correct — `role=tool` is invariant 3 exactly, no new operation — and named its gate: `does` needs runtime validation before tier 3 is safe. Not built. |
| [auto-upgrade](auto-upgrade/) | A CLI that catches up with its home, in a project that ships several times a day. [`design.md`](auto-upgrade/design.md) is the argument, [`phases.md`](auto-upgrade/phases.md) the walk — four phases, the first two notify-only — and [`journey.md`](auto-upgrade/journey.md) the acceptance suite, written after the design; writing it surfaced eight design gaps, recorded at its end. | **Phases 1–2 done, 27–28 Aug 2026; phases 3–4 not started.** isocan.io can say which commit it is running — `/healthz` carries it, and every promote since has been verified against it. A CLI that disagrees with its home now says so, once per pair of shas, naming both builds and the home; a copy that cannot find out says nothing. Nothing is fetched, applied or restarted yet: phase 3 is the install root, and it is the natural next step. |

**One project is owed and does not exist yet.** `launch/design.md` must own the
operational half of frozen delegation — the hook contract, how a home observes
the failure it promises to report, the payload as a channel that is not
private — before phase 12 opens. `multiuser/phases.md` names it in two places.
