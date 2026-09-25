## Judge

The judge's calibration corpus, read rather than made. Every screen a
wireframe flow draws carries round 1's P(yes) — how likely the request is to
need it — and who answered; the flow puts the confident screens in the
prototype itself and draws the unsure ones marked *maybe*. What the person
then does is the label.

- `isocan judge corpus [canvases...]` (or `--all`) folds each row a flow drew
  — a screen and its variations — into one pair: its P(yes) and the running
  person's verdict. **kept**: they put a row the flow left out into the
  prototype. **taken out**: they took out, or deleted, one the flow put in.
  **none**: they never touched it, or ended where the flow did — no label,
  not a yes. A keep the flow signed with its answerer's name is the judge's
  own output, and a collaborator's act is not counted.
- It prints counts and writes to no canvas. `--out <dir>` writes the pairs:
  `labelled.json` carries requests, screen titles and canvas names and stays
  on the machine — the verb refuses a directory inside a git work tree —
  and `shape.json` is the same pairs with every string taken out.
- **It reads a person's verdicts, so it refuses an agent session.** An agent
  asked for the count should hand the person the command rather than run it:
  its own keeps are not the labels. Quote the totals line, never the rows
  under it.
