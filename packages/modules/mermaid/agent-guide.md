## Diagrams

A diagram is a text file the canvas draws. Write Mermaid — a flowchart, a
sequence diagram, a state machine — into a `.mmd` file and `isocan add
flow.mmd` lands it as a **diagram**: the card and the stage show the picture,
`isocan ls --kind diagram` lists them, and `isocan edit <item>` opens the
text, because the text is the item. There is no diagram verb; a diagram is a
file with the mime `text/vnd.mermaid`, which GitHub, Obsidian and Notion read
too, so the same file travels.

```
flowchart LR
  ask --> plan --> build --> review
  review --> ask
```

A new version is a new drawing: `isocan edit` or `isocan add --replace` with
the changed text, and every card showing it redraws. When a diagram will not
parse, the card says so with the parser's first line rather than showing
nothing. Diagrams are a module (`@isocan/mermaid`): a home without it shows
the same file as a document, the text readable, nothing lost.
