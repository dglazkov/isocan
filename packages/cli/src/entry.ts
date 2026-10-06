import { enableCompileCache } from "node:module";

// Before main's import graph is compiled: a static import would be compiled first.
enableCompileCache();
await import("./main.ts");
