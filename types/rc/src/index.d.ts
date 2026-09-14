/**
 * **`@isocan/rc` — the rc's room as a module** (docs/projects/room/design.md),
 * shipped as `isocan/rc`.
 *
 * Everything reachable from this entry runs without Node: no `node:` import
 * and nothing from `@isocan/server`. `packages/rc/test/boundary.test.ts` holds
 * that as a fact, by walking the imports and by bundling this entry for the
 * browser platform. A host with `fetch`, a key-value store and a timer is the
 * audience; the laptop's `isocan rc` is one host of it.
 *
 * **And the client a host speaks to the daemon with** (sheep's collie, phase
 * 1): `DaemonRoutes`, the typed route surface the CLI's `DaemonClient`
 * extends, re-exported from `@isocan/api/routes` rather than written again.
 * It satisfies `RoomRoutes`, and it carries the calls a host makes around the
 * room — `redeemPass`, `mintPass`, `killBadge`, `badges`, `snapshot`. A host
 * constructs it over a base URL and a `BadgeStore` of its own; requests go
 * through the global `fetch`. The boundary test names `routes.ts` as the one
 * file of `@isocan/api` this entry reaches.
 */
export { ApiError, DaemonRoutes } from "../../api/src/routes.js";
export type { BadgeStore, StoredBadge } from "../../core/src/index.js";
export { gateTurn, type GuardLimits, type GuardState, type GuardVerdict } from "./guards.js";
export type { RcAgentRow, SheepPlace } from "./rows.js";
export { actorNamesOn, itemCenter, nameResolver, summonsPrompt, threadLocus } from "./helpers.js";
export { mapState, runRoom, type Room, type RoomAdapter, type RoomDeps, type RoomHarness, type RoomRoutes, type RoomRows, type RoomState, type RoomTurn, type RoomTurnEvent, } from "./room.js";
export { SHEEP_HARNESS, SheepAgent, assistantText, endSheep, toolCalls, toolTitle, type RmAnswer, type SheepBirth, type SheepCommands, type SheepEntry, type SheepReply, type SheepRow, } from "./sheep.js";
export { COLLAB_SKILL } from "./skill.js";
