// Synthetic, read-only compatibility measurements for the 14 Sep 2026 note.
// Usage (from the repo): node docs/research/shadcn-lint/probe.mjs /tmp/lint-probe
// First install @shadcn/lint@0.1.0, eslint@10.9.1,
// @typescript-eslint/parser@8.68.0 and tailwindcss@4.3.3 in that scratch prefix.
// No canvas access, application changes, or model calls.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const local = createRequire(new URL("../../../package.json", import.meta.url));
local("tsx/esm/api").register();
const { auditScreen } = await import("../../../packages/core/src/designaudit.ts");
const tokens = {
  colors: { primary: "#112233", background: "#ffffff" },
  typography: { body: { fontSize: "16px" } },
  rounded: { md: "8px" },
  spacing: { md: "16px" },
};
const inputs = {
  knownLiteral: '<p style="color:#112233">Acme</p>',
  offSystemLiteral: '<p style="color:#ff0000">Acme</p>',
  undefinedVariable: '<p style="color:var(--missing)">Acme</p>',
  undefinedVariableWithFallback: '<p style="color:var(--missing, #ff0000)">Acme</p>',
  offSystemSpacing: '<p style="padding:13px">Acme</p>',
  offSystemFontShorthand: '<p style="font:13px sans-serif">Acme</p>',
  proseOnly: '<p>The reference string is #ff0000.</p>',
};
const result = {
  node: process.version,
  tokens,
  html: Object.fromEntries(Object.entries(inputs).map(([name, source]) =>
    [name, { source, ...auditScreen(source, tokens) }])),
};

if (process.argv[2]) {
  const prefix = resolve(process.argv[2]);
  const upstream = createRequire(join(prefix, "package.json"));
  const { ESLint } = upstream("eslint");
  const parser = upstream("@typescript-eslint/parser");
  const { default: plugin } = await import(pathToFileURL(upstream.resolve("@shadcn/lint")));
  const fixture = join(prefix, "synthetic-fixture");
  mkdirSync(join(fixture, "components/ui"), { recursive: true });
  writeFileSync(join(fixture, "package.json"), JSON.stringify({ name: "acme-lint-probe", private: true }));
  writeFileSync(join(fixture, "components.json"), JSON.stringify({
    tailwind: { css: "theme.css" }, aliases: { ui: "./components/ui" },
  }));
  writeFileSync(join(fixture, "theme.css"), '@import "tailwindcss";\n@theme { --color-brand: #112233; }\n');
  writeFileSync(join(fixture, "components/ui/button.tsx"),
    'export function Button(props: {className?: string; size?: "sm" | "lg"}) { return <button {...props} />; }\n');
  const eslint = new ESLint({
    cwd: fixture, overrideConfigFile: true,
    overrideConfig: [{
      files: ["**/*.tsx"],
      languageOptions: { parser, parserOptions: { ecmaFeatures: { jsx: true } } },
      plugins: { shadcn: plugin },
      rules: {
        "shadcn/no-restyle": ["error", { allow: ["layout"] }],
        "shadcn/no-raw-colors": "error",
        "shadcn/no-arbitrary-values": "error",
        "shadcn/no-inline-styles": "error",
        "shadcn/no-unknown-classes": "error",
        "shadcn/require-static-classes": "error",
      },
    }],
  });
  const candidates = {
    "page.tsx": 'import { Button } from "./components/ui/button"; export const Page = () => <Button className="p-[13px] bg-[#ff0000] hovr:flex" />;',
    "clean.tsx": 'import { Button } from "./components/ui/button"; export const Page = () => <Button size="lg" className="mt-4" />;',
    "fractional.tsx": 'export const Page = () => <div className="p-3.25">Acme</div>;',
    "screen.html": '<!doctype html><html><style>p{color:#ff0000;padding:13px}</style><p>Acme</p></html>',
    "screen.css": 'p { color:#ff0000; padding:13px; }',
  };
  result.upstream = { version: upstream("@shadcn/lint/package.json").version, files: {} };
  for (const [filename, source] of Object.entries(candidates)) {
    const [reading] = await eslint.lintText(source, { filePath: join(fixture, filename) });
    result.upstream.files[filename] = {
      source, errorCount: reading.errorCount, warningCount: reading.warningCount,
      messages: reading.messages.map(({ ruleId, message, line, column }) => ({
        ruleId, message: message.replaceAll(`/private${fixture}`, "<fixture>").replaceAll(fixture, "<fixture>"), line, column,
      })),
    };
  }
}
console.log(JSON.stringify(result, null, 2));
