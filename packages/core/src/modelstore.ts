import { createHash, randomBytes } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { LOCAL_MODELS, localModel, type LocalModel } from "./local-judge.ts";

/**
 * **`<home>/models/` — the local judge's model on this machine** (local-judge
 * phase 0). Node-only, a subpath of its own (`@isocan/core/modelstore`) so
 * nothing here reaches a browser: `isocan model fetch` writes through it and
 * the daemon's `GET /models/<name>` reads through it, so the two agree on
 * where a model lives without either spelling the path.
 *
 * The home is the caller's — the same one `keys.json` sits in (`ISOCAN_HOME`,
 * else `~/.isocan`); nothing here guesses it. Never in git, never in `dist`.
 *
 * **A fetch is all or nothing.** The bytes stream into a temp file in the
 * same directory while they are hashed; only a file of exactly the pinned
 * length AND the pinned SHA-256 is renamed into place. Anything else is
 * deleted and refused in words that give both hashes. Resuming is not
 * offered: a partial is never kept.
 */

/** Where a home keeps its models. */
export function modelsDir(home: string): string {
  return path.join(home, "models");
}

/** Where one model's file lives in a home. */
export function modelPath(home: string, model: LocalModel): string {
  return path.join(modelsDir(home), model.file);
}

/** One manifest model, as `isocan model ls` shows it. */
interface ModelRow {
  name: string;
  file: string;
  /** On disk at the pinned size. The hash is checked on fetch, not on every `ls`. */
  present: boolean;
  /** Bytes on disk (0 when absent), and the pinned size. */
  bytes: number;
  expected: number;
  sha256: string;
  about: string;
  licence: string;
}

/** Every model the manifest knows, and whether this home has it. */
export async function listModels(home: string): Promise<ModelRow[]> {
  return Promise.all(
    LOCAL_MODELS.map(async (m) => {
      const size = await fs.stat(modelPath(home, m)).then((s) => s.size, () => 0);
      return { name: m.name, file: m.file, present: size === m.bytes, bytes: size, expected: m.bytes, sha256: m.sha256, about: m.about, licence: m.licence };
    }),
  );
}

/** SHA-256 of a file on disk, streamed. */
async function sha256Of(file: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

/** The model by name, or a refusal that names the ones there are. */
export function modelNamed(name: string): LocalModel {
  const m = localModel(name);
  if (!m) throw new Error(`no model called "${name}" — the models isocan knows are ${LOCAL_MODELS.map((x) => x.name).join(", ")}`);
  return m;
}

/** How a fetch reaches the network, and who hears about its progress. */
interface FetchModelOptions {
  fetch?: typeof fetch;
  /** Called as bytes arrive: how many so far, of how many. */
  onProgress?: (received: number, total: number) => void;
}

/** A model in place: where, how big, its hash, and whether this call downloaded it. */
interface FetchedModel {
  path: string;
  bytes: number;
  sha256: string;
  /** False when the file was already there and verified, so nothing was downloaded. */
  downloaded: boolean;
  ms: number;
}

/**
 * **Download one manifest model into a home, verified, atomically.** A file
 * already in place at the pinned size is hashed; if it matches, nothing is
 * downloaded. If it does not, it is refused rather than replaced silently —
 * the person is told to remove it.
 */
export async function fetchModel(home: string, name: string, opts: FetchModelOptions = {}): Promise<FetchedModel> {
  return fetchModelFile(home, modelNamed(name), opts);
}

/** `fetchModel` for a model already looked up — the manifest's, or a test's synthetic one. */
export async function fetchModelFile(home: string, model: LocalModel, opts: FetchModelOptions = {}): Promise<FetchedModel> {
  const target = modelPath(home, model);
  const t0 = Date.now();
  const existing = await fs.stat(target).then((s) => s.size, () => -1);
  if (existing >= 0) {
    const hash = existing === model.bytes ? await sha256Of(target) : null;
    if (hash === model.sha256) return { path: target, bytes: existing, sha256: hash, downloaded: false, ms: Date.now() - t0 };
    throw new Error(`${target} is already there but is not the pinned file (${existing} bytes${hash ? `, sha256 ${hash}` : ""}; expected ${model.bytes} bytes, sha256 ${model.sha256}) — remove it and fetch again`);
  }
  await fs.mkdir(modelsDir(home), { recursive: true });
  const partial = `${target}.partial-${randomBytes(4).toString("hex")}`;
  try {
    const res = await (opts.fetch ?? fetch)(model.url, { redirect: "follow" });
    if (!res.ok || !res.body) throw new Error(`the download of ${model.name} answered ${res.status} ${res.statusText} from ${model.url} — nothing was kept`);
    const hash = createHash("sha256");
    const out = await fs.open(partial, "wx", 0o644);
    let received = 0;
    try {
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > model.bytes) throw new Error(`the download of ${model.name} is longer than the pinned ${model.bytes} bytes — refused, and the partial file deleted`);
        hash.update(value);
        await out.write(value);
        opts.onProgress?.(received, model.bytes);
      }
      await out.sync();
    } finally {
      await out.close();
    }
    const got = hash.digest("hex");
    if (received !== model.bytes || got !== model.sha256) {
      throw new Error(
        `the download of ${model.name} is not the pinned file — got ${received} bytes with sha256 ${got}, expected ${model.bytes} bytes with sha256 ${model.sha256}. Refused, and the partial file deleted; nothing was installed`,
      );
    }
    await fs.rename(partial, target);
    return { path: target, bytes: received, sha256: got, downloaded: true, ms: Date.now() - t0 };
  } finally {
    await fs.rm(partial, { force: true });
  }
}
