#!/usr/bin/env node
// Source-mode launcher: register tsx so we can import TypeScript directly, and
// point `@isocan/*` at the sibling sources — registered last so it resolves
// first, leaving tsx to transpile what it hands back.
import { register as registerLoader } from "node:module";
import { register } from "tsx/esm/api";
register();
registerLoader("./workspace-loader.mjs", import.meta.url);
await import("../src/main.ts");
