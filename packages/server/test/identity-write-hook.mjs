/** IPC barriers for actual cross-process identity writes. Only scheduling facts
 * cross IPC; identity bytes and credentials remain in the owned fixture home. */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const source = fileURLToPath(new URL("../src/badge-store.ts", import.meta.url));
const lines = (await fs.readFile(source, "utf8")).split("\n");
const readLine = lines.findIndex((line) => /current = .*JSON.parse\(await fs.readFile/.test(line)) + 1;
if (!readLine) throw new Error("Identity write read seam is missing");
const home = await fs.realpath(process.env.ISOCAN_HOME);
const identity = path.join(home, "identity.json");
let gated = false;
const read = fs.readFile.bind(fs);
fs.readFile = async (...args) => {
  const writing = new Error().stack?.includes(`badge-store.ts:${readLine}:`);
  const raw = await read(...args);
  if (!gated && writing && String(args[0]) === identity) {
    gated = true;
    const released = new Promise((resolve) => process.once("message", resolve));
    process.send?.({ type: "identity-write-read" });
    await released;
  }
  return raw;
};
const mkdir = fs.mkdir.bind(fs);
let contended = false;
fs.mkdir = async (...args) => {
  try { return await mkdir(...args); }
  catch (error) {
    if (!contended && error.code === "EEXIST" && String(args[0]) === path.join(home, ".identity-write.lock")) {
      contended = true;
      process.send?.({ type: "identity-lock-contended" });
    }
    throw error;
  }
};
const rename = fs.rename.bind(fs);
fs.rename = async (...args) => {
  const result = await rename(...args);
  if (gated && String(args[1]) === identity) process.send?.({ type: "identity-write-saved" });
  return result;
};
