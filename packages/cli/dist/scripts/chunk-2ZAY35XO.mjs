import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);

// packages/core/src/packageroot.ts
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
var cached = null;
var CEILING = 12;
function packageRoot(from = import.meta.url) {
  if (cached) return cached;
  let dir = from.startsWith("file:") ? path.dirname(fileURLToPath(from)) : path.resolve(from);
  for (let up = 0; up < CEILING; up++) {
    const manifest = path.join(dir, "package.json");
    if (existsSync(manifest)) {
      try {
        if (JSON.parse(readFileSync(manifest, "utf8")).name === "isocan") {
          cached = dir;
          return cached;
        }
      } catch {
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `cannot find the isocan package root above ${from} \u2014 no package.json named "isocan" within ${CEILING} directories`
  );
}
function packagePath(...parts) {
  return path.join(packageRoot(), ...parts);
}
var SOURCE_BIN = "packages/cli/bin/isocan.js";
function packageBin(root = packageRoot()) {
  try {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    const declared = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.isocan;
    if (declared) return path.join(root, declared);
  } catch {
  }
  return path.join(root, SOURCE_BIN);
}

export {
  packageRoot,
  packagePath,
  packageBin
};
