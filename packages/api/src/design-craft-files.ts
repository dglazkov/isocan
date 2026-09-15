import { promises as fs } from "node:fs";
import path from "node:path";
import { impeccablePackageFiles } from "./craft/package-pin.ts";
import { craftBytes, craftHash, parseDesignCraftPacket } from "./design-craft-packet.ts";
import { checkDesignCraft } from "./design-craft-reader.ts";
import type { DesignRequestReadPort } from "./design-request-reader.ts";

async function boundedFile(root: string, relative: string, max: number): Promise<Uint8Array> {
  let file = root;
  for (const part of ["", ...relative.split("/")]) {
    if (part) file = path.join(file, part);
    const stat = await fs.lstat(file);
    if (stat.isSymbolicLink()) throw new Error(`Refusing symbolic link ${relative}.`);
    if (file !== path.join(root, relative) && !stat.isDirectory()) throw new Error(`Invalid file directory ${relative}.`);
  }
  const stat = await fs.stat(file);
  if (!stat.isFile() || stat.size > max) throw new Error(`File ${relative} exceeds its regular-file bound.`);
  const bytes = await fs.readFile(file);
  if (bytes.length > max) throw new Error(`File ${relative} changed beyond its bound.`);
  return bytes;
}

/** Inspect only the pinned Codex variant's fixed source files; no script or native engine is executed. */
export async function inspectDesignCraftPackage(directory: string) {
  const root = path.resolve(directory), files: Array<{ path: string; status: "verified" | "missing" | "drifted"; reason?: string }> = [];
  try { const stat = await fs.lstat(root); if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Package path must be a real directory."); }
  catch (error) { return { status: (error as NodeJS.ErrnoException).code === "ENOENT" ? "absent" as const : "drifted" as const, directory: root, variant: "Codex skill 4.3.1" as const, native: "unsupported/not-run" as const, files, reason: error instanceof Error ? error.message : String(error) }; }
  for (const expected of impeccablePackageFiles) {
    try {
      const bytes = await boundedFile(root, expected.path, expected.bytes + 1);
      files.push({ path: expected.path, status: bytes.length === expected.bytes && await craftHash(bytes) === expected.sha256 ? "verified" : "drifted" });
    } catch (error) { files.push({ path: expected.path, status: (error as NodeJS.ErrnoException).code === "ENOENT" ? "missing" : "drifted", reason: error instanceof Error ? error.message : String(error) }); }
  }
  return { status: files.some(file => file.status === "drifted") ? "drifted" as const : files.some(file => file.status === "missing") ? "incomplete" as const : "verified" as const, directory: root, variant: "Codex skill 4.3.1" as const, native: "unsupported/not-run" as const, files };
}

/** Export validated original context into a new directory, refusing every existing destination. */
export async function exportDesignCraft(directory: string, value: unknown) {
  const packet = await parseDesignCraftPacket(value), root = path.resolve(directory);
  await fs.mkdir(root);
  for (const file of packet.files) {
    const destination = path.join(root, file.path);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, craftBytes(file), { flag: "wx" });
  }
  await fs.writeFile(path.join(root, "CRAFT.manifest.json"), JSON.stringify(packet, null, 2) + "\n", { flag: "wx" });
  return { directory: root, packetId: packet.packetId, files: [...packet.files.map(file => file.path), "CRAFT.manifest.json"] };
}

/** Check source authority and original capture separately from proposed working-file edits; never rewrite either. */
export async function checkDesignCraftDirectory(io: DesignRequestReadPort, options: { canvasId: string; requestId: string; directory: string; signal?: AbortSignal }) {
  const directory = path.resolve(options.directory);
  const packet = await parseDesignCraftPacket(JSON.parse(new TextDecoder().decode(await boundedFile(directory, "CRAFT.manifest.json", 12 * 1024 * 1024))));
  const consistency = await checkDesignCraft(io, { canvasId: options.canvasId, requestId: options.requestId, packet, ...(options.signal ? { signal: options.signal } : {}) });
  const files: Array<{ path: string; status: "unchanged" | "modified" | "unavailable"; reason?: string }> = [];
  for (const file of packet.files) {
    try { files.push({ path: file.path, status: await craftHash(await boundedFile(directory, file.path, 2 * 1024 * 1024)) === file.sha256 ? "unchanged" : "modified" }); }
    catch (error) { files.push({ path: file.path, status: "unavailable", reason: error instanceof Error ? error.message : String(error) }); }
  }
  return { directory, ...consistency, files, notes: "Working PRODUCT/surface edits are proposed context, not canonical facts. DESIGN changes use the original projection and design reconcile. This check preserves all working files and original bases." };
}
