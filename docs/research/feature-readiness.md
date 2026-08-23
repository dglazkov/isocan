# Eighteen roads out: readiness of the proposed features

**21 August 2026** · [full write-up](https://claude.ai/code/artifact/2754aec1-01e6-4543-bcda-657ff925ed5a)

*Graded 2026-08-21; grades refreshed 2026-08-23 where the build has overtaken
them — the original reasoning is left standing so the calls can be judged.*

Eighteen features, graded by what stands between the idea and a working version
— not by value. Four are assembly, six are a week each, four are blocked on one
decision, three need foundations that do not exist, one needs explaining to me.

## The finding that reorders the list

Items 1–4 (auth, cloud, multiple users, remote agents) are not greenfield. The
repo contains a **multiuser era that was built and then wound back**:
`ae3d227..b2b9f6e` shipped lazy Firestore provisioning, the host daemon as sole
mirror writer, remote projects, a share marker and capability links, and
`cba0a78` reverted all of it — *"the designated-host + Firestore-mirror approach
is off the table."*

That work was not naive: the mirror hung off the engine's op event rather than
its write chain, so an outage could never sit between a person and their canvas;
the schema carried full log entries so a guest's undo worked identically; Google
was hand-rolled REST so no SDK landed in installs of a canvas nobody shares.

The property it could not escape is that **a shared canvas only exists while one
particular laptop is open**. Cloud running is therefore not a sibling of
multi-user and remote agents — it is the thing that design was avoiding.

## Grades

- **Assemble** — pieces are in the tree; days.
- **Build** — design clear, nothing unknown; ~a week.
- **Decide** — one named question blocks it.
- **Foundations** — needs auth, or a daemon that is not your laptop.
- **Define** — the shape is not known; a prototype would be learning.
- **Building / Done** — overtaken by events since this was written; see the note.

| Feature | Grade | Note |
| --- | --- | --- |
| Self-hosting (isocan on isocan) | Assemble | binding exists; 2–3 days |
| Trigger agents on events | Assemble | `wait --item/--op` exists; needs a runner + durable triggers |
| Design systems | Assemble | shipped since: DESIGN.md, tokens, CSS, linter |
| Share/compare skills | Assemble | `--from` shipped; `command diff` is the missing half |
| Personas | Build | an actor + skills + instructions, as a canvas item |
| Point a canvas at a repo | Build | read model, not sync; the smart part is a skill |
| Chat surfaces (Slack/Discord/Chat) | Build | outbound-only bridge needs no auth — cheapest path to "from my phone" |
| GitHub commit/push | Build | never auto-push, never to a default branch |
| Design taste (impeccable) | Build | first slice shipped; next is the checkable half (axe, contrast, visual diffs) |
| Multiple users / remote agents | **Building** | phases 1–5 done; a dev home serves a real canvas from Cloud Run today |
| Authentication | **Building** | decided and under construction: the badge (phase 2) and actor binding (phase 3) have shipped; attesters are Firebase Auth — magic link, Google, GitHub |
| Components | Decide | is an instance a copy or a reference? recommend copies with drift detection |
| Stitch loop skill | Decide | depends what the loop exchanges — HTML is small and good, screenshots are weak |
| agents-ctl mesh runner | Decide | unread; send a link |
| Cloud running | **Done (dev)** | dev.isocan.io serves from Cloud Run off Firestore; push to main deploys it |
| Mobile access | Foundations | try the chat bridge first — a phone is a bad infinite canvas |
| Self-improving loops | Define | make outcomes legible first, then see what wants to close |

## What holds up what

Ten of the eighteen need nothing from the keystone. Auth blocked exactly three
(multi-user, remote agents, mobile) — and as of 22 Aug it no longer blocks them
in principle: the badge is minted at the door and every surface carries it.
What the report said about unchecked actors ("every op carries its actor in the
request body unchecked") was true of the localhost daemon and is no longer true
of the home.

## Recommended order

1. **Self-host** — turns every remaining gap into something felt rather than planned.
2. **Personas** — multiplies the others: skills and voice travel with the project.
3. **Durable triggers** — agents that are already watching.
4. **Decide the auth model** — not build; decide. The reverted branch says guessing wrong costs a month.

## Open questions

- ~~What actually killed the mirror approach?~~ **Answered** by
  `docs/architecture.md`, written after this report: the reversed design put
  Firestore *between clients* — "a mirror and mailbox the protocol depended
  on". That is the fault. It made a third party part of the protocol, which
  breaks the commitment that any innkeeper can serve isocan, and it put a
  second writer beside the single one. The replacement keeps the same
  technology and moves it: Firestore sits *behind* the home daemon as its disk,
  no client ever touches it, and the protocol never learns it exists. The
  lesson generalises past Firestore — a backing store is a deployment detail,
  and the moment clients can name it, it is not.
- What is agents-ctl? *(still open — needs a link.)*
