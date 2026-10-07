import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);

// packages/core/src/modelstore.ts
import { createHash, randomBytes } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";

// packages/core/src/local-judge.ts
var LOCAL_MODELS = [
  {
    name: "embeddinggemma-2-text-270m",
    file: "embeddinggemma-2-text-270m.litertlm",
    url: "https://huggingface.co/litert-community/embeddinggemma-2-text-270m-litert-lm/resolve/main/embeddinggemma-2-text-270m.litertlm",
    bytes: 164626432,
    sha256: "2d079ee2f6f066b1f368e8d7c819f55214eaef1d0513b312321901f30ab286fb",
    about: "EmbeddingGemma 2 text 270M (LiteRT-LM), for MediaPipe Decision Maker",
    licence: "Apache-2.0 (per the litert-community card)"
  }
];
function localModel(name) {
  return LOCAL_MODELS.find((m) => m.name === name);
}
var MODELS_ROUTE = "/models";

// packages/core/src/modelstore.ts
function modelsDir(home) {
  return path.join(home, "models");
}
function modelPath(home, model) {
  return path.join(modelsDir(home), model.file);
}
async function listModels(home) {
  return Promise.all(
    LOCAL_MODELS.map(async (m) => {
      const size = await fs.stat(modelPath(home, m)).then((s) => s.size, () => 0);
      return { name: m.name, file: m.file, present: size === m.bytes, bytes: size, expected: m.bytes, sha256: m.sha256, about: m.about, licence: m.licence };
    })
  );
}
async function sha256Of(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
function modelNamed(name) {
  const m = localModel(name);
  if (!m) throw new Error(`no model called "${name}" \u2014 the models isocan knows are ${LOCAL_MODELS.map((x) => x.name).join(", ")}`);
  return m;
}
async function fetchModel(home, name, opts = {}) {
  return fetchModelFile(home, modelNamed(name), opts);
}
async function fetchModelFile(home, model, opts = {}) {
  const target = modelPath(home, model);
  const t0 = Date.now();
  const existing = await fs.stat(target).then((s) => s.size, () => -1);
  if (existing >= 0) {
    const hash = existing === model.bytes ? await sha256Of(target) : null;
    if (hash === model.sha256) return { path: target, bytes: existing, sha256: hash, downloaded: false, ms: Date.now() - t0 };
    throw new Error(`${target} is already there but is not the pinned file (${existing} bytes${hash ? `, sha256 ${hash}` : ""}; expected ${model.bytes} bytes, sha256 ${model.sha256}) \u2014 remove it and fetch again`);
  }
  await fs.mkdir(modelsDir(home), { recursive: true });
  const partial = `${target}.partial-${randomBytes(4).toString("hex")}`;
  try {
    const res = await (opts.fetch ?? fetch)(model.url, { redirect: "follow" });
    if (!res.ok || !res.body) throw new Error(`the download of ${model.name} answered ${res.status} ${res.statusText} from ${model.url} \u2014 nothing was kept`);
    const hash = createHash("sha256");
    const out = await fs.open(partial, "wx", 420);
    let received = 0;
    try {
      const reader = res.body.getReader();
      for (; ; ) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > model.bytes) throw new Error(`the download of ${model.name} is longer than the pinned ${model.bytes} bytes \u2014 refused, and the partial file deleted`);
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
        `the download of ${model.name} is not the pinned file \u2014 got ${received} bytes with sha256 ${got}, expected ${model.bytes} bytes with sha256 ${model.sha256}. Refused, and the partial file deleted; nothing was installed`
      );
    }
    await fs.rename(partial, target);
    return { path: target, bytes: received, sha256: got, downloaded: true, ms: Date.now() - t0 };
  } finally {
    await fs.rm(partial, { force: true });
  }
}

export {
  localModel,
  MODELS_ROUTE,
  modelsDir,
  modelPath,
  listModels,
  modelNamed,
  fetchModel,
  fetchModelFile
};
