import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  AnPlusB_exports,
  AtrulePrelude_exports,
  Atrule_exports,
  AttributeSelector_exports,
  Block_exports,
  Brackets_exports,
  CDC_exports,
  CDO_exports,
  ClassSelector_exports,
  Combinator_exports,
  Comment_exports,
  Condition_exports,
  DeclarationList_exports,
  Declaration_exports,
  Dimension_exports,
  FeatureFunction_exports,
  FeatureRange_exports,
  Feature_exports,
  Function_exports,
  GeneralEnclosed_exports,
  Hash_exports,
  IdSelector_exports,
  Identifier_exports,
  LayerList_exports,
  Layer_exports,
  MediaQueryList_exports,
  MediaQuery_exports,
  NestingSelector_exports,
  Nth_exports,
  Number_exports,
  Operator_exports,
  Parentheses_exports,
  Percentage_exports,
  PseudoClassSelector_exports,
  PseudoElementSelector_exports,
  Ratio_exports,
  Raw_exports,
  Rule_exports,
  Scope_exports,
  SelectorList_exports,
  Selector_exports,
  String_exports,
  StyleSheet_exports,
  SupportsDeclaration_exports,
  TypeSelector_exports,
  UnicodeRange_exports,
  Url_exports,
  Value_exports,
  WhiteSpace_exports,
  parser_default
} from "./chunk-UAFOAOKH.mjs";
import {
  decodeHTMLAttribute,
  parse,
  parseFragment
} from "./chunk-XSMUJNBI.mjs";
import {
  compileDesignContract,
  contractLonghands,
  parseSrgb,
  resolveContractValue,
  toCss
} from "./chunk-K4TDP4L5.mjs";
import {
  __export
} from "./chunk-JYOOXWJZ.mjs";

// node_modules/entities/dist/index.js
var EntityLevel;
(function(EntityLevel2) {
  EntityLevel2[EntityLevel2["XML"] = 0] = "XML";
  EntityLevel2[EntityLevel2["HTML"] = 1] = "HTML";
})(EntityLevel || (EntityLevel = {}));
var EncodingMode;
(function(EncodingMode2) {
  EncodingMode2[EncodingMode2["UTF8"] = 0] = "UTF8";
  EncodingMode2[EncodingMode2["ASCII"] = 1] = "ASCII";
  EncodingMode2[EncodingMode2["Extensive"] = 2] = "Extensive";
  EncodingMode2[EncodingMode2["Attribute"] = 3] = "Attribute";
  EncodingMode2[EncodingMode2["Text"] = 4] = "Text";
})(EncodingMode || (EncodingMode = {}));

// node_modules/css-tree/lib/walker/create.js
var { hasOwnProperty } = Object.prototype;
var noop = function() {
};
function ensureFunction(value) {
  return typeof value === "function" ? value : noop;
}
function invokeForType(fn, type) {
  return function(node, item, list) {
    if (node.type === type) {
      fn.call(this, node, item, list);
    }
  };
}
function getWalkersFromStructure(name, nodeType) {
  const structure = nodeType.structure;
  const walkers = [];
  for (const key in structure) {
    if (hasOwnProperty.call(structure, key) === false) {
      continue;
    }
    let fieldTypes = structure[key];
    const walker = {
      name: key,
      type: false,
      nullable: false
    };
    if (!Array.isArray(fieldTypes)) {
      fieldTypes = [fieldTypes];
    }
    for (const fieldType of fieldTypes) {
      if (fieldType === null) {
        walker.nullable = true;
      } else if (typeof fieldType === "string") {
        walker.type = "node";
      } else if (Array.isArray(fieldType)) {
        walker.type = "list";
      }
    }
    if (walker.type) {
      walkers.push(walker);
    }
  }
  if (walkers.length) {
    return {
      context: nodeType.walkContext,
      fields: walkers
    };
  }
  return null;
}
function getTypesFromConfig(config) {
  const types = {};
  for (const name in config.node) {
    if (hasOwnProperty.call(config.node, name)) {
      const nodeType = config.node[name];
      if (!nodeType.structure) {
        throw new Error("Missed `structure` field in `" + name + "` node type definition");
      }
      types[name] = getWalkersFromStructure(name, nodeType);
    }
  }
  return types;
}
function createTypeIterator(config, reverse) {
  const fields = config.fields.slice();
  const contextName = config.context;
  const useContext = typeof contextName === "string";
  if (reverse) {
    fields.reverse();
  }
  return function(node, context, walk2, walkReducer) {
    let prevContextValue;
    if (useContext) {
      prevContextValue = context[contextName];
      context[contextName] = node;
    }
    for (const field of fields) {
      const ref = node[field.name];
      if (!field.nullable || ref) {
        if (field.type === "list") {
          const breakWalk = reverse ? ref.reduceRight(walkReducer, false) : ref.reduce(walkReducer, false);
          if (breakWalk) {
            return true;
          }
        } else if (walk2(ref)) {
          return true;
        }
      }
    }
    if (useContext) {
      context[contextName] = prevContextValue;
    }
  };
}
function createFastTraveralMap({
  StyleSheet,
  Atrule,
  Rule,
  Block,
  DeclarationList
}) {
  return {
    Atrule: {
      StyleSheet,
      Atrule,
      Rule,
      Block
    },
    Rule: {
      StyleSheet,
      Atrule,
      Rule,
      Block
    },
    Declaration: {
      StyleSheet,
      Atrule,
      Rule,
      Block,
      DeclarationList
    }
  };
}
function createWalker(config) {
  const types = getTypesFromConfig(config);
  const iteratorsNatural = {};
  const iteratorsReverse = {};
  const breakWalk = /* @__PURE__ */ Symbol("break-walk");
  const skipNode = /* @__PURE__ */ Symbol("skip-node");
  for (const name in types) {
    if (hasOwnProperty.call(types, name) && types[name] !== null) {
      iteratorsNatural[name] = createTypeIterator(types[name], false);
      iteratorsReverse[name] = createTypeIterator(types[name], true);
    }
  }
  const fastTraversalIteratorsNatural = createFastTraveralMap(iteratorsNatural);
  const fastTraversalIteratorsReverse = createFastTraveralMap(iteratorsReverse);
  const walk2 = function(root, options) {
    function walkNode(node, item, list) {
      const enterRet = enter.call(context, node, item, list);
      if (enterRet === breakWalk) {
        return true;
      }
      if (enterRet === skipNode) {
        return false;
      }
      if (iterators.hasOwnProperty(node.type)) {
        if (iterators[node.type](node, context, walkNode, walkReducer)) {
          return true;
        }
      }
      if (leave.call(context, node, item, list) === breakWalk) {
        return true;
      }
      return false;
    }
    let enter = noop;
    let leave = noop;
    let iterators = iteratorsNatural;
    let walkReducer = (ret, data, item, list) => ret || walkNode(data, item, list);
    const context = {
      break: breakWalk,
      skip: skipNode,
      root,
      stylesheet: null,
      atrule: null,
      atrulePrelude: null,
      rule: null,
      selector: null,
      block: null,
      declaration: null,
      function: null
    };
    if (typeof options === "function") {
      enter = options;
    } else if (options) {
      enter = ensureFunction(options.enter);
      leave = ensureFunction(options.leave);
      if (options.reverse) {
        iterators = iteratorsReverse;
      }
      if (options.visit) {
        if (fastTraversalIteratorsNatural.hasOwnProperty(options.visit)) {
          iterators = options.reverse ? fastTraversalIteratorsReverse[options.visit] : fastTraversalIteratorsNatural[options.visit];
        } else if (!types.hasOwnProperty(options.visit)) {
          throw new Error("Bad value `" + options.visit + "` for `visit` option (should be: " + Object.keys(types).sort().join(", ") + ")");
        }
        enter = invokeForType(enter, options.visit);
        leave = invokeForType(leave, options.visit);
      }
    }
    if (enter === noop && leave === noop) {
      throw new Error("Neither `enter` nor `leave` walker handler is set or both aren't a function");
    }
    walkNode(root);
  };
  walk2.break = breakWalk;
  walk2.skip = skipNode;
  walk2.find = function(ast, fn) {
    let found = null;
    walk2(ast, function(node, item, list) {
      if (fn.call(this, node, item, list)) {
        found = node;
        return breakWalk;
      }
    });
    return found;
  };
  walk2.findLast = function(ast, fn) {
    let found = null;
    walk2(ast, {
      reverse: true,
      enter(node, item, list) {
        if (fn.call(this, node, item, list)) {
          found = node;
          return breakWalk;
        }
      }
    });
    return found;
  };
  walk2.findAll = function(ast, fn) {
    const found = [];
    walk2(ast, function(node, item, list) {
      if (fn.call(this, node, item, list)) {
        found.push(node);
      }
    });
    return found;
  };
  return walk2;
}

// node_modules/css-tree/lib/syntax/node/index.js
var node_exports = {};
__export(node_exports, {
  AnPlusB: () => AnPlusB_exports,
  Atrule: () => Atrule_exports,
  AtrulePrelude: () => AtrulePrelude_exports,
  AttributeSelector: () => AttributeSelector_exports,
  Block: () => Block_exports,
  Brackets: () => Brackets_exports,
  CDC: () => CDC_exports,
  CDO: () => CDO_exports,
  ClassSelector: () => ClassSelector_exports,
  Combinator: () => Combinator_exports,
  Comment: () => Comment_exports,
  Condition: () => Condition_exports,
  Declaration: () => Declaration_exports,
  DeclarationList: () => DeclarationList_exports,
  Dimension: () => Dimension_exports,
  Feature: () => Feature_exports,
  FeatureFunction: () => FeatureFunction_exports,
  FeatureRange: () => FeatureRange_exports,
  Function: () => Function_exports,
  GeneralEnclosed: () => GeneralEnclosed_exports,
  Hash: () => Hash_exports,
  IdSelector: () => IdSelector_exports,
  Identifier: () => Identifier_exports,
  Layer: () => Layer_exports,
  LayerList: () => LayerList_exports,
  MediaQuery: () => MediaQuery_exports,
  MediaQueryList: () => MediaQueryList_exports,
  NestingSelector: () => NestingSelector_exports,
  Nth: () => Nth_exports,
  Number: () => Number_exports,
  Operator: () => Operator_exports,
  Parentheses: () => Parentheses_exports,
  Percentage: () => Percentage_exports,
  PseudoClassSelector: () => PseudoClassSelector_exports,
  PseudoElementSelector: () => PseudoElementSelector_exports,
  Ratio: () => Ratio_exports,
  Raw: () => Raw_exports,
  Rule: () => Rule_exports,
  Scope: () => Scope_exports,
  Selector: () => Selector_exports,
  SelectorList: () => SelectorList_exports,
  String: () => String_exports,
  StyleSheet: () => StyleSheet_exports,
  SupportsDeclaration: () => SupportsDeclaration_exports,
  TypeSelector: () => TypeSelector_exports,
  UnicodeRange: () => UnicodeRange_exports,
  Url: () => Url_exports,
  Value: () => Value_exports,
  WhiteSpace: () => WhiteSpace_exports
});

// node_modules/css-tree/lib/syntax/config/walker.js
var walker_default = {
  node: node_exports
};

// node_modules/css-tree/lib/walker/index.js
var walker_default2 = createWalker(walker_default);

// packages/core/src/design-contract-rules.ts
var children = (node) => "children" in node && node.children ? node.children.toArray() : [];
function matchContractSelector(selector, element) {
  if (selector.type === "SelectorList") {
    let specificity2 = -1;
    for (const one of children(selector)) {
      const result = matchContractSelector(one, element);
      if (!result) return null;
      if (result.matches) specificity2 = Math.max(specificity2, result.specificity);
    }
    return { matches: specificity2 >= 0, specificity: Math.max(0, specificity2) };
  }
  if (selector.type !== "Selector") return null;
  let matches = true, specificity = 0;
  const attribute = (name) => element.attrs.find((one) => one.name === name)?.value;
  for (const part of children(selector)) {
    if (part.type === "TypeSelector" && /^[a-z][\w-]*$/i.test(part.name)) {
      specificity += 1;
      matches &&= element.tagName.toLowerCase() === part.name.toLowerCase();
    } else if (part.type === "ClassSelector") {
      if (part.name.includes("\\")) return null;
      specificity += 1e3;
      matches &&= (attribute("class") ?? "").split(/\s+/).includes(part.name);
    } else if (part.type === "IdSelector") {
      if (part.name.includes("\\")) return null;
      specificity += 1e6;
      matches &&= attribute("id") === part.name;
    } else if (part.type === "AttributeSelector" && part.name.type === "Identifier" && part.matcher === "=" && part.value && !part.flags) {
      if (part.value.type !== "String" && part.value.type !== "Identifier") return null;
      if (part.name.name.includes("\\") || part.value.type === "Identifier" && part.value.name.includes("\\")) return null;
      specificity += 1e3;
      matches &&= attribute(element.namespaceURI === "http://www.w3.org/1999/xhtml" ? part.name.name.toLowerCase() : part.name.name) === (part.value.type === "String" ? part.value.value : part.value.name);
    } else return null;
  }
  return { matches, specificity };
}
var quad = (items) => [items[0], items[1] ?? items[0], items[2] ?? items[0], items[3] ?? items[1] ?? items[0]];
function expandContractValues(property, values, spelling2) {
  const clean = values.filter((value) => spelling2(value).trim());
  const slash = clean.findIndex((value) => spelling2(value) === "/");
  if (property === "padding") {
    if (clean.length < 1 || clean.length > 4 || slash !== -1) return null;
    return new Map(contractLonghands(property).map((name, index) => [name, [quad(clean)[index]]]));
  }
  if (property === "border-radius") {
    const x = slash === -1 ? clean : clean.slice(0, slash), y = slash === -1 ? x : clean.slice(slash + 1);
    if (x.length < 1 || x.length > 4 || y.length < 1 || y.length > 4 || y.some((value) => spelling2(value) === "/")) return null;
    const horizontal = quad(x), vertical = quad(y);
    return new Map(contractLonghands(property).map((name, index) => [name, [horizontal[index], vertical[index]]]));
  }
  if (/^border-(?:top|bottom)-(?:left|right)-radius$/.test(property)) {
    if (clean.length < 1 || clean.length > 2 || slash !== -1) return null;
    return /* @__PURE__ */ new Map([[property, [clean[0], clean[1] ?? clean[0]]]]);
  }
  return clean.length === 1 ? /* @__PURE__ */ new Map([[property, clean]]) : null;
}

// packages/core/src/designaudit.ts
var parseCss = parser_default;
var walk = walker_default2;
var DESIGN_AUDIT_VERSION = "1.2.0";
var children2 = (node) => "children" in node && node.children ? node.children.toArray() : [];
var spelling = ({ node, part }) => part.text.slice(node.loc?.start.offset ?? 0, node.loc?.end.offset ?? part.text.length);
var COLOUR_PROPERTIES = /^(?:color|background(?:-color|-image)?|(?:border|outline)(?:-(?:top|right|bottom|left|block|inline|block-start|block-end|inline-start|inline-end))?(?:-color)?|box-shadow|text-shadow|fill|stroke|stop-color|flood-color|lighting-color|caret-color|accent-color|text-decoration(?:-color)?)$/;
var SPACING_PROPERTIES = /^(?:padding|margin)(?:-(?:top|right|bottom|left|block|inline|block-start|block-end|inline-start|inline-end))?$|^(?:gap|row-gap|column-gap)$/;
var RADIUS_PROPERTIES = /^border-(?:(?:top|bottom)-(?:left|right)-|(?:start|end)-(?:start|end)-)?radius$/;
var LENGTH_UNITS = /^(?:px|em|rem|ex|rex|cap|rcap|ch|rch|ic|ric|lh|rlh|vw|vh|vi|vb|vmin|vmax|svw|svh|svi|svb|svmin|svmax|lvw|lvh|lvi|lvb|lvmin|lvmax|dvw|dvh|dvi|dvb|dvmin|dvmax|cqw|cqh|cqi|cqb|cqmin|cqmax|cm|mm|q|in|pt|pc)$/i;
var NEUTRAL = /^(?:inherit|initial|unset|revert|revert-layer|currentcolor|transparent|none|auto|normal)$/i;
var COLOUR_FUNCTIONS = /^(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)$/i;
var NAMED_COLOURS = new Set("aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen".split(" "));
function normalize(value, kind) {
  const text = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (kind === "colour") {
    if (/^#[\da-f]{3,4}$/.test(text)) return normalize(`#${[...text.slice(1)].map((c) => c + c).join("")}`, kind);
    if (/^#[\da-f]{6}ff$/.test(text)) return text.slice(0, 7);
    return text;
  }
  const length = /^(-?(?:\d*\.)?\d+)([a-z%]*)$/.exec(text);
  return length ? `${Number(length[1])}${Number(length[1]) === 0 ? "" : length[2]}` : text;
}
function auditScreen(source, tokens) {
  const diagnostics = [];
  const unexamined = [];
  const blocks = [];
  const elements = [];
  const policy = compileDesignContract(tokens);
  const invalid = /* @__PURE__ */ new WeakSet();
  const registered = /* @__PURE__ */ new Set();
  const starts = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === "\n") starts.push(i + 1);
  const position = (offset) => {
    offset = Math.max(0, Math.min(offset, source.length));
    let low = 0, high = starts.length;
    while (low + 1 < high) {
      const mid = low + high >>> 1;
      if (starts[mid] <= offset) low = mid;
      else high = mid;
    }
    return { offset, line: low + 1, column: offset - starts[low] + 1 };
  };
  const range = (start, end) => ({ start: position(start), end: position(end) });
  const location = ({ node, part }) => range(part.offset(node.loc?.start.offset ?? 0), part.offset(node.loc?.end.offset ?? part.text.length));
  const uncovered = (code, where, explanation) => {
    if (!unexamined.some((v) => v.code === code && v.range.start.offset === where.start.offset && v.range.end.offset === where.end.offset)) unexamined.push({ code, range: where, explanation });
  };
  const wholePart = (part) => range(part.offset(0), part.offset(part.text.length));
  function css(part, inline = false, conditional = false, element) {
    let ast;
    try {
      ast = parseCss(part.text, {
        context: inline ? "declarationList" : "stylesheet",
        positions: true,
        parseCustomProperty: true,
        onParseError: (error) => uncovered("malformed-css", range(part.offset(error.offset), part.offset(error.offset + 1)), error.message)
      });
    } catch (error) {
      uncovered("malformed-css", wholePart(part), String(error));
      return;
    }
    const collect = (node, conditional2) => {
      if (node.type === "Raw") {
        uncovered("malformed-css", location({ node, part }), "This CSS region could not be parsed.");
        return;
      }
      if (node.type === "Atrule") {
        if (node.name.toLowerCase() === "property") {
          uncovered("unsupported-registration", location({ node, part }), "Custom-property registration and its inheritance/initial-value rules are unexamined.");
          const name = node.prelude ? spelling({ node: node.prelude, part }).trim() : "";
          if (name.startsWith("--")) registered.add(name);
          return;
        }
        if (["import", "namespace"].includes(node.name.toLowerCase())) uncovered("external-style", location({ node, part }), "External stylesheet or namespace was not fetched.");
        if (node.block) collect(node.block, true);
        return;
      }
      const list = children2(node);
      const declarations2 = list.filter((one) => one.type === "Declaration");
      if (node.type === "Rule") {
        const selector = node.prelude.loc ? part.text.slice(node.prelude.loc.start.offset, node.prelude.loc.end.offset).trim() : "";
        blocks.push({ part, declarations: children2(node.block).filter((one) => one.type === "Declaration"), root: selector === ":root" && !conditional2, conditional: conditional2, selector: node.prelude });
        for (const child of children2(node.block)) if (child.type !== "Declaration") collect(child, true);
        return;
      }
      if (declarations2.length) blocks.push({ part, declarations: declarations2, root: false, conditional: conditional2, ...element ? { element } : {} });
      for (const child of list) if (child.type !== "Declaration") collect(child, conditional2);
    };
    collect(ast, conditional);
    walk(ast, (node) => {
      if (node.type === "Raw" || node.type === "Function" && !spelling({ node, part }).endsWith(")")) invalid.add(node);
      if (node.type === "Function" && invalid.has(node) || node.type === "Block" && !spelling({ node, part }).endsWith("}")) uncovered("malformed-css", location({ node, part }), "An unclosed CSS function or block was recovered by the parser.");
    });
  }
  function attribute(el, name) {
    const loc = el.sourceCodeLocation?.attrs?.[name];
    const attr = el.attrs.find((a) => a.name === name);
    if (!loc || !attr) return null;
    const raw = source.slice(loc.startOffset, loc.endOffset);
    const start = /^[^=]+?\s*=\s*(["']?)/.exec(raw);
    if (!start) return null;
    const quote = start[1];
    const encoded = raw.slice(start[0].length, quote && raw.endsWith(quote) ? -1 : void 0);
    const base = loc.startOffset + start[0].length;
    const offsets = [base];
    let decoded = "";
    for (let i = 0; i < encoded.length; ) {
      const entity = encoded[i] === "&" ? /^&(?:#x[\da-f]+;?|#\d+;?|[a-z][\da-z]*;?)/i.exec(encoded.slice(i))?.[0] : void 0;
      const input = entity ?? encoded[i];
      const tail = encoded[i + input.length] ?? "";
      const decodedInput = decodeHTMLAttribute(input + tail);
      const value = decodedInput.slice(0, decodedInput.length - tail.length);
      const piece = entity && value !== input ? value : input;
      for (let n = 0; n < piece.length; n++) offsets.push(base + i + (n === piece.length - 1 ? input.length : 0));
      decoded += piece;
      i += input.length;
    }
    if (decoded !== attr.value) {
      uncovered("encoded-attribute", range(loc.startOffset, loc.endOffset), "Attribute decoding could not be mapped exactly to original source.");
      return null;
    }
    return { text: decoded, offset: (index) => offsets[Math.max(0, Math.min(index, offsets.length - 1))] };
  }
  const onParseError = (error) => {
    if (error.code !== "missing-doctype") uncovered("malformed-html", range(error.startOffset, error.endOffset), `HTML parser recovery: ${error.code}.`);
  };
  const document = /<!doctype|<html(?:\s|>)/i.test(source) ? parse(source, { sourceCodeLocationInfo: true, onParseError }) : parseFragment(source, { sourceCodeLocationInfo: true, onParseError });
  function visit(node) {
    if ("tagName" in node) {
      elements.push(node);
      const loc = node.sourceCodeLocation;
      if (node.tagName === "template") {
        if (loc) uncovered("dynamic-style", range(loc.startOffset, loc.endOffset), "Template content is inert until instantiated; its styling is unexamined.");
        return;
      }
      if (node.tagName === "style" && loc?.startTag) {
        const type = node.attrs.find((a) => a.name === "type")?.value;
        const start = loc.startTag.endOffset, end = loc.endTag?.startOffset ?? loc.endOffset;
        const part = { text: source.slice(start, end), offset: (i) => start + i };
        if (type && type.toLowerCase() !== "text/css") uncovered("unsupported-style", wholePart(part), `Style type ${type} is not CSS.`);
        else {
          const conditional = node.attrs.some((a) => a.name === "media" && a.value.trim() && a.value.trim().toLowerCase() !== "all");
          css(part, false, conditional);
        }
      }
      if (node.tagName === "link" && node.attrs.some((a) => a.name === "rel" && a.value.toLowerCase().split(/\s+/).includes("stylesheet")) && loc) uncovered("external-style", range(loc.startOffset, loc.endOffset), "Linked CSS was not fetched; its declarations and overrides are unexamined.");
      if (node.tagName === "script" && !node.attrs.some((a) => a.name === "type" && /^(?:application\/(?:ld\+)?json|importmap|speculationrules)$/i.test(a.value)) && loc) uncovered("dynamic-style", range(loc.startOffset, loc.endOffset), "Executable script may alter styles; it was not executed or inspected as CSS.");
      for (const attr of node.attrs) {
        if (/^on/i.test(attr.name) && loc?.attrs?.[attr.name]) {
          const a = loc.attrs[attr.name];
          uncovered("dynamic-style", range(a.startOffset, a.endOffset), "Event handler may alter styles; it was not executed.");
        }
        if (attr.name === "style") {
          const part = attribute(node, attr.name);
          if (part) css(part, true, false, node);
        } else if (node.namespaceURI === "http://www.w3.org/2000/svg" && /^(?:fill|stroke|stop-color|flood-color|lighting-color|font-size)$/.test(attr.name)) {
          const part = attribute(node, attr.name);
          if (part) {
            const prefix = `${attr.name}:`;
            css({ text: prefix + part.text, offset: (i) => part.offset(Math.max(0, i - prefix.length)) }, true, false, node);
          }
        }
      }
    }
    if ("childNodes" in node) for (const child of node.childNodes) visit(child);
  }
  visit(document);
  const exported = /* @__PURE__ */ new Map();
  let exportText = "";
  try {
    exportText = toCss(tokens);
  } catch (error) {
    uncovered("unsupported-system-token", range(0, 0), `The governing token export is unavailable: ${String(error)}`);
  }
  const exportAst = parseCss(exportText, { positions: true, parseCustomProperty: true });
  walk(exportAst, (node) => {
    if (node.type === "Declaration" && node.property.startsWith("--")) exported.set(node.property, { node: node.value, part: { text: exportText, offset: () => 0, generated: true } });
  });
  const category = (name) => name.startsWith("--color-") ? "colour" : name.startsWith("--space-") ? "spacing" : name.startsWith("--radius-") ? "radius" : name.startsWith("--size-") ? "type size" : void 0;
  const categories = ["colour", "type size", "radius", "spacing"];
  const palette = new Map(categories.map((kind) => [kind, []]));
  const roots = /* @__PURE__ */ new Map(), locals = /* @__PURE__ */ new Map();
  for (const block of blocks) for (const d of block.declarations) if (d.property.startsWith("--")) {
    if (block.root) roots.set(d.property, [...roots.get(d.property) ?? [], { node: d.value, part: block.part }]);
    else locals.set(d.property, [...locals.get(d.property) ?? [], block]);
  }
  const envFor = (block, exportedOnly = false) => {
    const env = exportedOnly ? new Map(exported) : /* @__PURE__ */ new Map();
    if (exportedOnly) return env;
    for (const name of registered) env.set(name, null);
    for (const [name, defs] of roots) env.set(name, defs.length === 1 ? defs[0] : null);
    for (const [name, defining] of locals) {
      const own = block?.declarations.filter((d) => d.property === name) ?? [];
      env.set(name, block && own.length === 1 && defining.length === 1 && !block.conditional ? { node: own[0].value, part: block.part } : null);
    }
    return env;
  };
  const cycles = (env) => {
    const cyclic = /* @__PURE__ */ new Set(), done = /* @__PURE__ */ new Set();
    const scan = (name, stack) => {
      if (stack.length > 128) return;
      const at = stack.indexOf(name);
      if (at >= 0) {
        for (const key of stack.slice(at)) cyclic.add(key);
        return;
      }
      if (done.has(name)) return;
      const binding = env.get(name);
      if (!binding) return;
      walk(binding.node, (n) => {
        if (n.type === "Function" && n.name.toLowerCase() === "var") {
          const ref = children2(n)[0];
          if (ref?.type === "Identifier") scan(ref.name, [...stack, name]);
        }
      });
      done.add(name);
    };
    for (const name of env.keys()) scan(name, []);
    return cyclic;
  };
  const invalidValue = /* @__PURE__ */ Symbol("invalid-variable-value");
  function resolve(value, env, cyclic, property, report, depth = 0, origin) {
    if (depth > 64) {
      if (report) uncovered("unsupported-expression", location(value), "Variable expansion exceeded the static depth limit.");
      return null;
    }
    const { node, part } = value;
    const where = part.generated && origin ? origin : value;
    if (invalid.has(node)) return null;
    if (node.type === "Value") {
      const out2 = [];
      for (const child of children2(node)) {
        const result = resolve({ node: child, part }, env, cyclic, property, report, depth + 1, origin);
        if (result === null || result === invalidValue) return result;
        out2.push(...result);
      }
      return out2;
    }
    if (node.type !== "Function" || node.name.toLowerCase() !== "var") return [value];
    const args = children2(node), identifier = args[0];
    if (identifier?.type !== "Identifier" || !identifier.name.startsWith("--")) {
      if (report) uncovered("malformed-css", location(where), "var() requires a custom-property name.");
      return null;
    }
    const name = identifier.name, binding = env.get(name);
    if (binding === null) {
      if (report) uncovered("ambiguous-cascade", location(where), `${name} has selector-dependent or competing declarations; its computed value is unexamined.`);
      return null;
    }
    if (binding && !cyclic.has(name)) {
      const inherited = binding.part.generated || roots.get(name)?.some((one) => one.node === binding.node);
      let dependentLocal = false;
      if (inherited) walk(binding.node, (n) => {
        if (n.type !== "Function" || n.name.toLowerCase() !== "var") return;
        const ref = children2(n)[0];
        if (ref?.type === "Identifier" && locals.has(ref.name) && env.get(ref.name)?.node !== exported.get(ref.name)?.node) dependentLocal = true;
      });
      if (dependentLocal) {
        if (report) uncovered("ambiguous-cascade", location(where), `${name} is inherited and refers to a locally overridden property; its declaration-time value is unexamined.`);
        return null;
      }
      const result = resolve(binding, env, cyclic, property, report, depth + 1, binding.part.generated ? origin ?? value : void 0);
      if (result !== invalidValue) return result?.map((one) => ({ ...one, via: [...one.via ?? [], name], use: origin ?? value })) ?? null;
    }
    const fallback = args[1]?.type === "Operator" && args[1].value === "," ? args.slice(2) : [];
    if (report) diagnostics.push({
      code: cyclic.has(name) ? "design/cyclic-variable" : binding ? "design/invalid-variable" : exported.has(name) ? "design/missing-token-declaration" : "design/missing-variable",
      severity: "warning",
      range: location(where),
      actual: name,
      property,
      explanation: `${name} ${cyclic.has(name) ? "belongs to a custom-property cycle" : binding ? "has an invalid referenced value" : exported.has(name) ? "is named by DESIGN.md but has no declaration in this artifact; include the governing CSS export (isocan design --css)" : "has no declaration in this artifact\u2019s static scope"}.${fallback.length ? " Its fallback is checked separately." : " No value can be checked."}`,
      candidates: [...exported.keys()].filter((token) => {
        const kind = category(token);
        return kind && (COLOUR_PROPERTIES.test(property) ? kind === "colour" : SPACING_PROPERTIES.test(property) ? kind === "spacing" : RADIUS_PROPERTIES.test(property) ? kind === "radius" : kind === "type size") && env.get(token) !== null;
      }).slice(0, 5).map((token) => ({ value: `var(${token})`, token, explanation: "This is an exported system reference; confirm its role and rerun the audit after replacement.", prerequisites: env.has(token) ? [] : [`Include the governing CSS export (isocan design --css); ${token} is not declared here.`], requiresReview: true }))
    });
    if (!fallback.length) return invalidValue;
    const out = [];
    for (const child of fallback) {
      const result = resolve({ node: child, part }, env, cyclic, property, report, depth + 1, origin);
      if (result === null || result === invalidValue) return result;
      out.push(...result);
    }
    return out;
  }
  const exportEnv = envFor(void 0, true), exportCycles = cycles(exportEnv);
  const unknownCategories = /* @__PURE__ */ new Set();
  for (const [name, binding] of exported) {
    const kind = category(name);
    if (!kind) continue;
    const resolved = resolve(binding, exportEnv, exportCycles, "", false);
    if (Array.isArray(resolved) && resolved.length === 1) {
      const located = resolved[0], node = located.node;
      palette.get(kind).push({ token: name, value: normalize(spelling(located), kind) });
      if (kind !== "colour" && !(node.type === "Dimension" && LENGTH_UNITS.test(node.unit) || node.type === "Percentage" || node.type === "Number" && Number(node.value) === 0)) unknownCategories.add(kind);
    } else unknownCategories.add(kind);
  }
  const marker = (el, name) => el.attrs.find((attr) => attr.name === `data-isocan-${name}`)?.value;
  const elementRange = (el) => range(el.sourceCodeLocation?.startTag?.startOffset ?? el.sourceCodeLocation?.startOffset ?? 0, el.sourceCodeLocation?.startTag?.endOffset ?? el.sourceCodeLocation?.endOffset ?? 0);
  const markerFinding = (el, name, explanation) => {
    const loc = el.sourceCodeLocation?.attrs?.[`data-isocan-${name}`];
    diagnostics.push({ code: `design/unknown-${name}`, severity: "warning", range: loc ? range(loc.startOffset, loc.endOffset) : elementRange(el), actual: marker(el, name) ?? "", explanation, candidates: [] });
  };
  const exceptions = /* @__PURE__ */ new Map();
  const marked = elements.filter((el) => ["recipe", "treatment", "exception"].some((name) => marker(el, name) !== void 0));
  for (const problem of policy.problems) uncovered("unsupported-policy", range(0, 0), `${problem.path}: ${problem.message}`);
  for (const el of marked) {
    if (!policy.effective) {
      uncovered("unsupported-contract", elementRange(el), "The governing contract version is unsupported; these marker meanings are unexamined.");
      continue;
    }
    const name = marker(el, "recipe"), recipe = name && Object.prototype.hasOwnProperty.call(policy.effective.recipes, name) ? policy.effective.recipes[name] : void 0;
    if (!recipe) {
      markerFinding(el, "recipe", "This element does not name a supported recipe in its governing design.");
      continue;
    }
    const treatment = marker(el, "treatment"), exception = marker(el, "exception");
    if (treatment !== void 0) {
      if (!Object.prototype.hasOwnProperty.call(recipe.treatments, treatment)) markerFinding(el, "treatment", `Unknown treatment ${treatment} for ${name}.`);
      else policy.appliedTreatments.push({ recipe: name, name: treatment, range: elementRange(el) });
    }
    if (exception !== void 0) {
      const rule = Object.prototype.hasOwnProperty.call(policy.effective.exceptions, exception) ? policy.effective.exceptions[exception] : void 0;
      if (!rule || rule.recipe !== name) markerFinding(el, "exception", `Exception ${exception} is not an approved, reasoned exception for ${name}.`);
      else {
        exceptions.set(el, new Set(rule.properties.flatMap(contractLonghands)));
        policy.appliedExceptions.push({ recipe: name, name: exception, properties: rule.properties, reason: rule.reason, range: elementRange(el) });
      }
    }
  }
  const exempt = (el, property) => contractLonghands(property).every((name) => exceptions.get(el)?.has(name));
  const targets = (block) => block.element ? [block.element] : block.selector ? elements.filter((el) => matchContractSelector(block.selector, el)?.matches) : [];
  const found = /* @__PURE__ */ new Map();
  let onSystem = 0, checkedValues = 0, declarations = 0;
  let referenceExempt = false;
  const note = (located, kind, property, env) => {
    const actual = spelling(located), value = normalize(actual, kind);
    if (NEUTRAL.test(value) || kind !== "colour" && /^0[a-z%]*$/.test(value)) return;
    const known = palette.get(kind);
    const where = location(located);
    if (!known.length && !unknownCategories.has(kind)) return;
    const rgb = kind === "colour" ? parseSrgb(value) : null;
    const matches = known.filter((one) => one.value === value || rgb && (() => {
      const other = parseSrgb(one.value);
      return other && Math.round(other.r) === Math.round(rgb.r) && Math.round(other.g) === Math.round(rgb.g) && Math.round(other.b) === Math.round(rgb.b);
    })());
    const match = matches.length > 0;
    if (!match && unknownCategories.has(kind)) {
      uncovered("unsupported-system-token", where, `Some declared ${kind} tokens cannot be resolved to static values; nonmembership cannot be determined.`);
      return;
    }
    if (kind === "colour" && !match && (!rgb || known.some((one) => !parseSrgb(one.value)))) {
      uncovered("unsupported-color-equivalence", where, "This color cannot be compared to every declared color with the supported sRGB conversion. Its conformance is unexamined.");
      return;
    }
    checkedValues++;
    if (match) {
      onSystem++;
      if (policy.effective?.literals === "require-references" && !referenceExempt && !matches.some((one) => located.via?.includes(one.token))) {
        diagnostics.push({ code: "design/reference-required", severity: "warning", range: location(located.use ?? located), actual: spelling(located.use ?? located), property, kind, candidates: matches.slice(0, 5).map((one) => ({ value: `var(${one.token})`, token: one.token, explanation: `This exported token supplies the matching ${kind}; confirm its intended role.`, prerequisites: env.has(one.token) ? [] : [`Include the governing CSS export (isocan design --css); ${one.token} is not declared here.`], requiresReview: true })), explanation: `The governing policy requires a declared exported token reference for this ${kind}; a matching literal or local literal alias is insufficient.` });
      }
      return;
    }
    const existing = found.get(`${kind}:${value}`);
    if (existing) existing.count++;
    else found.set(`${kind}:${value}`, { value, kind, count: 1, line: where.start.line });
    const candidates = known.filter((one) => {
      if (!env.has(one.token)) return true;
      const binding = env.get(one.token);
      const resolved = binding ? resolve(binding, env, cycles(env), property, false) : null;
      return Array.isArray(resolved) && resolved.length === 1 && normalize(spelling(resolved[0]), kind) === one.value;
    }).sort((a, b) => {
      if (kind === "colour" && rgb) {
        const distance = (s) => {
          const x = parseSrgb(s);
          return x ? (rgb.r - x.r) ** 2 + (rgb.g - x.g) ** 2 + (rgb.b - x.b) ** 2 : Infinity;
        };
        return distance(a.value) - distance(b.value);
      }
      return Math.abs(parseFloat(value) - parseFloat(a.value)) - Math.abs(parseFloat(value) - parseFloat(b.value));
    }).slice(0, 5).map((one) => ({ value: `var(${one.token})`, token: one.token, explanation: `${one.value} is a declared ${kind}; confirm its intended role before replacing.`, prerequisites: env.has(one.token) ? [] : [`Include the governing CSS export (isocan design --css); ${one.token} is not declared here.`], requiresReview: true }));
    diagnostics.push({ code: `design/off-scale-${kind === "type size" ? "font-size" : kind === "colour" ? "color" : kind}`, severity: "warning", range: where, actual, kind, property, explanation: `${actual} is outside the governing system's declared ${kind} values.`, candidates });
  };
  const cyclesOf = /* @__PURE__ */ new WeakMap();
  const containsVar = (node) => {
    let found2 = false;
    walk(node, (n) => {
      if (n.type === "Function" && n.name.toLowerCase() === "var") found2 = true;
    });
    return found2;
  };
  const inlineVars = (located, property, env) => {
    const { node } = located;
    if (node.type === "Function" && node.name.toLowerCase() === "var") {
      let cyclic = cyclesOf.get(env);
      if (!cyclic) {
        cyclic = cycles(env);
        cyclesOf.set(env, cyclic);
      }
      const result = resolve(located, env, cyclic, property, true);
      if (!Array.isArray(result)) return null;
      const pieces = result.map((one) => inlineVars(one, property, env));
      return pieces.some((one) => one === null) ? null : pieces.join(" ");
    }
    const text = spelling(located), start = node.loc?.start.offset ?? 0;
    let out = text;
    for (const child of children2(node).reverse()) {
      if (!containsVar(child)) continue;
      const piece = inlineVars({ node: child, part: located.part }, property, env);
      if (piece === null) return null;
      out = out.slice(0, (child.loc?.start.offset ?? 0) - start) + piece + out.slice((child.loc?.end.offset ?? 0) - start);
    }
    return out;
  };
  const values = (list, kind, property, env, colorShorthand = false) => {
    for (const located of list) {
      const n = located.node, actual = spelling(located);
      if (n.type === "Operator" || n.type === "WhiteSpace" || n.type === "Comment" || n.type === "Url" || n.type === "String") continue;
      if (NEUTRAL.test(actual)) continue;
      if (n.type === "Function" && n.name.toLowerCase() === "var") {
        let cyclic = cyclesOf.get(env);
        if (!cyclic) {
          cyclic = cycles(env);
          cyclesOf.set(env, cyclic);
        }
        const result = resolve(located, env, cyclic, property, true);
        if (Array.isArray(result)) values(result, kind, property, env, colorShorthand);
        continue;
      }
      if (kind === "colour") {
        if (n.type === "Hash" || n.type === "Identifier" && NAMED_COLOURS.has(n.name.toLowerCase())) {
          note(located, kind, property, env);
          continue;
        }
        if (n.type === "Function") {
          if (COLOUR_FUNCTIONS.test(n.name) && children2(n).some(containsVar)) {
            const text = inlineVars(located, property, env);
            if (text === null) continue;
            const parsed = children2(parseCss(text, { context: "value", positions: true }))[0];
            const from = location(located);
            if (parsed) values([{ node: parsed, part: { text, offset: (i) => i <= 0 ? from.start.offset : from.end.offset }, use: located }], kind, property, env, colorShorthand);
            continue;
          }
          if (COLOUR_FUNCTIONS.test(n.name) && !/[a-z-]+\(/i.test(actual.slice(actual.indexOf("(") + 1))) note(located, kind, property, env);
          else if (/^(?:repeating-)?(?:linear|radial|conic)-gradient$/i.test(n.name)) values(children2(n).map((node) => ({ node, part: located.part })), kind, property, env, true);
          else if (n.name.toLowerCase() === "color-mix") uncovered("unsupported-expression", location(located), `color-mix() computes its colour when the page renders; the mixed ${property} is unexamined.`);
          else uncovered("unsupported-expression", location(located), `${n.name}() cannot be resolved statically for ${property}.`);
        } else if (!colorShorthand) uncovered("unsupported-expression", location(located), `This ${property} color expression is unsupported.`);
      } else if (n.type === "Dimension" && LENGTH_UNITS.test(n.unit) || n.type === "Percentage" || n.type === "Number" && Number(n.value) === 0) note(located, kind, property, env);
      else if (n.type === "Identifier" && palette.get(kind).some((one) => one.value === normalize(actual, kind))) note(located, kind, property, env);
      else uncovered("unsupported-expression", location(located), `This ${property} expression requires evaluation; its value is unexamined.`);
    }
  };
  for (const block of blocks) {
    const env = envFor(block), cyclic = cycles(env);
    for (const d of block.declarations) {
      declarations++;
      const property = d.property.toLowerCase();
      if (property.startsWith("--")) continue;
      const affected = targets(block);
      referenceExempt = affected.length > 0 && affected.every((el) => exempt(el, property));
      let kind;
      if (COLOUR_PROPERTIES.test(property)) kind = "colour";
      else if (property === "font-size" || property === "font") kind = "type size";
      else if (RADIUS_PROPERTIES.test(property)) kind = "radius";
      else if (SPACING_PROPERTIES.test(property)) kind = "spacing";
      if (!kind) continue;
      const result = resolve({ node: d.value, part: block.part }, env, cyclic, property, true);
      if (!Array.isArray(result)) continue;
      if (property === "font") {
        const size = result.find((one) => one.node.type === "Dimension" || one.node.type === "Percentage" || one.node.type === "Function" || one.node.type === "Identifier" && /^(?:xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large|smaller|larger)$/.test(one.node.name));
        if (size) values([size], kind, property, env);
        else uncovered("unsupported-expression", location({ node: d.value, part: block.part }), "The font shorthand's size could not be resolved.");
      } else values(result, kind, property, env, kind === "colour" && !/(?:color|fill|stroke)$/.test(property));
    }
  }
  const atom = (value, property) => {
    const text = spelling(value).trim().toLowerCase(), node = value.node;
    if (property === "font-weight") {
      if (text === "normal") return "400";
      if (text === "bold") return "700";
      return node.type === "Number" && Number(text) >= 1 && Number(text) <= 1e3 ? String(Number(text)) : null;
    }
    if (node.type === "Dimension" && LENGTH_UNITS.test(node.unit) && Number(node.value) >= 0 || node.type === "Percentage" || node.type === "Number" && Number(node.value) === 0) return normalize(text, property === "font-size" ? "type size" : "spacing");
    return property === "font-size" && /^(?:xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large)$/.test(text) ? text : null;
  };
  const contractProblem = (path, explanation) => {
    if (!policy.problems.some((problem) => problem.path === path && problem.message === explanation)) policy.problems.push({ code: "unsupported-policy", path, message: explanation });
    policy.status = "partial";
    uncovered("unsupported-policy", range(0, 0), `${path}: ${explanation}`);
  };
  const unknownStyles = unexamined.some((one) => ["external-style", "dynamic-style", "malformed-css", "unsupported-style"].includes(one.code));
  const higher = (a, b) => a.some((value, index) => value !== b[index] && a.slice(0, index).every((v, i) => v === b[i]) && value > b[index]);
  for (const el of marked) {
    const recipeName = marker(el, "recipe");
    const recipe = recipeName && policy.effective && Object.prototype.hasOwnProperty.call(policy.effective.recipes, recipeName) ? policy.effective.recipes[recipeName] : void 0;
    if (!recipe || !policy.effective) continue;
    const chosen = marker(el, "treatment");
    const treatment = chosen && Object.prototype.hasOwnProperty.call(recipe.treatments, chosen) ? recipe.treatments[chosen] : void 0;
    const rules = { ...recipe.owns, ...treatment };
    const expected = /* @__PURE__ */ new Map();
    for (const [property, raw] of Object.entries(rules)) {
      const text = resolveContractValue(tokens, raw);
      const path = `isocan.lint.recipes.${recipeName}.${treatment && Object.prototype.hasOwnProperty.call(treatment, property) ? `treatments.${chosen}` : "owns"}.${property}`;
      if (text === null) {
        contractProblem(path, "The owned value cannot be resolved to scalar CSS.");
        continue;
      }
      const part = { text, offset: () => 0, generated: true };
      let resolved = null;
      try {
        resolved = resolve({ node: parseCss(text, { context: "value", positions: true }), part }, exportEnv, exportCycles, property, false);
      } catch {
      }
      const expanded = Array.isArray(resolved) ? expandContractValues(property, resolved, spelling) : null;
      if (!expanded || [...expanded].some(([name, values2]) => values2.some((value) => atom(value, name) === null))) {
        contractProblem(path, "The owned value or exported variable cannot be statically compared.");
        continue;
      }
      for (const [name, values2] of expanded) {
        if (expected.has(name) && expected.get(name).values.map((one) => atom(one, name)).join(" ") !== values2.map((one) => atom(one, name)).join(" ")) contractProblem(path, `Overlapping ownership gives ${name} competing expected values.`);
        expected.set(name, { values: values2, rule: property });
      }
    }
    const winning = /* @__PURE__ */ new Map();
    const uncertain = /* @__PURE__ */ new Set();
    let unknownCascade = unknownStyles;
    for (let order = 0; order < blocks.length; order++) {
      const block = blocks[order];
      const match = block.element ? { matches: block.element === el, specificity: 0 } : block.selector ? matchContractSelector(block.selector, el) : null;
      if (match && !match.matches) continue;
      if (!match || block.conditional) {
        if (block.declarations.some((declaration) => !declaration.property.startsWith("--"))) {
          unknownCascade = true;
          uncovered("unsupported-contract-cascade", wholePart(block.part), "This selector or conditional rule cannot be assigned safely to the marked element; ownership remains unexamined.");
        }
        continue;
      }
      const env = envFor(block), cyclic = cycles(env);
      for (let index = 0; index < block.declarations.length; index++) {
        const declaration = block.declarations[index], property = declaration.property.toLowerCase();
        if (property.startsWith("--")) continue;
        const related = contractLonghands(property);
        const owned = related.some((name) => expected.has(name));
        const allowed = (name) => recipe.allow.some((control) => contractLonghands(control).includes(name) || control === "margin" && /^margin-(?:top|right|bottom|left)$/.test(name));
        if (!related.every((name) => expected.has(name) || allowed(name))) diagnostics.push({ code: "design/unapproved-property", severity: "warning", range: location({ node: declaration, part: block.part }), actual: property, property, explanation: `${recipeName} does not declare ${property} as owned styling or an approved caller control.`, candidates: [] });
        if (property === "font" || property === "all" || /^(?:padding|border)-(?:inline|block|start|end)/.test(property)) {
          for (const name of expected.keys()) if (property === "all" || property === "font" && name.startsWith("font-") || property.startsWith("padding") && name.startsWith("padding") || property.startsWith("border") && name.includes("radius")) uncertain.add(name);
          uncovered("unsupported-contract-property", location({ node: declaration, part: block.part }), `The effect of ${property} on owned physical values is unexamined.`);
          continue;
        }
        if (!owned) continue;
        const resolved = resolve({ node: declaration.value, part: block.part }, env, cyclic, property, false);
        const expanded = Array.isArray(resolved) ? expandContractValues(property, resolved, spelling) : null;
        const priority = [declaration.important ? 1 : 0, block.element ? 1 : 0, match.specificity, order, index];
        for (const name of related) {
          if (!expected.has(name)) continue;
          const existing = winning.get(name);
          if (existing && !higher(priority, existing.priority)) continue;
          const values2 = expanded?.get(name);
          if (!values2 || values2.some((value) => atom(value, name) === null)) {
            uncertain.add(name);
            uncovered("unsupported-contract-value", location({ node: declaration.value, part: block.part }), `The effective ${name} cannot be compared within the static contract boundary.`);
          } else {
            uncertain.delete(name);
            winning.set(name, { values: values2, declaration, block, priority });
          }
        }
      }
    }
    if (unknownCascade) uncovered("unsupported-contract-cascade", elementRange(el), "External, dynamic, conditional or unsupported selector paths may change this element; matching local values do not establish complete ownership coverage.");
    for (const [property, required] of expected) {
      if (exempt(el, property)) continue;
      const actual = winning.get(property);
      if (uncertain.has(property)) continue;
      if (!actual) {
        let inherited = false;
        if (property === "font-weight" || property === "font-size") {
          let ancestor = el.parentNode;
          while (ancestor) {
            if ("tagName" in ancestor) {
              const parent = ancestor;
              inherited ||= blocks.some((block) => (block.element === parent || block.selector && matchContractSelector(block.selector, parent)?.matches) && block.declarations.some((declaration) => [property, "font", "all"].includes(declaration.property.toLowerCase())));
            }
            ancestor = "parentNode" in ancestor ? ancestor.parentNode : null;
          }
        }
        if (inherited) {
          uncovered("unsupported-contract-inheritance", elementRange(el), `An ancestor authors ${property}; inherited ownership is outside the direct-selector boundary.`);
          continue;
        }
        if (!unknownCascade) diagnostics.push({ code: "design/missing-owned-property", severity: "warning", range: elementRange(el), actual: property, property, candidates: [], explanation: `${recipeName} requires ${property}: ${required.values.map((one) => atom(one, property)).join(" ")}; no supported authored declaration supplies it.` });
        continue;
      }
      if (unknownCascade) continue;
      const expectedAtoms = required.values.map((one) => atom(one, property)), actualAtoms = actual.values.map((one) => atom(one, property));
      if (expectedAtoms.join(" ") !== actualAtoms.join(" ")) diagnostics.push({ code: "design/owned-value", severity: "warning", range: location({ node: actual.declaration.value, part: actual.block.part }), actual: spelling({ node: actual.declaration.value, part: actual.block.part }), property, candidates: [], explanation: `${recipeName}${treatment ? ` / ${chosen}` : ""} owns ${property}: expected ${expectedAtoms.join(" ")}, found ${actualAtoms.join(" ")}.` });
      if (policy.effective.literals === "require-references" && property === "font-weight") {
        const known = [...exported].filter(([name]) => name.startsWith("--weight-")).flatMap(([name, binding]) => {
          const values2 = resolve(binding, exportEnv, exportCycles, property, false);
          return Array.isArray(values2) && values2.length === 1 && atom(values2[0], property) !== null ? [{ name, value: atom(values2[0], property) }] : [];
        });
        if (known.some((one) => expectedAtoms.includes(one.value)) && !actual.values.every((value) => known.some((one) => value.via?.includes(one.name) && atom(value, property) === one.value))) diagnostics.push({ code: "design/reference-required", severity: "warning", range: location({ node: actual.declaration.value, part: actual.block.part }), actual: spelling({ node: actual.declaration.value, part: actual.block.part }), property, candidates: [], explanation: "This owned font weight requires a declared exported token reference; a matching literal or local literal alias is insufficient." });
      }
    }
  }
  diagnostics.sort((a, b) => a.range.start.offset - b.range.start.offset || a.code.localeCompare(b.code));
  unexamined.sort((a, b) => a.range.start.offset - b.range.start.offset || a.code.localeCompare(b.code));
  return { ruleVersion: DESIGN_AUDIT_VERSION, diagnostics, policy, coverage: { complete: unexamined.length === 0, declarations, checkedValues, omittedCategories: categories.filter((kind) => !palette.get(kind).length && !unknownCategories.has(kind)), unexamined }, offSystem: [...found.values()].sort((a, b) => b.count - a.count || a.line - b.line), onSystem };
}
function offSystemTotal(audits) {
  return audits.reduce((sum, audit) => sum + audit.offSystem.length, 0);
}
export {
  DESIGN_AUDIT_VERSION,
  auditScreen,
  offSystemTotal
};
