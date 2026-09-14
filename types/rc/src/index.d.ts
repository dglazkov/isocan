/**
 * **`@isocan/rc` — the rc's room as a module** (docs/projects/room/design.md),
 * shipped as `isocan/rc`.
 *
 * Everything reachable from this entry runs without Node: no `node:` import
 * and nothing from `@isocan/server`. `packages/rc/test/boundary.test.ts` holds
 * that as a fact, by walking the imports and by bundling this entry for the
 * browser platform. A host with `fetch`, a key-value store and a timer is the
 * audience; the laptop's `isocan rc` is one host of it.
 */
export { gateTurn, type GuardLimits, type GuardState, type GuardVerdict } from "./guards.js";
export type { RcAgentRow, SheepPlace } from "./rows.js";
export { actorNamesOn, itemCenter, nameResolver, summonsPrompt, threadLocus } from "./helpers.js";
export { mapState, runRoom, type Room, type RoomAdapter, type RoomDeps, type RoomHarness, type RoomRoutes, type RoomRows, type RoomState, type RoomTurn, type RoomTurnEvent, } from "./room.js";
export { SHEEP_HARNESS, SheepAgent, assistantText, endSheep, toolCalls, toolTitle, type RmAnswer, type SheepBirth, type SheepCommands, type SheepEntry, type SheepReply, type SheepRow, } from "./sheep.js";
export { COLLAB_SKILL } from "./skill.js";
