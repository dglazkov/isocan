# The guide in tiers — the proposed cut

**18 September 2026.** Phase 4 of [phases.md](phases.md) opens here and stops:
what is core and what is a topic is a judgement about what an agent must know
*before her first act*, and design.md's open door 2 says that judgement is
Dimitri's. This is the proposal, with the numbers it rests on.

## What the guide costs today

`packages/cli/src/agent-guide.md` is 184 KB, **about 46,700 tokens**, and the
eight module guides append roughly 3,000 more. There is no way to ask for part
of it. Journey 3's number is that the summons carries it on every model call of
a turn: in the 146-second turn #332 measured, three of ten shell calls were
`--help`, and the guide rode along each time.

Token counts below are characters over four — the same rough measure
throughout, so the proportions are right even where the absolute is not.

## The proposal in one line

**A core of about 6,000 tokens, an index of about 400, and 46 topics.**
`isocan --agent-help` prints core plus index; `isocan --agent-help <topic>`
prints one topic; module guides become topics. That is **an eighth** of what an
agent reads today before her first act.

## The core (recommended)

Everything an agent needs to arrive, say who she is, do one thing, say what she
did, and park. Nothing that is about a *kind* of work.

| tokens | section | why it is core |
| ---: | --- | --- |
| 98 | (preamble) | what this document is |
| 788 | Orient (once per session) | the first command of every session |
| 1086 | Your name | she cannot act unnamed |
| 1143 | The session protocol | the loop itself |
| 857 | Who is at your terminal | who she is answering to |
| 863 | Parking is a foreground call | `isocan wait` is how a turn ends |
| 587 | What is addressed to you | `isocan inbox` — how she finds the work |
| 299 | When you need a person | the escape hatch, needed before it is needed |
| ~500 | *the opening of* Practices that earn trust | terse comments, and presence that follows the work |
| ~400 | the topic index | every topic named, one line each |
| **~6,600** | | |

The last row is the one that makes this work: a topic nobody is told about does
not exist, which is `surface.test.ts`'s rule wearing a different hat.

## The topics

Everything else, one topic per current `##`, in the order they stand. The five
that dominate:

| tokens | topic | note |
| ---: | --- | --- |
| ~9,400 | the design stack | the bulk of "Practices that earn trust" is `design brief` / `receipt` / `questions` / `audit` / `repair`. It is specialist work and reads as a manual, not a protocol. **Splitting this one section is most of the win.** |
| 4,435 | Quick reference of the whole surface | every verb, in one place. Its own topic, and the one a stuck agent asks for |
| 2,701 | Making an image | |
| 1,671 | One shared review and bounded repair | belongs with the design stack |
| 1,645 | Standing agents | |

And 41 more between 87 and 1,576 tokens: Scripting, Your bench, The Chat, Words
on the canvas, Choosing between variations, Where the seams are, Saying what
matters here, The slide deck, Modules, Tools, Sprints, Groups, Sharing, Spaces,
Passes, the refusals, and the rest.

## The three judgements this asks you to make

1. **Is `Saying what matters here` core?** It is `isocan context pin/exclude`
   — what an agent reads before it starts — and at 1,284 tokens it would take
   the core to ~7,900, which is under phase 4's 8,000 bar but with no headroom.
   Recommended as a topic, named in the index as the first one to read.
2. **Does the core name every verb, or only the loop's?** The recommendation
   above is the loop's only, with `Quick reference` one command away. The
   alternative — folding the quick reference into the core — is 4,435 tokens
   and would put the core at ~11,000.
3. **Where does "Practices that earn trust" break?** The recommendation keeps
   its opening (comments are read in a small thread window; presence follows
   the work) and moves the design stack out. Its opening is the most
   behavioural writing in the guide and the part that least resembles a manual,
   which is the argument for keeping it in the core.

## What phase 4 builds once this is settled

`isocan --agent-help` prints core and index; `isocan --agent-help <topic>`
prints a topic; module guides are topics. `surface.test.ts` is restated: every
registered command appears in the core or in a topic the index names. A budget
test holds the core under 8,000 tokens by a stated count. Separately, the rc's
summons carries the comment's thread and the id, kind and title of the item it
is on, so "make it blue" can be answered in three shell calls.
