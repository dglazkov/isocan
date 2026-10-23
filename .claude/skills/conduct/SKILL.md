---
name: conduct
description: Compatibility name for this repository's local /spin conductor. Use when /conduct is invoked; preserve its arguments and follow the same local workflow.
argument-hint: "<project> [status | <phase number> | one]"
---

# /conduct compatibility

Read and follow [the local /spin skill](../spin/SKILL.md), passing every
argument unchanged. `/conduct` is the compatibility name for `/spin`; its
behavior, verification requirements, permissions and stopping rules are the
same. Do not substitute Plates's generic conductor for this repository's
own workflow. If the local skill is unavailable, stop and report that path.

The old `status.sh` path forwards to `../spin/status.sh`.
