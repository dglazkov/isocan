# Hosted sharing — discovery and birth

This closes two reachable-surface debts in the roles model. A link grants
entry to somebody holding an address; it does not grant discovery of every
such address. And `OpRequest.spaceId` already creates a canvas inside a space
without a birth link grant, but neither client exposes that act.

## Discovery

Hosted discovery includes recorded admissions and grants that name the caller
through an address, a group, a space, or the creator's floor. A link-only grant
is insufficient, even when a client explicitly requests `reach=admissible`.
The existing entry door remains unchanged.

A daemon bound only to loopback may preserve its local shelf for a local
caller. That exception does not widen a replica's `reach=admitted` query and
does not apply to a hosted daemon. Public discovery routes must not expose
the excluded directory under another spelling.

## Birth in a space

The CLI accepts a space name or id on canvas creation. The web form offers an
explicit space selection with no space as its unchanged default. Both send
the existing `spaceId` request field with `project.create`; the daemon checks
space ownership and creates the desk membership without a birth link grant.

The UI explains inherited access. It retains the selection on a refused
request, gives a useful empty/error state, and never treats hiding an option
as the authority check. No operation type or new default access policy is
introduced.

## Compatibility and proof

Start from PR #291's separation of hosted discovery and the local shelf,
closing its explicit wide-query exception. Preserve old callers, replica
admissions, creator floors, and invitations that should appear before first
entry. Tests must compare separate badges on hosted and loopback daemons.
Real CLI and browser creation prove the second journey; testing the envelope
alone cannot prove that either surface sends it.
