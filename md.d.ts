/**
 * **`import guide from "./agent-guide.md"` is that file's text.**
 *
 * The one declaration behind the rule `packages/cli/bin/workspace-loader.mjs`
 * implements for source mode, `scripts/release.mjs` and
 * `scripts/module-build.mjs` for their bundles, and `vitest.config.ts` for the
 * suite. It is here at the root and named by each package's tsconfig `include`
 * rather than copied into nine `src/` directories, because there is one rule.
 *
 * Why the rule exists: in the bundled release CLI every source file shares one
 * `import.meta.url` — the bundle's — so the `new URL("./agent-guide.md",
 * import.meta.url)` each guide used to be read by resolved to nothing
 * (`docs/projects/first-minute/design.md`, change 1).
 */
declare module "*.md" {
  const text: string;
  export default text;
}
