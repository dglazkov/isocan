---
name: "Acme Market (app.tamber)"
description: "The design of the Exact app dev.acme.market, read from its app.tamber by `tamber ir` (digest 5a84030ea8e6e8b0). Edit app.tamber, not this file: the next capture rewrites it."
colors:
  brand.ink: "#1b4d3e"
  note.ink: "#5b6b62"
spacing:
  space.note: 4
  radius.card: 8px
isocan: {"exact":{"app":"dev.acme.market","digest":"5a84030ea8e6e8b0","tokens":[{"name":"brand.ink","kind":"color","values":["light-dark(#1b4d3eff, #8fd3b6ff)"]},{"name":"note.ink","kind":"color","values":["light-dark(#5b6b62ff, #a8b8aeff)"]},{"name":"space.note","kind":"number","values":["4"]},{"name":"radius.card","kind":"length","values":["8px"]}]}}
---

## Overview

The tokens of Acme Market's `app.tamber`, as the app's own compiler folds them, with where each is used.

## Colors

| Token | Kind | Light | Dark | Used at |
| --- | --- | --- | --- | --- |
| `brand.ink` | color | #1b4d3e | #8fd3b6 | app.contract:91 (App), app.contract:181 (PriceTag), app.contract:229 (CartSheet) |
| `note.ink` | color | #5b6b62 | #a8b8ae | app.contract:172 (ShippingNote) |
| `space.note` | number | 4 | 4 | not used |
| `radius.card` | length | 8px | 8px | app.contract:181 (PriceTag), app.contract:181 (PriceTag), app.contract:181 (PriceTag), app.contract:181 (PriceTag) |
