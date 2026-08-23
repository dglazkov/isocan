# Research

Findings that took longer to reach than they take to read — surveys, format
evaluations, and readiness assessments. Each one is a markdown file here (the
durable, greppable copy) and a designed write-up behind a link (the version to
send someone).

The rule for this directory: **write down what was measured, not what was
assumed.** Every number in here came from an API, a converter, or a test run on
the day it is dated. Where something is inference rather than evidence, it says
so.

| Date | Research | What it found |
| --- | --- | --- |
| 22 Aug 2026 | [JSON Canvas](json-canvas.md) · [full](https://claude.ai/code/artifact/e764ed1d-0d76-426f-8667-8aff6b648ef2) | The open canvas format's coordinate model is ours exactly, and a real conversion of a working canvas keeps 12 of 12 rectangles while dropping 26 versions, 6 threads, 48 comments and 5 actors — 2,173 bytes against 54KB of state and 94KB of history. A good export, a bad storage format. Underneath it: whether we want edges at all, which is a product decision and not a format one. |
| 22 Aug 2026 | [Agent skills](agent-skills.md) · [full](https://claude.ai/code/artifact/a380ba2c-2cbe-44dc-b3b4-ef0a3ae2b38b) | A survey of the most-starred skill repositories. Four worth importing today (all MIT, one line each), four worth reading, and the directories worth pointing `/skill find` at rather than installing. The official set — 171k stars — has no licence file at all. And the observation underneath: every repo on that leaderboard is a file that changes agent behaviour, and not one has anywhere for the work to land. |
| 21 Aug 2026 | [Feature readiness](feature-readiness.md) · [full](https://claude.ai/code/artifact/2754aec1-01e6-4543-bcda-657ff925ed5a) | Eighteen proposed features graded by what blocks them. Ten need nothing from authentication; three are blocked entirely by it. The finding that reorders the list: the multiuser era was built and wound back (`ae3d227..b2b9f6e`, reverted by `cba0a78`), and the property that design could not escape is that a shared canvas only exists while one laptop is open. |

Day-to-day work is not research: what shipped and why lives in
[`docs/changelog/`](../changelog/), a page per day.

## Adding to this

Date it, say what was measured and how, and link the full version if there is
one. Research that cannot be checked a month later is an opinion with a
timestamp.
