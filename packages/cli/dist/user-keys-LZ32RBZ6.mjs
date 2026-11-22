import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  makeCtx,
  printJson,
  printTable
} from "./chunk-LOZ63YTJ.mjs";
import "./chunk-T4LMSPFM.mjs";
import "./chunk-54HCMC2L.mjs";
import "./chunk-QZ5ZDBZU.mjs";
import "./chunk-JDNKRDOA.mjs";
import "./chunk-3VC5ZAEL.mjs";
import "./chunk-O7A67R2R.mjs";
import "./chunk-CPKHQO6E.mjs";
import "./chunk-GAJX4R3V.mjs";
import "./chunk-2KSBM74U.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-XFLHEMLN.mjs";
import "./chunk-YFZFUVCG.mjs";
import "./chunk-236HKTFA.mjs";
import "./chunk-O735QEST.mjs";
import "./chunk-DGLWR6MP.mjs";
import "./chunk-YD4GAIKS.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-2Q4BD67B.mjs";
import {
  ApiError
} from "./chunk-J5Q22QZF.mjs";
import "./chunk-5NDVMWWX.mjs";
import "./chunk-GUY4UN4O.mjs";
import "./chunk-K4TDP4L5.mjs";
import "./chunk-DX6WJD6A.mjs";
import "./chunk-JYOOXWJZ.mjs";

// packages/cli/src/user-keys.ts
async function listMineKeys(cmd) {
  const ctx = await makeCtx(cmd);
  const listing = await ctx.client.listUserKeys();
  if (ctx.json) {
    printJson({ home: ctx.client.base, ...listing });
    return;
  }
  printTable(
    listing.keys.map((row) => ({
      provider: row.provider,
      mine: row.present ? `v${row.version}` : "not set",
      updated: row.updatedAt ? row.updatedAt.slice(0, 10) : "",
      active: row.source
    }))
  );
  console.log(`
home: ${ctx.client.base}`);
}
async function setMineKey(cmd, provider, key) {
  const ctx = await makeCtx(cmd);
  const saved = await ctx.client.setUserKey(provider, key);
  if (ctx.json) {
    printJson(saved);
    return;
  }
  console.log(`${saved.provider}: stored sealed for your account (v${saved.version}, ${saved.credentialRef}) on ${ctx.client.base}`);
}
async function removeMineKey(cmd, provider) {
  const ctx = await makeCtx(cmd);
  let removed;
  try {
    ({ removed } = await ctx.client.deleteUserKey(provider));
  } catch (err) {
    if (err instanceof ApiError && err.status === 404 && err.code === "no-user-key") {
      removed = false;
    } else {
      throw err;
    }
  }
  if (ctx.json) {
    printJson({ provider, removed });
    return;
  }
  console.log(
    removed ? `${provider}: removed per-user key from ${ctx.client.base}` : `${provider}: no stored per-user key on ${ctx.client.base} \u2014 nothing to remove`
  );
}
export {
  listMineKeys,
  removeMineKey,
  setMineKey
};
