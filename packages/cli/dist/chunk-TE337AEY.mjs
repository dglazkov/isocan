import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);

// packages/core/src/designmd.ts
var DESIGN_SECTIONS = [
  "Overview",
  "Colors",
  "Typography",
  "Layout",
  "Elevation & Depth",
  "Shapes",
  "Components",
  "Do's and Don'ts"
];
var SECTION_ALIASES = {
  "brand & style": "Overview",
  "layout & spacing": "Layout",
  elevation: "Elevation & Depth",
  "dos and don'ts": "Do's and Don'ts",
  "do's and don'ts": "Do's and Don'ts"
};
function canonicalSection(heading) {
  const key = heading.trim().toLowerCase();
  if (SECTION_ALIASES[key]) return SECTION_ALIASES[key];
  const match = DESIGN_SECTIONS.find((section) => section.toLowerCase() === key);
  return match ?? heading.trim();
}
var UNSAFE_KEYS = /* @__PURE__ */ new Set(["__proto__", "prototype", "constructor"]);
var parsedProblems = /* @__PURE__ */ new WeakMap();
function assertJsonCompatible(value, path = "isocan", ancestors = /* @__PURE__ */ new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value) && !Object.is(value, -0)) return;
  if (typeof value !== "object") throw new Error(`${path}: ${typeof value} value is not losslessly JSON-compatible`);
  if (ancestors.has(value)) throw new Error(`${path}: cyclic data is not JSON-compatible`);
  const array = Array.isArray(value);
  if (!array && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new Error(`${path}: only plain JSON objects and arrays are supported`);
  }
  ancestors.add(value);
  if (array && Object.keys(value).length !== value.length) throw new Error(`${path}: sparse arrays or extra array properties are not supported`);
  for (const key of Reflect.ownKeys(value)) {
    if (array && key === "length") continue;
    if (typeof key !== "string" || UNSAFE_KEYS.has(key)) throw new Error(`${path}: unsafe or symbol key ${String(key)} is not supported`);
    if (array && !/^(0|[1-9]\d*)$/.test(key)) throw new Error(`${path}: extra array key ${key} is not supported`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!("value" in descriptor) || !descriptor.enumerable) throw new Error(`${path}.${key}: accessors and non-enumerable data are not supported`);
    assertJsonCompatible(descriptor.value, `${path}.${key}`, ancestors);
  }
  ancestors.delete(value);
}
function parseDesignJson(text) {
  const value = JSON.parse(text);
  const parts = text.match(/"(?:\\.|[^"\\])*"|[{}[\]:,]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g) ?? [];
  let at = 0;
  const inspect = () => {
    const next = parts[at++];
    if (next === "{") {
      const keys = /* @__PURE__ */ new Set();
      while (parts[at] !== "}") {
        const key = JSON.parse(parts[at++]);
        if (keys.has(key)) throw new Error(`duplicate key "${key}" is not supported`);
        if (UNSAFE_KEYS.has(key)) throw new Error(`unsafe key "${key}" is not supported`);
        keys.add(key);
        at += 1;
        inspect();
        if (parts[at] !== ",") break;
        at += 1;
      }
      at += 1;
    } else if (next === "[") {
      while (parts[at] !== "]") {
        inspect();
        if (parts[at] !== ",") break;
        at += 1;
      }
      at += 1;
    }
  };
  inspect();
  assertJsonCompatible(value, "JSON");
  return value;
}
function assertDesignConvertible(tokens) {
  const problems = parsedProblems.get(tokens);
  if (problems?.length) throw new Error(`Cannot convert DESIGN.md with front matter problems: ${problems.join("; ")}`);
  const extension = Object.getOwnPropertyDescriptor(tokens, "isocan");
  if (extension) {
    if (!("value" in extension) || !extension.enumerable) throw new Error("isocan: accessors and non-enumerable data are not supported");
    assertJsonCompatible(extension.value);
  }
}
function scalar(raw) {
  const value = raw.trim();
  if (value.startsWith('"') || value.startsWith("{") || value.startsWith("[")) return parseDesignJson(value);
  if (value.startsWith("'")) {
    if (!/^'(?:[^']|'')*'$/.test(value)) throw new Error("unsupported or unterminated single-quoted scalar");
    return value.slice(1, -1).replace(/''/g, "'");
  }
  if (/^(?:true|false|null)$/.test(value) || /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value)) return parseDesignJson(value);
  if (/^(?:true|false|null)$/i.test(value)) return JSON.parse(value.toLowerCase());
  if (value === "~") return null;
  if (/^[+-]?(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?[\d_]+)?$|^[+-]?0[xob][\da-f_]+$/i.test(value)) {
    throw new Error("unsupported YAML number; use JSON numeric syntax or quote the value");
  }
  if (/^[&*!%@`]|^[|>]|^(?:[-?]\s)|:\s|^[+-]?\.(?:inf|nan)$/i.test(value)) throw new Error("unsupported YAML scalar; use a quoted string or JSON flow value");
  return value;
}
function withoutComment(raw) {
  let quote2 = "";
  for (let i = 0; i < raw.length; i += 1) {
    const c = raw[i];
    if (quote2 === '"' && c === "\\") {
      i += 1;
      continue;
    }
    if (quote2 === "'" && c === "'" && raw[i + 1] === "'") {
      i += 1;
      continue;
    }
    if (quote2) {
      if (c === quote2) quote2 = "";
      continue;
    }
    if ((c === '"' || c === "'") && (i === 0 || /[\s:[{,]/.test(raw[i - 1]))) quote2 = c;
    if (c === "#" && (i === 0 || /\s/.test(raw[i - 1]))) return raw.slice(0, i);
  }
  return raw;
}
function readLines(yaml, problems) {
  const out = [];
  yaml.split(/\r?\n/).forEach((raw, i) => {
    const clean = withoutComment(raw);
    if (clean.trim() === "") return;
    if (/^\s*\t/.test(clean)) {
      problems.push(`line ${i + 1}: tabs are not valid YAML indentation`);
      return;
    }
    out.push({ indent: clean.length - clean.trimStart().length, text: clean.trim(), n: i + 1 });
  });
  return out;
}
function mapPair(text) {
  const match = /^("(?:\\.|[^"\\])*"|'(?:[^']|'')*'|[A-Za-z0-9_.-]+):(?:\s+(.*)|$)/.exec(text);
  if (!match) return null;
  const rawKey = match[1].trim();
  if (!/^[A-Za-z0-9_.-]+$/.test(rawKey) && !/^["']/.test(rawKey)) throw new Error("unsupported YAML key; use a plain key or JSON flow value");
  const key = /^["']/.test(rawKey) ? scalar(rawKey) : rawKey;
  if (typeof key !== "string" || !key) throw new Error("map keys must be nonempty strings");
  if (UNSAFE_KEYS.has(key)) throw new Error(`unsafe key "${key}" is not supported`);
  return [key, match[2]?.trim() ?? ""];
}
var isList = (text) => text === "-" || text.startsWith("- ");
function readBlock(lines, at, indent, problems, path = []) {
  if (isList(lines[at].text)) {
    const items = [];
    let i2 = at;
    while (i2 < lines.length && lines[i2].indent === indent && isList(lines[i2].text)) {
      const line = lines[i2];
      const rest = line.text.slice(1).trim();
      try {
        if (!rest) {
          const next = lines[i2 + 1];
          if (!next || next.indent <= indent) {
            items.push(null);
            i2 += 1;
            continue;
          }
          const [value, after] = readBlock(lines, i2 + 1, next.indent, problems, path);
          items.push(value);
          i2 = after;
          continue;
        }
        if (mapPair(rest)) {
          const changed = [...lines];
          changed[i2] = { ...line, indent: indent + 2, text: rest };
          const [value, after] = readBlock(changed, i2, indent + 2, problems, path);
          items.push(value);
          i2 = after;
          continue;
        }
        items.push(scalar(rest));
      } catch (error) {
        problems.push(`line ${line.n}: ${error.message}`);
      }
      i2 += 1;
    }
    return [items, i2];
  }
  const map = {};
  let i = at;
  while (i < lines.length && lines[i].indent >= indent) {
    const line = lines[i];
    if (line.indent > indent) {
      problems.push(`line ${line.n}: unexpected indentation`);
      i += 1;
      continue;
    }
    let pair;
    try {
      pair = mapPair(line.text);
    } catch (error) {
      problems.push(`line ${line.n}: ${error.message}`);
      i += 1;
      continue;
    }
    if (!pair) {
      problems.push(`line ${line.n}: expected "key: value"`);
      i += 1;
      continue;
    }
    const [key, rest] = pair;
    const duplicate = Object.hasOwn(map, key);
    if (duplicate) problems.push(`line ${line.n}: duplicate key "${key}" is not supported`);
    let value;
    if (/^[|>][+-]?$/.test(rest)) {
      if (path[0] === "isocan" || key === "isocan") problems.push(`line ${line.n}: block scalars in isocan are unsupported; use a quoted string or JSON flow value`);
      const parts = [];
      i += 1;
      while (i < lines.length && lines[i].indent > indent) {
        parts.push(lines[i].text);
        i += 1;
      }
      value = parts.join(rest.startsWith(">") ? " " : "\n");
    } else if (rest) {
      try {
        value = scalar(rest);
      } catch (error) {
        problems.push(`line ${line.n}: ${error.message}`);
        i += 1;
        continue;
      }
      i += 1;
    } else {
      const next = lines[i + 1];
      if (!next || next.indent <= indent) {
        value = {};
        i += 1;
      } else {
        const result = readBlock(lines, i + 1, next.indent, problems, [...path, key]);
        value = result[0];
        i = result[1];
      }
    }
    if (!duplicate) map[key] = value;
  }
  return [map, i];
}
function parseFrontMatter(yaml) {
  const problems = [];
  const lines = readLines(yaml, problems);
  if (lines.length === 0) {
    const data2 = {};
    if (problems.length) parsedProblems.set(data2, [...problems]);
    return { data: data2, problems };
  }
  const [value, after] = readBlock(lines, 0, lines[0].indent, problems);
  if (after < lines.length) problems.push(`line ${lines[after].n}: unexpected trailing block`);
  const data = value && !Array.isArray(value) && typeof value === "object" ? value : {};
  if (data !== value) problems.push("front matter must be a map");
  if (problems.length) parsedProblems.set(data, [...problems]);
  return { data, problems };
}
function parseDesign(text) {
  const problems = [];
  let tokens = {};
  let body = text;
  const front = /^﻿?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (front) {
    body = text.slice(front[0].length);
    const { data, problems: yamlProblems } = parseFrontMatter(front[1]);
    problems.push(...yamlProblems);
    tokens = data;
  }
  const sections = [];
  const lines = body.split(/\r?\n/);
  let current = null;
  for (const line of lines) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      if (current) sections.push({ title: current.title, body: current.lines.join("\n").trim() });
      current = { title: canonicalSection(heading[1]), lines: [] };
      continue;
    }
    current?.lines.push(line);
  }
  if (current) sections.push({ title: current.title, body: current.lines.join("\n").trim() });
  return { tokens, body: body.trim(), sections, problems };
}
function referencesIn(value) {
  return [...value.matchAll(/\{([^{}]+)\}/g)].map((m) => `{${m[1].trim()}}`);
}
function unresolvedReferences(tokens, value) {
  return referencesIn(value).filter((ref) => resolveToken(tokens, ref) === null);
}
function resolveToken(tokens, reference) {
  const path = /^\{([^}]+)\}$/.exec(reference.trim());
  if (!path) return null;
  let node = tokens;
  for (const step of path[1].split(".")) {
    if (typeof node !== "object" || node === null) return null;
    node = node[step];
  }
  return node ?? null;
}
function serializeDesign(tokens, body) {
  assertDesignConvertible(tokens);
  const yaml = toYaml(tokens, 0).trimEnd();
  return `---
${yaml}
---

${body.trim()}
`;
}
function toYaml(value, depth) {
  const pad = "  ".repeat(depth);
  let out = "";
  for (const [key, item] of Object.entries(value)) {
    if (UNSAFE_KEYS.has(key)) throw new Error(`unsafe key "${key}" is not supported`);
    if (depth === 0 && key === "isocan") {
      out += `${pad}isocan: ${JSON.stringify(item)}
`;
      continue;
    }
    if (item === void 0) continue;
    if (Array.isArray(item)) {
      out += `${pad}${key}:
`;
      for (const entry of item) {
        if (entry && typeof entry === "object") {
          const pairs = Object.entries(entry);
          const [first, ...rest] = pairs;
          if (!first) continue;
          out += `${pad}  - ${first[0]}: ${quote(first[1])}
`;
          for (const [k, v] of rest) out += `${pad}    ${k}: ${quote(v)}
`;
        } else {
          out += `${pad}  - ${quote(entry)}
`;
        }
      }
      continue;
    }
    if (item && typeof item === "object") {
      out += `${pad}${key}:
${toYaml(item, depth + 1)}`;
      continue;
    }
    out += `${pad}${key}: ${quote(item)}
`;
  }
  return out;
}
function quote(value) {
  if (value === null || typeof value === "number" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value !== "string") throw new Error("unsupported YAML scalar; use JSON-compatible isocan extension data");
  const plain = /^[A-Za-z0-9 ._/-]+$/.test(value) && value.trim() === value;
  return plain && !/^(?:true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[+-]?\.(?:inf|nan))$/i.test(value) ? value : JSON.stringify(value);
}

// packages/core/src/contrast.ts
var CONTRAST_BODY = 4.5;
var CONTRAST_UI = 3;
function parseHex(color) {
  const hex = color.trim().replace(/^#/, "");
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return null;
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16)
  };
}
function channel(value) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function luminance(color) {
  const rgb = parseHex(color);
  if (!rgb) return null;
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}
function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return Math.round((light + 0.05) / (dark + 0.05) * 100) / 100;
}
function passesContrast(a, b, need = CONTRAST_BODY) {
  const ratio = contrastRatio(a, b);
  return ratio === null ? null : ratio >= need;
}

// packages/core/src/design-contract.ts
var own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
var object = (value) => !!value && typeof value === "object" && !Array.isArray(value);
var identifier = /^[A-Za-z_][A-Za-z0-9_-]*$/;
var propertyName = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
var sides = ["top", "right", "bottom", "left"];
var corners = ["top-left", "top-right", "bottom-right", "bottom-left"];
var ownedProperties = /* @__PURE__ */ new Set(["padding", ...sides.map((side) => `padding-${side}`), "border-radius", ...corners.map((corner) => `border-${corner}-radius`), "font-size", "font-weight"]);
var length = /^(?:0|(?:\d*\.)?\d+(?:px|em|rem|ex|rex|cap|rcap|ch|rch|ic|ric|lh|rlh|vw|vh|vi|vb|vmin|vmax|svw|svh|svi|svb|svmin|svmax|lvw|lvh|lvi|lvb|lvmin|lvmax|dvw|dvh|dvi|dvb|dvmin|dvmax|cqw|cqh|cqi|cqb|cqmin|cqmax|cm|mm|q|in|pt|pc|%))$/i;
function resolveContractValue(tokens, value, seen = []) {
  if (seen.length > 32) return null;
  let failed = false;
  const resolved = value.replace(/\{([^{}]+)\}/g, (reference) => {
    if (seen.includes(reference)) {
      failed = true;
      return "";
    }
    const token = resolveToken(tokens, reference);
    if (typeof token !== "string" && !(typeof token === "number" && Number.isFinite(token))) {
      failed = true;
      return "";
    }
    const next = resolveContractValue(tokens, String(token), [...seen, reference]);
    if (next === null) {
      failed = true;
      return "";
    }
    return next;
  });
  return failed || /[{}]/.test(resolved) ? null : resolved.trim();
}
function contractLonghands(property) {
  return property === "padding" ? sides.map((side) => `padding-${side}`) : property === "border-radius" ? corners.map((corner) => `border-${corner}-radius`) : [property];
}
function supportedValue(property, value) {
  const scalar2 = value.replace(/var\(\s*--[\w-]+\s*\)/g, property === "font-weight" ? "400" : "1px");
  if (property === "font-weight") return /^(?:normal|bold|[1-9]\d{0,2}|1000)$/.test(scalar2);
  if (property === "font-size") return length.test(scalar2) || /^(?:xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large)$/.test(scalar2);
  const axes = scalar2.split("/");
  const radius = property.includes("radius");
  if (axes.length > (radius ? 2 : 1)) return false;
  if (radius && property !== "border-radius") return axes.length === 1 && scalar2.trim().split(/\s+/).length <= 2 && scalar2.trim().split(/\s+/).every((one) => length.test(one));
  return axes.every((axis) => {
    const values = axis.trim().split(/\s+/);
    return values.length <= (property === "padding" || property === "border-radius" ? 4 : 1) && values.every((one) => length.test(one));
  });
}
function compileDesignContract(tokens) {
  const extension = tokens.isocan;
  const report = {
    status: "default",
    original: extension ?? null,
    effective: { version: 1, literals: "allow", recipes: {}, exceptions: {} },
    problems: [],
    boundary: "Version 1 checks inline declarations and direct static type, class, ID and exact attribute selectors. Padding, physical radius corners, font size and weight are supported; external, dynamic and unresolved cascade paths remain unexamined.",
    appliedTreatments: [],
    appliedExceptions: []
  };
  const problem = (path, message, code = "unsupported-policy") => {
    report.problems.push({ code, path, message });
  };
  const unknown = (value, allowed, path) => {
    for (const key of Object.keys(value)) if (!allowed.includes(key)) problem(`${path}.${key}`, `Unknown contract field ${key}.`);
  };
  if (extension === void 0) return report;
  if (!object(extension)) {
    problem("isocan", "The isocan extension must be an object.");
    report.status = "unsupported";
    report.effective = null;
    return report;
  }
  if (!own(extension, "lint")) return report;
  const lint = extension.lint;
  if (!object(lint) || lint.version !== 1) {
    problem("isocan.lint.version", "Only integer contract version 1 is supported; marker semantics are unexamined.");
    report.status = "unsupported";
    report.effective = null;
    return report;
  }
  report.status = "supported";
  const effective = report.effective;
  unknown(lint, ["version", "literals", "recipes", "exceptions"], "isocan.lint");
  if (lint.literals !== void 0) {
    if (lint.literals === "allow" || lint.literals === "require-references") effective.literals = lint.literals;
    else problem("isocan.lint.literals", "literals must be allow or require-references.");
  }
  const mapping = (value, path) => {
    if (value === void 0) return {};
    if (object(value)) return value;
    problem(path, "Expected a map.");
    return {};
  };
  const names = (value, path) => {
    if (value === void 0) return [];
    if (!Array.isArray(value) || value.some((one) => typeof one !== "string" || !propertyName.test(one))) {
      problem(path, "Expected a list of lowercase CSS property names.");
      return [];
    }
    return [...new Set(value)];
  };
  const values = (value, path, only) => {
    const result = {};
    for (const [property, raw] of Object.entries(mapping(value, path))) {
      if (!ownedProperties.has(property)) {
        problem(`${path}.${property}`, `Ownership of ${property} is unsupported in version 1.`);
        continue;
      }
      if (only && !only.has(property)) {
        problem(`${path}.${property}`, "A treatment may replace only a property explicitly named in owns.");
        continue;
      }
      if (typeof raw !== "string" || !raw.trim()) {
        problem(`${path}.${property}`, "An owned value must be a nonempty CSS value or token reference string.");
        continue;
      }
      const resolved = resolveContractValue(tokens, raw);
      if (resolved === null || !supportedValue(property, resolved)) {
        problem(`${path}.${property}`, "The value or its token references cannot be resolved within the supported static property grammar.");
        continue;
      }
      result[property] = raw.trim();
    }
    return result;
  };
  for (const [name, raw] of Object.entries(mapping(lint.recipes, "isocan.lint.recipes"))) {
    const path = `isocan.lint.recipes.${name}`;
    if (!identifier.test(name) || ["__proto__", "constructor", "prototype"].includes(name)) {
      problem(path, "Recipe names must be safe plain identifiers.");
      continue;
    }
    if (!object(raw)) {
      problem(path, "A recipe must be an object.");
      continue;
    }
    unknown(raw, ["owns", "allow", "treatments"], path);
    const recipe = { owns: values(raw.owns, `${path}.owns`), allow: names(raw.allow, `${path}.allow`), treatments: {} };
    effective.recipes[name] = recipe;
    for (const [treatment, overrides] of Object.entries(mapping(raw.treatments, `${path}.treatments`))) {
      if (!identifier.test(treatment) || ["__proto__", "constructor", "prototype"].includes(treatment)) {
        problem(`${path}.treatments.${treatment}`, "Treatment names must be safe plain identifiers.");
        continue;
      }
      recipe.treatments[treatment] = values(overrides, `${path}.treatments.${treatment}`, new Set(Object.keys(recipe.owns)));
    }
  }
  for (const [name, raw] of Object.entries(mapping(lint.exceptions, "isocan.lint.exceptions"))) {
    const path = `isocan.lint.exceptions.${name}`;
    if (!identifier.test(name) || ["__proto__", "constructor", "prototype"].includes(name)) {
      problem(path, "Exception names must be safe plain identifiers.");
      continue;
    }
    if (!object(raw)) {
      problem(path, "An exception must be an object.");
      continue;
    }
    unknown(raw, ["recipe", "properties", "reason"], path);
    const props = names(raw.properties, `${path}.properties`);
    const recipe = typeof raw.recipe === "string" && own(effective.recipes, raw.recipe) ? effective.recipes[raw.recipe] : void 0;
    if (!recipe || !props.length || props.some((property) => !own(recipe.owns, property)) || typeof raw.reason !== "string" || !raw.reason.trim()) {
      problem(path, "An exception needs a known recipe, its explicit owned properties and a nonempty reason.");
      continue;
    }
    effective.exceptions[name] = { recipe: raw.recipe, properties: props, reason: raw.reason.trim() };
  }
  if (report.problems.length) report.status = "partial";
  return report;
}

// packages/core/src/tokens.ts
var DTCG_SCHEMA = "https://www.designtokens.org/schemas/2025.10/format.json";
var DTCG_EXTENSION = "io.isocan";
function toDtcg(tokens) {
  assertDesignConvertible(tokens);
  const out = { $schema: DTCG_SCHEMA };
  const unexported = {};
  if (tokens.colors && Object.keys(tokens.colors).length > 0) {
    const group = {};
    for (const [name, value] of Object.entries(tokens.colors)) {
      const leaf = colorLeaf(String(value));
      if (leaf) group[name] = leaf;
      else unexported[`colors.${name}`] = { value, why: "not a colour sRGB can state exactly \u2014 oklch(), color-mix(), a name" };
    }
    if (Object.keys(group).length > 0) out.color = group;
  }
  for (const key of ["spacing", "rounded"]) {
    const values = tokens[key];
    if (!values || Object.keys(values).length === 0) continue;
    const group = {};
    for (const [name, value] of Object.entries(values)) {
      const leaf = dimensionLeaf(value);
      if (leaf) group[name] = leaf;
      else unexported[`${key}.${name}`] = { value, why: "not a px or rem length, and not a bare number" };
    }
    if (Object.keys(group).length > 0) out[key] = group;
  }
  if (tokens.typography && Object.keys(tokens.typography).length > 0) {
    const group = {};
    for (const [name, level] of Object.entries(tokens.typography)) {
      const made = typographyLeaf(level);
      if (made.ok) group[name] = made.leaf;
      else unexported[`typography.${name}`] = { value: level, why: made.why };
    }
    if (Object.keys(group).length > 0) out.typography = group;
  }
  const ours = {};
  if (Object.hasOwn(tokens, "isocan")) ours.isocan = JSON.parse(JSON.stringify(tokens.isocan));
  if (tokens.components && Object.keys(tokens.components).length > 0) {
    ours.components = tokens.components;
  }
  if (Object.keys(unexported).length > 0) ours.unexported = unexported;
  if (Object.keys(ours).length > 0) out.$extensions = { [DTCG_EXTENSION]: ours };
  return out;
}
function colorLeaf(value) {
  if (isReference(value)) return { $type: "color", $value: value };
  const srgb = parseSrgb(value);
  if (!srgb) return null;
  const color = {
    colorSpace: "srgb",
    components: [round(srgb.r / 255), round(srgb.g / 255), round(srgb.b / 255)],
    hex: `#${[srgb.r, srgb.g, srgb.b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`
  };
  if (srgb.alpha !== void 0 && srgb.alpha < 1) color.alpha = round(srgb.alpha);
  return { $type: "color", $value: color };
}
function parseSrgb(value) {
  const text = value.trim();
  const hex = parseHex(text);
  if (hex) return hex;
  const long = /^#([0-9a-f]{6})([0-9a-f]{2})$/i.exec(text);
  if (long) {
    const rgb = parseHex(`#${long[1]}`);
    return { ...rgb, alpha: parseInt(long[2], 16) / 255 };
  }
  const fn = /^(rgba?|hsla?)\(\s*([^)]*)\)$/i.exec(text);
  if (!fn) return null;
  const parts = fn[2].split(/\s*[,/]\s*|\s+/).filter((p) => p.length > 0);
  if (parts.length < 3) return null;
  const num = (p, scale) => p.endsWith("%") ? Number(p.slice(0, -1)) / 100 * scale : Number(p);
  const alphaRaw = parts[3];
  const alpha = alphaRaw === void 0 ? void 0 : alphaRaw.endsWith("%") ? Number(alphaRaw.slice(0, -1)) / 100 : Number(alphaRaw);
  if (alpha !== void 0 && Number.isNaN(alpha)) return null;
  if (fn[1].toLowerCase().startsWith("rgb")) {
    const [r, g, b] = [num(parts[0], 255), num(parts[1], 255), num(parts[2], 255)];
    if ([r, g, b].some((c2) => Number.isNaN(c2))) return null;
    return { r, g, b, ...alpha === void 0 ? {} : { alpha } };
  }
  const h = Number(parts[0].replace(/deg$/i, ""));
  const s = num(parts[1], 1);
  const l = num(parts[2], 1);
  if ([h, s, l].some((c2) => Number.isNaN(c2))) return null;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(h / 60 % 2 - 1));
  const m = l - c / 2;
  const sector = Math.floor((h % 360 + 360) % 360 / 60);
  const [r1, g1, b1] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x]
  ][sector];
  return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255, ...alpha === void 0 ? {} : { alpha } };
}
function dimensionLeaf(value) {
  if (typeof value === "string" && isReference(value)) return { $type: "dimension", $value: value };
  const dim = dimensionOrZero(value);
  if (dim) return { $type: "dimension", $value: dim };
  if (typeof value === "number") {
    return { $type: "number", $value: value, $description: "unitless in DESIGN.md \u2014 a ratio, not a length" };
  }
  return null;
}
var WEIGHT_WORDS = /* @__PURE__ */ new Set([
  "thin",
  "hairline",
  "extra-light",
  "ultra-light",
  "light",
  "normal",
  "regular",
  "book",
  "medium",
  "semi-bold",
  "demi-bold",
  "bold",
  "extra-bold",
  "ultra-bold",
  "black",
  "heavy",
  "extra-black",
  "ultra-black"
]);
function typographyLeaf(level) {
  const value = {};
  const filled = [];
  if (level.fontFamily === void 0) return { ok: false, why: "no fontFamily \u2014 the composite requires one and there is nothing honest to fill it with" };
  value.fontFamily = /^\{[^{}]+\}$/.test(level.fontFamily.trim()) ? level.fontFamily : level.fontFamily.split(",").map((f) => f.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  if (value.fontFamily.length === 1) value.fontFamily = value.fontFamily[0];
  const size = dimensionOrZero(level.fontSize) ?? (typeof level.fontSize === "string" && isReference(level.fontSize) ? level.fontSize : null);
  if (!size) return { ok: false, why: `fontSize "${String(level.fontSize)}" is not a px or rem length` };
  value.fontSize = size;
  if (level.fontWeight !== void 0) {
    const weight = level.fontWeight;
    const numeric = typeof weight === "number" ? weight : /^\d+$/.test(String(weight).trim()) ? Number(weight) : null;
    const word = String(weight).trim().toLowerCase();
    if (numeric !== null && numeric >= 1 && numeric <= 1e3) value.fontWeight = numeric;
    else if (WEIGHT_WORDS.has(word)) value.fontWeight = word;
    else return { ok: false, why: `fontWeight "${String(weight)}" is neither 1\u20131000 nor a weight the spec names` };
  } else {
    value.fontWeight = 400;
    filled.push("fontWeight");
  }
  if (level.lineHeight !== void 0) {
    const raw = level.lineHeight;
    const lhPx = parseDimension(raw);
    const lh = typeof raw === "number" ? raw : /^\d+(\.\d+)?$/.test(String(raw).trim()) ? Number(raw) : lhPx && lhPx.unit === "px" && typeof size === "object" && size.unit === "px" && size.value > 0 ? round(lhPx.value / size.value) : null;
    if (lh === null) return { ok: false, why: `lineHeight "${String(raw)}" is not a ratio, and not a px length over a px size` };
    value.lineHeight = lh;
  } else {
    value.lineHeight = 1.2;
    filled.push("lineHeight");
  }
  if (level.letterSpacing !== void 0) {
    const tracking = dimensionOrZero(level.letterSpacing);
    if (!tracking) return { ok: false, why: `letterSpacing "${String(level.letterSpacing)}" is not a px or rem length` };
    value.letterSpacing = tracking;
  } else {
    value.letterSpacing = { value: 0, unit: "px" };
    filled.push("letterSpacing");
  }
  const extra = {};
  if (level.fontFeature !== void 0) extra.fontFeature = level.fontFeature;
  if (level.fontVariation !== void 0) extra.fontVariation = level.fontVariation;
  const leaf = { $type: "typography", $value: value };
  if (filled.length > 0) leaf.$description = `${filled.join(", ")}: not in DESIGN.md \u2014 CSS initial value${filled.length === 1 ? "" : "s"}, which the composite requires`;
  if (Object.keys(extra).length > 0) leaf.$extensions = { [DTCG_EXTENSION]: extra };
  return { ok: true, leaf };
}
function dimensionOrZero(value) {
  if (value === 0 || value === "0") return { value: 0, unit: "px" };
  return parseDimension(value);
}
function fromDtcg(dtcg) {
  assertJsonCompatible(dtcg, "DTCG");
  const tokens = {};
  const colorGroup = dtcg.color ?? dtcg.colors;
  const colors = leaves(colorGroup, (value) => dtcgColorString(value));
  if (colors) tokens.colors = colors;
  const spacing = leaves(dtcg.spacing, (value) => dtcgDimensionString(value));
  if (spacing) tokens.spacing = spacing;
  const rounded = leaves(dtcg.rounded, (value) => dtcgDimensionString(value));
  if (rounded) tokens.rounded = rounded;
  const typography = leaves(dtcg.typography, (value, leaf) => typographyLevel(value, leaf));
  if (typography) tokens.typography = typography;
  const ours = dtcg.$extensions?.[DTCG_EXTENSION];
  if (ours !== void 0 && (!ours || typeof ours !== "object" || Array.isArray(ours))) throw new Error(`DTCG $extensions["${DTCG_EXTENSION}"]: expected an object; native extension data cannot be restored`);
  if (ours?.components && typeof ours.components === "object") {
    tokens.components = ours.components;
  }
  if (ours && Object.hasOwn(ours, "isocan")) tokens.isocan = JSON.parse(JSON.stringify(ours.isocan));
  for (const [path, entry] of Object.entries(ours?.unexported ?? {})) {
    const [bucket, ...name] = path.split(".");
    const key = name.join(".");
    if (!key || !entry || typeof entry !== "object" || !Object.hasOwn(entry, "value")) continue;
    assertJsonCompatible({ [key]: entry.value }, `DTCG.unexported.${path}`);
    if (bucket === "colors" || bucket === "rounded" || bucket === "spacing") {
      if (typeof entry.value !== "string" && !(bucket === "spacing" && typeof entry.value === "number")) continue;
      const group = tokens[bucket] ??= {};
      group[key] = entry.value;
    } else if (bucket === "typography" && entry.value && typeof entry.value === "object" && !Array.isArray(entry.value)) {
      (tokens.typography ??= {})[key] = entry.value;
    }
  }
  return tokens;
}
function leaves(group, read) {
  if (!group || typeof group !== "object") return null;
  const values = {};
  for (const [name, node] of Object.entries(group)) {
    if (name.startsWith("$")) continue;
    const leaf = node && typeof node === "object" ? node : { $value: node };
    const value = leaf.$value !== void 0 ? read(leaf.$value, leaf) : void 0;
    if (value !== void 0) values[name] = value;
  }
  return Object.keys(values).length > 0 ? values : null;
}
function dtcgColorString(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const color = value;
    if (typeof color.hex === "string") return color.hex;
    if (Array.isArray(color.components) && color.components.length >= 3) {
      const [r, g, b] = color.components;
      return `#${[r, g, b].map((c) => Math.round(Math.max(0, Math.min(1, Number(c))) * 255).toString(16).padStart(2, "0")).join("")}`;
    }
  }
  return void 0;
}
function dtcgDimensionString(value) {
  if (typeof value === "string" || typeof value === "number") return value;
  if (value && typeof value === "object") {
    const dim = value;
    if (typeof dim.value === "number" && typeof dim.unit === "string") return `${dim.value}${dim.unit}`;
  }
  return void 0;
}
function typographyLevel(value, leaf) {
  if (!value || typeof value !== "object") return void 0;
  const raw = value;
  const level = {};
  if (typeof raw.fontFamily === "string") level.fontFamily = raw.fontFamily;
  else if (Array.isArray(raw.fontFamily)) level.fontFamily = raw.fontFamily.map(String).join(", ");
  const size = dtcgDimensionString(raw.fontSize);
  if (size !== void 0) level.fontSize = String(size);
  if (typeof raw.fontWeight === "number" || typeof raw.fontWeight === "string") level.fontWeight = raw.fontWeight;
  if (typeof raw.lineHeight === "number" || typeof raw.lineHeight === "string") level.lineHeight = raw.lineHeight;
  const tracking = dtcgDimensionString(raw.letterSpacing);
  if (tracking !== void 0) level.letterSpacing = String(tracking);
  const extra = leaf.$extensions?.[DTCG_EXTENSION];
  if (typeof extra?.fontFeature === "string") level.fontFeature = extra.fontFeature;
  if (typeof extra?.fontVariation === "string") level.fontVariation = extra.fontVariation;
  return level;
}
function isReference(value) {
  return typeof value === "string" && /^\{[^{}]+\}$/.test(value.trim());
}
function parseDimension(value) {
  if (typeof value !== "string") return null;
  const m = /^(-?\d+(?:\.\d+)?)(px|rem)$/.exec(value.trim());
  return m ? { value: Number(m[1]), unit: m[2] } : null;
}
function round(n) {
  return Math.round(n * 1e4) / 1e4;
}
function designConversionNotes(tokens, format) {
  return format === "css" && Object.hasOwn(tokens, "isocan") ? [
    "CSS exports token values only; isocan policies, recipes, exceptions and other extension data are not preserved. Use DESIGN.md or DTCG JSON for a contract round trip."
  ] : [];
}
function toCss(tokens) {
  assertDesignConvertible(tokens);
  const lines = [...designConversionNotes(tokens, "css").map((note) => `/* ${note} */`), ":root {"];
  const put = (name, value) => lines.push(`  --${name}: ${String(value)};`);
  for (const [name, value] of Object.entries(tokens.colors ?? {})) put(`color-${kebab(name)}`, deref(value));
  for (const [name, value] of Object.entries(tokens.spacing ?? {})) put(`space-${kebab(name)}`, deref(value));
  for (const [name, value] of Object.entries(tokens.rounded ?? {})) put(`radius-${kebab(name)}`, deref(value));
  for (const [name, type] of Object.entries(tokens.typography ?? {})) {
    const key = kebab(name);
    if (type.fontFamily) put(`font-${key}`, type.fontFamily);
    if (type.fontSize) put(`size-${key}`, type.fontSize);
    if (type.fontWeight !== void 0) put(`weight-${key}`, type.fontWeight);
    if (type.lineHeight !== void 0) put(`leading-${key}`, type.lineHeight);
    if (type.letterSpacing) put(`tracking-${key}`, type.letterSpacing);
  }
  lines.push("}");
  for (const [name] of Object.entries(tokens.typography ?? {})) {
    const key = kebab(name);
    const parts = [`font-family: var(--font-${key});`, `font-size: var(--size-${key});`];
    if (tokens.typography[name].fontWeight !== void 0) parts.push(`font-weight: var(--weight-${key});`);
    if (tokens.typography[name].lineHeight !== void 0) parts.push(`line-height: var(--leading-${key});`);
    if (tokens.typography[name].letterSpacing) parts.push(`letter-spacing: var(--tracking-${key});`);
    lines.push("", `.${key} { ${parts.join(" ")} }`);
  }
  return `${lines.join("\n")}
`;
}
function deref(value) {
  const ref = /^\{([^}]+)\}$/.exec(String(value));
  if (!ref) return value;
  const path = ref[1].split(".");
  const group = path[0] === "colors" ? "color" : path[0] === "spacing" ? "space" : path[0] === "rounded" ? "radius" : path[0];
  return `var(--${group}-${kebab(path.slice(1).join("-"))})`;
}
function kebab(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[_\s.]+/g, "-").toLowerCase();
}

export {
  DESIGN_SECTIONS,
  canonicalSection,
  assertJsonCompatible,
  parseDesignJson,
  parseFrontMatter,
  parseDesign,
  referencesIn,
  unresolvedReferences,
  resolveToken,
  serializeDesign,
  CONTRAST_BODY,
  CONTRAST_UI,
  parseHex,
  luminance,
  contrastRatio,
  passesContrast,
  resolveContractValue,
  contractLonghands,
  compileDesignContract,
  DTCG_SCHEMA,
  DTCG_EXTENSION,
  toDtcg,
  parseSrgb,
  fromDtcg,
  dtcgColorString,
  dtcgDimensionString,
  parseDimension,
  designConversionNotes,
  toCss
};
