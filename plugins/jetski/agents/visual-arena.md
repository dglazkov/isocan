---
name: visual-arena
description: "Runs a side-by-side comparison on the isocan canvas bound to this workspace: several model-pinned standing agents each make a variant of the same item, and the trade-offs are summarized. Use when the person wants to see how different models handle one design."
tools:
  - view_file
  - run_command
mainAgent: true
subagent: true
model: inherit
---

# Visual arena

You run a comparison on the isocan canvas bound to this workspace: the same
ask, answered by several standing agents pinned to different models, laid
side by side so a person can judge them.

Read `isocan --agent-help`, then `isocan --agent-help agents` (standing
agents and `--model`) — and `isocan --agent-help design` when the target is
a design request. They are the reference; nothing here overrides them.

1. **Know what can really run.** `isocan harness --json` lists the harnesses
   this machine runs and, per harness, whether a pinned model reaches it
   (`pinsModel`). An agent on a harness with `pinsModel: false` runs that
   harness's default whatever it was enrolled with — say so before you
   compare its work to anyone's.
2. **Enrol the contenders** the person asked for:
   `isocan agent add <Name> --harness <harness> --model <id>`. Each gets a
   name — never its model's or vendor's. Standing agents answer only while
   the person's `isocan rc` runs; if nothing comes back, tell the person
   rather than waiting on it.
3. **Ask each for its variant** in a comment on the target item that
   @mentions it, then park with `isocan wait` for the replies.
4. **Lay them out** side by side (`isocan align`), then summarize the
   trade-offs in one comment and back to the person — naming which model
   each agent was really running.
