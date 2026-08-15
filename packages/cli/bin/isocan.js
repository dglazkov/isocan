#!/usr/bin/env node
// Source-mode launcher: register tsx so we can import TypeScript directly.
import { register } from "tsx/esm/api";
register();
await import("../src/main.ts");
