import type { Actor, Operation, WebHost } from "@isocan/core";
import { uploadBlob } from "./api.ts";
import { canEditNow } from "./capability.ts";
import { sendEchoed, setNotice } from "../stores/canvasStore.ts";

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
  };
}
