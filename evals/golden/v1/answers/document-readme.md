# Orders

A single screen that lists what has been ordered, grouped by the day it was
placed. It is the record a person opens to answer "what came in, and when".

## What it shows

- **A header** with the screen's name and a **Filter** button. Filter is the
  one control on the screen; it narrows the list without leaving it.
- **One section per day**, each a collapsible group headed by the date and
  how many orders that day had — "12 Sep — 3 orders". Every section is open
  by default, so the whole list can be read top to bottom.
- **A table per day** with three columns: the order number, the items in it,
  and the order's total.

## How the days and totals work

Days are the unit. An order belongs to the day it was placed, and a day
appears only when it has at least one order; there are no empty days. The
groups are in date order, oldest first, and each one can be collapsed to a
single line — the date and the count — when a reader wants the shape of the
month rather than every line.

Each row's **total** is that order's amount. A day's figure, where it is
shown, is the sum of the rows in its table and nothing else — no tax or
shipping is added at this level. The screen never computes a grand total;
that belongs to a report, not to a list.

## States this screen needs

- **Empty** — no orders yet: say so, and offer the one thing to do next.
- **Filtered to nothing** — the filter excluded every order: say which
  filter did it, and offer to clear it.
