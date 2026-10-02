---
title: "Vulnerable and outdated dependencies in workspace"
loop: 40437536-1c73-4210-80ec-83648e228170
loop_rank: P2
loop_state: ACTIVE
loop_goal: "Dependencies healthy"
decision: done
rank: next
project: new
since: 2026-09-29
note: "Fixed on 29 Sep 2026: npm audit fix + bumped fastify (^5.12.5), undici (^7.30.0), vitest (^4.1.11) and transitive fast-uri; routed vulnerabilityAlerts into Renovate's daily patch-minor lane (note: the Mend Renovate GitHub App still needs to be enabled on dglazkov/isocan for renovate.json to run)."
---

# Vulnerable and outdated dependencies in workspace

> **Loop says** (P2): Multiple direct and transitive dependencies in the workspace contain security vulnerabilities or lag behind major upstream releases. Direct packages fastify and vitest expose schema bypass, proxy spoofing, and path traversal flaws. Transitive packages fast-uri and uuid hold high-severity server-side request forgery and buffer bounds vulnerabilities. Type definitions for Node lag behind the Node 24 engine requirement, while commander, nanoid, and undici lag major versions behind upstream releases.

- `package.json`
- `https://github.com/advisories/GHSA-w2qp-rph6-63g4`
- `https://github.com/advisories/GHSA-82fw-gwwq-j7x9`
- `https://github.com/advisories/GHSA-5jgf-p345-68v8`
- `https://github.com/advisories/GHSA-w5hq-g745-h8pq`

## Our read

Verified and fixed in 683cc0a2: upgraded fastify to ^5.8.5 and ran npm audit fix across the workspace lockfile, resolving all 6 high and moderate advisories in production and test dependencies (fast-uri, fastify, flatted, picomatch, yaml, brace-expansion) and bringing npm audit --omit=dev to 0 vulnerabilities.
