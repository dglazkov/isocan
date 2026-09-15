---
status: partial
since: 2026-09-14
see: design-competition, evals, context, memory
note: phases 0–1 closed with shared contracts, twelve-case evaluation preparation and the real question/reference workflow verified on browser and CLI. Phase 2 is next; ordinary request enrollment, the complete design workflow and generated-design outcome evaluation remain ahead.
---
# A design partner — the experience

The debt is the gap between asking for an app and receiving a design
partnership. isocan already holds references, systems, alternatives and
decisions, but the person must know which commands assemble them. The ordinary
request should do that work.

The [research](../../research/2026-09-14-design-partner.md) establishes the
current gaps. These scenes describe the intended result, not shipped behavior.
[design.md](design.md) gives the shared contract,
[phases.md](phases.md) the execution order, and
[evaluation.md](evaluation.md) the evidence required to make it the default.
Every example and acceptance canvas is synthetic.

## Scene 1 — “Build me an inventory app”

The person asks in canvas chat. isocan reads the selected context and sees
an Acme product brief and an existing brand reference. It does not ask for
the company name or offer a new palette. It asks two questions that change
the design: “Who uses this most?” and “What must they finish quickly?” Each
offers understandable choices, a short reason, and room for a different answer.
“Use your judgment” is a usable answer.

The person chooses warehouse staff and receiving stock on a phone. isocan
reflects the consequence: “I'll prioritize scanning and quantity entry with
large controls. I'll use your existing brand. Stock analysis can follow.”
That compact brief is visible and editable beside the result; filling out
a long form or approving a specification is not a prerequisite.

The same request to an external coding agent produces the same brief and
next step. The agent reads and writes the canvas protocol through the CLI;
it does not invent a separate interview or private memory file.

## Scene 2 — A reference actually reaches the designer

The person attaches a sketch while answering a question. Its thumbnail
appears after upload succeeds. The agent can open the exact attached version
and describe the useful part: the sketch separates receiving from stock lookup.
An inaccessible URL is marked unavailable, not treated as a reference the
agent has seen.

Another agent posts a progress update. The question remains open. The person
goes back, changes a choice, refreshes, and resumes without reentering the
draft. A submitted answer is visible from both clients. An upload or submit
failure leaves the draft available to retry without creating duplicate answers.
Skipping a question records the skip; it does not pretend the missing fact
was supplied.

## Scene 3 — Show the decision worth making

The receiving workflow is uncertain. isocan offers two working wireframes:
one scans continuously into a receipt; the other confirms each item before
the next scan. Both show the same realistic example delivery, at the same
fidelity. It recommends continuous scanning for the brief and explains the
tradeoff: faster batches, with an explicit review step to catch mistakes.

The person can try the key interaction, choose either, combine a specific
idea, or delegate the choice. A delegated choice is recorded as the agent's
decision, not a human preference. Selection keeps the brief and comparison
available and starts the chosen screen's implementation. One undo restores
the previous decision and adoption together.

For an established checkout needing a clearer error message, none of this
ceremony appears. The agent fixes the message in the existing design.
For a new campaign with settled structure but open art direction, the
comparison shows polished first viewports with different composition and
typography. Wireframes would answer the wrong question there.

## Scene 4 — Strong defaults, specific to the work

The first implementation uses believable content and a complete primary
task. Receiving stock includes an empty receipt, validation, a saved result
and a correction path. Large type alone does not make the mobile task work.
The interface gives the task priority and reserves emphasis for the action
that matters.

A reading page uses comfortable measure and clear editorial hierarchy. A
campaign uses a persuasive sequence and supplied evidence. These surfaces
share a standard of craft, not the same cards, gradient or type scale.
Missing photography does not turn into a broken image, and missing customer
proof does not become an invented testimonial.

When the task belongs to an existing repository, the agent inspects its
components, tokens and conventions before adding another implementation.
A standalone HTML prototype remains runnable as a canvas node. A request
for a connected app is delivered in its actual runtime; a decorative HTML
mock cannot silently stand in for a working application.

## Scene 5 — The next screen remembers why

After the person accepts the receiving direction, isocan records the
reusable decisions in the scoped design system: type, spacing, controls,
states and the reasoning that matters. The first screen had a provisional
direction; the next screen has a concrete system to extend.

The person returns through a different agent: “Add stock lookup.” The agent
reads the same audience, accepted direction and component treatments. It
does not ask for the brand again. A system in another group cannot govern
this one merely because it was edited more recently.

If a teammate changes the governing system while a draft is in progress,
the agent sees that its inputs changed. It reconciles the difference before
calling the draft consistent. References in a working folder remain
projections of identified canvas versions, not competing sources of truth.
Cross-project memory changes only through the existing explicit pin flow.

## Scene 6 — Finished means someone tried it

Before handing over the new screen, the agent opens its actual rendered
version, receives stock, triggers a validation error, saves and corrects an
entry, and checks the agreed phone and desktop widths. It catches an
overflowing quantity control and repairs it. A source audit also points to
an existing control treatment instead of merely reporting a nonstandard color.

The person sees the result and a short receipt: what works, what was
checked, and any remaining limit. The detailed evidence identifies the
artifact and governing system versions. Editing either makes the relevant
check stale. A teammate's newer edit is never overwritten by an old repair.

When the current agent cannot inspect a browser, it can still create a
draft. isocan labels it unverified and can route verification to an available,
authorized capable agent. Lack of a browser cannot produce a “checked” badge.
The same status is readable in CLI JSON and on the canvas.

## Scene 7 — Craft expertise without a ritual

An available, compatible Impeccable package helps the agent critique the
hierarchy, refine the interaction and finish the accepted direction. It
receives the same brief, references and design system. The person does not
repeat discovery because a skill started, choose technical commands, or
approve a second plan that says the same thing.

If the package is unavailable or incompatible, isocan continues its own
craft workflow. The detailed receipt distinguishes native package use from
adapted guidance. Extra image generation or additional review agents are
used only when the task and available budget justify them.

## What the scenes force

1. **One shared request and decision record.** Both entrances resume the
   same work; context and answers have identity and provenance.
2. **Adaptive effort.** Ask about consequential uncertainty, default the
   rest, and skip rediscovery for a precise edit. The agent makes a recommendation.
3. **Honest references and useful comparisons.** Real bytes, real previews,
   comparable fidelity, safe selection, and a preserved reason for the choice.
4. **A usable system from the beginning.** Resolve the incumbent first;
   establish a provisional direction before building; preserve accepted
   treatments before expanding to more screens.
5. **A complete task and versioned proof.** Static checks, browser behavior
   and human design judgment answer different questions. None substitutes
   for the others.
6. **A measurable release.** The default changes after the partnership and
   output improve in the evaluation, not when the phase list has enough code.
