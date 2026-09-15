---
status: partial
since: 2026-09-15
issue: 316
see: bench, sheep-harness, standing-agents, agent-custody, on-demand, room
note: walked 15 Sep 2026, on a real canvas with a real Cloudflare account — an agent moved from a laptop to an always-on machine and answered from there. Three things were proved that no test covers: `isocan pass --agent` redeemed by `isocan setup` hands an agent's identity to a second machine (the piece `standing-agents` deliberately left); two machines join ONE sheep home and see the same cells; and the custody split holds visibly — identity crosses, harness and cwd do not. Three sharp edges found, one of them a likely bug: `rc listen --to` reported success and the grant is not at the home. The other two are `--default-harness` being machine-wide and `rc add` resetting a listen grant as a side effect of setting a harness.
---

# A sheep on two machines

**15 September 2026.** A walk, not a design. Everything here happened on
`[isocan] History` (`prj_Gi8oGKNALt`) against `isocan.io`, with a real
Cloudflare account and real container minutes.

The goal was Dion's: *"a sheep that is always available"* — an agent that
answers when the laptop is shut. This is what happened on the way, including
the parts that did not work.

## What was proved, and had no test

**1. An agent's identity can move to a second machine.** `isocan pass --agent
Dolly` on the laptop, the printed pass-bearing address redeemed by `isocan
setup '<address>'` on the cloudtop, and afterwards the cloudtop's `isocan who`
showed Dolly `answerable` with no *"not held by this machine"*. Her actor id
was unchanged: `usr_eJuIFLPIbf` before and after.

This is the piece [standing-agents](2026-08-30-standing-agents.md) closed four
phases with *"deliberately left"*, and the piece
[agent-custody](../projects/agent-custody/design.md) still lists as open under
"a dead machine's agent". It works. It had **no test and no walker**, and the
instruction printed beside the pass points at `collie new --pass` — a host that
does not exist — so nobody had come this way before.

**2. Two machines share one sheep home.** `sheep setup` on the second machine,
same Cloudflare account token, and it joined the station the account already
had rather than deploying a second one — as its own help says it would. The
proof is `sheep ls` on the cloudtop listing the cell the laptop had minted,
same session id. One Worker, one Durable Object, one container application,
two machines.

**3. The custody split held, visibly.** Dolly arrived on the cloudtop as kind
`agent`, not `sheep`. The pass hands over the *identity*; the harness and cwd
are the machine-local half and **do not replicate** — exactly what
`packages/cli/src/rc.ts` says, seen in the wild rather than argued. She needed
a harness named on the new machine before she was a sheep again.

**4. The bench's best-effort rule earned itself on first contact.** Enrolling
printed *"Its bench could not be read … so no row was written"* and **enrolled
anyway**. That is [the bench](2026-09-14-the-bench.md) phase 3's rule — the
registry must never break the act it records — meeting a real canvas hours
after it shipped.

## Three sharp edges

### 1. `rc listen --to` reported success and the grant is not there

**The one to fix — filed as [#316](https://github.com/dglazkov/isocan/issues/316).** On the cloudtop:

```
isocan --canvas prj_Gi8oGKNALt rc listen Dolly --to usr_NqnR80M_lu
Dolly listens only to you — on 1 canvas ([isocan] History). A running
`isocan rc` reads this on its next lap; nothing needs restarting.
```

That line is the **write** path (`main.ts`: it prints only after
`written.length > 0`), so the gesture ran and touched one canvas. Reading the
grant back from the home afterwards — `ISOCAN_DIRECT=https://isocan.io isocan
… rc listen Dolly` — says `listens only to you`. The grant is not there.

**What is ruled out.** It is not an unresolved target: `resolveListen` throws
`nobody on this canvas answers to "<who>"` and no such error appeared. It is
not the name: an actor id behaved identically. The same gesture, with the
name, **worked on the laptop** — where the CLI reached the home directly
rather than through a local replica.

**What is not known**, and should be found rather than guessed: whether the op
never left the cloudtop, whether it was written and the read-back is stale, or
whether something else. The difference between the machine where it worked and
the one where it did not is `ISOCAN_DIRECT` versus a local daemon and replica.

**Why it matters more than its size.** This is the gesture that decides whose
word may spend somebody's tokens. It reported success. The person who runs it
has no reason to check, and the failure is invisible until the grantee's
summons quietly does nothing — which is the *"summons into silence"* the whole
bench project exists to eliminate.

### 2. `--default-harness` is machine-wide, and re-homed an agent nobody asked about

Setting `isocan rc --all --default-harness sheep` on the cloudtop so that
*Dolly* would run as a sheep also caught **Scout**, an unrelated agent held by
that machine whose row named no harness. Scout went from `agent` to `sheep` —
a different runtime, in a container, on a different bill.

The rule is documented (*"an agent enrolled without a harness named runs on
this machine's default"*) and the flag is per machine, so this is behaving as
designed. It is still a sharp edge: the person asked for one agent to be a
sheep and got every silent row on the box.

### 3. `rc add` resets a listen grant as a side effect of setting a harness

`rc add Dolly --harness sheep` was the way to name a harness on a row that
arrived by pass. It resumed the same actor — no doubling, the "one machine,
one Dolly" rule held — and it **dropped her listen grant**, because
`agent.enroll`'s contract is *"re-enrolling an enrolled actor updates the
record in place (the rules change; the standing was already there)"*.

Correct by its own lights, and the exact mirror of `agent.invite`, which
**preserves** `rules` so a re-join cannot widen or narrow who may summon (the
bench, phase 1, mutation-tested). Two ops, opposite behaviour, both right.
What is missing is a third thing: a way to set a row's harness that touches
nothing else.

## Two smaller things seen on the way

- **Two actors can wear one name.** `Scout → usr_eP709VeUL3` and `Scout →
  usr_9SGTtKaRcv` both stand on that canvas, which is why the rc narrates
  *"Scout is not held by this machine"* twice. `@Scout` is ambiguous there, and
  whichever actor a mention resolves to is an accident. Almost certainly one
  agent enrolled from two machines, each deriving its own key for the name.
- **The CLI notices build skew and says so.** *"this copy is 3385707; your home
  runs c09f0a7 — your home is the older build"*, unprompted, on an ordinary
  command. Worth keeping: it is the only thing that tells a person their CLI
  and their home disagree, and the version string cannot (both say `0.1.0`).

## What this leaves

Dolly is held by the cloudtop, runs as a sheep in a cell at a home both
machines share, and answers there. The laptop is no longer load-bearing for
her. What is still not true is journey 4: she is *run* in a cell but *woken* by
a parked `isocan rc` on a machine, and that machine is now a cloudtop instead
of a laptop. That is better — a cloudtop does not close its lid — but it is
not the rc in a cell, and the thing that would prove it worth building is still
the number [sheep-as-standing-agents](2026-09-08-sheep-as-standing-agents.md)
phase 3 asks for: what a night of long-polling actually bills.

The setup to measure that now exists, which it did not this morning.
