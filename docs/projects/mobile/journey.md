---
status: partial
since: 2026-09-13
issue: 182
see: workbench, multi-identity, inbox
note: stage 0 already pans and pinches; the continuation finishes touch controls, a Chat-first phone face and presentation gestures. Physical-phone keyboard, Safari and gesture feel remain acceptance work; handoff and install/share targets are later stages
---

# Mobile — talk, look, present

The [5 September measurement](../../research/2026-09-05-mobile-web.md)
established the design, and Dion chose Chat first on 11 September. This
project holds the continuation's acceptance walk. A phone reads the same
canvas and writes the same comments as the desktop and CLI.

## Journey 1: Ask from the phone

Morgan opens a canvas on a phone. Chat is the first face. Its composer is
visible above the keyboard; Morgan posts a question and sees the reply.
Canvas and Agents are the other two tabs, in that order. Switching tabs does
not lose a draft, change the desktop's panel preferences or write a seen-mark
for a canvas nobody visited.

The Canvas tab is the [node walk](../../research/2026-09-05-mobile-web.md#the-node-walk--the-model-stage-1-was-missing)
added on 13 September. Morgan stands in one item and steps through live
screen edges; an edge is offered exactly when `findNextItem` would move in
that direction. Dead edges do nothing. The current node's thread opens as a
sheet, and pinch-out reveals the spatial plan with that node still marked.
Stepping changes Morgan's view only. Existing spatial ordering supplies the
candidates; a new group-first order is a separate product decision. The Agents
tab uses the existing agent roster; opening an agent's stage reaches the
same viewer. A read-only admission retains its capability and never gains a
composer or editing action that it cannot use.

Chat carries cards for items that the existing request/output relationship
actually connects to a message. Tapping a card enters that node. No geometry
or author/time guess may claim that a message produced an unrelated item.
At entry, a while-away digest uses the prior authoritative seen-mark before
the ordinary visit advances it. Rows open the items or threads they name;
unavailable history is stated, not filled with made-up changes or attendance.

## Journey 2: Touch does one thing at a time

On the Canvas tab a finger pans the empty background and a second finger
pinches around their midpoint. A stationary long press opens the existing
context menu. Movement, a second finger, release and cancellation cancel the
pending menu, so a slow pan or pinch never leaves a surprise menu behind.

At phone width the rail folds to Hand, Comment and a More control. The
controls a person can see and use have distinct hit areas at least 44 pixels
wide and high. Panels and the zoom controls fit at 375 pixels without
horizontal scrolling or overlapping hit areas. The comment control respects
the caller's capability. Touch physics also works at tablet width; a narrow
mouse-driven desktop keeps mouse semantics.

Rotating or widening the viewport restores the desktop face and its saved
preferences. A responsive layout never writes a preference on the person's
behalf. Existing local minimap folding keeps its own measured breakpoint.

## Journey 3: Present the work

Morgan opens a presentation on a phone. In both the viewer and fullscreen
presentation, a tap on the right third advances and the left third goes
back. A horizontal swipe does the same. A gesture advances at most once;
vertical scrolling and gestures on controls or interactive content do not
flip the presentation. The first and last items stay within their bounds.

Notes open as a readable sheet, then close without losing the current item.
Back exits the presentation. The printable deck route keeps its existing
meaning and layout.

## What these scenes force

Width chooses layout; pointer type chooses gestures. Existing operations,
capability checks, Chat, roster and viewer remain the product. No mobile
document model, source editor, device handoff, native app or share-target
work belongs in these three stages.

Drive a real browser with touch input at phone and tablet dimensions, then
repeat at desktop width. Synthetic daemon fixtures must show that a posted
comment reaches the shared record and that read-only access stays read-only.
Emulation proves events and layout; an actual phone is required to judge the
keyboard, Safari toolbar changes and the feel of long press and pinch.
