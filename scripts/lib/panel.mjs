/**
 * **A generated panel on a canvas: one item, edited in place, never silted.**
 *
 * Lifted out of `scripts/canvas-board.mjs` when the roadmap needed the same
 * thing (`scripts/roadmap.mjs --publish`). Two copies of "find the panel,
 * compare the bytes, add a version only when they differ, prune the stack"
 * would be correct on the day they were made and drift after, and the drift
 * would look like a canvas that silts again.
 *
 * - **Found by a property, not by its title.** `properties[key] === slug`, so
 *   a person renaming the panel keeps it the same panel. A title match is the
 *   fallback, used once to adopt a panel made before the property existed, and
 *   it stamps the property as it goes.
 * - **An unchanged run is a no-op.** The bytes are compared with the current
 *   version's `blobHash`, so a run that changed nothing stacks nothing.
 * - **The stack is bounded.** The newest `keepVersions` stay, and `gc` sweeps
 *   the rest — a regenerated panel is not a history worth keeping whole.
 * - **A dry run writes files, never the canvas.**
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";

/** sha256 of a buffer, hex — the same digest the canvas keeps as `blobHash`. */
export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/**
 * A publisher for one canvas. `canvas` is an `@isocan/api` canvas handle, or
 * null with `dryDir` set for a dry run. `existing` and `changed` are returned
 * so a caller can find a panel it published and report what moved.
 */
export async function panelPublisher({ canvas, dryDir = null, keepVersions = 14, key = "board" }) {
  const existing = dryDir || !canvas ? [] : await canvas.items();
  const changed = [];

  /** Publish `content` as the panel `slug`; `place` applies on creation only. */
  async function publish(slug, title, content, place, { mime = "text/html", ext = "html" } = {}) {
    const filename = `${slug}.${ext}`;
    if (dryDir) {
      const file = path.join(dryDir, filename);
      writeFileSync(file, content);
      console.log(`would publish "${title}" → ${file}`);
      return;
    }
    const hash = sha256(Buffer.from(content));
    const byProp = existing.find((i) => i.properties?.[key] === slug);
    const item = byProp ?? existing.find((i) => i.title === title);

    if (!item) {
      const made = await canvas.add({
        title,
        content,
        mime,
        filename,
        ...(place?.at ? { at: place.at } : {}),
        ...(place?.size ? { size: place.size } : {}),
        properties: { [key]: slug, ...(place?.props ?? {}) },
      });
      changed.push({ title, what: "created" });
      existing.push(made);
      return;
    }
    if (!byProp) await canvas.set(item.id, { properties: { [key]: slug } });

    const current = item.versions.find((v) => v.id === item.currentVersionId);
    if (current?.blobHash === hash) return;
    await canvas.edit(item.id, { content, mime, filename });
    changed.push({ title, what: `v${item.versions.length + 1}` });
    await canvas.pruneVersions(item.id, keepVersions);
  }

  return { publish, existing, changed };
}
