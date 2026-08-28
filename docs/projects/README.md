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
| [ui-refresh](ui-refresh/) | The canvas as a stage rather than a workbench with tools bolted to the walls — a floating rail, results drawn beside the message that made them, and chrome that arrives when summoned. [`phases.md`](ui-refresh/phases.md) is the walk; the design itself lives on canvas `prj_trml8m4Zfh` (seven screens, a rationale, and a spec for two of them). | **Nothing built, 28 Aug 2026.** Phase 0 is three questions. Both themes and no lost features are gates on every phase, not a later pass. |
| [context](context/) | What an agent actually reads when it starts work here — seeing it, managing it, and whether an external memory system (Honcho, Hindsight) belongs. [`design.md`](context/design.md) settles the last one first: the canvas is the RECORD and a memory system is at most an INDEX, held to three tests — can it be undone, can everyone see it, does it work offline. | **Researched, 28 Aug 2026. Nothing built.** Stage 1 is a Context view that stores nothing new, which is why it comes first. |
| [mindmap](mindmap/) | Riffing with an agent into a mind map you can drag: real nodes, real arrows, on the canvas. [`design.md`](mindmap/design.md) records a reversal — the first draft argued against a graph by weighing it as a new op type, when the nodes already exist as text items and an edge is a property. Direct manipulation is what settles it: a dragged node needs its position to be a canvas fact. | **Researched, 28 Aug 2026. Nothing built.** Stage 1 is a graph you can drag. The named costs are forty items where there was one, and per-op undo. |
| [atlas](atlas/) | Understanding a system you did not write, on a canvas, with an agent — and keeping that understanding current as the system moves. [`journey.md`](atlas/journey.md) plus the two mechanisms it forced: [convergence](atlas/convergence.md) (the canvas can diverge and cannot converge) and [the content origin](atlas/content-origin.md) (serve item content from an origin that owns nothing). | Journey written 24 Aug 2026. Both mechanisms designed, neither built. The content origin now has an [execution plan](atlas/content-origin-plan.md) (26 Aug): four stages, local half first, each stage stable on both shapes. |
| [evals](evals/) | Finding out whether isocan is any good at the thing it exists for, and then continuing to find out. [`plan.md`](evals/plan.md) is staged: observe, then measure, then judge, then intervene. | Staged plan. Stage 2's graders exist in [`scripts/grade.mjs`](../../scripts/grade.mjs) and are wired to nothing — which the night-shift research found by typing the command nobody types. |
| [workbench](workbench/) | A second top-level view that flips from the canvas: agents \| files \| artifact \| editor. Talk to every agent by @name, see what each is doing right now. | Drafted 25 Aug 2026 from a five-lens fan-out and three adversarial reviews. Not chosen. |
| [extensions](extensions/) | Making things *of* the canvas rather than *on* it: a new entry in the tool rail, a panel down the side, a view that did not ship. | Designed. The 24 Aug architecture review judged the model correct — `role=tool` is invariant 3 exactly, no new operation — and named its gate: `does` needs runtime validation before tier 3 is safe. Not built. |
| [auto-upgrade](auto-upgrade/) | A CLI that catches up with its home, in a project that ships several times a day. [`design.md`](auto-upgrade/design.md) is the argument, [`phases.md`](auto-upgrade/phases.md) the walk — four phases, the first two notify-only — and [`journey.md`](auto-upgrade/journey.md) the acceptance suite, written after the design; writing it surfaced eight design gaps, recorded at its end. | **Phase 1 done, 27 Aug 2026; phases 2–4 not started.** isocan.io can say which commit it is running — `/healthz` carries it, and every promote since has been verified against it. Phase 2 is the natural next step, and its rig now exists: two daemons on one laptop can be given two different shas. |

**One project is owed and does not exist yet.** `launch/design.md` must own the
operational half of frozen delegation — the hook contract, how a home observes
the failure it promises to report, the payload as a channel that is not
private — before phase 12 opens. `multiuser/phases.md` names it in two places.
