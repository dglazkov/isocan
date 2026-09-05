## Mind maps

Riffing into a shape somebody can drag. `isocan map new "Lake house"` starts
one with a root node; `isocan map add "Booking" --to <node>` hangs a child off
it; `isocan map link <node> <parent>` moves a branch somewhere else. `isocan
map show` prints the whole thing as a tree, and `isocan map ls` names every
map on the canvas.

**`isocan map tidy` lays it out.** Nodes land where they are added — right of
the parent, under the last sibling — which is legible as you build and records
the ORDER you typed rather than the SHAPE of the tree. Tidy gives each depth
its own column and centres every parent on its children. It arrives as one
`items.move`, so one `isocan undo` puts it back; `--dry-run` says what would
move without moving it. Worth running once a map has grown past the shape you
imagined for it.

```
Lake house
├── Booking
│   ├── Checkout day is exclusive
│   └── Timezone is the browser's
└── The four screens are islands
```

**A node is a text node and an edge is a property**, so nothing here is a new
kind of thing: nodes version, `#Title` points at them, `isocan get` hands back
a `.md`, and the human can drag any node anywhere. The lines are worked out
from where the nodes ARE, so they follow a drag rather than needing to be
redrawn. Mind maps are a module (`@isocan/mindmap`): a home without it still
shows the nodes as text, and only the lines and these verbs are gone.
