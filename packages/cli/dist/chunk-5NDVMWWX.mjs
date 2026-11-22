import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);

// node_modules/nanoid/index.js
import { webcrypto as crypto } from "node:crypto";

// node_modules/nanoid/url-alphabet/index.js
var urlAlphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

// node_modules/nanoid/index.js
var POOL_SIZE_MULTIPLIER = 128;
var pool;
var poolOffset;
function fillPool(bytes) {
  if (bytes < 0) throw new RangeError("Wrong ID size");
  try {
    if (!pool || pool.length < bytes) {
      pool = Buffer.allocUnsafe(bytes * POOL_SIZE_MULTIPLIER);
      crypto.getRandomValues(pool);
      poolOffset = 0;
    } else if (poolOffset + bytes > pool.length) {
      crypto.getRandomValues(pool);
      poolOffset = 0;
    }
  } catch (e) {
    pool = void 0;
    throw e;
  }
  poolOffset += bytes;
}
function nanoid(size = 21) {
  fillPool(size |= 0);
  let id = "";
  for (let i = poolOffset - size; i < poolOffset; i++) {
    id += urlAlphabet[pool[i] & 63];
  }
  return id;
}

// packages/core/src/ids.ts
function newId(prefix) {
  return `${prefix}_${nanoid(10)}`;
}
var newCanvasId = () => newId("prj");
var newItemId = () => newId("itm");
var newVersionId = () => newId("ver");
var newThreadId = () => newId("thr");
var newCommentId = () => newId("cmt");
var newOpId = () => newId("op");
var newGroupId = () => newId("grp");
var isOpId = (value) => typeof value === "string" && /^op_[A-Za-z0-9_-]{6,32}$/.test(value);
var newActorId = () => newId("usr");
var newClientId = () => newId("cli");
var newJobId = () => newId("job");

export {
  nanoid,
  newId,
  newCanvasId,
  newItemId,
  newVersionId,
  newThreadId,
  newCommentId,
  newOpId,
  newGroupId,
  isOpId,
  newActorId,
  newClientId,
  newJobId
};
