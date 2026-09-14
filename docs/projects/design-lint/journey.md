---
status: partial
since: 2026-09-14
issue: 299
see: design-competition, evals
note: phases 1–3 deliver parsed diagnostics, conditional repair and scoped recipe contracts on both surfaces, including policy edit/undo and native/DTCG preservation. Optional repository checks are next; approved paid evaluation follows the no-spend harness.
---
# A design check that gives the next edit

## 1. Find the real departure

A person opens a synthetic Acme screen whose padding is 13px and whose text
uses `var(--missing)`. The governing DESIGN.md declares 16px spacing and a
named ink color. The report points to the declarations, explains the missing
reference and offers the real exported spacing name. A hex string in the
paragraph is ignored. External CSS and dynamic styling are visibly unexamined.
The agent reading the same screen receives the same findings and provenance.
A screen inside a nested group follows that group's system; a linked inherited
system remains attributed to its source canvas.

## 2. Repair and keep another person's edit

The person adds the screen through the browser. Its findings are available
after save, just as they are after CLI add/update, including JSON callers.
Opening a finding selects its source location. The person makes an explicit
repair and receives a fresh report. The accepted content is one version and
one undo. An agent can supply repaired HTML against a captured version through
the CLI. If somebody edits the screen in between, the stale repair is refused
and the newer content remains. No model call or policy change is implicit.

## 3. Two systems stay different

Two nested groups hold different DESIGN.md documents. One allows exact
literals; the other requires references and gives a Button recipe ownership
of padding and radius while allowing placement. A title recipe permits size
changes while retaining weight. Explicit HTML markers name recipes and approved
treatments. Both clients expose the effective policy and its source. Editing
the governing document, including an exception with a reason, creates an
ordinary version that can be undone. Unknown extension data survives supported
round trips or its unsupported conversion is explained.

## 4. A repository brings its own checks

A connected Tailwind v4 repository opts into the pinned shadcn adapter. The
runner reads that repository's theme and components and reports findings with
relative source locations. An HTML file or missing Tailwind installation
produces an unsupported or unavailable result, never a clean success. Existing
project configuration remains authoritative. Other stack-specific tools are
recommendations until their adapters have executable compatibility evidence.

## 5. Measure what the feedback changed

The same synthetic drafts are repaired under rules-only and rules-plus-findings
conditions with equal budgets. The report separates compliance, coverage,
false positives, system changes, latency and model spend. Rendered task intent,
interactions and human preference remain separate. No empty page or policy
weakening counts as success. A dry run proves the harness without spending;
paid runs and human judgments are recorded only after they actually happen.

## What the scenes force

One shared analyzer and governing-system resolver; source and rule versions;
honest partial coverage; explicit, conditional content edits; declarative
versioned contracts; optional Node tooling outside browser core; measured
compatibility before adoption; and no inference from lint compliance to taste.
