# The identity desk

The first of the [journey](../multiuser-journey.md)'s open debts, taken up.
The journey stays ground truth for the *experience*; this doc owns the
*mechanism* — who may enter a canvas, what credential anything presents, and
how an actor claim is vouched across surfaces. It is written as an
inventory of **missing mechanisms**: the things that must exist for the
scenes to be true, none of which exist yet.

Status: **inventory**. Nothing here is designed; this is the work list and
the constraints it must be designed under.

## What the journey already fixed

Decisions the scenes forced, which any mechanism must honor rather than
reopen:

- **People enter through one origin** — the home's web app; the local
  daemon serves ops to CLIs, never pages to persons.
- **An actor is minted on arrival, never provisioned by the invite**
  (Scene 3). Nobody exists on a canvas before they enter it.
- **Authenticated identity only changes how an Actor is minted** (Scene 5's
  rule). The desk hardens the door; it does not restructure what stands
  behind it.
- **Credentials flow outward from an admitted session**, never typed inward
  at doors (the escalation pass, Scene 5). The one place this inverts —
  Scene 7's standing registrations — is mechanism 11's problem, not a
  license.
- **The grant grants exactly what the sentence named** (Scenes 1–2), and
  **sharing is daemon-API parity, not an op** — the oplog never records
  grants.
- **Presence tells the truth** — which, at a shared home, quietly depends
  on this desk (mechanism 5).
- Lean, not yet a decision: **borrow accounts rather than mint them.**
  Mechanism 3 is where it must become one.

## Where the desk stands today

The address is the secret, and the daemon believes every field it is
handed. Concretely, in code:

- The door checks nothing but the URL; the WS connect carries only a
  `projectId` (`packages/server/src/ws.ts`).
- Every op's `actor` is client-supplied (`PostOpRequest.actor`), and
  `actor.claim` with `as:` reassigns any actor to any session key.
  `engine.ts` says so out loud: "there is no authentication here, and a
  daemon that only listens to one machine's people and agents does not
  pretend otherwise." Honest on localhost; the home removes the premise.
- The browser's identity is localStorage the code itself calls "memory,
  not authority" (`packages/web/src/lib/identity.ts`).
- The CLI stubs the credential slot it doesn't have: "Future: an `auth`
  block" (`packages/cli/src/identity.ts`).

## The missing mechanisms

Numbered for cross-reference; each names the scenes that need it.

1. **A session the home can recognize.** Some artifact minted at admission
   that the home can check later. Upstream of everything below — passes
   (Scene 5), grants (Scenes 1–2), and registrations (Scene 7) all say
   "admitted session," and no such checkable thing exists.
2. **A door that can tell holders apart.** Enforcement of grants needs
   per-caller credentials at entry — a different door than address-as-
   secret, not a hardened one. Until it exists, the Scene 1–2 grant stays
   recorded intent.
3. **A grant subject type.** Something a grant binds to — account, email,
   key — so "revoke Jordan" can point at anything. This is where the
   borrow-vs-mint-accounts lean becomes a decision.
4. **Revocation.** Un-share, expel, rotate. Structurally impossible under
   address-as-secret; becomes possible only after 2 and 3.
5. **Server-side actor binding.** The home stamps ops and presence with who
   the *connection* is, instead of trusting the asserted `actor` field.
   Turns `comment.update`'s "only the author," actor-scoped undo, and
   honest presence from conventions into enforcement.
6. **Person resumption across browsers.** A way for Jordan's phone to *be*
   Jordan. Today the honest path is refused (name taken) and the dishonest
   one (`as:`) is open to anyone — exactly backwards.
7. **Pass → durable credential exchange.** The Scene 5 pass is single-use
   and short-lived; the daemon it enrolls reconnects for months. What the
   pass exchanges into — lifetime, storage, scope, revocation — is unnamed.
8. **A bootstrap credential.** Scene 0 reaches the home before any admitted
   session exists; the flow-outward rule cannot mint its own first link.
9. **A repo-membership check.** Scene 6's "the committed marker admitted
   her" currently reduces to URL-knowledge; "can read the repo ⇒ admitted"
   needs a real mechanism.
10. **Scoped registry / tenancy.** The actor registry (names, claims,
    colors) is per-home, and claims consult every project on it
    (`Engine.heldNames()`). On a multi-tenant home that is cross-tenant
    name collision and leakage. The registry's scope must be chosen.
11. **Bounded standing mint** (Scene 7). Registrations mint passes with
    nobody present. Scope and revocation of that power is this desk's half
    of the launch-custody debt.

## Order of attack

**1 first** — everything leans on "admitted session" being real. Then **3
and 2** (choose the subject, then build the door that checks it), then
**5** (bind actors to connections). The rest hang off those: 4 falls out of
2+3; 6, 7, and 8 are shapes of 1; 9 is a special credential under 2; 10 is
a scoping decision 1 forces anyway; 11 waits on 7's credential shape.
