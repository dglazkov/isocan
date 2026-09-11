import type { Actor, EnrolAsk, Operation, WebHost } from "@isocan/core";
import { askEnrolAgent, uploadBlob } from "./api.ts";
import { canEditNow } from "./capability.ts";
import { sendEchoed, setNotice, useCanvasStore } from "../stores/canvasStore.ts";

/**
 * **The web half's host object** (#156, 9 Sep 2026).
 *
 * `packages/cli/src/modulehost.ts` is the twin, and it has existed since
 * modules did. This one did not, which is the whole finding: a module's CLI
 * verbs were handed a named, documented set of helpers with a rule beside it
 * — *"a module that wants a helper not listed here is asking for one to be
 * promoted, which is a review question and not a private import"* — while a
 * module's COMPONENTS were handed facts as props and had no promotion path at
 * all. An author who needed one could reach into a zustand store, which the
 * design forbids, or file an issue. romannurik filed the issue.
 *
 * ## The door test lives here, once
 *
 * `canEditNow()` is checked inside `send` rather than trusted to the call
 * sites. There are three slots that hold this object today and there will be
 * more; a permission test spelled at every call site is a permission test that
 * will be missing from one of them. A reader who has a module's tray on screen
 * can drag out of it — the canvas simply will not take the write, and says so,
 * which is what every other refusal on this surface does.
 *
 * ## It echoes, because the palette does
 *
 * A module action's ops go through `sendOp` with a local echo so the canvas
 * moves before the round trip. A component's write must feel the same or the
 * tray will seem slower than the menu that does the same thing.
 */
export function webHostFor(canvasId: string, actor: Actor): WebHost {
  return {
    async send(ops: readonly Operation[], group?: string): Promise<void> {
      if (!canEditNow()) {
        setNotice("You are reading this canvas — that change was not sent.");
        return;
      }
      /* `sendEchoed`, not `sendOp` plus an echo of our own: there is one door
         for a write to the open canvas and `writes.test.ts` holds every caller
         to it. Echoing by hand here would have been a second door that looked
         right and skipped the offline queue, the inflight fold and the
         scrubber's refusal. Caught by that guard on the first run. */
      for (const op of ops) await sendEchoed(canvasId, actor, op, group);
    },
    async putBlob(bytes: Blob, filename: string): Promise<{ blobHash: string; size: number }> {
      /**
       * No permission test, deliberately, and it is worth saying why rather
       * than looking like an omission: a blob nothing names is invisible and
       * unreachable — it becomes part of the canvas only when an op names its
       * hash, and that op goes through `send` above. Testing here as well
       * would refuse a reader twice for one gesture and say the wrong thing
       * the first time.
       */
      const upload = await uploadBlob(canvasId, bytes, filename);
      return { blobHash: upload.blobHash, size: upload.size };
    },
    /**
     * **The parked rc enrols; this asks** (proposed: `templates`). The same
     * doorbell `AddAgent` rings — never an `agent.enroll` of our own, because
     * the actor is born first-claim on the machine that answers for it — and
     * it resolves the way that dialog does: when the enrol op for the name
     * lands in the replica. A refusal on the rc (a name already worn, a
     * template that machine does not have) is narrated there and arrives here
     * as the patience running out, said in words.
     */
    async enrol(ask: EnrolAsk): Promise<{ actorId: string }> {
      if (!canEditNow()) throw new Error("You are reading this canvas — nobody can be enrolled from here.");
      const standing = () =>
        Object.values(useCanvasStore.getState().canvas?.agents ?? {}).find(
          (a) => a.actor.name.toLowerCase() === ask.name.toLowerCase(),
        );
      const already = standing();
      if (already) return { actorId: already.actor.id };
      await askEnrolAgent(canvasId, {
        name: ask.name,
        from: actor,
        ...(ask.template ? { template: ask.template } : {}),
        ...(ask.args ? { args: { ...ask.args } } : {}),
      });
      const until = Date.now() + ENROL_PATIENCE_MS;
      while (Date.now() < until) {
        const row = standing();
        if (row) return { actorId: row.actor.id };
        await new Promise((r) => setTimeout(r, 250));
      }
      throw new Error(`the rc did not enrol ${ask.name} — its terminal says why`);
    },
  };
}

/** How long an enrol waits for the op to land — `AddAgent`'s own patience. */
const ENROL_PATIENCE_MS = 25_000;
