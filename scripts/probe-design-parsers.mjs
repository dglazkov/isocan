#!/usr/bin/env node
/** Browser bundle/source-location probe for design-lint phase 1.
 * node scripts/probe-design-parsers.mjs [scratch-prefix-with-postcss-and-postcss-value-parser]
 * Optional comparison deps belong in a scratch prefix, not the application:
 * npm install --prefix /tmp/isocan-parser-probe --ignore-scripts postcss@8.5.28 postcss-value-parser@4.2.0
 */
import { build } from "esbuild";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import parseCss from "css-tree/parser";
import walk from "css-tree/walker";
import { parseFragment } from "parse5";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const version = (name, at = root) => {
  const local = createRequire(path.join(at, "package.json"));
  let directory = path.dirname(local.resolve(name));
  for (;;) {
    try { const manifest = JSON.parse(readFileSync(path.join(directory, "package.json"), "utf8")); if (manifest.name === name) return manifest.version; } catch {}
    const parent = path.dirname(directory); if (parent === directory) return "unknown"; directory = parent;
  }
};
const size = bytes => ({ raw: bytes.length, gzip: gzipSync(bytes).length });
const bundle = async (contents, resolveDir = root) => {
  const result = await build({ stdin: { contents, resolveDir }, bundle: true, minify: true, platform: "browser", format: "esm", write: false, logLevel: "silent" });
  return size(result.outputFiles[0].contents);
};
const standalone = {
  parse5: { version: version("parse5"), ...await bundle('export {parse,parseFragment} from "parse5"') },
  cssTree: { version: version("css-tree"), ...await bundle('export {default as parse} from "css-tree/parser"; export {default as walk} from "css-tree/walker"') },
  analyzer: await bundle('export {auditScreen} from "./packages/core/src/designaudit.ts"'),
};
if (process.argv[2]) {
  const scratch = path.resolve(process.argv[2]);
  standalone.postcss = { version: version("postcss", scratch), valueParserVersion: version("postcss-value-parser", scratch), ...await bundle('export {default as parse} from "postcss"; export {default as valueParser} from "postcss-value-parser"', scratch) };
}
const cssInputs = ['p{font:italic 13px/1.4 sans-serif;color:var(--x,var(--y,#ff0000))}', 'p{color:#ff0000;broken;padding:13px}', 'p{color:var(--ink'];
const css = cssInputs.map(source => {
  const errors = [], values = [];
  const ast = parseCss(source, { positions: true, parseCustomProperty: true, onParseError: error => errors.push({ message: error.message, offset: error.offset }) });
  walk(ast, node => { if (["Declaration", "Raw", "Function"].includes(node.type)) values.push({ type: node.type, start: node.loc.start.offset, end: node.loc.end.offset, source: source.slice(node.loc.start.offset, node.loc.end.offset) }); });
  return { source, errors, values };
});
const html = '<p style="color:&#35;ff0000">Acme</p>';
const element = parseFragment(html, { sourceCodeLocationInfo: true }).childNodes[0];
const htmlProbe = { source: html, decodedStyle: element.attrs[0].value, range: element.sourceCodeLocation.attrs.style };
const assetsDirectory = path.join(root, "packages/web/dist/assets");
let app = null;
try {
  const assets = readdirSync(assetsDirectory).filter(name => name.endsWith(".js")).map(name => ({ name, ...size(readFileSync(path.join(assetsDirectory, name))) }));
  const html = readFileSync(path.join(root, "packages/web/dist/index.html"), "utf8");
  const entryName = html.match(/src="\/assets\/([^" ]+\.js)"/)?.[1];
  app = { entry: assets.find(asset => asset.name === entryName) ?? null, raw: assets.reduce((n, a) => n + a.raw, 0), gzip: assets.reduce((n, a) => n + a.gzip, 0), assets };
} catch {}
console.log(JSON.stringify({ node: process.version, esbuild: require("esbuild/package.json").version, entities: version("entities"), standalone, css, html: htmlProbe, app }, null, 2));
