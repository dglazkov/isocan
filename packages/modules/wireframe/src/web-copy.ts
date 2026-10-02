import type { WebCopyWriter } from "@isocan/core";
import { writeWireCopy } from "./copy-write.ts";
import { wiresOn } from "./flow.ts";
import { currentVersionOf } from "./port.ts";
import { embedWireSpec, readWire, renderWire } from "./render.ts";
import { webPort } from "./web-port.ts";

/**
 * **The stage's in-place text edit on a wire screen** — `WebModule.copy`'s
 * `at` and `apply` (its `variant` is `copy-variant.ts`).
 *
 * Before this, a double-click edit on a wireframe spliced the HTML and left
 * the embedded spec saying the old words, so the next restyle, flesh or
 * prototype rebuild drew from the spec and quietly took the edit back. Now
 * `at` names the word path each edited node draws (core's `wireWordAt`, from
 * the spec — no HTML parser), and `apply`
 * writes the words through `writeWireCopy` — the writer `wire copy --apply`
 * and `isocan words --apply` use — as one version in one op group, sent as
 * the person who typed them.
 *
 * A screen whose file is the renderer's own output is re-rendered from the
 * new words, so every place a word draws (the title in the bar AND the
 * heading) moves together. A screen whose file is not (crafted around an
 * embedded spec, or spliced by hand before this existed) keeps the bytes the
 * person saw, with their edit spliced in and the new words embedded — a
 * re-render would throw the craft away.
 */
/**
 * Core's spec-word walk, fetched rather than imported: `copy-deck.ts` imports
 * it too, so a static import here would make it a chunk of its own that this
 * half depends on — one more name in the entry's preload list, which has no
 * bytes to spare. Fetched, it costs the entry nothing.
 */
const words = () => import("@isocan/core/wire-words");

export const wireWebCopy: Required<Pick<WebCopyWriter, "at" | "apply">> = {
  async at(html, place) {
    const spec = readWire(html);
    return spec ? (await words()).wireWordAt(spec, place) : { ok: false, reason: "This screen's wireframe spec cannot be read, so its words cannot be told apart — the editor can still change the file." };
  },
  async apply(host, canvasId, itemId, edits, { by, html: spliced }) {
    const port = webPort(canvasId, host);
    const canvas = await port.canvas();
    const all = await wiresOn(port, canvas);
    const screen = all.find((s) => s.item === itemId);
    const current = canvas.items[itemId] ? currentVersionOf(canvas.items[itemId]!) : undefined;
    if (!screen || !current) throw new Error("This wireframe's spec could not be read, so its words cannot be written.");
    const file = (await words()).wireCopyFor(screen.spec, edits);
    if (!file.ok) throw new Error(file.reason);
    if (file.changed.length === 0) return { changed: [] };
    const html = await port.readText(current.blobHash);
    let ownRender = false;
    try {
      ownRender = html === renderWire(screen.spec);
    } catch {
      // A spec the renderer refuses is not one it drew.
    }
    const r = await writeWireCopy(port, canvas, all, screen, file.file, by, ownRender || spliced === undefined ? renderWire : (next) => embedWireSpec(spliced, next));
    return { changed: r.changed ? file.changed : [] };
  },
};
