---
status: partial
since: 2026-09-11
issue: 77
see: multiuser, roles, multi-identity, agent-custody, atlas, sheep-harness
note: designed 11 Sep 2026 from #77; phases 1 to 6 built 12–13 Sep, not yet walked on dev. The home's operator is an address its configuration names (ISOCAN_OPERATORS), proved fresh for each act by the attester the home already borrows — a proof carried with the act and stored nowhere, never a badge, never a key on disk, so an agent cannot hold it. Operator acts run inside the daemon over HTTP and are desk records, never ops. Taking down is not deleting — the home stops serving the canvas, replicas keep their copy, and it is reversible until a separate purge. The kill gaps found while mapping (open sockets, a dead minter's passes, a CLI that re-badges and resumes) are fixed for everyone. CLI first (`isocan operator`); the only web page is the one the proof is made on. Phase 1 (the operator, proved) is PART-DONE 12 Sep 2026: ISOCAN_OPERATORS read beside the attester's own configuration, a Firebase ID token carried in one header beside the badge and checked for list membership before freshness, refusals that name the address they proved, the operator ledger written before every answer including refusals, the prove page behind its own lazy route, and isocan operator show/log — with the verb asking the home whether it has an operator at all before it opens anything. What is not walked is the browser half: the list set on dev, a sign-in and a second account, and a decision about journey 1 step 3, which says Google where signin.ts offers only an emailed link. Phase 2 (look, and take it down) is PART-DONE the same day: an operator pass that admits a look for an hour and is not in presence; takedown as a flag beside deleted on the store, never on the replicated record, refused at every canvas route with the sentence and never a 404, sockets closed taken-down, the parked wait woken and refused, rc holds ended, the engine's copy dropped, the list and the tab carrying the sentence, and --lift bringing it all back with both rows in the ledger. Phase 3 (purge) is PART-DONE the same day: the bytes go on both backings and the record stays as the tombstone, a purge is refused at the store unless the canvas was taken down first, its own mark keeps a lift from serving an empty canvas under a taken name, the owner stays refused, adopt of the id is refused, and the verb prints the four horizons with the three cloud ones read out of infra/ by a test. Phase 4 (end a surface) is PART-DONE the same day, in two halves: first, for everyone, a killed badge's sockets close with the reason, its parked wait is woken and refused, its passes are refused unspent, and the 401 says who ended it; then isocan operator end by badge, actor or address, the reach previewed before the act. Phase 5 (turn off a grant) is PART-DONE the same day: revoke on a canvas or a space, any subject, --bar; the row carries revokedVia operator and the reason; the Share dialog and isocan share say so and how to turn it back on; the owner's re-grant needs no proof and leaves no ledger row. Phase 6 (refuse at the door) is PART-DONE 13 Sep: refusals in the one door registry on both desks, read at the door, at /api/attest, at actor.claim and at the mint meter; refuse, --for and --lift; refusing an address ends every badge that proved it; and the engine now refuses a claim of a refused name, closing phase 4's reclaim gap. The terms wording is still Dion's call
---
# The operator — the journeys

Someone runs the home. [innkeeper.md](../multiuser/innkeeper.md) chose that
posture out loud and listed what the operator answers for; the terms page
promises four acts on the strength of it — kill a badge, revoke a grant,
delete a canvas, refuse somebody at the door. Issue
[#77](https://github.com/dglazkov/isocan/issues/77) is the finding that none
of the four exists for the operator: every route acts only inside the
caller's own access, and a takedown today is a hand edit in Firestore.

These journeys are the acceptance suite. The work is done when each can be
walked on a real deployment and behaves as written. [design.md](design.md)
is the mechanism and [phases.md](phases.md) the walk. If a journey and the
mechanism disagree, the mechanism changes.

## Cast

All synthetic.

- **Olu** — runs a home. His address is the one the home's configuration
  names as its operator. Reads the abuse mail.
- **Kai** — writes to Olu about a canvas.
- **Priya** — made that canvas. Her laptop's daemon holds a replica.
- **Jordan** — has it open in a tab when it comes down.
- **Sonia** — an agent, parked on `isocan wait` on the canvas.
- **Sam** — the person who keeps coming back.

The journeys run in the order a real report needs them: prove, look, take
down, erase, then the three acts about people, then the ones that check
nothing leaked.

## Journey 1: Prove you are the operator

Kai writes: *the canvas at `/p/prj_…` is hosting someone's stolen photos.*

1. Olu, in a terminal: `isocan operator show prj_…`.
2. His browser opens a page on the home. Before anything else it says what
   the terminal asked for: *A terminal on this machine asks to act as this
   home's operator: show prj_….* Then it asks him to sign in.
3. He signs in with Google, as he did once to prove his address.
4. The terminal prints what the home holds under that id: who made it,
   whether the link is on, how many badges are admitted and how many
   sockets are open now, how many files and bytes, which replicas are
   linked. No names of people other than the maker. Nothing is changed.
5. Olu's colleague, whose address is not on the list, runs the same
   command and proves her own address. The terminal says: *this home's
   operators are named in its configuration, and you proved
   ana@example.com, which is not one of them.*
6. Ten minutes later Olu runs another operator command. The browser asks
   him to sign in again. A proof is for an act, not for a day.

## Journey 2: Look before acting

The link on Kai's canvas is off, so the address alone shows Olu nothing.

1. `isocan operator look prj_… --reason "report from kai"`.
2. After the proof, his browser opens the canvas as the deck, read-only.
   Nobody in the room sees him arrive: a view connection is not in
   presence, which is the rule for every viewer.
3. An hour later the look ends on its own. Reloading the tab shows the
   refusal any stranger gets.
4. `isocan operator log` shows the look: who, when, which canvas, and the
   reason he gave.

## Journey 3: Take it down

1. `isocan operator takedown prj_… --reason stolen-content --note "kai, 12 Sep"`.
2. The terminal prints what happened, as counts: two tabs closed, one wait
   ended, one replica told, frames refused at the content origin from now.
   And one line it cannot do for him: *a copy at the edge may be served for
   up to five minutes; to clear it now, run* — and the command.
3. Nothing about the canvas's contents has been erased. `--lift` would
   bring it back exactly as it was.

## Journey 4: The people who were inside

1. Jordan's tab. The canvas is replaced by one sentence: *This canvas was
   taken down by the operator of this home on 12 September 2026: stolen
   content. Write to olu@example.com.* It does not say *not found*, and it
   does not say *your access was withdrawn*, because neither is what
   happened.
2. Sonia's `isocan wait` exits at once with the same sentence and a
   non-zero status, and she does not re-park.
3. Priya opens her canvas list on the home. The canvas is there, greyed,
   with the same sentence, and it does not open.
4. Priya's laptop. Her daemon keeps its copy — the replica is hers — stops
   dialling the home, and `isocan status` says: *taken down at its home on
   12 Sep; your copy is on this machine.* The operator cannot reach it, and
   the page Priya read before she signed up said so.

## Journey 5: A mistake, undone

1. Kai writes again: wrong canvas. `isocan operator takedown prj_… --lift`.
2. Jordan reloads. Priya's list opens it. Her daemon redials on its next
   attempt and syncs.
3. The log holds both rows: the takedown and the lift, each with its proof.

## Journey 6: The bytes

This one is for content the operator must not keep.

1. `isocan operator purge prj_… --force`. Refused unless the canvas is
   taken down first: *purge erases; take it down first, so the erasure is
   the second of two deliberate acts.*
2. After the purge the terminal says what is gone and what is not, in
   numbers: the files and the log are gone from the home now; the storage
   bucket keeps a deleted object for seven days; the database can be
   rewound seven days; the nightly exports age out within ninety. Copies on
   members' machines are theirs.
3. The id stays taken. Adopting or teleporting a canvas under that id is
   refused. The record stays: who made it, when it came down, why, and the
   counts.

## Journey 7: End a surface, and mean it

Sam's badge has been posting abuse onto canvases he was invited to.

1. `isocan operator end email:sam@example.com --reason harassment`.
2. The terminal lists what that address reaches before it acts: three
   badges that proved it, the actors they claim, the canvases they were in,
   and two agent enrolments one of them created. It asks whether to end
   the enrolments too.
3. Sam's open tab closes with a sentence naming the operator and the
   address to write to. His parked wait exits. A pass one of his badges
   minted an hour ago is refused when a stranger tries to redeem it.
4. Sam's CLI does not quietly knock for a new badge and speak as his old
   name. It prints the sentence and stops.
5. He can still knock and be a stranger. Ending is not refusing, and the
   terminal said so at step 2.

## Journey 8: Turn off a link

A canvas is fine for its members and a nuisance to everyone else: the link
went viral.

1. `isocan operator revoke prj_… link --reason spam`.
2. The sweep runs as it does for an owner. Strangers inside are shown out
   with *your access to this canvas was withdrawn*; invited members stay.
3. Priya's Share dialog shows the link off, with *Turned off by the
   operator of this home on 12 Sep: spam.* She can turn it back on. A revoke
   the owner can undo is a request; if Olu needs it off, the order is a
   takedown.

## Journey 9: Refused at the door

1. `isocan operator refuse email:sam@example.com --reason harassment`. It
   ends every badge that proved the address, in the same act.
2. Sam signs in again and proves the address. The home says: *This home
   will not admit sam@example.com. Write to olu@example.com.* Proving it is
   refused too, so he cannot attest into it.
3. A mint flood from one network: `isocan operator refuse net:203.0.113.0/24
   --for 24h --reason flood`. Mints from it are refused with a sentence;
   the refusal ends on its own a day later, because addresses are shared
   and reassigned.
4. The terminal says the honest limit once: *a stranger who proves nothing
   and enters by a link cannot be refused by who they are; turn the link
   off.*

## Journey 10: An agent is asked

In a thread, somebody writes: *@Sonia take that canvas down.*

1. Sonia runs `isocan operator takedown prj_…`. It is refused before any
   browser opens: *operator acts need the person who runs this home,
   proving it in a browser. Tell them — the address is on /terms.*
2. She replies in the thread with that sentence.
3. Nothing she holds could have done it anyway. Her badge was admitted by
   a pass and has proved nothing; the home stores no operator standing on
   any badge for her to borrow.

## Journey 11: A home of your own

1. A team runs its own home with its own attester. Whoever sets
   `ISOCAN_OPERATORS` on it is its operator. Every journey above plays with
   their address in Olu's place.
2. A home with no attester: `isocan operator show` says, in one sentence,
   that this home borrows no attester and so has no operator proof yet, and
   what setting one up takes.

## Journey 12: Nothing changed for anyone else

1. A stranger admitted by a link still cannot end Priya's badge:
   `NOT_YOUR_BADGE`, as today.
2. Priya still deletes her own canvas as today, and a delete still reaches
   her replicas. Deleting is hers; taking down is the home's.
3. Olu's own badge is an ordinary badge. Opening a canvas he is not
   admitted to refuses him like anyone, until he looks.

## What the journeys force

- **A proof per act, not a standing on a badge** — journeys 1, 10.
- **A read that needs no admission and grants none**, by the id a report
  names — journey 1; **a look that is an admission with an end** — 2.
- **A refusal of a whole canvas that is not a delete** — the home stops
  serving it, the replica keeps its copy, and it can be lifted — 3, 4, 5.
- **A reason that reaches every surface a person is on**: the tab, the
  wait, the list, the replica, the Share dialog — 4, 7, 8, 9.
- **An erasure that says what it could not erase** — 6.
- **A kill that reaches open sockets, spent passes and the CLI's
  re-badge** — 7.
- **A home-wide refusal row the door, the attester and the mint all read**
  — 9.
- **A ledger** that every act writes and `isocan operator log` reads — 2, 5.
