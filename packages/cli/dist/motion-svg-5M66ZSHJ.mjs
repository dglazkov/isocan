import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  walker_default
} from "./chunk-ZGM2EGRQ.mjs";
import {
  AtKeyword,
  BadUrl,
  CDC,
  Colon,
  Delim,
  Dimension,
  Function,
  Hash,
  Ident,
  LeftParenthesis,
  Number as Number2,
  Percentage,
  RightParenthesis,
  String as String2,
  Url,
  WhiteSpace,
  generate,
  generate10,
  generate11,
  generate12,
  generate13,
  generate14,
  generate15,
  generate16,
  generate17,
  generate18,
  generate19,
  generate2,
  generate20,
  generate21,
  generate22,
  generate23,
  generate24,
  generate25,
  generate26,
  generate27,
  generate28,
  generate29,
  generate3,
  generate30,
  generate31,
  generate32,
  generate33,
  generate34,
  generate35,
  generate36,
  generate37,
  generate38,
  generate39,
  generate4,
  generate40,
  generate41,
  generate42,
  generate43,
  generate44,
  generate45,
  generate46,
  generate47,
  generate48,
  generate49,
  generate5,
  generate6,
  generate7,
  generate8,
  generate9,
  parser_default,
  tokenize
} from "./chunk-RMSXDVER.mjs";
import {
  defaultTreeAdapter,
  html_exports,
  parseFragment,
  serializeOuter
} from "./chunk-VK3MKXRI.mjs";
import {
  __commonJS,
  __export,
  __toESM
} from "./chunk-JYOOXWJZ.mjs";

// node_modules/source-map-js/lib/base64.js
var require_base64 = __commonJS({
  "node_modules/source-map-js/lib/base64.js"(exports) {
    var intToCharMap = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("");
    exports.encode = function(number) {
      if (0 <= number && number < intToCharMap.length) {
        return intToCharMap[number];
      }
      throw new TypeError("Must be between 0 and 63: " + number);
    };
    exports.decode = function(charCode) {
      var bigA = 65;
      var bigZ = 90;
      var littleA = 97;
      var littleZ = 122;
      var zero = 48;
      var nine = 57;
      var plus = 43;
      var slash = 47;
      var littleOffset = 26;
      var numberOffset = 52;
      if (bigA <= charCode && charCode <= bigZ) {
        return charCode - bigA;
      }
      if (littleA <= charCode && charCode <= littleZ) {
        return charCode - littleA + littleOffset;
      }
      if (zero <= charCode && charCode <= nine) {
        return charCode - zero + numberOffset;
      }
      if (charCode == plus) {
        return 62;
      }
      if (charCode == slash) {
        return 63;
      }
      return -1;
    };
  }
});

// node_modules/source-map-js/lib/base64-vlq.js
var require_base64_vlq = __commonJS({
  "node_modules/source-map-js/lib/base64-vlq.js"(exports) {
    var base64 = require_base64();
    var VLQ_BASE_SHIFT = 5;
    var VLQ_BASE = 1 << VLQ_BASE_SHIFT;
    var VLQ_BASE_MASK = VLQ_BASE - 1;
    var VLQ_CONTINUATION_BIT = VLQ_BASE;
    function toVLQSigned(aValue) {
      return aValue < 0 ? (-aValue << 1) + 1 : (aValue << 1) + 0;
    }
    function fromVLQSigned(aValue) {
      var isNegative = (aValue & 1) === 1;
      var shifted = aValue >> 1;
      return isNegative ? -shifted : shifted;
    }
    exports.encode = function base64VLQ_encode(aValue) {
      var encoded = "";
      var digit;
      var vlq = toVLQSigned(aValue);
      do {
        digit = vlq & VLQ_BASE_MASK;
        vlq >>>= VLQ_BASE_SHIFT;
        if (vlq > 0) {
          digit |= VLQ_CONTINUATION_BIT;
        }
        encoded += base64.encode(digit);
      } while (vlq > 0);
      return encoded;
    };
    exports.decode = function base64VLQ_decode(aStr, aIndex, aOutParam) {
      var strLen = aStr.length;
      var result = 0;
      var shift = 0;
      var continuation, digit;
      do {
        if (aIndex >= strLen) {
          throw new Error("Expected more digits in base 64 VLQ value.");
        }
        digit = base64.decode(aStr.charCodeAt(aIndex++));
        if (digit === -1) {
          throw new Error("Invalid base64 digit: " + aStr.charAt(aIndex - 1));
        }
        continuation = !!(digit & VLQ_CONTINUATION_BIT);
        digit &= VLQ_BASE_MASK;
        result = result + (digit << shift);
        shift += VLQ_BASE_SHIFT;
      } while (continuation);
      aOutParam.value = fromVLQSigned(result);
      aOutParam.rest = aIndex;
    };
  }
});

// node_modules/source-map-js/lib/util.js
var require_util = __commonJS({
  "node_modules/source-map-js/lib/util.js"(exports) {
    function getArg(aArgs, aName, aDefaultValue) {
      if (aName in aArgs) {
        return aArgs[aName];
      } else if (arguments.length === 3) {
        return aDefaultValue;
      } else {
        throw new Error('"' + aName + '" is a required argument.');
      }
    }
    exports.getArg = getArg;
    var urlRegexp = /^(?:([\w+\-.]+):)?\/\/(?:(\w+:\w+)@)?([\w.-]*)(?::(\d+))?(.*)$/;
    var dataUrlRegexp = /^data:.+\,.+$/;
    function urlParse(aUrl) {
      var match = aUrl.match(urlRegexp);
      if (!match) {
        return null;
      }
      return {
        scheme: match[1],
        auth: match[2],
        host: match[3],
        port: match[4],
        path: match[5]
      };
    }
    exports.urlParse = urlParse;
    function urlGenerate(aParsedUrl) {
      var url = "";
      if (aParsedUrl.scheme) {
        url += aParsedUrl.scheme + ":";
      }
      url += "//";
      if (aParsedUrl.auth) {
        url += aParsedUrl.auth + "@";
      }
      if (aParsedUrl.host) {
        url += aParsedUrl.host;
      }
      if (aParsedUrl.port) {
        url += ":" + aParsedUrl.port;
      }
      if (aParsedUrl.path) {
        url += aParsedUrl.path;
      }
      return url;
    }
    exports.urlGenerate = urlGenerate;
    var MAX_CACHED_INPUTS = 32;
    function lruMemoize(f) {
      var cache = [];
      return function(input) {
        for (var i = 0; i < cache.length; i++) {
          if (cache[i].input === input) {
            var temp = cache[0];
            cache[0] = cache[i];
            cache[i] = temp;
            return cache[0].result;
          }
        }
        var result = f(input);
        cache.unshift({
          input,
          result
        });
        if (cache.length > MAX_CACHED_INPUTS) {
          cache.pop();
        }
        return result;
      };
    }
    var normalize = lruMemoize(function normalize2(aPath) {
      var path = aPath;
      var url = urlParse(aPath);
      if (url) {
        if (!url.path) {
          return aPath;
        }
        path = url.path;
      }
      var isAbsolute = exports.isAbsolute(path);
      var parts = [];
      var start = 0;
      var i = 0;
      while (true) {
        start = i;
        i = path.indexOf("/", start);
        if (i === -1) {
          parts.push(path.slice(start));
          break;
        } else {
          parts.push(path.slice(start, i));
          while (i < path.length && path[i] === "/") {
            i++;
          }
        }
      }
      for (var part, up = 0, i = parts.length - 1; i >= 0; i--) {
        part = parts[i];
        if (part === ".") {
          parts.splice(i, 1);
        } else if (part === "..") {
          up++;
        } else if (up > 0) {
          if (part === "") {
            parts.splice(i + 1, up);
            up = 0;
          } else {
            parts.splice(i, 2);
            up--;
          }
        }
      }
      path = parts.join("/");
      if (path === "") {
        path = isAbsolute ? "/" : ".";
      }
      if (url) {
        url.path = path;
        return urlGenerate(url);
      }
      return path;
    });
    exports.normalize = normalize;
    function join(aRoot, aPath) {
      if (aRoot === "") {
        aRoot = ".";
      }
      if (aPath === "") {
        aPath = ".";
      }
      var aPathUrl = urlParse(aPath);
      var aRootUrl = urlParse(aRoot);
      if (aRootUrl) {
        aRoot = aRootUrl.path || "/";
      }
      if (aPathUrl && !aPathUrl.scheme) {
        if (aRootUrl) {
          aPathUrl.scheme = aRootUrl.scheme;
        }
        return urlGenerate(aPathUrl);
      }
      if (aPathUrl || aPath.match(dataUrlRegexp)) {
        return aPath;
      }
      if (aRootUrl && !aRootUrl.host && !aRootUrl.path) {
        aRootUrl.host = aPath;
        return urlGenerate(aRootUrl);
      }
      var joined = aPath.charAt(0) === "/" ? aPath : normalize(aRoot.replace(/\/+$/, "") + "/" + aPath);
      if (aRootUrl) {
        aRootUrl.path = joined;
        return urlGenerate(aRootUrl);
      }
      return joined;
    }
    exports.join = join;
    exports.isAbsolute = function(aPath) {
      return aPath.charAt(0) === "/" || urlRegexp.test(aPath);
    };
    function relative(aRoot, aPath) {
      if (aRoot === "") {
        aRoot = ".";
      }
      aRoot = aRoot.replace(/\/$/, "");
      var level = 0;
      while (aPath.indexOf(aRoot + "/") !== 0) {
        var index = aRoot.lastIndexOf("/");
        if (index < 0) {
          return aPath;
        }
        aRoot = aRoot.slice(0, index);
        if (aRoot.match(/^([^\/]+:\/)?\/*$/)) {
          return aPath;
        }
        ++level;
      }
      return Array(level + 1).join("../") + aPath.substr(aRoot.length + 1);
    }
    exports.relative = relative;
    var supportsNullProto = (function() {
      var obj = /* @__PURE__ */ Object.create(null);
      return !("__proto__" in obj);
    })();
    function identity(s) {
      return s;
    }
    function toSetString(aStr) {
      if (isProtoString(aStr)) {
        return "$" + aStr;
      }
      return aStr;
    }
    exports.toSetString = supportsNullProto ? identity : toSetString;
    function fromSetString(aStr) {
      if (isProtoString(aStr)) {
        return aStr.slice(1);
      }
      return aStr;
    }
    exports.fromSetString = supportsNullProto ? identity : fromSetString;
    function isProtoString(s) {
      if (!s) {
        return false;
      }
      var length = s.length;
      if (length < 9) {
        return false;
      }
      if (s.charCodeAt(length - 1) !== 95 || s.charCodeAt(length - 2) !== 95 || s.charCodeAt(length - 3) !== 111 || s.charCodeAt(length - 4) !== 116 || s.charCodeAt(length - 5) !== 111 || s.charCodeAt(length - 6) !== 114 || s.charCodeAt(length - 7) !== 112 || s.charCodeAt(length - 8) !== 95 || s.charCodeAt(length - 9) !== 95) {
        return false;
      }
      for (var i = length - 10; i >= 0; i--) {
        if (s.charCodeAt(i) !== 36) {
          return false;
        }
      }
      return true;
    }
    function compareByOriginalPositions(mappingA, mappingB, onlyCompareOriginal) {
      var cmp = strcmp(mappingA.source, mappingB.source);
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.originalLine - mappingB.originalLine;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.originalColumn - mappingB.originalColumn;
      if (cmp !== 0 || onlyCompareOriginal) {
        return cmp;
      }
      cmp = mappingA.generatedColumn - mappingB.generatedColumn;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.generatedLine - mappingB.generatedLine;
      if (cmp !== 0) {
        return cmp;
      }
      return strcmp(mappingA.name, mappingB.name);
    }
    exports.compareByOriginalPositions = compareByOriginalPositions;
    function compareByOriginalPositionsNoSource(mappingA, mappingB, onlyCompareOriginal) {
      var cmp;
      cmp = mappingA.originalLine - mappingB.originalLine;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.originalColumn - mappingB.originalColumn;
      if (cmp !== 0 || onlyCompareOriginal) {
        return cmp;
      }
      cmp = mappingA.generatedColumn - mappingB.generatedColumn;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.generatedLine - mappingB.generatedLine;
      if (cmp !== 0) {
        return cmp;
      }
      return strcmp(mappingA.name, mappingB.name);
    }
    exports.compareByOriginalPositionsNoSource = compareByOriginalPositionsNoSource;
    function compareByGeneratedPositionsDeflated(mappingA, mappingB, onlyCompareGenerated) {
      var cmp = mappingA.generatedLine - mappingB.generatedLine;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.generatedColumn - mappingB.generatedColumn;
      if (cmp !== 0 || onlyCompareGenerated) {
        return cmp;
      }
      cmp = strcmp(mappingA.source, mappingB.source);
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.originalLine - mappingB.originalLine;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.originalColumn - mappingB.originalColumn;
      if (cmp !== 0) {
        return cmp;
      }
      return strcmp(mappingA.name, mappingB.name);
    }
    exports.compareByGeneratedPositionsDeflated = compareByGeneratedPositionsDeflated;
    function compareByGeneratedPositionsDeflatedNoLine(mappingA, mappingB, onlyCompareGenerated) {
      var cmp = mappingA.generatedColumn - mappingB.generatedColumn;
      if (cmp !== 0 || onlyCompareGenerated) {
        return cmp;
      }
      cmp = strcmp(mappingA.source, mappingB.source);
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.originalLine - mappingB.originalLine;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.originalColumn - mappingB.originalColumn;
      if (cmp !== 0) {
        return cmp;
      }
      return strcmp(mappingA.name, mappingB.name);
    }
    exports.compareByGeneratedPositionsDeflatedNoLine = compareByGeneratedPositionsDeflatedNoLine;
    function strcmp(aStr1, aStr2) {
      if (aStr1 === aStr2) {
        return 0;
      }
      if (aStr1 === null) {
        return 1;
      }
      if (aStr2 === null) {
        return -1;
      }
      if (aStr1 > aStr2) {
        return 1;
      }
      return -1;
    }
    function compareByGeneratedPositionsInflated(mappingA, mappingB) {
      var cmp = mappingA.generatedLine - mappingB.generatedLine;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.generatedColumn - mappingB.generatedColumn;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = strcmp(mappingA.source, mappingB.source);
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.originalLine - mappingB.originalLine;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.originalColumn - mappingB.originalColumn;
      if (cmp !== 0) {
        return cmp;
      }
      return strcmp(mappingA.name, mappingB.name);
    }
    exports.compareByGeneratedPositionsInflated = compareByGeneratedPositionsInflated;
    function parseSourceMapInput(str) {
      return JSON.parse(str.replace(/^\)]}'[^\n]*\n/, ""));
    }
    exports.parseSourceMapInput = parseSourceMapInput;
    function computeSourceURL(sourceRoot, sourceURL, sourceMapURL) {
      sourceURL = sourceURL || "";
      if (sourceRoot) {
        if (sourceRoot[sourceRoot.length - 1] !== "/" && sourceURL[0] !== "/") {
          sourceRoot += "/";
        }
        sourceURL = sourceRoot + sourceURL;
      }
      if (sourceMapURL) {
        var parsed = urlParse(sourceMapURL);
        if (!parsed) {
          throw new Error("sourceMapURL could not be parsed");
        }
        if (parsed.path) {
          var index = parsed.path.lastIndexOf("/");
          if (index >= 0) {
            parsed.path = parsed.path.substring(0, index + 1);
          }
        }
        sourceURL = join(urlGenerate(parsed), sourceURL);
      }
      return normalize(sourceURL);
    }
    exports.computeSourceURL = computeSourceURL;
  }
});

// node_modules/source-map-js/lib/array-set.js
var require_array_set = __commonJS({
  "node_modules/source-map-js/lib/array-set.js"(exports) {
    var util = require_util();
    var has = Object.prototype.hasOwnProperty;
    var hasNativeMap = typeof Map !== "undefined";
    function ArraySet() {
      this._array = [];
      this._set = hasNativeMap ? /* @__PURE__ */ new Map() : /* @__PURE__ */ Object.create(null);
    }
    ArraySet.fromArray = function ArraySet_fromArray(aArray, aAllowDuplicates) {
      var set = new ArraySet();
      for (var i = 0, len = aArray.length; i < len; i++) {
        set.add(aArray[i], aAllowDuplicates);
      }
      return set;
    };
    ArraySet.prototype.size = function ArraySet_size() {
      return hasNativeMap ? this._set.size : Object.getOwnPropertyNames(this._set).length;
    };
    ArraySet.prototype.add = function ArraySet_add(aStr, aAllowDuplicates) {
      var sStr = hasNativeMap ? aStr : util.toSetString(aStr);
      var isDuplicate = hasNativeMap ? this.has(aStr) : has.call(this._set, sStr);
      var idx = this._array.length;
      if (!isDuplicate || aAllowDuplicates) {
        this._array.push(aStr);
      }
      if (!isDuplicate) {
        if (hasNativeMap) {
          this._set.set(aStr, idx);
        } else {
          this._set[sStr] = idx;
        }
      }
    };
    ArraySet.prototype.has = function ArraySet_has(aStr) {
      if (hasNativeMap) {
        return this._set.has(aStr);
      } else {
        var sStr = util.toSetString(aStr);
        return has.call(this._set, sStr);
      }
    };
    ArraySet.prototype.indexOf = function ArraySet_indexOf(aStr) {
      if (hasNativeMap) {
        var idx = this._set.get(aStr);
        if (idx >= 0) {
          return idx;
        }
      } else {
        var sStr = util.toSetString(aStr);
        if (has.call(this._set, sStr)) {
          return this._set[sStr];
        }
      }
      throw new Error('"' + aStr + '" is not in the set.');
    };
    ArraySet.prototype.at = function ArraySet_at(aIdx) {
      if (aIdx >= 0 && aIdx < this._array.length) {
        return this._array[aIdx];
      }
      throw new Error("No element indexed by " + aIdx);
    };
    ArraySet.prototype.toArray = function ArraySet_toArray() {
      return this._array.slice();
    };
    exports.ArraySet = ArraySet;
  }
});

// node_modules/source-map-js/lib/mapping-list.js
var require_mapping_list = __commonJS({
  "node_modules/source-map-js/lib/mapping-list.js"(exports) {
    var util = require_util();
    function generatedPositionAfter(mappingA, mappingB) {
      var lineA = mappingA.generatedLine;
      var lineB = mappingB.generatedLine;
      var columnA = mappingA.generatedColumn;
      var columnB = mappingB.generatedColumn;
      return lineB > lineA || lineB == lineA && columnB >= columnA || util.compareByGeneratedPositionsInflated(mappingA, mappingB) <= 0;
    }
    function MappingList() {
      this._array = [];
      this._sorted = true;
      this._last = { generatedLine: -1, generatedColumn: 0 };
    }
    MappingList.prototype.unsortedForEach = function MappingList_forEach(aCallback, aThisArg) {
      this._array.forEach(aCallback, aThisArg);
    };
    MappingList.prototype.add = function MappingList_add(aMapping) {
      if (generatedPositionAfter(this._last, aMapping)) {
        this._last = aMapping;
        this._array.push(aMapping);
      } else {
        this._sorted = false;
        this._array.push(aMapping);
      }
    };
    MappingList.prototype.toArray = function MappingList_toArray() {
      if (!this._sorted) {
        this._array.sort(util.compareByGeneratedPositionsInflated);
        this._sorted = true;
      }
      return this._array;
    };
    exports.MappingList = MappingList;
  }
});

// node_modules/source-map-js/lib/source-map-generator.js
var require_source_map_generator = __commonJS({
  "node_modules/source-map-js/lib/source-map-generator.js"(exports) {
    var base64VLQ = require_base64_vlq();
    var util = require_util();
    var ArraySet = require_array_set().ArraySet;
    var MappingList = require_mapping_list().MappingList;
    function SourceMapGenerator2(aArgs) {
      if (!aArgs) {
        aArgs = {};
      }
      this._file = util.getArg(aArgs, "file", null);
      this._sourceRoot = util.getArg(aArgs, "sourceRoot", null);
      this._skipValidation = util.getArg(aArgs, "skipValidation", false);
      this._ignoreInvalidMapping = util.getArg(aArgs, "ignoreInvalidMapping", false);
      this._sources = new ArraySet();
      this._names = new ArraySet();
      this._mappings = new MappingList();
      this._sourcesContents = null;
    }
    SourceMapGenerator2.prototype._version = 3;
    SourceMapGenerator2.fromSourceMap = function SourceMapGenerator_fromSourceMap(aSourceMapConsumer, generatorOps) {
      var sourceRoot = aSourceMapConsumer.sourceRoot;
      var generator = new SourceMapGenerator2(Object.assign(generatorOps || {}, {
        file: aSourceMapConsumer.file,
        sourceRoot
      }));
      aSourceMapConsumer.eachMapping(function(mapping) {
        var newMapping = {
          generated: {
            line: mapping.generatedLine,
            column: mapping.generatedColumn
          }
        };
        if (mapping.source != null) {
          newMapping.source = mapping.source;
          if (sourceRoot != null) {
            newMapping.source = util.relative(sourceRoot, newMapping.source);
          }
          newMapping.original = {
            line: mapping.originalLine,
            column: mapping.originalColumn
          };
          if (mapping.name != null) {
            newMapping.name = mapping.name;
          }
        }
        generator.addMapping(newMapping);
      });
      aSourceMapConsumer.sources.forEach(function(sourceFile) {
        var sourceRelative = sourceFile;
        if (sourceRoot !== null) {
          sourceRelative = util.relative(sourceRoot, sourceFile);
        }
        if (!generator._sources.has(sourceRelative)) {
          generator._sources.add(sourceRelative);
        }
        var content = aSourceMapConsumer.sourceContentFor(sourceFile);
        if (content != null) {
          generator.setSourceContent(sourceFile, content);
        }
      });
      return generator;
    };
    SourceMapGenerator2.prototype.addMapping = function SourceMapGenerator_addMapping(aArgs) {
      var generated = util.getArg(aArgs, "generated");
      var original = util.getArg(aArgs, "original", null);
      var source = util.getArg(aArgs, "source", null);
      var name = util.getArg(aArgs, "name", null);
      if (!this._skipValidation) {
        if (this._validateMapping(generated, original, source, name) === false) {
          return;
        }
      }
      if (source != null) {
        source = String(source);
        if (!this._sources.has(source)) {
          this._sources.add(source);
        }
      }
      if (name != null) {
        name = String(name);
        if (!this._names.has(name)) {
          this._names.add(name);
        }
      }
      this._mappings.add({
        generatedLine: generated.line,
        generatedColumn: generated.column,
        originalLine: original != null && original.line,
        originalColumn: original != null && original.column,
        source,
        name
      });
    };
    SourceMapGenerator2.prototype.setSourceContent = function SourceMapGenerator_setSourceContent(aSourceFile, aSourceContent) {
      var source = aSourceFile;
      if (this._sourceRoot != null) {
        source = util.relative(this._sourceRoot, source);
      }
      if (aSourceContent != null) {
        if (!this._sourcesContents) {
          this._sourcesContents = /* @__PURE__ */ Object.create(null);
        }
        this._sourcesContents[util.toSetString(source)] = aSourceContent;
      } else if (this._sourcesContents) {
        delete this._sourcesContents[util.toSetString(source)];
        if (Object.keys(this._sourcesContents).length === 0) {
          this._sourcesContents = null;
        }
      }
    };
    SourceMapGenerator2.prototype.applySourceMap = function SourceMapGenerator_applySourceMap(aSourceMapConsumer, aSourceFile, aSourceMapPath) {
      var sourceFile = aSourceFile;
      if (aSourceFile == null) {
        if (aSourceMapConsumer.file == null) {
          throw new Error(
            `SourceMapGenerator.prototype.applySourceMap requires either an explicit source file, or the source map's "file" property. Both were omitted.`
          );
        }
        sourceFile = aSourceMapConsumer.file;
      }
      var sourceRoot = this._sourceRoot;
      if (sourceRoot != null) {
        sourceFile = util.relative(sourceRoot, sourceFile);
      }
      var newSources = new ArraySet();
      var newNames = new ArraySet();
      this._mappings.unsortedForEach(function(mapping) {
        if (mapping.source === sourceFile && mapping.originalLine != null) {
          var original = aSourceMapConsumer.originalPositionFor({
            line: mapping.originalLine,
            column: mapping.originalColumn
          });
          if (original.source != null) {
            mapping.source = original.source;
            if (aSourceMapPath != null) {
              mapping.source = util.join(aSourceMapPath, mapping.source);
            }
            if (sourceRoot != null) {
              mapping.source = util.relative(sourceRoot, mapping.source);
            }
            mapping.originalLine = original.line;
            mapping.originalColumn = original.column;
            if (original.name != null) {
              mapping.name = original.name;
            }
          }
        }
        var source = mapping.source;
        if (source != null && !newSources.has(source)) {
          newSources.add(source);
        }
        var name = mapping.name;
        if (name != null && !newNames.has(name)) {
          newNames.add(name);
        }
      }, this);
      this._sources = newSources;
      this._names = newNames;
      aSourceMapConsumer.sources.forEach(function(sourceFile2) {
        var content = aSourceMapConsumer.sourceContentFor(sourceFile2);
        if (content != null) {
          if (aSourceMapPath != null) {
            sourceFile2 = util.join(aSourceMapPath, sourceFile2);
          }
          if (sourceRoot != null) {
            sourceFile2 = util.relative(sourceRoot, sourceFile2);
          }
          this.setSourceContent(sourceFile2, content);
        }
      }, this);
    };
    SourceMapGenerator2.prototype._validateMapping = function SourceMapGenerator_validateMapping(aGenerated, aOriginal, aSource, aName) {
      if (aOriginal && typeof aOriginal.line !== "number" && typeof aOriginal.column !== "number") {
        var message = "original.line and original.column are not numbers -- you probably meant to omit the original mapping entirely and only map the generated position. If so, pass null for the original mapping instead of an object with empty or null values.";
        if (this._ignoreInvalidMapping) {
          if (typeof console !== "undefined" && console.warn) {
            console.warn(message);
          }
          return false;
        } else {
          throw new Error(message);
        }
      }
      if (aGenerated && "line" in aGenerated && "column" in aGenerated && aGenerated.line > 0 && aGenerated.column >= 0 && !aOriginal && !aSource && !aName) {
        return;
      } else if (aGenerated && "line" in aGenerated && "column" in aGenerated && aOriginal && "line" in aOriginal && "column" in aOriginal && aGenerated.line > 0 && aGenerated.column >= 0 && aOriginal.line > 0 && aOriginal.column >= 0 && aSource) {
        return;
      } else {
        var message = "Invalid mapping: " + JSON.stringify({
          generated: aGenerated,
          source: aSource,
          original: aOriginal,
          name: aName
        });
        if (this._ignoreInvalidMapping) {
          if (typeof console !== "undefined" && console.warn) {
            console.warn(message);
          }
          return false;
        } else {
          throw new Error(message);
        }
      }
    };
    SourceMapGenerator2.prototype._serializeMappings = function SourceMapGenerator_serializeMappings() {
      var previousGeneratedColumn = 0;
      var previousGeneratedLine = 1;
      var previousOriginalColumn = 0;
      var previousOriginalLine = 0;
      var previousName = 0;
      var previousSource = 0;
      var result = "";
      var next;
      var mapping;
      var nameIdx;
      var sourceIdx;
      var mappings = this._mappings.toArray();
      for (var i = 0, len = mappings.length; i < len; i++) {
        mapping = mappings[i];
        next = "";
        if (mapping.generatedLine !== previousGeneratedLine) {
          previousGeneratedColumn = 0;
          while (mapping.generatedLine !== previousGeneratedLine) {
            next += ";";
            previousGeneratedLine++;
          }
        } else {
          if (i > 0) {
            if (!util.compareByGeneratedPositionsInflated(mapping, mappings[i - 1])) {
              continue;
            }
            next += ",";
          }
        }
        next += base64VLQ.encode(mapping.generatedColumn - previousGeneratedColumn);
        previousGeneratedColumn = mapping.generatedColumn;
        if (mapping.source != null) {
          sourceIdx = this._sources.indexOf(mapping.source);
          next += base64VLQ.encode(sourceIdx - previousSource);
          previousSource = sourceIdx;
          next += base64VLQ.encode(mapping.originalLine - 1 - previousOriginalLine);
          previousOriginalLine = mapping.originalLine - 1;
          next += base64VLQ.encode(mapping.originalColumn - previousOriginalColumn);
          previousOriginalColumn = mapping.originalColumn;
          if (mapping.name != null) {
            nameIdx = this._names.indexOf(mapping.name);
            next += base64VLQ.encode(nameIdx - previousName);
            previousName = nameIdx;
          }
        }
        result += next;
      }
      return result;
    };
    SourceMapGenerator2.prototype._generateSourcesContent = function SourceMapGenerator_generateSourcesContent(aSources, aSourceRoot) {
      return aSources.map(function(source) {
        if (!this._sourcesContents) {
          return null;
        }
        if (aSourceRoot != null) {
          source = util.relative(aSourceRoot, source);
        }
        var key = util.toSetString(source);
        return Object.prototype.hasOwnProperty.call(this._sourcesContents, key) ? this._sourcesContents[key] : null;
      }, this);
    };
    SourceMapGenerator2.prototype.toJSON = function SourceMapGenerator_toJSON() {
      var map = {
        version: this._version,
        sources: this._sources.toArray(),
        names: this._names.toArray(),
        mappings: this._serializeMappings()
      };
      if (this._file != null) {
        map.file = this._file;
      }
      if (this._sourceRoot != null) {
        map.sourceRoot = this._sourceRoot;
      }
      if (this._sourcesContents) {
        map.sourcesContent = this._generateSourcesContent(map.sources, map.sourceRoot);
      }
      return map;
    };
    SourceMapGenerator2.prototype.toString = function SourceMapGenerator_toString() {
      return JSON.stringify(this.toJSON());
    };
    exports.SourceMapGenerator = SourceMapGenerator2;
  }
});

// node_modules/css-tree/lib/generator/sourceMap.js
var import_source_map_generator = __toESM(require_source_map_generator(), 1);
var trackNodes = /* @__PURE__ */ new Set(["Atrule", "Selector", "Declaration"]);
function generateSourceMap(handlers) {
  const map = new import_source_map_generator.SourceMapGenerator();
  const generated = {
    line: 1,
    column: 0
  };
  const original = {
    line: 0,
    // should be zero to add first mapping
    column: 0
  };
  const activatedGenerated = {
    line: 1,
    column: 0
  };
  const activatedMapping = {
    generated: activatedGenerated
  };
  let line = 1;
  let column = 0;
  let sourceMappingActive = false;
  const origHandlersNode = handlers.node;
  handlers.node = function(node) {
    if (node.loc && node.loc.start && trackNodes.has(node.type)) {
      const nodeLine = node.loc.start.line;
      const nodeColumn = node.loc.start.column - 1;
      if (original.line !== nodeLine || original.column !== nodeColumn) {
        original.line = nodeLine;
        original.column = nodeColumn;
        generated.line = line;
        generated.column = column;
        if (sourceMappingActive) {
          sourceMappingActive = false;
          if (generated.line !== activatedGenerated.line || generated.column !== activatedGenerated.column) {
            map.addMapping(activatedMapping);
          }
        }
        sourceMappingActive = true;
        map.addMapping({
          source: node.loc.source,
          original,
          generated
        });
      }
    }
    origHandlersNode.call(this, node);
    if (sourceMappingActive && trackNodes.has(node.type)) {
      activatedGenerated.line = line;
      activatedGenerated.column = column;
    }
  };
  const origHandlersEmit = handlers.emit;
  handlers.emit = function(value, type, auto) {
    for (let i = 0; i < value.length; i++) {
      if (value.charCodeAt(i) === 10) {
        line++;
        column = 0;
      } else {
        column++;
      }
    }
    origHandlersEmit(value, type, auto);
  };
  const origHandlersResult = handlers.result;
  handlers.result = function() {
    if (sourceMappingActive) {
      map.addMapping(activatedMapping);
    }
    return {
      css: origHandlersResult(),
      map
    };
  };
  return handlers;
}

// node_modules/css-tree/lib/generator/token-before.js
var token_before_exports = {};
__export(token_before_exports, {
  safe: () => safe,
  spec: () => spec
});
var PLUSSIGN = 43;
var HYPHENMINUS = 45;
var code = (type, value) => {
  if (type === Delim) {
    type = value;
  }
  if (typeof type === "string") {
    type = Math.min(type.charCodeAt(0), 128) << 6;
  }
  return type << 1;
};
var specPairs = [
  [Ident, Ident],
  [Ident, Function],
  [Ident, Url],
  [Ident, BadUrl],
  [Ident, "-"],
  [Ident, Number2],
  [Ident, Percentage],
  [Ident, Dimension],
  [Ident, CDC],
  [Ident, LeftParenthesis],
  [AtKeyword, Ident],
  [AtKeyword, Function],
  [AtKeyword, Url],
  [AtKeyword, BadUrl],
  [AtKeyword, "-"],
  [AtKeyword, Number2],
  [AtKeyword, Percentage],
  [AtKeyword, Dimension],
  [AtKeyword, CDC],
  [Hash, Ident],
  [Hash, Function],
  [Hash, Url],
  [Hash, BadUrl],
  [Hash, "-"],
  [Hash, Number2],
  [Hash, Percentage],
  [Hash, Dimension],
  [Hash, CDC],
  [Dimension, Ident],
  [Dimension, Function],
  [Dimension, Url],
  [Dimension, BadUrl],
  [Dimension, "-"],
  [Dimension, Number2],
  [Dimension, Percentage],
  [Dimension, Dimension],
  [Dimension, CDC],
  ["#", Ident],
  ["#", Function],
  ["#", Url],
  ["#", BadUrl],
  ["#", "-"],
  ["#", Number2],
  ["#", Percentage],
  ["#", Dimension],
  ["#", CDC],
  // https://github.com/w3c/csswg-drafts/pull/6874
  ["-", Ident],
  ["-", Function],
  ["-", Url],
  ["-", BadUrl],
  ["-", "-"],
  ["-", Number2],
  ["-", Percentage],
  ["-", Dimension],
  ["-", CDC],
  // https://github.com/w3c/csswg-drafts/pull/6874
  [Number2, Ident],
  [Number2, Function],
  [Number2, Url],
  [Number2, BadUrl],
  [Number2, Number2],
  [Number2, Percentage],
  [Number2, Dimension],
  [Number2, "%"],
  [Number2, CDC],
  // https://github.com/w3c/csswg-drafts/pull/6874
  ["@", Ident],
  ["@", Function],
  ["@", Url],
  ["@", BadUrl],
  ["@", "-"],
  ["@", CDC],
  // https://github.com/w3c/csswg-drafts/pull/6874
  [".", Number2],
  [".", Percentage],
  [".", Dimension],
  ["+", Number2],
  ["+", Percentage],
  ["+", Dimension],
  ["/", "*"]
];
var safePairs = specPairs.concat([
  [Ident, Hash],
  [Dimension, Hash],
  [Hash, Hash],
  [AtKeyword, LeftParenthesis],
  [AtKeyword, String2],
  [AtKeyword, Colon],
  [Percentage, Percentage],
  [Percentage, Dimension],
  [Percentage, Function],
  [Percentage, "-"],
  [RightParenthesis, Ident],
  [RightParenthesis, Function],
  [RightParenthesis, Percentage],
  [RightParenthesis, Dimension],
  [RightParenthesis, Hash],
  [RightParenthesis, "-"]
]);
function createMap(pairs) {
  const isWhiteSpaceRequired = new Set(
    pairs.map(([prev, next]) => code(prev) << 16 | code(next))
  );
  return function(prevCode, type, value) {
    const nextCode = code(type, value);
    const nextCharCode = value.charCodeAt(0);
    const emitWs = nextCharCode === HYPHENMINUS && type !== Ident && type !== Function && type !== CDC || nextCharCode === PLUSSIGN ? isWhiteSpaceRequired.has((prevCode & 65534) << 16 | nextCharCode << 7) : isWhiteSpaceRequired.has((prevCode & 65534) << 16 | nextCode);
    return nextCode | emitWs;
  };
}
var spec = createMap(specPairs);
var safe = createMap(safePairs);

// node_modules/css-tree/lib/generator/create.js
var REVERSESOLIDUS = 92;
function processChildren(node, delimeter) {
  if (typeof delimeter === "function") {
    let prev = null;
    node.children.forEach((node2) => {
      if (prev !== null) {
        delimeter.call(this, prev);
      }
      this.node(node2);
      prev = node2;
    });
    return;
  }
  node.children.forEach(this.node, this);
}
function createGenerator(config) {
  const types = /* @__PURE__ */ new Map();
  for (let [name, item] of Object.entries(config.node)) {
    const fn = item.generate || item;
    if (typeof fn === "function") {
      types.set(name, item.generate || item);
    }
  }
  return function(node, options) {
    let buffer = "";
    let prevCode = 0;
    let handlers = {
      node(node2) {
        if (types.has(node2.type)) {
          types.get(node2.type).call(publicApi, node2);
        } else {
          throw new Error("Unknown node type: " + node2.type);
        }
      },
      tokenBefore: safe,
      token(type, value, suppressAutoWhiteSpace) {
        prevCode = this.tokenBefore(prevCode, type, value);
        if (!suppressAutoWhiteSpace && prevCode & 1) {
          this.emit(" ", WhiteSpace, true);
        }
        this.emit(value, type, false);
        if (type === Delim && value.charCodeAt(0) === REVERSESOLIDUS) {
          this.emit("\n", WhiteSpace, true);
        }
      },
      emit(value) {
        buffer += value;
      },
      result() {
        return buffer;
      }
    };
    if (options) {
      if (typeof options.decorator === "function") {
        handlers = options.decorator(handlers);
      }
      if (options.sourceMap) {
        handlers = generateSourceMap(handlers);
      }
      if (options.mode in token_before_exports) {
        handlers.tokenBefore = token_before_exports[options.mode];
      }
    }
    const publicApi = {
      node: (node2) => handlers.node(node2),
      children: processChildren,
      token: (type, value) => handlers.token(type, value),
      tokenize: (raw) => tokenize(raw, (type, start, end) => {
        handlers.token(
          type,
          raw.slice(start, end),
          start !== 0
          // suppress auto whitespace for internal value tokens
        );
      })
    };
    handlers.node(node);
    return handlers.result();
  };
}

// node_modules/css-tree/lib/syntax/node/index-generate.js
var index_generate_exports = {};
__export(index_generate_exports, {
  AnPlusB: () => generate,
  Atrule: () => generate2,
  AtrulePrelude: () => generate3,
  AttributeSelector: () => generate4,
  Block: () => generate5,
  Brackets: () => generate6,
  CDC: () => generate7,
  CDO: () => generate8,
  ClassSelector: () => generate9,
  Combinator: () => generate10,
  Comment: () => generate11,
  Condition: () => generate12,
  Declaration: () => generate13,
  DeclarationList: () => generate14,
  Dimension: () => generate15,
  Feature: () => generate16,
  FeatureFunction: () => generate17,
  FeatureRange: () => generate18,
  Function: () => generate19,
  GeneralEnclosed: () => generate20,
  Hash: () => generate21,
  IdSelector: () => generate23,
  Identifier: () => generate22,
  Layer: () => generate24,
  LayerList: () => generate25,
  MediaQuery: () => generate26,
  MediaQueryList: () => generate27,
  NestingSelector: () => generate28,
  Nth: () => generate29,
  Number: () => generate30,
  Operator: () => generate31,
  Parentheses: () => generate32,
  Percentage: () => generate33,
  PseudoClassSelector: () => generate34,
  PseudoElementSelector: () => generate35,
  Ratio: () => generate36,
  Raw: () => generate37,
  Rule: () => generate38,
  Scope: () => generate39,
  Selector: () => generate40,
  SelectorList: () => generate41,
  String: () => generate42,
  StyleSheet: () => generate43,
  SupportsDeclaration: () => generate44,
  TypeSelector: () => generate45,
  UnicodeRange: () => generate46,
  Url: () => generate47,
  Value: () => generate48,
  WhiteSpace: () => generate49
});

// node_modules/css-tree/lib/syntax/config/generator.js
var generator_default = {
  node: index_generate_exports
};

// node_modules/css-tree/lib/generator/index.js
var generator_default2 = createGenerator(generator_default);

// packages/core/src/motion-svg.ts
var parseCss = parser_default;
var walkCss = walker_default;
var generateCss = generator_default2;
var SVG_NS = "http://www.w3.org/2000/svg";
var SMIL = /* @__PURE__ */ new Set(["animate", "animateMotion", "animateTransform", "animateColor", "set", "discard"]);
var GEOMETRY = /* @__PURE__ */ new Set(["path", "circle", "ellipse", "rect", "line", "polyline", "polygon"]);
var isElement = (node) => "tagName" in node;
var attr = (el, name) => el.attrs.find((a) => a.name === name && !a.prefix)?.value;
var isHref = (a) => a.name === "href";
function setAttr(el, name, value) {
  const hit = el.attrs.find((a) => a.name === name && !a.prefix);
  if (hit) hit.value = value;
  else el.attrs.push({ name, value });
}
function dropAttr(el, name) {
  el.attrs = el.attrs.filter((a) => !(a.name === name && !a.prefix));
}
function count(stripped, what) {
  stripped.set(what, (stripped.get(what) ?? 0) + 1);
}
function inWords(stripped) {
  return [...stripped].map(([what, n]) => n === 1 ? what : `${what} \xD7${n}`);
}
var local = (ref) => /^\s*(#|data:)/i.test(ref);
function cleanCss(text, context, rename, stripped) {
  let ast;
  try {
    ast = parseCss(text, { context });
  } catch {
    count(stripped, "CSS that would not parse");
    return "";
  }
  walkCss(ast, {
    enter(node, item, list) {
      if (node.type === "Atrule" && node.name.toLowerCase() === "import") {
        count(stripped, "CSS @import");
        list?.remove(item);
        return;
      }
      if (node.type === "Declaration") {
        let remote = false;
        walkCss(node, (inner) => {
          if (inner.type === "Url" && !local(inner.value)) remote = true;
        });
        if (remote || /javascript:/i.test(generateCss(node))) {
          count(stripped, "remote url() in CSS");
          list?.remove(item);
        }
        return;
      }
      if (node.type === "IdSelector") node.name = rename(node.name);
      if (node.type === "Url" && node.value.startsWith("#")) node.value = `#${rename(node.value.slice(1))}`;
    }
  });
  return generateCss(ast);
}
function sanitize(el, stripped) {
  const kept = [];
  for (const child of el.childNodes) {
    if (!isElement(child)) {
      if (child.nodeName === "#comment") continue;
      kept.push(child);
      continue;
    }
    if (child.namespaceURI !== SVG_NS) {
      count(stripped, `<${child.tagName}> (not SVG)`);
      continue;
    }
    if (child.tagName === "script") {
      count(stripped, "<script>");
      continue;
    }
    if (child.tagName === "foreignObject") {
      count(stripped, "<foreignObject>");
      continue;
    }
    if (SMIL.has(child.tagName)) {
      count(stripped, `<${child.tagName}> (SMIL animation)`);
      continue;
    }
    cleanAttrs(child, stripped);
    sanitize(child, stripped);
    kept.push(child);
  }
  el.childNodes = kept;
  for (const child of kept) child.parentNode = el;
}
function cleanAttrs(el, stripped) {
  el.attrs = el.attrs.filter((a) => {
    if (/^on/i.test(a.name)) {
      count(stripped, `${a.name} attribute`);
      return false;
    }
    if (isHref(a) && !local(a.value)) {
      count(stripped, "external href");
      return false;
    }
    if (/javascript:/i.test(a.value)) {
      count(stripped, "javascript: URL");
      return false;
    }
    const urls = [...a.value.matchAll(/url\(\s*['"]?([^'")]*)/gi)].map((m) => m[1] ?? "");
    if (a.name !== "style" && urls.some((u) => !local(u))) {
      count(stripped, "remote url()");
      return false;
    }
    return true;
  });
}
function collectIds(el, ids) {
  const id = attr(el, "id");
  if (id) ids.add(id);
  for (const child of el.childNodes) if (isElement(child)) collectIds(child, ids);
}
function renameRefs(el, rename, stripped) {
  for (const a of el.attrs) {
    if (a.name === "id" && !a.prefix) a.value = rename(a.value);
    else if (isHref(a) && a.value.startsWith("#")) a.value = `#${rename(a.value.slice(1))}`;
    else if (a.name === "style" && !a.prefix) a.value = cleanCss(a.value, "declarationList", rename, stripped);
    else if (a.value.includes("url(")) a.value = a.value.replace(/url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g, (_m, _q, id) => `url(#${rename(id)})`);
    else if (/^aria-(labelledby|describedby)$/.test(a.name)) a.value = a.value.split(/\s+/).map(rename).join(" ");
  }
  if (el.tagName === "style") {
    const text = el.childNodes.map((c) => "value" in c ? c.value : "").join("");
    const css = cleanCss(text, "stylesheet", rename, stripped);
    el.childNodes = [];
    if (css) defaultTreeAdapter.insertText(el, css);
  }
  for (const child of el.childNodes) if (isElement(child)) renameRefs(child, rename, stripped);
}
var IDENTITY = [1, 0, 0, 1, 0, 0];
var mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5]
];
var numbers = (text) => (text.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? []).map(Number);
function transformMatrix(text) {
  let m = IDENTITY;
  for (const [, fn, args] of (text ?? "").matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g)) {
    const n = numbers(args ?? "");
    const rad = (n[0] ?? 0) * Math.PI / 180;
    let step = IDENTITY;
    if (fn === "matrix" && n.length >= 6) step = n.slice(0, 6);
    else if (fn === "translate") step = [1, 0, 0, 1, n[0] ?? 0, n[1] ?? 0];
    else if (fn === "scale") step = [n[0] ?? 1, 0, 0, n[1] ?? n[0] ?? 1, 0, 0];
    else if (fn === "rotate") {
      const r = [Math.cos(rad), Math.sin(rad), -Math.sin(rad), Math.cos(rad), 0, 0];
      const cx = n[1] ?? 0, cy = n[2] ?? 0;
      step = mul(mul([1, 0, 0, 1, cx, cy], r), [1, 0, 0, 1, -cx, -cy]);
    } else if (fn === "skewX") step = [1, 0, Math.tan(rad), 1, 0, 0];
    else if (fn === "skewY") step = [1, Math.tan(rad), 0, 1, 0, 0];
    m = mul(m, step);
  }
  return m;
}
function pathPoints(d) {
  const out = [];
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  let i = 0, cmd = "M", x = 0, y = 0, sx = 0, sy = 0;
  const num = () => Number(tokens[i++] ?? 0);
  while (i < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const pt = () => {
      const px = num(), py = num();
      return rel ? [x + px, y + py] : [px, py];
    };
    if (C === "Z") {
      x = sx;
      y = sy;
      continue;
    }
    if (i >= tokens.length || /^[A-Za-z]$/.test(tokens[i])) continue;
    if (C === "M" || C === "L" || C === "T") {
      [x, y] = pt();
      out.push([x, y]);
      if (C === "M") {
        sx = x;
        sy = y;
        cmd = rel ? "l" : "L";
      }
    } else if (C === "H") {
      x = rel ? x + num() : num();
      out.push([x, y]);
    } else if (C === "V") {
      y = rel ? y + num() : num();
      out.push([x, y]);
    } else if (C === "C" || C === "S" || C === "Q") {
      const pts = C === "C" ? [pt(), pt(), pt()] : [pt(), pt()];
      out.push(...pts);
      [x, y] = pts[pts.length - 1];
    } else if (C === "A") {
      const rx = Math.abs(num()), ry = Math.abs(num());
      num();
      num();
      num();
      const [ex, ey] = pt();
      const r = Math.max(rx, ry);
      out.push([x - r, y - r], [x + r, y + r], [ex - r, ey - r], [ex + r, ey + r]);
      x = ex;
      y = ey;
    } else i++;
  }
  return out;
}
function shapePoints(el) {
  const n = (name) => Number(attr(el, name) ?? 0) || 0;
  switch (el.tagName) {
    case "path":
      return pathPoints(attr(el, "d") ?? "");
    case "circle":
      return [[n("cx") - n("r"), n("cy") - n("r")], [n("cx") + n("r"), n("cy") + n("r")]];
    case "ellipse":
      return [[n("cx") - n("rx"), n("cy") - n("ry")], [n("cx") + n("rx"), n("cy") + n("ry")]];
    case "rect":
    case "image":
    case "use":
      return [[n("x"), n("y")], [n("x") + n("width"), n("y") + n("height")]];
    case "line":
      return [[n("x1"), n("y1")], [n("x2"), n("y2")]];
    case "polyline":
    case "polygon": {
      const v = numbers(attr(el, "points") ?? "");
      const out = [];
      for (let k = 0; k + 1 < v.length; k += 2) out.push([v[k], v[k + 1]]);
      return out;
    }
    case "text":
      return [[n("x"), n("y")]];
    default:
      return [];
  }
}
function boxOf(el) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const visit = (node, m) => {
    for (const child of node.childNodes) {
      if (!isElement(child) || child.tagName === "defs" || child.tagName === "clipPath" || child.tagName === "mask") continue;
      const cm = mul(m, transformMatrix(attr(child, "transform")));
      for (const [px, py] of shapePoints(child)) {
        const wx = cm[0] * px + cm[2] * py + cm[4];
        const wy = cm[1] * px + cm[3] * py + cm[5];
        x0 = Math.min(x0, wx);
        y0 = Math.min(y0, wy);
        x1 = Math.max(x1, wx);
        y1 = Math.max(y1, wy);
      }
      visit(child, cm);
    }
  };
  visit(el, IDENTITY);
  if (!Number.isFinite(x0)) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}
function paintOf(el, inherited) {
  const style = attr(el, "style") ?? "";
  const fromStyle = (name) => new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, "i").exec(style)?.[1]?.trim();
  return {
    fill: fromStyle("fill") ?? attr(el, "fill") ?? inherited.fill,
    stroke: fromStyle("stroke") ?? attr(el, "stroke") ?? inherited.stroke
  };
}
function shapes(el, inherited, out = []) {
  for (const child of el.childNodes) {
    if (!isElement(child) || child.tagName === "defs" || child.tagName === "clipPath" || child.tagName === "mask") continue;
    const paint = paintOf(child, inherited);
    if (GEOMETRY.has(child.tagName)) out.push({ el: child, paint });
    shapes(child, paint, out);
  }
  return out;
}
var none = (paint) => /^(none|transparent)$/i.test(paint);
var ROOT_PAINT = { fill: "black", stroke: "none" };
function viewBoxOf(root, box) {
  const v = numbers(attr(root, "viewBox") ?? "");
  if (v.length === 4 && v[2] > 0 && v[3] > 0) return { x: v[0], y: v[1], width: v[2], height: v[3] };
  const w = Number.parseFloat(attr(root, "width") ?? ""), h = Number.parseFloat(attr(root, "height") ?? "");
  if (w > 0 && h > 0) return { x: 0, y: 0, width: w, height: h };
  return { x: 0, y: 0, width: box.width, height: box.height };
}
function wrapChildren(el, target) {
  const g = defaultTreeAdapter.createElement("g", html_exports.NS.SVG, [{ name: "data-motion", value: target }]);
  g.childNodes = el.childNodes;
  for (const child of g.childNodes) child.parentNode = g;
  el.childNodes = [g];
  g.parentNode = el;
}
function prepareMotionLayer(source, id, offset) {
  const stripped = /* @__PURE__ */ new Map();
  const fragment = parseFragment(source.svg);
  const tops = fragment.childNodes.filter(isElement);
  const root = tops.find((el) => el.tagName === "svg" && el.namespaceURI === SVG_NS);
  if (!root) throw new Error(`${source.title} has no <svg> to animate`);
  for (const el of tops) if (el !== root) count(stripped, `<${el.tagName}> outside the <svg> root`);
  cleanAttrs(root, stripped);
  sanitize(root, stripped);
  const ids = /* @__PURE__ */ new Set();
  collectIds(root, ids);
  const rename = (name) => ids.has(name) ? `m-${id}-${name}` : name;
  const parts = {};
  const partEls = [];
  const findParts = (el) => {
    for (const child of el.childNodes) {
      if (!isElement(child)) continue;
      const pid = child.tagName === "g" ? attr(child, "id") : void 0;
      if (pid && /^[A-Za-z][\w-]*$/.test(pid) && !(pid in parts)) {
        const box2 = boxOf(child);
        if (box2) {
          parts[pid] = box2;
          partEls.push({ el: child, name: pid });
        }
      }
      findParts(child);
    }
  };
  findParts(root);
  renameRefs(root, rename, stripped);
  const viewBox = viewBoxOf(root, source.box);
  const all = shapes(root, paintOf(root, ROOT_PAINT));
  const ink = all.length > 0 && all.every((s) => none(s.paint.fill) && !none(s.paint.stroke)) ? "outline" : "filled";
  for (const { el, name } of partEls) wrapChildren(el, `${id}/${name}`);
  wrapChildren(root, id);
  for (const name of ["x", "y", "width", "height", "viewBox", "xmlns", "xmlns:xlink", "overflow"]) dropAttr(root, name);
  root.attrs = root.attrs.filter((a) => !(a.prefix === "xmlns" || a.name === "xmlns"));
  const box = { x: source.box.x - offset.x, y: source.box.y - offset.y, width: source.box.width, height: source.box.height };
  setAttr(root, "data-motion-layer", id);
  setAttr(root, "x", String(box.x));
  setAttr(root, "y", String(box.y));
  setAttr(root, "width", String(box.width));
  setAttr(root, "height", String(box.height));
  setAttr(root, "viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
  setAttr(root, "overflow", "visible");
  const scopeStyles = (el) => {
    for (const child of el.childNodes) {
      if (!isElement(child)) continue;
      if (child.tagName === "style") {
        const css = child.childNodes.map((c) => "value" in c ? c.value : "").join("");
        child.childNodes = [];
        if (css) defaultTreeAdapter.insertText(child, `@scope ([data-motion-layer="${id}"]) { ${css} }`);
      } else scopeStyles(child);
    }
  };
  scopeStyles(root);
  return {
    layer: { id, item: source.item, version: source.version, title: source.title, box, viewBox, parts, ink },
    root,
    stripped: inWords(stripped)
  };
}
function motionLayerMarkup(prepared, drawn) {
  const mark = (el, target, paint) => {
    for (const child of el.childNodes) {
      if (!isElement(child)) continue;
      const here = attr(child, "data-motion");
      const t = here !== void 0 && drawn.has(here) ? here : target;
      const p = paintOf(child, paint);
      if (t && GEOMETRY.has(child.tagName) && !none(p.stroke)) {
        setAttr(child, "pathLength", "1");
        setAttr(child, "stroke-dasharray", "1 1");
        setAttr(child, "stroke-dashoffset", "0");
        setAttr(child, "data-motion-draw", t);
      }
      mark(child, t, p);
    }
  };
  mark(prepared.root, null, paintOf(prepared.root, ROOT_PAINT));
  return serializeOuter(prepared.root);
}
export {
  motionLayerMarkup,
  prepareMotionLayer
};
