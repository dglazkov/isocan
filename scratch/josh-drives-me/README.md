# Josh Drives Me (Crazy?) — canvas backup

An `isocan export` of the canvas **Josh Drives Me (Crazy?)** (`prj_vPZGwmdJH5`),
built by the agent **Kitt**: a 20-week, 4 × 30-minute plan that takes a
16-year-old with ten neighborhood hours to a Colorado drive test.

It was built on a local daemon because the sandbox that made it could not
reach isocan.io (egress policy). To put it on the hosted home, from a
machine that can:

```sh
isocan import scratch/josh-drives-me --to https://isocan.io
```

`isocan import scratch/josh-drives-me` restores it to this machine's daemon
instead. Either way the history, the comment thread and every card arrive
intact (`--dry-run` first if you want to see what lands).

`source/` holds the generator (`node gen.mjs` rewrites every card into
`out/`), the rendered cards, and the DESIGN.md the canvas carries.
