---
status: partial
since: 2026-09-13
see: roles, multiuser, switcher
note: discovery verified 13 Sep across hosted listings and known-address entry; CLI and browser space creation/refusal proved, with the native selector gesture still requiring a browser walk
---

# Hosted sharing — the journeys

The access model already exists. What remains is reaching it without a
hosted list revealing addresses that were meant to be shared deliberately,
and without creating a link-open canvas before moving it into a private space.

## Journey 1: One invitation does not reveal the home

Maya owns several canvases. Rowan follows the address of one link-open
canvas and enters it. Another account has entered none.

1. Rowan's home list shows the canvas they entered and any canvases shared
   with them by name, group or space. It does not show unrelated link-open
   canvases. The other account cannot enumerate those canvases either.
2. Asking the listing API explicitly for `reach=admissible` gives neither
   account a directory of link-only canvases. Other public discovery lists
   preserve the same boundary.
3. Following a known link still enters the canvas at the link's capability.
   Listing and entry answer different questions.
4. Maya's loopback-only daemon still shows the canvases it holds to its own
   local browser and CLI. Replica admission-only listing stays narrow.

Acceptance requires actual HTTP requests from separate synthetic badges,
plus a browser home-list walk. Both the ordinary and explicit listing modes
must be exercised on a daemon configured as a hosted home.

## Journey 2: A private space stays private as it grows

Maya owns the Design space and has invited Rowan. Its canvases are closed to
link-only entry.

1. Maya chooses Design while creating a canvas in the web app. The new
   canvas appears in that space and starts with no birth link grant.
2. Rowan reaches it through the space's invitation. An unrelated account
   cannot enter it merely by learning its address.
3. Maya performs the same act with `isocan canvas create --space Design`.
   Membership and access match the web-created canvas.
4. An account without ownership of the space is refused creation there by
   the daemon, including a caller bypassing the UI.
5. Choosing no space preserves ordinary canvas creation. A failed create
   leaves the form's intended space available for correction and retry.

The space is request metadata held by the desk. It is not a new canvas
operation and must travel with creation, never as a later move.
