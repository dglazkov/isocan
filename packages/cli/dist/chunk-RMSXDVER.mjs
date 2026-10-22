import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  __export
} from "./chunk-JYOOXWJZ.mjs";

// node_modules/css-tree/lib/utils/List.js
var releasedCursors = null;
var List = class _List {
  static createItem(data) {
    return {
      prev: null,
      next: null,
      data
    };
  }
  constructor() {
    this.head = null;
    this.tail = null;
    this.cursor = null;
  }
  createItem(data) {
    return _List.createItem(data);
  }
  // cursor helpers
  allocateCursor(prev, next) {
    let cursor;
    if (releasedCursors !== null) {
      cursor = releasedCursors;
      releasedCursors = releasedCursors.cursor;
      cursor.prev = prev;
      cursor.next = next;
      cursor.cursor = this.cursor;
    } else {
      cursor = {
        prev,
        next,
        cursor: this.cursor
      };
    }
    this.cursor = cursor;
    return cursor;
  }
  releaseCursor() {
    const { cursor } = this;
    this.cursor = cursor.cursor;
    cursor.prev = null;
    cursor.next = null;
    cursor.cursor = releasedCursors;
    releasedCursors = cursor;
  }
  updateCursors(prevOld, prevNew, nextOld, nextNew) {
    let { cursor } = this;
    while (cursor !== null) {
      if (cursor.prev === prevOld) {
        cursor.prev = prevNew;
      }
      if (cursor.next === nextOld) {
        cursor.next = nextNew;
      }
      cursor = cursor.cursor;
    }
  }
  *[Symbol.iterator]() {
    for (let cursor = this.head; cursor !== null; cursor = cursor.next) {
      yield cursor.data;
    }
  }
  // getters
  get size() {
    let size = 0;
    for (let cursor = this.head; cursor !== null; cursor = cursor.next) {
      size++;
    }
    return size;
  }
  get isEmpty() {
    return this.head === null;
  }
  get first() {
    return this.head && this.head.data;
  }
  get last() {
    return this.tail && this.tail.data;
  }
  // convertors
  fromArray(array) {
    let cursor = null;
    this.head = null;
    for (let data of array) {
      const item = _List.createItem(data);
      if (cursor !== null) {
        cursor.next = item;
      } else {
        this.head = item;
      }
      item.prev = cursor;
      cursor = item;
    }
    this.tail = cursor;
    return this;
  }
  toArray() {
    return [...this];
  }
  toJSON() {
    return [...this];
  }
  // array-like methods
  forEach(fn, thisArg = this) {
    const cursor = this.allocateCursor(null, this.head);
    while (cursor.next !== null) {
      const item = cursor.next;
      cursor.next = item.next;
      fn.call(thisArg, item.data, item, this);
    }
    this.releaseCursor();
  }
  forEachRight(fn, thisArg = this) {
    const cursor = this.allocateCursor(this.tail, null);
    while (cursor.prev !== null) {
      const item = cursor.prev;
      cursor.prev = item.prev;
      fn.call(thisArg, item.data, item, this);
    }
    this.releaseCursor();
  }
  reduce(fn, initialValue, thisArg = this) {
    let cursor = this.allocateCursor(null, this.head);
    let acc = initialValue;
    let item;
    while (cursor.next !== null) {
      item = cursor.next;
      cursor.next = item.next;
      acc = fn.call(thisArg, acc, item.data, item, this);
    }
    this.releaseCursor();
    return acc;
  }
  reduceRight(fn, initialValue, thisArg = this) {
    let cursor = this.allocateCursor(this.tail, null);
    let acc = initialValue;
    let item;
    while (cursor.prev !== null) {
      item = cursor.prev;
      cursor.prev = item.prev;
      acc = fn.call(thisArg, acc, item.data, item, this);
    }
    this.releaseCursor();
    return acc;
  }
  some(fn, thisArg = this) {
    for (let cursor = this.head; cursor !== null; cursor = cursor.next) {
      if (fn.call(thisArg, cursor.data, cursor, this)) {
        return true;
      }
    }
    return false;
  }
  map(fn, thisArg = this) {
    const result = new _List();
    for (let cursor = this.head; cursor !== null; cursor = cursor.next) {
      result.appendData(fn.call(thisArg, cursor.data, cursor, this));
    }
    return result;
  }
  filter(fn, thisArg = this) {
    const result = new _List();
    for (let cursor = this.head; cursor !== null; cursor = cursor.next) {
      if (fn.call(thisArg, cursor.data, cursor, this)) {
        result.appendData(cursor.data);
      }
    }
    return result;
  }
  nextUntil(start, fn, thisArg = this) {
    if (start === null) {
      return;
    }
    const cursor = this.allocateCursor(null, start);
    while (cursor.next !== null) {
      const item = cursor.next;
      cursor.next = item.next;
      if (fn.call(thisArg, item.data, item, this)) {
        break;
      }
    }
    this.releaseCursor();
  }
  prevUntil(start, fn, thisArg = this) {
    if (start === null) {
      return;
    }
    const cursor = this.allocateCursor(start, null);
    while (cursor.prev !== null) {
      const item = cursor.prev;
      cursor.prev = item.prev;
      if (fn.call(thisArg, item.data, item, this)) {
        break;
      }
    }
    this.releaseCursor();
  }
  // mutation
  clear() {
    this.head = null;
    this.tail = null;
  }
  copy() {
    const result = new _List();
    for (let data of this) {
      result.appendData(data);
    }
    return result;
  }
  prepend(item) {
    this.updateCursors(null, item, this.head, item);
    if (this.head !== null) {
      this.head.prev = item;
      item.next = this.head;
    } else {
      this.tail = item;
    }
    this.head = item;
    return this;
  }
  prependData(data) {
    return this.prepend(_List.createItem(data));
  }
  append(item) {
    return this.insert(item);
  }
  appendData(data) {
    return this.insert(_List.createItem(data));
  }
  insert(item, before = null) {
    if (before !== null) {
      this.updateCursors(before.prev, item, before, item);
      if (before.prev === null) {
        if (this.head !== before) {
          throw new Error("before doesn't belong to list");
        }
        this.head = item;
        before.prev = item;
        item.next = before;
        this.updateCursors(null, item);
      } else {
        before.prev.next = item;
        item.prev = before.prev;
        before.prev = item;
        item.next = before;
      }
    } else {
      this.updateCursors(this.tail, item, null, item);
      if (this.tail !== null) {
        this.tail.next = item;
        item.prev = this.tail;
      } else {
        this.head = item;
      }
      this.tail = item;
    }
    return this;
  }
  insertData(data, before) {
    return this.insert(_List.createItem(data), before);
  }
  remove(item) {
    this.updateCursors(item, item.prev, item, item.next);
    if (item.prev !== null) {
      item.prev.next = item.next;
    } else {
      if (this.head !== item) {
        throw new Error("item doesn't belong to list");
      }
      this.head = item.next;
    }
    if (item.next !== null) {
      item.next.prev = item.prev;
    } else {
      if (this.tail !== item) {
        throw new Error("item doesn't belong to list");
      }
      this.tail = item.prev;
    }
    item.prev = null;
    item.next = null;
    return item;
  }
  push(data) {
    this.insert(_List.createItem(data));
  }
  pop() {
    return this.tail !== null ? this.remove(this.tail) : null;
  }
  unshift(data) {
    this.prepend(_List.createItem(data));
  }
  shift() {
    return this.head !== null ? this.remove(this.head) : null;
  }
  prependList(list) {
    return this.insertList(list, this.head);
  }
  appendList(list) {
    return this.insertList(list);
  }
  insertList(list, before) {
    if (list.head === null) {
      return this;
    }
    if (before !== void 0 && before !== null) {
      this.updateCursors(before.prev, list.tail, before, list.head);
      if (before.prev !== null) {
        before.prev.next = list.head;
        list.head.prev = before.prev;
      } else {
        this.head = list.head;
      }
      before.prev = list.tail;
      list.tail.next = before;
    } else {
      this.updateCursors(this.tail, list.tail, null, list.head);
      if (this.tail !== null) {
        this.tail.next = list.head;
        list.head.prev = this.tail;
      } else {
        this.head = list.head;
      }
      this.tail = list.tail;
    }
    list.head = null;
    list.tail = null;
    return this;
  }
  replace(oldItem, newItemOrList) {
    if ("head" in newItemOrList) {
      this.insertList(newItemOrList, oldItem);
    } else {
      this.insert(newItemOrList, oldItem);
    }
    this.remove(oldItem);
  }
};

// node_modules/css-tree/lib/utils/create-custom-error.js
function createCustomError(name50, message) {
  const error = Object.create(SyntaxError.prototype);
  const errorStack = new Error();
  return Object.assign(error, {
    name: name50,
    message,
    get stack() {
      return (errorStack.stack || "").replace(/^(.+\n){1,3}/, `${name50}: ${message}
`);
    }
  });
}

// node_modules/css-tree/lib/parser/SyntaxError.js
var MAX_LINE_LENGTH = 100;
var OFFSET_CORRECTION = 60;
var TAB_REPLACEMENT = "    ";
function sourceFragment({ source, line, column, baseLine, baseColumn }, extraLines) {
  function processLines(start, end) {
    return lines.slice(start, end).map(
      (line2, idx) => String(start + idx + 1).padStart(maxNumLength) + " |" + line2
    ).join("\n");
  }
  const prelines = "\n".repeat(Math.max(baseLine - 1, 0));
  const precolumns = " ".repeat(Math.max(baseColumn - 1, 0));
  const lines = (prelines + precolumns + source).split(/\r\n?|\n|\f/);
  const startLine = Math.max(1, line - extraLines) - 1;
  const endLine = Math.min(line + extraLines, lines.length + 1);
  const maxNumLength = Math.max(4, String(endLine).length) + 1;
  let cutLeft = 0;
  column += (TAB_REPLACEMENT.length - 1) * (lines[line - 1].substr(0, column - 1).match(/\t/g) || []).length;
  if (column > MAX_LINE_LENGTH) {
    cutLeft = column - OFFSET_CORRECTION + 3;
    column = OFFSET_CORRECTION - 2;
  }
  for (let i = startLine; i <= endLine; i++) {
    if (i >= 0 && i < lines.length) {
      lines[i] = lines[i].replace(/\t/g, TAB_REPLACEMENT);
      lines[i] = (cutLeft > 0 && lines[i].length > cutLeft ? "\u2026" : "") + lines[i].substr(cutLeft, MAX_LINE_LENGTH - 2) + (lines[i].length > cutLeft + MAX_LINE_LENGTH - 1 ? "\u2026" : "");
    }
  }
  return [
    processLines(startLine, line),
    new Array(column + maxNumLength + 2).join("-") + "^",
    processLines(line, endLine)
  ].filter(Boolean).join("\n").replace(/^(\s+\d+\s+\|\n)+/, "").replace(/\n(\s+\d+\s+\|)+$/, "");
}
function SyntaxError2(message, source, offset, line, column, baseLine = 1, baseColumn = 1) {
  const error = Object.assign(createCustomError("SyntaxError", message), {
    source,
    offset,
    line,
    column,
    sourceFragment(extraLines) {
      return sourceFragment({ source, line, column, baseLine, baseColumn }, isNaN(extraLines) ? 0 : extraLines);
    },
    get formattedMessage() {
      return `Parse error: ${message}
` + sourceFragment({ source, line, column, baseLine, baseColumn }, 2);
    }
  });
  return error;
}

// node_modules/css-tree/lib/tokenizer/types.js
var EOF = 0;
var Ident = 1;
var Function = 2;
var AtKeyword = 3;
var Hash = 4;
var String2 = 5;
var BadString = 6;
var Url = 7;
var BadUrl = 8;
var Delim = 9;
var Number = 10;
var Percentage = 11;
var Dimension = 12;
var WhiteSpace = 13;
var CDO = 14;
var CDC = 15;
var Colon = 16;
var Semicolon = 17;
var Comma = 18;
var LeftSquareBracket = 19;
var RightSquareBracket = 20;
var LeftParenthesis = 21;
var RightParenthesis = 22;
var LeftCurlyBracket = 23;
var RightCurlyBracket = 24;
var Comment = 25;

// node_modules/css-tree/lib/tokenizer/char-code-definitions.js
var EOF2 = 0;
function isDigit(code) {
  return code >= 48 && code <= 57;
}
function isHexDigit(code) {
  return isDigit(code) || // 0 .. 9
  code >= 65 && code <= 70 || // A .. F
  code >= 97 && code <= 102;
}
function isUppercaseLetter(code) {
  return code >= 65 && code <= 90;
}
function isLowercaseLetter(code) {
  return code >= 97 && code <= 122;
}
function isLetter(code) {
  return isUppercaseLetter(code) || isLowercaseLetter(code);
}
function isNonAscii(code) {
  return code >= 128;
}
function isNameStart(code) {
  return isLetter(code) || isNonAscii(code) || code === 95;
}
function isName(code) {
  return isNameStart(code) || isDigit(code) || code === 45;
}
function isNonPrintable(code) {
  return code >= 0 && code <= 8 || code === 11 || code >= 14 && code <= 31 || code === 127;
}
function isNewline(code) {
  return code === 10 || code === 13 || code === 12;
}
function isWhiteSpace(code) {
  return isNewline(code) || code === 32 || code === 9;
}
function isValidEscape(first, second) {
  if (first !== 92) {
    return false;
  }
  if (isNewline(second) || second === EOF2) {
    return false;
  }
  return true;
}
function isIdentifierStart(first, second, third) {
  if (first === 45) {
    return isNameStart(second) || second === 45 || isValidEscape(second, third);
  }
  if (isNameStart(first)) {
    return true;
  }
  if (first === 92) {
    return isValidEscape(first, second);
  }
  return false;
}
function isNumberStart(first, second, third) {
  if (first === 43 || first === 45) {
    if (isDigit(second)) {
      return 2;
    }
    return second === 46 && isDigit(third) ? 3 : 0;
  }
  if (first === 46) {
    return isDigit(second) ? 2 : 0;
  }
  if (isDigit(first)) {
    return 1;
  }
  return 0;
}
function isBOM(code) {
  if (code === 65279) {
    return 1;
  }
  if (code === 65534) {
    return 1;
  }
  return 0;
}
var CATEGORY = new Array(128);
var EofCategory = 128;
var WhiteSpaceCategory = 130;
var DigitCategory = 131;
var NameStartCategory = 132;
var NonPrintableCategory = 133;
for (let i = 0; i < CATEGORY.length; i++) {
  CATEGORY[i] = isWhiteSpace(i) && WhiteSpaceCategory || isDigit(i) && DigitCategory || isNameStart(i) && NameStartCategory || isNonPrintable(i) && NonPrintableCategory || i || EofCategory;
}
function charCodeCategory(code) {
  return code < 128 ? CATEGORY[code] : NameStartCategory;
}

// node_modules/css-tree/lib/tokenizer/utils.js
function getCharCode(source, offset) {
  return offset < source.length ? source.charCodeAt(offset) : 0;
}
function getNewlineLength(source, offset, code) {
  if (code === 13 && getCharCode(source, offset + 1) === 10) {
    return 2;
  }
  return 1;
}
function cmpChar(testStr, offset, referenceCode) {
  let code = testStr.charCodeAt(offset);
  if (isUppercaseLetter(code)) {
    code = code | 32;
  }
  return code === referenceCode;
}
function cmpStr(testStr, start, end, referenceStr) {
  if (end - start !== referenceStr.length) {
    return false;
  }
  if (start < 0 || end > testStr.length) {
    return false;
  }
  for (let i = start; i < end; i++) {
    const referenceCode = referenceStr.charCodeAt(i - start);
    let testCode = testStr.charCodeAt(i);
    if (isUppercaseLetter(testCode)) {
      testCode = testCode | 32;
    }
    if (testCode !== referenceCode) {
      return false;
    }
  }
  return true;
}
function findWhiteSpaceStart(source, offset) {
  for (; offset >= 0; offset--) {
    if (!isWhiteSpace(source.charCodeAt(offset))) {
      break;
    }
  }
  return offset + 1;
}
function findWhiteSpaceEnd(source, offset) {
  for (; offset < source.length; offset++) {
    if (!isWhiteSpace(source.charCodeAt(offset))) {
      break;
    }
  }
  return offset;
}
function findDecimalNumberEnd(source, offset) {
  for (; offset < source.length; offset++) {
    if (!isDigit(source.charCodeAt(offset))) {
      break;
    }
  }
  return offset;
}
function consumeEscaped(source, offset) {
  offset += 2;
  if (isHexDigit(getCharCode(source, offset - 1))) {
    for (const maxOffset = Math.min(source.length, offset + 5); offset < maxOffset; offset++) {
      if (!isHexDigit(getCharCode(source, offset))) {
        break;
      }
    }
    const code = getCharCode(source, offset);
    if (isWhiteSpace(code)) {
      offset += getNewlineLength(source, offset, code);
    }
  }
  return offset;
}
function consumeName(source, offset) {
  for (; offset < source.length; offset++) {
    const code = source.charCodeAt(offset);
    if (isName(code)) {
      continue;
    }
    if (isValidEscape(code, getCharCode(source, offset + 1))) {
      offset = consumeEscaped(source, offset) - 1;
      continue;
    }
    break;
  }
  return offset;
}
function consumeNumber(source, offset) {
  let code = source.charCodeAt(offset);
  if (code === 43 || code === 45) {
    code = source.charCodeAt(offset += 1);
  }
  if (isDigit(code)) {
    offset = findDecimalNumberEnd(source, offset + 1);
    code = source.charCodeAt(offset);
  }
  if (code === 46 && isDigit(source.charCodeAt(offset + 1))) {
    offset += 2;
    offset = findDecimalNumberEnd(source, offset);
  }
  if (cmpChar(
    source,
    offset,
    101
    /* e */
  )) {
    let sign = 0;
    code = source.charCodeAt(offset + 1);
    if (code === 45 || code === 43) {
      sign = 1;
      code = source.charCodeAt(offset + 2);
    }
    if (isDigit(code)) {
      offset = findDecimalNumberEnd(source, offset + 1 + sign + 1);
    }
  }
  return offset;
}
function consumeBadUrlRemnants(source, offset) {
  for (; offset < source.length; offset++) {
    const code = source.charCodeAt(offset);
    if (code === 41) {
      offset++;
      break;
    }
    if (isValidEscape(code, getCharCode(source, offset + 1))) {
      offset = consumeEscaped(source, offset);
    }
  }
  return offset;
}
function decodeEscaped(escaped) {
  if (escaped.length === 1 && !isHexDigit(escaped.charCodeAt(0))) {
    return escaped[0];
  }
  let code = parseInt(escaped, 16);
  if (code === 0 || // If this number is zero,
  code >= 55296 && code <= 57343 || // or is for a surrogate,
  code > 1114111) {
    code = 65533;
  }
  return String.fromCodePoint(code);
}

// node_modules/css-tree/lib/tokenizer/names.js
var names_default = [
  "EOF-token",
  "ident-token",
  "function-token",
  "at-keyword-token",
  "hash-token",
  "string-token",
  "bad-string-token",
  "url-token",
  "bad-url-token",
  "delim-token",
  "number-token",
  "percentage-token",
  "dimension-token",
  "whitespace-token",
  "CDO-token",
  "CDC-token",
  "colon-token",
  "semicolon-token",
  "comma-token",
  "[-token",
  "]-token",
  "(-token",
  ")-token",
  "{-token",
  "}-token",
  "comment-token"
];

// node_modules/css-tree/lib/tokenizer/adopt-buffer.js
var MIN_SIZE = 16 * 1024;
function adoptBuffer(buffer = null, size) {
  if (buffer === null || buffer.length < size) {
    return new Uint32Array(Math.max(size + 1024, MIN_SIZE));
  }
  return buffer;
}

// node_modules/css-tree/lib/tokenizer/OffsetToLocation.js
var N = 10;
var F = 12;
var R = 13;
function computeLinesAndColumns(host) {
  const source = host.source;
  const sourceLength = source.length;
  const startOffset = source.length > 0 ? isBOM(source.charCodeAt(0)) : 0;
  const lines = adoptBuffer(host.lines, sourceLength);
  const columns = adoptBuffer(host.columns, sourceLength);
  let line = host.startLine;
  let column = host.startColumn;
  for (let i = startOffset; i < sourceLength; i++) {
    const code = source.charCodeAt(i);
    lines[i] = line;
    columns[i] = column++;
    if (code === N || code === R || code === F) {
      if (code === R && i + 1 < sourceLength && source.charCodeAt(i + 1) === N) {
        i++;
        lines[i] = line;
        columns[i] = column;
      }
      line++;
      column = 1;
    }
  }
  lines[sourceLength] = line;
  columns[sourceLength] = column;
  host.lines = lines;
  host.columns = columns;
  host.computed = true;
}
var OffsetToLocation = class {
  constructor(source, startOffset, startLine, startColumn) {
    this.setSource(source, startOffset, startLine, startColumn);
    this.lines = null;
    this.columns = null;
  }
  setSource(source = "", startOffset = 0, startLine = 1, startColumn = 1) {
    this.source = source;
    this.startOffset = startOffset;
    this.startLine = startLine;
    this.startColumn = startColumn;
    this.computed = false;
  }
  getLocation(offset, filename) {
    if (!this.computed) {
      computeLinesAndColumns(this);
    }
    return {
      source: filename,
      offset: this.startOffset + offset,
      line: this.lines[offset],
      column: this.columns[offset]
    };
  }
  getLocationRange(start, end, filename) {
    if (!this.computed) {
      computeLinesAndColumns(this);
    }
    return {
      source: filename,
      start: {
        offset: this.startOffset + start,
        line: this.lines[start],
        column: this.columns[start]
      },
      end: {
        offset: this.startOffset + end,
        line: this.lines[end],
        column: this.columns[end]
      }
    };
  }
};

// node_modules/css-tree/lib/tokenizer/TokenStream.js
var OFFSET_MASK = 16777215;
var TYPE_SHIFT = 24;
var BLOCK_OPEN_TOKEN = 1;
var BLOCK_CLOSE_TOKEN = 2;
var balancePair = new Uint8Array(32);
balancePair[Function] = RightParenthesis;
balancePair[LeftParenthesis] = RightParenthesis;
balancePair[LeftSquareBracket] = RightSquareBracket;
balancePair[LeftCurlyBracket] = RightCurlyBracket;
var blockTokens = new Uint8Array(32);
blockTokens[Function] = BLOCK_OPEN_TOKEN;
blockTokens[LeftParenthesis] = BLOCK_OPEN_TOKEN;
blockTokens[LeftSquareBracket] = BLOCK_OPEN_TOKEN;
blockTokens[LeftCurlyBracket] = BLOCK_OPEN_TOKEN;
blockTokens[RightParenthesis] = BLOCK_CLOSE_TOKEN;
blockTokens[RightSquareBracket] = BLOCK_CLOSE_TOKEN;
blockTokens[RightCurlyBracket] = BLOCK_CLOSE_TOKEN;
function boundIndex(index, min, max) {
  return index < min ? min : index > max ? max : index;
}
var TokenStream = class {
  constructor(source, tokenize2) {
    this.setSource(source, tokenize2);
  }
  reset() {
    this.eof = false;
    this.tokenIndex = -1;
    this.tokenType = 0;
    this.tokenStart = this.firstCharOffset;
    this.tokenEnd = this.firstCharOffset;
  }
  setSource(source = "", tokenize2 = () => {
  }) {
    source = String(source || "");
    const sourceLength = source.length;
    const offsetAndType = adoptBuffer(this.offsetAndType, source.length + 1);
    const balance = adoptBuffer(this.balance, source.length + 1);
    let tokenCount = 0;
    let firstCharOffset = -1;
    let balanceCloseType = 0;
    let balanceStart = source.length;
    this.offsetAndType = null;
    this.balance = null;
    balance.fill(0);
    tokenize2(source, (type, start, end) => {
      const index = tokenCount++;
      offsetAndType[index] = type << TYPE_SHIFT | end;
      if (firstCharOffset === -1) {
        firstCharOffset = start;
      }
      balance[index] = balanceStart;
      if (type === balanceCloseType) {
        const prevBalanceStart = balance[balanceStart];
        balance[balanceStart] = index;
        balanceStart = prevBalanceStart;
        balanceCloseType = balancePair[offsetAndType[prevBalanceStart] >> TYPE_SHIFT];
      } else if (this.isBlockOpenerTokenType(type)) {
        balanceStart = index;
        balanceCloseType = balancePair[type];
      }
    });
    offsetAndType[tokenCount] = EOF << TYPE_SHIFT | sourceLength;
    balance[tokenCount] = tokenCount;
    for (let i = 0; i < tokenCount; i++) {
      const balanceStart2 = balance[i];
      if (balanceStart2 <= i) {
        const balanceEnd = balance[balanceStart2];
        if (balanceEnd !== i) {
          balance[i] = balanceEnd;
        }
      } else if (balanceStart2 > tokenCount) {
        balance[i] = tokenCount;
      }
    }
    this.source = source;
    this.firstCharOffset = firstCharOffset === -1 ? 0 : firstCharOffset;
    this.tokenCount = tokenCount;
    this.offsetAndType = offsetAndType;
    this.balance = balance;
    this.reset();
    this.next();
  }
  lookupType(offset) {
    offset += this.tokenIndex;
    if (offset < this.tokenCount) {
      return this.offsetAndType[offset] >> TYPE_SHIFT;
    }
    return EOF;
  }
  lookupTypeNonSC(idx) {
    for (let offset = this.tokenIndex; offset < this.tokenCount; offset++) {
      const tokenType = this.offsetAndType[offset] >> TYPE_SHIFT;
      if (tokenType !== WhiteSpace && tokenType !== Comment) {
        if (idx-- === 0) {
          return tokenType;
        }
      }
    }
    return EOF;
  }
  lookupOffset(offset) {
    offset += this.tokenIndex;
    if (offset < this.tokenCount) {
      return this.offsetAndType[offset - 1] & OFFSET_MASK;
    }
    return this.source.length;
  }
  lookupOffsetNonSC(idx) {
    for (let offset = this.tokenIndex; offset < this.tokenCount; offset++) {
      const tokenType = this.offsetAndType[offset] >> TYPE_SHIFT;
      if (tokenType !== WhiteSpace && tokenType !== Comment) {
        if (idx-- === 0) {
          return offset - this.tokenIndex;
        }
      }
    }
    return EOF;
  }
  lookupValue(offset, referenceStr) {
    offset += this.tokenIndex;
    if (offset < this.tokenCount) {
      return cmpStr(
        this.source,
        this.offsetAndType[offset - 1] & OFFSET_MASK,
        this.offsetAndType[offset] & OFFSET_MASK,
        referenceStr
      );
    }
    return false;
  }
  getTokenStart(tokenIndex) {
    if (tokenIndex === this.tokenIndex) {
      return this.tokenStart;
    }
    if (tokenIndex > 0) {
      return tokenIndex < this.tokenCount ? this.offsetAndType[tokenIndex - 1] & OFFSET_MASK : this.offsetAndType[this.tokenCount] & OFFSET_MASK;
    }
    return this.firstCharOffset;
  }
  getTokenEnd(tokenIndex) {
    if (tokenIndex === this.tokenIndex) {
      return this.tokenEnd;
    }
    return this.offsetAndType[boundIndex(tokenIndex, 0, this.tokenCount)] & OFFSET_MASK;
  }
  getTokenType(tokenIndex) {
    if (tokenIndex === this.tokenIndex) {
      return this.tokenType;
    }
    return this.offsetAndType[boundIndex(tokenIndex, 0, this.tokenCount)] >> TYPE_SHIFT;
  }
  substrToCursor(start) {
    return this.source.substring(start, this.tokenStart);
  }
  isBlockOpenerTokenType(tokenType) {
    return blockTokens[tokenType] === BLOCK_OPEN_TOKEN;
  }
  isBlockCloserTokenType(tokenType) {
    return blockTokens[tokenType] === BLOCK_CLOSE_TOKEN;
  }
  getBlockTokenPairIndex(tokenIndex) {
    const type = this.getTokenType(tokenIndex);
    if (blockTokens[type] === 1) {
      const pairIndex = this.balance[tokenIndex];
      const closeType = this.getTokenType(pairIndex);
      return balancePair[type] === closeType ? pairIndex : -1;
    } else if (blockTokens[type] === 2) {
      const pairIndex = this.balance[tokenIndex];
      const openType = this.getTokenType(pairIndex);
      return balancePair[openType] === type ? pairIndex : -1;
    }
    return -1;
  }
  isBalanceEdge(tokenIndex) {
    return this.balance[this.tokenIndex] < tokenIndex;
  }
  isDelim(code, offset) {
    if (offset) {
      return this.lookupType(offset) === Delim && this.source.charCodeAt(this.lookupOffset(offset)) === code;
    }
    return this.tokenType === Delim && this.source.charCodeAt(this.tokenStart) === code;
  }
  skip(tokenCount) {
    let next = this.tokenIndex + tokenCount;
    if (next < this.tokenCount) {
      this.tokenIndex = next;
      this.tokenStart = this.offsetAndType[next - 1] & OFFSET_MASK;
      next = this.offsetAndType[next];
      this.tokenType = next >> TYPE_SHIFT;
      this.tokenEnd = next & OFFSET_MASK;
    } else {
      this.tokenIndex = this.tokenCount;
      this.next();
    }
  }
  next() {
    let next = this.tokenIndex + 1;
    if (next < this.tokenCount) {
      this.tokenIndex = next;
      this.tokenStart = this.tokenEnd;
      next = this.offsetAndType[next];
      this.tokenType = next >> TYPE_SHIFT;
      this.tokenEnd = next & OFFSET_MASK;
    } else {
      this.eof = true;
      this.tokenIndex = this.tokenCount;
      this.tokenType = EOF;
      this.tokenStart = this.tokenEnd = this.source.length;
    }
  }
  skipSC() {
    while (this.tokenType === WhiteSpace || this.tokenType === Comment) {
      this.next();
    }
  }
  skipUntilBalanced(startToken, stopConsume) {
    let cursor = startToken;
    let balanceEnd = 0;
    let offset = 0;
    loop:
      for (; cursor < this.tokenCount; cursor++) {
        balanceEnd = this.balance[cursor];
        if (balanceEnd < startToken) {
          break loop;
        }
        offset = cursor > 0 ? this.offsetAndType[cursor - 1] & OFFSET_MASK : this.firstCharOffset;
        switch (stopConsume(this.source.charCodeAt(offset))) {
          case 1:
            break loop;
          case 2:
            cursor++;
            break loop;
          default:
            if (this.isBlockOpenerTokenType(this.offsetAndType[cursor] >> TYPE_SHIFT)) {
              cursor = balanceEnd;
            }
        }
      }
    this.skip(cursor - this.tokenIndex);
  }
  forEachToken(fn) {
    for (let i = 0, offset = this.firstCharOffset; i < this.tokenCount; i++) {
      const start = offset;
      const item = this.offsetAndType[i];
      const end = item & OFFSET_MASK;
      const type = item >> TYPE_SHIFT;
      offset = end;
      fn(type, start, end, i);
    }
  }
  dump() {
    const tokens = new Array(this.tokenCount);
    this.forEachToken((type, start, end, index) => {
      tokens[index] = {
        idx: index,
        type: names_default[type],
        chunk: this.source.substring(start, end),
        balance: this.balance[index]
      };
    });
    return tokens;
  }
};

// node_modules/css-tree/lib/tokenizer/index.js
function tokenize(source, onToken) {
  function getCharCode2(offset2) {
    return offset2 < sourceLength ? source.charCodeAt(offset2) : 0;
  }
  function consumeNumericToken() {
    offset = consumeNumber(source, offset);
    if (isIdentifierStart(getCharCode2(offset), getCharCode2(offset + 1), getCharCode2(offset + 2))) {
      type = Dimension;
      offset = consumeName(source, offset);
      return;
    }
    if (getCharCode2(offset) === 37) {
      type = Percentage;
      offset++;
      return;
    }
    type = Number;
  }
  function consumeIdentLikeToken() {
    const nameStartOffset = offset;
    offset = consumeName(source, offset);
    if (cmpStr(source, nameStartOffset, offset, "url") && getCharCode2(offset) === 40) {
      offset = findWhiteSpaceEnd(source, offset + 1);
      if (getCharCode2(offset) === 34 || getCharCode2(offset) === 39) {
        type = Function;
        offset = nameStartOffset + 4;
        return;
      }
      consumeUrlToken();
      return;
    }
    if (getCharCode2(offset) === 40) {
      type = Function;
      offset++;
      return;
    }
    type = Ident;
  }
  function consumeStringToken(endingCodePoint) {
    if (!endingCodePoint) {
      endingCodePoint = getCharCode2(offset++);
    }
    type = String2;
    for (; offset < source.length; offset++) {
      const code = source.charCodeAt(offset);
      switch (charCodeCategory(code)) {
        // ending code point
        case endingCodePoint:
          offset++;
          return;
        // EOF
        // case EofCategory:
        // This is a parse error. Return the <string-token>.
        // return;
        // newline
        case WhiteSpaceCategory:
          if (isNewline(code)) {
            offset += getNewlineLength(source, offset, code);
            type = BadString;
            return;
          }
          break;
        // U+005C REVERSE SOLIDUS (\)
        case 92:
          if (offset === source.length - 1) {
            break;
          }
          const nextCode = getCharCode2(offset + 1);
          if (isNewline(nextCode)) {
            offset += getNewlineLength(source, offset + 1, nextCode);
          } else if (isValidEscape(code, nextCode)) {
            offset = consumeEscaped(source, offset) - 1;
          }
          break;
      }
    }
  }
  function consumeUrlToken() {
    type = Url;
    offset = findWhiteSpaceEnd(source, offset);
    for (; offset < source.length; offset++) {
      const code = source.charCodeAt(offset);
      switch (charCodeCategory(code)) {
        // U+0029 RIGHT PARENTHESIS ())
        case 41:
          offset++;
          return;
        // EOF
        // case EofCategory:
        // This is a parse error. Return the <url-token>.
        // return;
        // whitespace
        case WhiteSpaceCategory:
          offset = findWhiteSpaceEnd(source, offset);
          if (getCharCode2(offset) === 41 || offset >= source.length) {
            if (offset < source.length) {
              offset++;
            }
            return;
          }
          offset = consumeBadUrlRemnants(source, offset);
          type = BadUrl;
          return;
        // U+0022 QUOTATION MARK (")
        // U+0027 APOSTROPHE (')
        // U+0028 LEFT PARENTHESIS (()
        // non-printable code point
        case 34:
        case 39:
        case 40:
        case NonPrintableCategory:
          offset = consumeBadUrlRemnants(source, offset);
          type = BadUrl;
          return;
        // U+005C REVERSE SOLIDUS (\)
        case 92:
          if (isValidEscape(code, getCharCode2(offset + 1))) {
            offset = consumeEscaped(source, offset) - 1;
            break;
          }
          offset = consumeBadUrlRemnants(source, offset);
          type = BadUrl;
          return;
      }
    }
  }
  source = String(source || "");
  const sourceLength = source.length;
  let start = isBOM(getCharCode2(0));
  let offset = start;
  let type;
  while (offset < sourceLength) {
    const code = source.charCodeAt(offset);
    switch (charCodeCategory(code)) {
      // whitespace
      case WhiteSpaceCategory:
        type = WhiteSpace;
        offset = findWhiteSpaceEnd(source, offset + 1);
        break;
      // U+0022 QUOTATION MARK (")
      case 34:
        consumeStringToken();
        break;
      // U+0023 NUMBER SIGN (#)
      case 35:
        if (isName(getCharCode2(offset + 1)) || isValidEscape(getCharCode2(offset + 1), getCharCode2(offset + 2))) {
          type = Hash;
          offset = consumeName(source, offset + 1);
        } else {
          type = Delim;
          offset++;
        }
        break;
      // U+0027 APOSTROPHE (')
      case 39:
        consumeStringToken();
        break;
      // U+0028 LEFT PARENTHESIS (()
      case 40:
        type = LeftParenthesis;
        offset++;
        break;
      // U+0029 RIGHT PARENTHESIS ())
      case 41:
        type = RightParenthesis;
        offset++;
        break;
      // U+002B PLUS SIGN (+)
      case 43:
        if (isNumberStart(code, getCharCode2(offset + 1), getCharCode2(offset + 2))) {
          consumeNumericToken();
        } else {
          type = Delim;
          offset++;
        }
        break;
      // U+002C COMMA (,)
      case 44:
        type = Comma;
        offset++;
        break;
      // U+002D HYPHEN-MINUS (-)
      case 45:
        if (isNumberStart(code, getCharCode2(offset + 1), getCharCode2(offset + 2))) {
          consumeNumericToken();
        } else {
          if (getCharCode2(offset + 1) === 45 && getCharCode2(offset + 2) === 62) {
            type = CDC;
            offset = offset + 3;
          } else {
            if (isIdentifierStart(code, getCharCode2(offset + 1), getCharCode2(offset + 2))) {
              consumeIdentLikeToken();
            } else {
              type = Delim;
              offset++;
            }
          }
        }
        break;
      // U+002E FULL STOP (.)
      case 46:
        if (isNumberStart(code, getCharCode2(offset + 1), getCharCode2(offset + 2))) {
          consumeNumericToken();
        } else {
          type = Delim;
          offset++;
        }
        break;
      // U+002F SOLIDUS (/)
      case 47:
        if (getCharCode2(offset + 1) === 42) {
          type = Comment;
          offset = source.indexOf("*/", offset + 2);
          offset = offset === -1 ? source.length : offset + 2;
        } else {
          type = Delim;
          offset++;
        }
        break;
      // U+003A COLON (:)
      case 58:
        type = Colon;
        offset++;
        break;
      // U+003B SEMICOLON (;)
      case 59:
        type = Semicolon;
        offset++;
        break;
      // U+003C LESS-THAN SIGN (<)
      case 60:
        if (getCharCode2(offset + 1) === 33 && getCharCode2(offset + 2) === 45 && getCharCode2(offset + 3) === 45) {
          type = CDO;
          offset = offset + 4;
        } else {
          type = Delim;
          offset++;
        }
        break;
      // U+0040 COMMERCIAL AT (@)
      case 64:
        if (isIdentifierStart(getCharCode2(offset + 1), getCharCode2(offset + 2), getCharCode2(offset + 3))) {
          type = AtKeyword;
          offset = consumeName(source, offset + 1);
        } else {
          type = Delim;
          offset++;
        }
        break;
      // U+005B LEFT SQUARE BRACKET ([)
      case 91:
        type = LeftSquareBracket;
        offset++;
        break;
      // U+005C REVERSE SOLIDUS (\)
      case 92:
        if (isValidEscape(code, getCharCode2(offset + 1))) {
          consumeIdentLikeToken();
        } else {
          type = Delim;
          offset++;
        }
        break;
      // U+005D RIGHT SQUARE BRACKET (])
      case 93:
        type = RightSquareBracket;
        offset++;
        break;
      // U+007B LEFT CURLY BRACKET ({)
      case 123:
        type = LeftCurlyBracket;
        offset++;
        break;
      // U+007D RIGHT CURLY BRACKET (})
      case 125:
        type = RightCurlyBracket;
        offset++;
        break;
      // digit
      case DigitCategory:
        consumeNumericToken();
        break;
      // name-start code point
      case NameStartCategory:
        consumeIdentLikeToken();
        break;
      // EOF
      // case EofCategory:
      // Return an <EOF-token>.
      // break;
      // anything else
      default:
        type = Delim;
        offset++;
    }
    onToken(type, start, start = offset);
  }
}

// node_modules/css-tree/lib/parser/sequence.js
function readSequence(recognizer) {
  const children = this.createList();
  let space = false;
  const context = {
    recognizer
  };
  while (!this.eof) {
    switch (this.tokenType) {
      case Comment:
        this.next();
        continue;
      case WhiteSpace:
        space = true;
        this.next();
        continue;
    }
    let child = recognizer.getNode.call(this, context);
    if (child === void 0) {
      break;
    }
    if (space) {
      if (recognizer.onWhiteSpace) {
        recognizer.onWhiteSpace.call(this, child, children, context);
      }
      space = false;
    }
    children.push(child);
  }
  if (space && recognizer.onWhiteSpace) {
    recognizer.onWhiteSpace.call(this, null, children, context);
  }
  return children;
}

// node_modules/css-tree/lib/parser/create.js
var NOOP = () => {
};
var EXCLAMATIONMARK = 33;
var NUMBERSIGN = 35;
var SEMICOLON = 59;
var LEFTCURLYBRACKET = 123;
var NULL = 0;
var arrayMethods = {
  createList() {
    return [];
  },
  createSingleNodeList(node) {
    return [node];
  },
  getFirstListNode(list) {
    return list && list[0] || null;
  },
  getLastListNode(list) {
    return list && list.length > 0 ? list[list.length - 1] : null;
  }
};
var listMethods = {
  createList() {
    return new List();
  },
  createSingleNodeList(node) {
    return new List().appendData(node);
  },
  getFirstListNode(list) {
    return list && list.first;
  },
  getLastListNode(list) {
    return list && list.last;
  }
};
function createParseContext(name50) {
  return function() {
    return this[name50]();
  };
}
function fetchParseValues(dict) {
  const result = /* @__PURE__ */ Object.create(null);
  for (const name50 of Object.keys(dict)) {
    const item = dict[name50];
    const fn = item.parse || item;
    if (fn) {
      result[name50] = fn;
    }
  }
  return result;
}
function processConfig(config) {
  const parseConfig = {
    context: /* @__PURE__ */ Object.create(null),
    features: Object.assign(/* @__PURE__ */ Object.create(null), config.features),
    scope: Object.assign(/* @__PURE__ */ Object.create(null), config.scope),
    atrule: fetchParseValues(config.atrule),
    pseudo: fetchParseValues(config.pseudo),
    node: fetchParseValues(config.node)
  };
  for (const [name50, context] of Object.entries(config.parseContext)) {
    switch (typeof context) {
      case "function":
        parseConfig.context[name50] = context;
        break;
      case "string":
        parseConfig.context[name50] = createParseContext(context);
        break;
    }
  }
  return {
    config: parseConfig,
    ...parseConfig,
    ...parseConfig.node
  };
}
function createParser(config) {
  let source = "";
  let filename = "<unknown>";
  let needPositions = false;
  let onParseError = NOOP;
  let onParseErrorThrow = false;
  const locationMap = new OffsetToLocation();
  const parser = Object.assign(new TokenStream(), processConfig(config || {}), {
    parseAtrulePrelude: true,
    parseRulePrelude: true,
    parseValue: true,
    parseCustomProperty: false,
    readSequence,
    consumeUntilBalanceEnd: () => 0,
    consumeUntilLeftCurlyBracket(code) {
      return code === LEFTCURLYBRACKET ? 1 : 0;
    },
    consumeUntilLeftCurlyBracketOrSemicolon(code) {
      return code === LEFTCURLYBRACKET || code === SEMICOLON ? 1 : 0;
    },
    consumeUntilExclamationMarkOrSemicolon(code) {
      return code === EXCLAMATIONMARK || code === SEMICOLON ? 1 : 0;
    },
    consumeUntilSemicolonIncluded(code) {
      return code === SEMICOLON ? 2 : 0;
    },
    createList: NOOP,
    createSingleNodeList: NOOP,
    getFirstListNode: NOOP,
    getLastListNode: NOOP,
    parseWithFallback(consumer, fallback) {
      const startIndex = this.tokenIndex;
      try {
        return consumer.call(this);
      } catch (e) {
        if (onParseErrorThrow) {
          throw e;
        }
        this.skip(startIndex - this.tokenIndex);
        const fallbackNode = fallback.call(this);
        onParseErrorThrow = true;
        onParseError(e, fallbackNode);
        onParseErrorThrow = false;
        return fallbackNode;
      }
    },
    lookupNonWSType(offset) {
      let type;
      do {
        type = this.lookupType(offset++);
        if (type !== WhiteSpace && type !== Comment) {
          return type;
        }
      } while (type !== NULL);
      return NULL;
    },
    charCodeAt(offset) {
      return offset >= 0 && offset < source.length ? source.charCodeAt(offset) : 0;
    },
    substring(offsetStart, offsetEnd) {
      return source.substring(offsetStart, offsetEnd);
    },
    substrToCursor(start) {
      return this.source.substring(start, this.tokenStart);
    },
    cmpChar(offset, charCode) {
      return cmpChar(source, offset, charCode);
    },
    cmpStr(offsetStart, offsetEnd, str) {
      return cmpStr(source, offsetStart, offsetEnd, str);
    },
    consume(tokenType) {
      const start = this.tokenStart;
      this.eat(tokenType);
      return this.substrToCursor(start);
    },
    consumeFunctionName() {
      const name50 = source.substring(this.tokenStart, this.tokenEnd - 1);
      this.eat(Function);
      return name50;
    },
    consumeNumber(type) {
      const number = source.substring(this.tokenStart, consumeNumber(source, this.tokenStart));
      this.eat(type);
      return number;
    },
    eat(tokenType) {
      if (this.tokenType !== tokenType) {
        const tokenName = names_default[tokenType].slice(0, -6).replace(/-/g, " ").replace(/^./, (m) => m.toUpperCase());
        let message = `${/[[\](){}]/.test(tokenName) ? `"${tokenName}"` : tokenName} is expected`;
        let offset = this.tokenStart;
        switch (tokenType) {
          case Ident:
            if (this.tokenType === Function || this.tokenType === Url) {
              offset = this.tokenEnd - 1;
              message = "Identifier is expected but function found";
            } else {
              message = "Identifier is expected";
            }
            break;
          case Hash:
            if (this.isDelim(NUMBERSIGN)) {
              this.next();
              offset++;
              message = "Name is expected";
            }
            break;
          case Percentage:
            if (this.tokenType === Number) {
              offset = this.tokenEnd;
              message = "Percent sign is expected";
            }
            break;
        }
        this.error(message, offset);
      }
      this.next();
    },
    eatIdent(name50) {
      if (this.tokenType !== Ident || this.lookupValue(0, name50) === false) {
        this.error(`Identifier "${name50}" is expected`);
      }
      this.next();
    },
    eatDelim(code) {
      if (!this.isDelim(code)) {
        this.error(`Delim "${String.fromCharCode(code)}" is expected`);
      }
      this.next();
    },
    getLocation(start, end) {
      if (needPositions) {
        return locationMap.getLocationRange(
          start,
          end,
          filename
        );
      }
      return null;
    },
    getLocationFromList(list) {
      if (needPositions) {
        const head = this.getFirstListNode(list);
        const tail = this.getLastListNode(list);
        return locationMap.getLocationRange(
          head !== null ? head.loc.start.offset - locationMap.startOffset : this.tokenStart,
          tail !== null ? tail.loc.end.offset - locationMap.startOffset : this.tokenStart,
          filename
        );
      }
      return null;
    },
    error(message, offset) {
      const location = typeof offset !== "undefined" && offset < source.length ? locationMap.getLocation(offset) : this.eof ? locationMap.getLocation(findWhiteSpaceStart(source, source.length - 1)) : locationMap.getLocation(this.tokenStart);
      throw new SyntaxError2(
        message || "Unexpected input",
        source,
        location.offset,
        location.line,
        location.column,
        locationMap.startLine,
        locationMap.startColumn
      );
    }
  });
  const createTokenIterateAPI = () => ({
    filename,
    source,
    tokenCount: parser.tokenCount,
    getTokenType: (index) => parser.getTokenType(index),
    getTokenTypeName: (index) => names_default[parser.getTokenType(index)],
    getTokenStart: (index) => parser.getTokenStart(index),
    getTokenEnd: (index) => parser.getTokenEnd(index),
    getTokenValue: (index) => parser.source.substring(parser.getTokenStart(index), parser.getTokenEnd(index)),
    substring: (start, end) => parser.source.substring(start, end),
    balance: parser.balance.subarray(0, parser.tokenCount + 1),
    isBlockOpenerTokenType: parser.isBlockOpenerTokenType,
    isBlockCloserTokenType: parser.isBlockCloserTokenType,
    getBlockTokenPairIndex: (index) => parser.getBlockTokenPairIndex(index),
    getLocation: (offset) => locationMap.getLocation(offset, filename),
    getRangeLocation: (start, end) => locationMap.getLocationRange(start, end, filename)
  });
  const parse50 = function(source_, options) {
    source = source_;
    options = options || {};
    parser.setSource(source, tokenize);
    locationMap.setSource(
      source,
      options.offset,
      options.line,
      options.column
    );
    filename = options.filename || "<unknown>";
    needPositions = Boolean(options.positions);
    onParseError = typeof options.onParseError === "function" ? options.onParseError : NOOP;
    onParseErrorThrow = false;
    parser.parseAtrulePrelude = "parseAtrulePrelude" in options ? Boolean(options.parseAtrulePrelude) : true;
    parser.parseRulePrelude = "parseRulePrelude" in options ? Boolean(options.parseRulePrelude) : true;
    parser.parseValue = "parseValue" in options ? Boolean(options.parseValue) : true;
    parser.parseCustomProperty = "parseCustomProperty" in options ? Boolean(options.parseCustomProperty) : false;
    const { context = "default", list = true, onComment, onToken } = options;
    if (context in parser.context === false) {
      throw new Error("Unknown context `" + context + "`");
    }
    Object.assign(parser, list ? listMethods : arrayMethods);
    if (Array.isArray(onToken)) {
      parser.forEachToken((type, start, end) => {
        onToken.push({ type, start, end });
      });
    } else if (typeof onToken === "function") {
      parser.forEachToken(onToken.bind(createTokenIterateAPI()));
    }
    if (typeof onComment === "function") {
      parser.forEachToken((type, start, end) => {
        if (type === Comment) {
          const loc = parser.getLocation(start, end);
          const value = cmpStr(source, end - 2, end, "*/") ? source.slice(start + 2, end - 2) : source.slice(start + 2, end);
          onComment(value, loc);
        }
      });
    }
    const ast = parser.context[context].call(parser, options);
    if (!parser.eof) {
      parser.error();
    }
    return ast;
  };
  return Object.assign(parse50, {
    SyntaxError: SyntaxError2,
    config: parser.config
  });
}

// node_modules/css-tree/lib/syntax/scope/index.js
var scope_exports = {};
__export(scope_exports, {
  AtrulePrelude: () => atrulePrelude_default,
  Selector: () => selector_default,
  Value: () => value_default
});

// node_modules/css-tree/lib/syntax/scope/default.js
var NUMBERSIGN2 = 35;
var ASTERISK = 42;
var PLUSSIGN = 43;
var HYPHENMINUS = 45;
var SOLIDUS = 47;
var U = 117;
function defaultRecognizer(context) {
  switch (this.tokenType) {
    case Hash:
      return this.Hash();
    case Comma:
      return this.Operator();
    case LeftParenthesis:
      return this.Parentheses(this.readSequence, context.recognizer);
    case LeftSquareBracket:
      return this.Brackets(this.readSequence, context.recognizer);
    case String2:
      return this.String();
    case Dimension:
      return this.Dimension();
    case Percentage:
      return this.Percentage();
    case Number:
      return this.Number();
    case Function:
      return this.cmpStr(this.tokenStart, this.tokenEnd, "url(") ? this.Url() : this.Function(this.readSequence, context.recognizer);
    case Url:
      return this.Url();
    case Ident:
      if (this.cmpChar(this.tokenStart, U) && this.cmpChar(this.tokenStart + 1, PLUSSIGN)) {
        return this.UnicodeRange();
      } else {
        return this.Identifier();
      }
    case Delim: {
      const code = this.charCodeAt(this.tokenStart);
      if (code === SOLIDUS || code === ASTERISK || code === PLUSSIGN || code === HYPHENMINUS) {
        return this.Operator();
      }
      if (code === NUMBERSIGN2) {
        this.error("Hex or identifier is expected", this.tokenStart + 1);
      }
      break;
    }
  }
}

// node_modules/css-tree/lib/syntax/scope/atrulePrelude.js
var atrulePrelude_default = {
  getNode: defaultRecognizer
};

// node_modules/css-tree/lib/syntax/scope/selector.js
var NUMBERSIGN3 = 35;
var AMPERSAND = 38;
var ASTERISK2 = 42;
var PLUSSIGN2 = 43;
var SOLIDUS2 = 47;
var FULLSTOP = 46;
var GREATERTHANSIGN = 62;
var VERTICALLINE = 124;
var TILDE = 126;
function onWhiteSpace(next, children) {
  if (children.last !== null && children.last.type !== "Combinator" && next !== null && next.type !== "Combinator") {
    children.push({
      // FIXME: this.Combinator() should be used instead
      type: "Combinator",
      loc: null,
      name: " "
    });
  }
}
function getNode() {
  switch (this.tokenType) {
    case LeftSquareBracket:
      return this.AttributeSelector();
    case Hash:
      return this.IdSelector();
    case Colon:
      if (this.lookupType(1) === Colon) {
        return this.PseudoElementSelector();
      } else {
        return this.PseudoClassSelector();
      }
    case Ident:
      return this.TypeSelector();
    case Number:
    case Percentage:
      return this.Percentage();
    case Dimension:
      if (this.charCodeAt(this.tokenStart) === FULLSTOP) {
        this.error("Identifier is expected", this.tokenStart + 1);
      }
      break;
    case Delim: {
      const code = this.charCodeAt(this.tokenStart);
      switch (code) {
        case PLUSSIGN2:
        case GREATERTHANSIGN:
        case TILDE:
        case SOLIDUS2:
          return this.Combinator();
        case FULLSTOP:
          return this.ClassSelector();
        case ASTERISK2:
        case VERTICALLINE:
          return this.TypeSelector();
        case NUMBERSIGN3:
          return this.IdSelector();
        case AMPERSAND:
          return this.NestingSelector();
      }
      break;
    }
  }
}
var selector_default = {
  onWhiteSpace,
  getNode
};

// node_modules/css-tree/lib/syntax/function/expression.js
function expression_default() {
  return this.createSingleNodeList(
    this.Raw(null, false)
  );
}

// node_modules/css-tree/lib/syntax/function/var.js
function var_default() {
  const children = this.createList();
  this.skipSC();
  children.push(this.Identifier());
  this.skipSC();
  if (this.tokenType === Comma) {
    children.push(this.Operator());
    const startIndex = this.tokenIndex;
    const value = this.parseCustomProperty ? this.Value(null) : this.Raw(this.consumeUntilExclamationMarkOrSemicolon, false);
    if (value.type === "Value" && value.children.isEmpty) {
      for (let offset = startIndex - this.tokenIndex; offset <= 0; offset++) {
        if (this.lookupType(offset) === WhiteSpace) {
          value.children.appendData({
            type: "WhiteSpace",
            loc: null,
            value: " "
          });
          break;
        }
      }
    }
    children.push(value);
  }
  return children;
}

// node_modules/css-tree/lib/syntax/scope/value.js
function isPlusMinusOperator(node) {
  return node !== null && node.type === "Operator" && (node.value[node.value.length - 1] === "-" || node.value[node.value.length - 1] === "+");
}
var value_default = {
  getNode: defaultRecognizer,
  onWhiteSpace(next, children) {
    if (isPlusMinusOperator(next)) {
      next.value = " " + next.value;
    }
    if (isPlusMinusOperator(children.last)) {
      children.last.value += " ";
    }
  },
  "expression": expression_default,
  "var": var_default
};

// node_modules/css-tree/lib/syntax/atrule/container.js
var nonContainerNameKeywords = /* @__PURE__ */ new Set(["none", "and", "not", "or"]);
var container_default = {
  parse: {
    prelude() {
      const children = this.createList();
      if (this.tokenType === Ident) {
        const name50 = this.substring(this.tokenStart, this.tokenEnd);
        if (!nonContainerNameKeywords.has(name50.toLowerCase())) {
          children.push(this.Identifier());
        }
      }
      children.push(this.Condition("container"));
      return children;
    },
    block(nested = false) {
      return this.Block(nested);
    }
  }
};

// node_modules/css-tree/lib/syntax/atrule/font-face.js
var font_face_default = {
  parse: {
    prelude: null,
    block() {
      return this.Block(true);
    }
  }
};

// node_modules/css-tree/lib/syntax/atrule/import.js
function parseWithFallback(parse50, fallback) {
  return this.parseWithFallback(
    () => {
      try {
        return parse50.call(this);
      } finally {
        this.skipSC();
        if (this.lookupNonWSType(0) !== RightParenthesis) {
          this.error();
        }
      }
    },
    fallback || (() => this.Raw(null, true))
  );
}
var parseFunctions = {
  layer() {
    this.skipSC();
    const children = this.createList();
    const node = parseWithFallback.call(this, this.Layer);
    if (node.type !== "Raw" || node.value !== "") {
      children.push(node);
    }
    return children;
  },
  supports() {
    this.skipSC();
    const children = this.createList();
    const node = parseWithFallback.call(
      this,
      this.Declaration,
      () => parseWithFallback.call(this, () => this.Condition("supports"))
    );
    if (node.type !== "Raw" || node.value !== "") {
      children.push(node);
    }
    return children;
  }
};
var import_default3 = {
  parse: {
    prelude() {
      const children = this.createList();
      switch (this.tokenType) {
        case String2:
          children.push(this.String());
          break;
        case Url:
        case Function:
          children.push(this.Url());
          break;
        default:
          this.error("String or url() is expected");
      }
      this.skipSC();
      if (this.tokenType === Ident && this.cmpStr(this.tokenStart, this.tokenEnd, "layer")) {
        children.push(this.Identifier());
      } else if (this.tokenType === Function && this.cmpStr(this.tokenStart, this.tokenEnd, "layer(")) {
        children.push(this.Function(null, parseFunctions));
      }
      this.skipSC();
      if (this.tokenType === Function && this.cmpStr(this.tokenStart, this.tokenEnd, "supports(")) {
        children.push(this.Function(null, parseFunctions));
      }
      if (this.lookupNonWSType(0) === Ident || this.lookupNonWSType(0) === LeftParenthesis) {
        children.push(this.MediaQueryList());
      }
      return children;
    },
    block: null
  }
};

// node_modules/css-tree/lib/syntax/atrule/layer.js
var layer_default = {
  parse: {
    prelude() {
      return this.createSingleNodeList(
        this.LayerList()
      );
    },
    block() {
      return this.Block(false);
    }
  }
};

// node_modules/css-tree/lib/syntax/atrule/media.js
var media_default = {
  parse: {
    prelude() {
      return this.createSingleNodeList(
        this.MediaQueryList()
      );
    },
    block(nested = false) {
      return this.Block(nested);
    }
  }
};

// node_modules/css-tree/lib/syntax/atrule/nest.js
var nest_default = {
  parse: {
    prelude() {
      return this.createSingleNodeList(
        this.SelectorList()
      );
    },
    block() {
      return this.Block(true);
    }
  }
};

// node_modules/css-tree/lib/syntax/atrule/page.js
var page_default = {
  parse: {
    prelude() {
      return this.createSingleNodeList(
        this.SelectorList()
      );
    },
    block() {
      return this.Block(true);
    }
  }
};

// node_modules/css-tree/lib/syntax/atrule/scope.js
var scope_default = {
  parse: {
    prelude() {
      return this.createSingleNodeList(
        this.Scope()
      );
    },
    block(nested = false) {
      return this.Block(nested);
    }
  }
};

// node_modules/css-tree/lib/syntax/atrule/starting-style.js
var starting_style_default = {
  parse: {
    prelude: null,
    block(nested = false) {
      return this.Block(nested);
    }
  }
};

// node_modules/css-tree/lib/syntax/atrule/supports.js
var supports_default = {
  parse: {
    prelude() {
      return this.createSingleNodeList(
        this.Condition("supports")
      );
    },
    block(nested = false) {
      return this.Block(nested);
    }
  }
};

// node_modules/css-tree/lib/syntax/atrule/index.js
var atrule_default = {
  container: container_default,
  "font-face": font_face_default,
  import: import_default3,
  layer: layer_default,
  media: media_default,
  nest: nest_default,
  page: page_default,
  scope: scope_default,
  "starting-style": starting_style_default,
  supports: supports_default
};

// node_modules/css-tree/lib/syntax/pseudo/lang.js
function parseLanguageRangeList() {
  const children = this.createList();
  this.skipSC();
  loop: while (!this.eof) {
    switch (this.tokenType) {
      case Ident:
        children.push(this.Identifier());
        break;
      case String2:
        children.push(this.String());
        break;
      case Comma:
        children.push(this.Operator());
        break;
      case RightParenthesis:
        break loop;
      default:
        this.error("Identifier, string or comma is expected");
    }
    this.skipSC();
  }
  return children;
}

// node_modules/css-tree/lib/syntax/pseudo/index.js
var selectorList = {
  parse() {
    return this.createSingleNodeList(
      this.SelectorList()
    );
  }
};
var selector = {
  parse() {
    return this.createSingleNodeList(
      this.Selector()
    );
  }
};
var identList = {
  parse() {
    return this.createSingleNodeList(
      this.Identifier()
    );
  }
};
var langList = {
  parse: parseLanguageRangeList
};
var nth = {
  parse() {
    return this.createSingleNodeList(
      this.Nth()
    );
  }
};
var pseudo_default = {
  "dir": identList,
  "has": selectorList,
  "lang": langList,
  "matches": selectorList,
  "is": selectorList,
  "-moz-any": selectorList,
  "-webkit-any": selectorList,
  "where": selectorList,
  "not": selectorList,
  "nth-child": nth,
  "nth-last-child": nth,
  "nth-last-of-type": nth,
  "nth-of-type": nth,
  "slotted": selector,
  "host": selector,
  "host-context": selector
};

// node_modules/css-tree/lib/syntax/node/index-parse.js
var index_parse_exports = {};
__export(index_parse_exports, {
  AnPlusB: () => parse,
  Atrule: () => parse2,
  AtrulePrelude: () => parse3,
  AttributeSelector: () => parse4,
  Block: () => parse5,
  Brackets: () => parse6,
  CDC: () => parse7,
  CDO: () => parse8,
  ClassSelector: () => parse9,
  Combinator: () => parse10,
  Comment: () => parse11,
  Condition: () => parse12,
  Declaration: () => parse13,
  DeclarationList: () => parse14,
  Dimension: () => parse15,
  Feature: () => parse16,
  FeatureFunction: () => parse17,
  FeatureRange: () => parse18,
  Function: () => parse19,
  GeneralEnclosed: () => parse20,
  Hash: () => parse21,
  IdSelector: () => parse23,
  Identifier: () => parse22,
  Layer: () => parse24,
  LayerList: () => parse25,
  MediaQuery: () => parse26,
  MediaQueryList: () => parse27,
  NestingSelector: () => parse28,
  Nth: () => parse29,
  Number: () => parse30,
  Operator: () => parse31,
  Parentheses: () => parse32,
  Percentage: () => parse33,
  PseudoClassSelector: () => parse34,
  PseudoElementSelector: () => parse35,
  Ratio: () => parse36,
  Raw: () => parse37,
  Rule: () => parse38,
  Scope: () => parse39,
  Selector: () => parse40,
  SelectorList: () => parse41,
  String: () => parse42,
  StyleSheet: () => parse43,
  SupportsDeclaration: () => parse44,
  TypeSelector: () => parse45,
  UnicodeRange: () => parse46,
  Url: () => parse47,
  Value: () => parse48,
  WhiteSpace: () => parse49
});

// node_modules/css-tree/lib/syntax/node/AnPlusB.js
var AnPlusB_exports = {};
__export(AnPlusB_exports, {
  generate: () => generate,
  name: () => name,
  parse: () => parse,
  structure: () => structure
});
var PLUSSIGN3 = 43;
var HYPHENMINUS2 = 45;
var N2 = 110;
var DISALLOW_SIGN = true;
var ALLOW_SIGN = false;
function checkInteger(offset, disallowSign) {
  let pos = this.tokenStart + offset;
  const code = this.charCodeAt(pos);
  if (code === PLUSSIGN3 || code === HYPHENMINUS2) {
    if (disallowSign) {
      this.error("Number sign is not allowed");
    }
    pos++;
  }
  for (; pos < this.tokenEnd; pos++) {
    if (!isDigit(this.charCodeAt(pos))) {
      this.error("Integer is expected", pos);
    }
  }
}
function checkTokenIsInteger(disallowSign) {
  return checkInteger.call(this, 0, disallowSign);
}
function expectCharCode(offset, code) {
  if (!this.cmpChar(this.tokenStart + offset, code)) {
    let msg = "";
    switch (code) {
      case N2:
        msg = "N is expected";
        break;
      case HYPHENMINUS2:
        msg = "HyphenMinus is expected";
        break;
    }
    this.error(msg, this.tokenStart + offset);
  }
}
function consumeB() {
  let offset = 0;
  let sign = 0;
  let type = this.tokenType;
  while (type === WhiteSpace || type === Comment) {
    type = this.lookupType(++offset);
  }
  if (type !== Number) {
    if (this.isDelim(PLUSSIGN3, offset) || this.isDelim(HYPHENMINUS2, offset)) {
      sign = this.isDelim(PLUSSIGN3, offset) ? PLUSSIGN3 : HYPHENMINUS2;
      do {
        type = this.lookupType(++offset);
      } while (type === WhiteSpace || type === Comment);
      if (type !== Number) {
        this.skip(offset);
        checkTokenIsInteger.call(this, DISALLOW_SIGN);
      }
    } else {
      return null;
    }
  }
  if (offset > 0) {
    this.skip(offset);
  }
  if (sign === 0) {
    type = this.charCodeAt(this.tokenStart);
    if (type !== PLUSSIGN3 && type !== HYPHENMINUS2) {
      this.error("Number sign is expected");
    }
  }
  checkTokenIsInteger.call(this, sign !== 0);
  return sign === HYPHENMINUS2 ? "-" + this.consume(Number) : this.consume(Number);
}
var name = "AnPlusB";
var structure = {
  a: [String, null],
  b: [String, null]
};
function parse() {
  const start = this.tokenStart;
  let a = null;
  let b = null;
  if (this.tokenType === Number) {
    checkTokenIsInteger.call(this, ALLOW_SIGN);
    b = this.consume(Number);
  } else if (this.tokenType === Ident && this.cmpChar(this.tokenStart, HYPHENMINUS2)) {
    a = "-1";
    expectCharCode.call(this, 1, N2);
    switch (this.tokenEnd - this.tokenStart) {
      // -n
      // -n <signed-integer>
      // -n ['+' | '-'] <signless-integer>
      case 2:
        this.next();
        b = consumeB.call(this);
        break;
      // -n- <signless-integer>
      case 3:
        expectCharCode.call(this, 2, HYPHENMINUS2);
        this.next();
        this.skipSC();
        checkTokenIsInteger.call(this, DISALLOW_SIGN);
        b = "-" + this.consume(Number);
        break;
      // <dashndashdigit-ident>
      default:
        expectCharCode.call(this, 2, HYPHENMINUS2);
        checkInteger.call(this, 3, DISALLOW_SIGN);
        this.next();
        b = this.substrToCursor(start + 2);
    }
  } else if (this.tokenType === Ident || this.isDelim(PLUSSIGN3) && this.lookupType(1) === Ident) {
    let sign = 0;
    a = "1";
    if (this.isDelim(PLUSSIGN3)) {
      sign = 1;
      this.next();
    }
    expectCharCode.call(this, 0, N2);
    switch (this.tokenEnd - this.tokenStart) {
      // '+'? n
      // '+'? n <signed-integer>
      // '+'? n ['+' | '-'] <signless-integer>
      case 1:
        this.next();
        b = consumeB.call(this);
        break;
      // '+'? n- <signless-integer>
      case 2:
        expectCharCode.call(this, 1, HYPHENMINUS2);
        this.next();
        this.skipSC();
        checkTokenIsInteger.call(this, DISALLOW_SIGN);
        b = "-" + this.consume(Number);
        break;
      // '+'? <ndashdigit-ident>
      default:
        expectCharCode.call(this, 1, HYPHENMINUS2);
        checkInteger.call(this, 2, DISALLOW_SIGN);
        this.next();
        b = this.substrToCursor(start + sign + 1);
    }
  } else if (this.tokenType === Dimension) {
    const code = this.charCodeAt(this.tokenStart);
    const sign = code === PLUSSIGN3 || code === HYPHENMINUS2;
    let i = this.tokenStart + sign;
    for (; i < this.tokenEnd; i++) {
      if (!isDigit(this.charCodeAt(i))) {
        break;
      }
    }
    if (i === this.tokenStart + sign) {
      this.error("Integer is expected", this.tokenStart + sign);
    }
    expectCharCode.call(this, i - this.tokenStart, N2);
    a = this.substring(start, i);
    if (i + 1 === this.tokenEnd) {
      this.next();
      b = consumeB.call(this);
    } else {
      expectCharCode.call(this, i - this.tokenStart + 1, HYPHENMINUS2);
      if (i + 2 === this.tokenEnd) {
        this.next();
        this.skipSC();
        checkTokenIsInteger.call(this, DISALLOW_SIGN);
        b = "-" + this.consume(Number);
      } else {
        checkInteger.call(this, i - this.tokenStart + 2, DISALLOW_SIGN);
        this.next();
        b = this.substrToCursor(i + 1);
      }
    }
  } else {
    this.error();
  }
  if (a !== null && a.charCodeAt(0) === PLUSSIGN3) {
    a = a.substr(1);
  }
  if (b !== null && b.charCodeAt(0) === PLUSSIGN3) {
    b = b.substr(1);
  }
  return {
    type: "AnPlusB",
    loc: this.getLocation(start, this.tokenStart),
    a,
    b
  };
}
function generate(node) {
  if (node.a) {
    const a = node.a === "+1" && "n" || node.a === "1" && "n" || node.a === "-1" && "-n" || node.a + "n";
    if (node.b) {
      const b = node.b[0] === "-" || node.b[0] === "+" ? node.b : "+" + node.b;
      this.tokenize(a + b);
    } else {
      this.tokenize(a);
    }
  } else {
    this.tokenize(node.b);
  }
}

// node_modules/css-tree/lib/syntax/node/Atrule.js
var Atrule_exports = {};
__export(Atrule_exports, {
  generate: () => generate2,
  name: () => name2,
  parse: () => parse2,
  structure: () => structure2,
  walkContext: () => walkContext
});
function consumeRaw() {
  return this.Raw(this.consumeUntilLeftCurlyBracketOrSemicolon, true);
}
function isDeclarationBlockAtrule() {
  for (let offset = 1, type; type = this.lookupType(offset); offset++) {
    if (type === RightCurlyBracket) {
      return true;
    }
    if (type === LeftCurlyBracket || type === AtKeyword) {
      return false;
    }
  }
  return false;
}
var name2 = "Atrule";
var walkContext = "atrule";
var structure2 = {
  name: String,
  prelude: ["AtrulePrelude", "Raw", null],
  block: ["Block", null]
};
function parse2(isDeclaration = false) {
  const start = this.tokenStart;
  let name50;
  let nameLowerCase;
  let prelude = null;
  let block = null;
  this.eat(AtKeyword);
  name50 = this.substrToCursor(start + 1);
  nameLowerCase = name50.toLowerCase();
  this.skipSC();
  if (this.eof === false && this.tokenType !== LeftCurlyBracket && this.tokenType !== Semicolon) {
    if (this.parseAtrulePrelude) {
      prelude = this.parseWithFallback(this.AtrulePrelude.bind(this, name50, isDeclaration), consumeRaw);
    } else {
      prelude = consumeRaw.call(this, this.tokenIndex);
    }
    this.skipSC();
  }
  switch (this.tokenType) {
    case Semicolon:
      this.next();
      break;
    case LeftCurlyBracket:
      if (hasOwnProperty.call(this.atrule, nameLowerCase) && typeof this.atrule[nameLowerCase].block === "function") {
        block = this.atrule[nameLowerCase].block.call(this, isDeclaration);
      } else {
        block = this.Block(isDeclarationBlockAtrule.call(this));
      }
      break;
  }
  return {
    type: "Atrule",
    loc: this.getLocation(start, this.tokenStart),
    name: name50,
    prelude,
    block
  };
}
function generate2(node) {
  this.token(AtKeyword, "@" + node.name);
  if (node.prelude !== null) {
    this.node(node.prelude);
  }
  if (node.block) {
    this.node(node.block);
  } else {
    this.token(Semicolon, ";");
  }
}

// node_modules/css-tree/lib/syntax/node/AtrulePrelude.js
var AtrulePrelude_exports = {};
__export(AtrulePrelude_exports, {
  generate: () => generate3,
  name: () => name3,
  parse: () => parse3,
  structure: () => structure3,
  walkContext: () => walkContext2
});
var name3 = "AtrulePrelude";
var walkContext2 = "atrulePrelude";
var structure3 = {
  children: [[]]
};
function parse3(name50) {
  let children = null;
  if (name50 !== null) {
    name50 = name50.toLowerCase();
  }
  this.skipSC();
  if (hasOwnProperty.call(this.atrule, name50) && typeof this.atrule[name50].prelude === "function") {
    children = this.atrule[name50].prelude.call(this);
  } else {
    children = this.readSequence(this.scope.AtrulePrelude);
  }
  this.skipSC();
  if (this.eof !== true && this.tokenType !== LeftCurlyBracket && this.tokenType !== Semicolon) {
    this.error("Semicolon or block is expected");
  }
  return {
    type: "AtrulePrelude",
    loc: this.getLocationFromList(children),
    children
  };
}
function generate3(node) {
  this.children(node);
}

// node_modules/css-tree/lib/syntax/node/AttributeSelector.js
var AttributeSelector_exports = {};
__export(AttributeSelector_exports, {
  generate: () => generate4,
  name: () => name4,
  parse: () => parse4,
  structure: () => structure4
});
var DOLLARSIGN = 36;
var ASTERISK3 = 42;
var EQUALSSIGN = 61;
var CIRCUMFLEXACCENT = 94;
var VERTICALLINE2 = 124;
var TILDE2 = 126;
function getAttributeName() {
  if (this.eof) {
    this.error("Unexpected end of input");
  }
  const start = this.tokenStart;
  let expectIdent = false;
  if (this.isDelim(ASTERISK3)) {
    expectIdent = true;
    this.next();
  } else if (!this.isDelim(VERTICALLINE2)) {
    this.eat(Ident);
  }
  if (this.isDelim(VERTICALLINE2)) {
    if (this.charCodeAt(this.tokenStart + 1) !== EQUALSSIGN) {
      this.next();
      this.eat(Ident);
    } else if (expectIdent) {
      this.error("Identifier is expected", this.tokenEnd);
    }
  } else if (expectIdent) {
    this.error("Vertical line is expected");
  }
  return {
    type: "Identifier",
    loc: this.getLocation(start, this.tokenStart),
    name: this.substrToCursor(start)
  };
}
function getOperator() {
  const start = this.tokenStart;
  const code = this.charCodeAt(start);
  if (code !== EQUALSSIGN && // =
  code !== TILDE2 && // ~=
  code !== CIRCUMFLEXACCENT && // ^=
  code !== DOLLARSIGN && // $=
  code !== ASTERISK3 && // *=
  code !== VERTICALLINE2) {
    this.error("Attribute selector (=, ~=, ^=, $=, *=, |=) is expected");
  }
  this.next();
  if (code !== EQUALSSIGN) {
    if (!this.isDelim(EQUALSSIGN)) {
      this.error("Equal sign is expected");
    }
    this.next();
  }
  return this.substrToCursor(start);
}
var name4 = "AttributeSelector";
var structure4 = {
  name: "Identifier",
  matcher: [String, null],
  value: ["String", "Identifier", null],
  flags: [String, null]
};
function parse4() {
  const start = this.tokenStart;
  let name50;
  let matcher = null;
  let value = null;
  let flags = null;
  this.eat(LeftSquareBracket);
  this.skipSC();
  name50 = getAttributeName.call(this);
  this.skipSC();
  if (this.tokenType !== RightSquareBracket) {
    if (this.tokenType !== Ident) {
      matcher = getOperator.call(this);
      this.skipSC();
      value = this.tokenType === String2 ? this.String() : this.Identifier();
      this.skipSC();
    }
    if (this.tokenType === Ident) {
      flags = this.consume(Ident);
      this.skipSC();
    }
  }
  this.eat(RightSquareBracket);
  return {
    type: "AttributeSelector",
    loc: this.getLocation(start, this.tokenStart),
    name: name50,
    matcher,
    value,
    flags
  };
}
function generate4(node) {
  this.token(Delim, "[");
  this.node(node.name);
  if (node.matcher !== null) {
    this.tokenize(node.matcher);
    this.node(node.value);
  }
  if (node.flags !== null) {
    this.token(Ident, node.flags);
  }
  this.token(Delim, "]");
}

// node_modules/css-tree/lib/syntax/node/Block.js
var Block_exports = {};
__export(Block_exports, {
  generate: () => generate5,
  name: () => name5,
  parse: () => parse5,
  structure: () => structure5,
  walkContext: () => walkContext3
});
var AMPERSAND2 = 38;
function consumeRaw2() {
  return this.Raw(null, true);
}
function consumeRule() {
  return this.parseWithFallback(this.Rule, consumeRaw2);
}
function consumeRawDeclaration() {
  return this.Raw(this.consumeUntilSemicolonIncluded, true);
}
function consumeDeclaration() {
  if (this.tokenType === Semicolon) {
    return consumeRawDeclaration.call(this, this.tokenIndex);
  }
  const node = this.parseWithFallback(this.Declaration, consumeRawDeclaration);
  if (this.tokenType === Semicolon) {
    this.next();
  }
  return node;
}
var name5 = "Block";
var walkContext3 = "block";
var structure5 = {
  children: [[
    "Atrule",
    "Rule",
    "Declaration"
  ]]
};
function parse5(isStyleBlock) {
  const consumer = isStyleBlock ? consumeDeclaration : consumeRule;
  const start = this.tokenStart;
  let children = this.createList();
  this.eat(LeftCurlyBracket);
  scan:
    while (!this.eof) {
      switch (this.tokenType) {
        case RightCurlyBracket:
          break scan;
        case WhiteSpace:
        case Comment:
          this.next();
          break;
        case AtKeyword:
          children.push(this.parseWithFallback(this.Atrule.bind(this, isStyleBlock), consumeRaw2));
          break;
        default:
          if (isStyleBlock && this.isDelim(AMPERSAND2)) {
            children.push(consumeRule.call(this));
          } else {
            children.push(consumer.call(this));
          }
      }
    }
  if (!this.eof) {
    this.eat(RightCurlyBracket);
  }
  return {
    type: "Block",
    loc: this.getLocation(start, this.tokenStart),
    children
  };
}
function generate5(node) {
  this.token(LeftCurlyBracket, "{");
  this.children(node, (prev) => {
    if (prev.type === "Declaration") {
      this.token(Semicolon, ";");
    }
  });
  this.token(RightCurlyBracket, "}");
}

// node_modules/css-tree/lib/syntax/node/Brackets.js
var Brackets_exports = {};
__export(Brackets_exports, {
  generate: () => generate6,
  name: () => name6,
  parse: () => parse6,
  structure: () => structure6
});
var name6 = "Brackets";
var structure6 = {
  children: [[]]
};
function parse6(readSequence2, recognizer) {
  const start = this.tokenStart;
  let children = null;
  this.eat(LeftSquareBracket);
  children = readSequence2.call(this, recognizer);
  if (!this.eof) {
    this.eat(RightSquareBracket);
  }
  return {
    type: "Brackets",
    loc: this.getLocation(start, this.tokenStart),
    children
  };
}
function generate6(node) {
  this.token(Delim, "[");
  this.children(node);
  this.token(Delim, "]");
}

// node_modules/css-tree/lib/syntax/node/CDC.js
var CDC_exports = {};
__export(CDC_exports, {
  generate: () => generate7,
  name: () => name7,
  parse: () => parse7,
  structure: () => structure7
});
var name7 = "CDC";
var structure7 = [];
function parse7() {
  const start = this.tokenStart;
  this.eat(CDC);
  return {
    type: "CDC",
    loc: this.getLocation(start, this.tokenStart)
  };
}
function generate7() {
  this.token(CDC, "-->");
}

// node_modules/css-tree/lib/syntax/node/CDO.js
var CDO_exports = {};
__export(CDO_exports, {
  generate: () => generate8,
  name: () => name8,
  parse: () => parse8,
  structure: () => structure8
});
var name8 = "CDO";
var structure8 = [];
function parse8() {
  const start = this.tokenStart;
  this.eat(CDO);
  return {
    type: "CDO",
    loc: this.getLocation(start, this.tokenStart)
  };
}
function generate8() {
  this.token(CDO, "<!--");
}

// node_modules/css-tree/lib/syntax/node/ClassSelector.js
var ClassSelector_exports = {};
__export(ClassSelector_exports, {
  generate: () => generate9,
  name: () => name9,
  parse: () => parse9,
  structure: () => structure9
});
var FULLSTOP2 = 46;
var name9 = "ClassSelector";
var structure9 = {
  name: String
};
function parse9() {
  this.eatDelim(FULLSTOP2);
  return {
    type: "ClassSelector",
    loc: this.getLocation(this.tokenStart - 1, this.tokenEnd),
    name: this.consume(Ident)
  };
}
function generate9(node) {
  this.token(Delim, ".");
  this.token(Ident, node.name);
}

// node_modules/css-tree/lib/syntax/node/Combinator.js
var Combinator_exports = {};
__export(Combinator_exports, {
  generate: () => generate10,
  name: () => name10,
  parse: () => parse10,
  structure: () => structure10
});
var PLUSSIGN4 = 43;
var SOLIDUS3 = 47;
var GREATERTHANSIGN2 = 62;
var TILDE3 = 126;
var name10 = "Combinator";
var structure10 = {
  name: String
};
function parse10() {
  const start = this.tokenStart;
  let name50;
  switch (this.tokenType) {
    case WhiteSpace:
      name50 = " ";
      break;
    case Delim:
      switch (this.charCodeAt(this.tokenStart)) {
        case GREATERTHANSIGN2:
        case PLUSSIGN4:
        case TILDE3:
          this.next();
          break;
        case SOLIDUS3:
          this.next();
          this.eatIdent("deep");
          this.eatDelim(SOLIDUS3);
          break;
        default:
          this.error("Combinator is expected");
      }
      name50 = this.substrToCursor(start);
      break;
  }
  return {
    type: "Combinator",
    loc: this.getLocation(start, this.tokenStart),
    name: name50
  };
}
function generate10(node) {
  this.tokenize(node.name);
}

// node_modules/css-tree/lib/syntax/node/Comment.js
var Comment_exports = {};
__export(Comment_exports, {
  generate: () => generate11,
  name: () => name11,
  parse: () => parse11,
  structure: () => structure11
});
var ASTERISK4 = 42;
var SOLIDUS4 = 47;
var name11 = "Comment";
var structure11 = {
  value: String
};
function parse11() {
  const start = this.tokenStart;
  let end = this.tokenEnd;
  this.eat(Comment);
  if (end - start + 2 >= 2 && this.charCodeAt(end - 2) === ASTERISK4 && this.charCodeAt(end - 1) === SOLIDUS4) {
    end -= 2;
  }
  return {
    type: "Comment",
    loc: this.getLocation(start, this.tokenStart),
    value: this.substring(start + 2, end)
  };
}
function generate11(node) {
  this.token(Comment, "/*" + node.value + "*/");
}

// node_modules/css-tree/lib/syntax/node/Condition.js
var Condition_exports = {};
__export(Condition_exports, {
  generate: () => generate12,
  name: () => name12,
  parse: () => parse12,
  structure: () => structure12
});
var likelyFeatureToken = /* @__PURE__ */ new Set([Colon, RightParenthesis, EOF]);
var name12 = "Condition";
var structure12 = {
  kind: String,
  children: [[
    "Identifier",
    "Feature",
    "FeatureFunction",
    "FeatureRange",
    "SupportsDeclaration"
  ]]
};
function featureOrRange(kind) {
  if (this.lookupTypeNonSC(1) === Ident && likelyFeatureToken.has(this.lookupTypeNonSC(2))) {
    return this.Feature(kind);
  }
  return this.FeatureRange(kind);
}
var parentheses = {
  media: featureOrRange,
  container: featureOrRange,
  supports() {
    return this.SupportsDeclaration();
  }
};
function parse12(kind = "media") {
  const children = this.createList();
  scan: while (!this.eof) {
    switch (this.tokenType) {
      case Comment:
      case WhiteSpace:
        this.next();
        continue;
      case Ident:
        children.push(this.Identifier());
        break;
      case LeftParenthesis: {
        let term = this.parseWithFallback(
          () => parentheses[kind].call(this, kind),
          () => null
        );
        if (!term) {
          term = this.parseWithFallback(
            () => {
              this.eat(LeftParenthesis);
              const res = this.Condition(kind);
              this.eat(RightParenthesis);
              return res;
            },
            () => {
              return this.GeneralEnclosed(kind);
            }
          );
        }
        children.push(term);
        break;
      }
      case Function: {
        let term = this.parseWithFallback(
          () => this.FeatureFunction(kind),
          () => null
        );
        if (!term) {
          term = this.GeneralEnclosed(kind);
        }
        children.push(term);
        break;
      }
      default:
        break scan;
    }
  }
  if (children.isEmpty) {
    this.error("Condition is expected");
  }
  return {
    type: "Condition",
    loc: this.getLocationFromList(children),
    kind,
    children
  };
}
function generate12(node) {
  node.children.forEach((child) => {
    if (child.type === "Condition") {
      this.token(LeftParenthesis, "(");
      this.node(child);
      this.token(RightParenthesis, ")");
    } else {
      this.node(child);
    }
  });
}

// node_modules/css-tree/lib/syntax/node/Declaration.js
var Declaration_exports = {};
__export(Declaration_exports, {
  generate: () => generate13,
  name: () => name13,
  parse: () => parse13,
  structure: () => structure13,
  walkContext: () => walkContext4
});

// node_modules/css-tree/lib/utils/names.js
var HYPHENMINUS3 = 45;
function isCustomProperty(str, offset) {
  offset = offset || 0;
  return str.length - offset >= 2 && str.charCodeAt(offset) === HYPHENMINUS3 && str.charCodeAt(offset + 1) === HYPHENMINUS3;
}

// node_modules/css-tree/lib/syntax/node/Declaration.js
var EXCLAMATIONMARK2 = 33;
var NUMBERSIGN4 = 35;
var DOLLARSIGN2 = 36;
var AMPERSAND3 = 38;
var ASTERISK5 = 42;
var PLUSSIGN5 = 43;
var SOLIDUS5 = 47;
function consumeValueRaw() {
  return this.Raw(this.consumeUntilExclamationMarkOrSemicolon, true);
}
function consumeCustomPropertyRaw() {
  return this.Raw(this.consumeUntilExclamationMarkOrSemicolon, false);
}
function consumeValue() {
  const startValueToken = this.tokenIndex;
  const value = this.Value();
  if (value.type !== "Raw" && this.eof === false && this.tokenType !== Semicolon && this.isDelim(EXCLAMATIONMARK2) === false && this.isBalanceEdge(startValueToken) === false) {
    this.error();
  }
  return value;
}
var name13 = "Declaration";
var walkContext4 = "declaration";
var structure13 = {
  important: [Boolean, String],
  property: String,
  value: ["Value", "Raw"]
};
function parse13() {
  const start = this.tokenStart;
  const startToken = this.tokenIndex;
  const property = readProperty.call(this);
  const customProperty = isCustomProperty(property);
  const parseValue = customProperty ? this.parseCustomProperty : this.parseValue;
  const consumeRaw6 = customProperty ? consumeCustomPropertyRaw : consumeValueRaw;
  let important = false;
  let value;
  this.skipSC();
  this.eat(Colon);
  const valueStart = this.tokenIndex;
  if (!customProperty) {
    this.skipSC();
  }
  if (parseValue) {
    value = this.parseWithFallback(consumeValue, consumeRaw6);
  } else {
    value = consumeRaw6.call(this, this.tokenIndex);
  }
  if (customProperty && value.type === "Value" && value.children.isEmpty) {
    for (let offset = valueStart - this.tokenIndex; offset <= 0; offset++) {
      if (this.lookupType(offset) === WhiteSpace) {
        value.children.appendData({
          type: "WhiteSpace",
          loc: null,
          value: " "
        });
        break;
      }
    }
  }
  if (this.isDelim(EXCLAMATIONMARK2)) {
    important = getImportant.call(this);
    this.skipSC();
  }
  if (this.eof === false && this.tokenType !== Semicolon && this.isBalanceEdge(startToken) === false) {
    this.error();
  }
  return {
    type: "Declaration",
    loc: this.getLocation(start, this.tokenStart),
    important,
    property,
    value
  };
}
function generate13(node) {
  this.token(Ident, node.property);
  this.token(Colon, ":");
  this.node(node.value);
  if (node.important) {
    this.token(Delim, "!");
    this.token(Ident, node.important === true ? "important" : node.important);
  }
}
function readProperty() {
  const start = this.tokenStart;
  if (this.tokenType === Delim) {
    switch (this.charCodeAt(this.tokenStart)) {
      case ASTERISK5:
      case DOLLARSIGN2:
      case PLUSSIGN5:
      case NUMBERSIGN4:
      case AMPERSAND3:
        this.next();
        break;
      // TODO: not sure we should support this hack
      case SOLIDUS5:
        this.next();
        if (this.isDelim(SOLIDUS5)) {
          this.next();
        }
        break;
    }
  }
  if (this.tokenType === Hash) {
    this.eat(Hash);
  } else {
    this.eat(Ident);
  }
  return this.substrToCursor(start);
}
function getImportant() {
  this.eat(Delim);
  this.skipSC();
  const important = this.consume(Ident);
  return important === "important" ? true : important;
}

// node_modules/css-tree/lib/syntax/node/DeclarationList.js
var DeclarationList_exports = {};
__export(DeclarationList_exports, {
  generate: () => generate14,
  name: () => name14,
  parse: () => parse14,
  structure: () => structure14
});
var AMPERSAND4 = 38;
function consumeRaw3() {
  return this.Raw(this.consumeUntilSemicolonIncluded, true);
}
var name14 = "DeclarationList";
var structure14 = {
  children: [[
    "Declaration",
    "Atrule",
    "Rule"
  ]]
};
function parse14() {
  const children = this.createList();
  scan:
    while (!this.eof) {
      switch (this.tokenType) {
        case WhiteSpace:
        case Comment:
        case Semicolon:
          this.next();
          break;
        case AtKeyword:
          children.push(this.parseWithFallback(this.Atrule.bind(this, true), consumeRaw3));
          break;
        default:
          if (this.isDelim(AMPERSAND4)) {
            children.push(this.parseWithFallback(this.Rule, consumeRaw3));
          } else {
            children.push(this.parseWithFallback(this.Declaration, consumeRaw3));
          }
      }
    }
  return {
    type: "DeclarationList",
    loc: this.getLocationFromList(children),
    children
  };
}
function generate14(node) {
  this.children(node, (prev) => {
    if (prev.type === "Declaration") {
      this.token(Semicolon, ";");
    }
  });
}

// node_modules/css-tree/lib/syntax/node/Dimension.js
var Dimension_exports = {};
__export(Dimension_exports, {
  generate: () => generate15,
  name: () => name15,
  parse: () => parse15,
  structure: () => structure15
});
var name15 = "Dimension";
var structure15 = {
  value: String,
  unit: String
};
function parse15() {
  const start = this.tokenStart;
  const value = this.consumeNumber(Dimension);
  return {
    type: "Dimension",
    loc: this.getLocation(start, this.tokenStart),
    value,
    unit: this.substring(start + value.length, this.tokenStart)
  };
}
function generate15(node) {
  this.token(Dimension, node.value + node.unit);
}

// node_modules/css-tree/lib/syntax/node/Feature.js
var Feature_exports = {};
__export(Feature_exports, {
  generate: () => generate16,
  name: () => name16,
  parse: () => parse16,
  structure: () => structure16
});
var SOLIDUS6 = 47;
var name16 = "Feature";
var structure16 = {
  kind: String,
  name: String,
  value: ["Identifier", "Number", "Dimension", "Ratio", "Function", null]
};
function parse16(kind) {
  const start = this.tokenStart;
  let name50;
  let value = null;
  this.eat(LeftParenthesis);
  this.skipSC();
  name50 = this.consume(Ident);
  this.skipSC();
  if (this.tokenType !== RightParenthesis) {
    this.eat(Colon);
    this.skipSC();
    switch (this.tokenType) {
      case Number:
        if (this.lookupNonWSType(1) === Delim) {
          value = this.Ratio();
        } else {
          value = this.Number();
        }
        break;
      case Dimension:
        value = this.Dimension();
        break;
      case Ident:
        value = this.Identifier();
        break;
      case Function:
        value = this.parseWithFallback(
          () => {
            const res = this.Function(this.readSequence, this.scope.Value);
            this.skipSC();
            if (this.isDelim(SOLIDUS6)) {
              this.error();
            }
            return res;
          },
          () => {
            return this.Ratio();
          }
        );
        break;
      default:
        this.error("Number, dimension, ratio or identifier is expected");
    }
    this.skipSC();
  }
  if (!this.eof) {
    this.eat(RightParenthesis);
  }
  return {
    type: "Feature",
    loc: this.getLocation(start, this.tokenStart),
    kind,
    name: name50,
    value
  };
}
function generate16(node) {
  this.token(LeftParenthesis, "(");
  this.token(Ident, node.name);
  if (node.value !== null) {
    this.token(Colon, ":");
    this.node(node.value);
  }
  this.token(RightParenthesis, ")");
}

// node_modules/css-tree/lib/syntax/node/FeatureFunction.js
var FeatureFunction_exports = {};
__export(FeatureFunction_exports, {
  generate: () => generate17,
  name: () => name17,
  parse: () => parse17,
  structure: () => structure17
});
var name17 = "FeatureFunction";
var structure17 = {
  kind: String,
  feature: String,
  value: ["Declaration", "Selector"]
};
function getFeatureParser(kind, name50) {
  const featuresOfKind = this.features[kind] || {};
  const parser = featuresOfKind[name50];
  if (typeof parser !== "function") {
    this.error(`Unknown feature ${name50}()`);
  }
  return parser;
}
function parse17(kind = "unknown") {
  const start = this.tokenStart;
  const functionName = this.consumeFunctionName();
  const valueParser = getFeatureParser.call(this, kind, functionName.toLowerCase());
  this.skipSC();
  const value = this.parseWithFallback(
    () => {
      const startValueToken = this.tokenIndex;
      const value2 = valueParser.call(this);
      if (this.eof === false && this.isBalanceEdge(startValueToken) === false) {
        this.error();
      }
      return value2;
    },
    () => this.Raw(null, false)
  );
  if (!this.eof) {
    this.eat(RightParenthesis);
  }
  return {
    type: "FeatureFunction",
    loc: this.getLocation(start, this.tokenStart),
    kind,
    feature: functionName,
    value
  };
}
function generate17(node) {
  this.token(Function, node.feature + "(");
  this.node(node.value);
  this.token(RightParenthesis, ")");
}

// node_modules/css-tree/lib/syntax/node/FeatureRange.js
var FeatureRange_exports = {};
__export(FeatureRange_exports, {
  generate: () => generate18,
  name: () => name18,
  parse: () => parse18,
  structure: () => structure18
});
var SOLIDUS7 = 47;
var LESSTHANSIGN = 60;
var EQUALSSIGN2 = 61;
var GREATERTHANSIGN3 = 62;
var name18 = "FeatureRange";
var structure18 = {
  kind: String,
  left: ["Identifier", "Number", "Dimension", "Ratio", "Function"],
  leftComparison: String,
  middle: ["Identifier", "Number", "Dimension", "Ratio", "Function"],
  rightComparison: [String, null],
  right: ["Identifier", "Number", "Dimension", "Ratio", "Function", null]
};
function readTerm() {
  this.skipSC();
  switch (this.tokenType) {
    case Number:
      if (this.isDelim(SOLIDUS7, this.lookupOffsetNonSC(1))) {
        return this.Ratio();
      } else {
        return this.Number();
      }
    case Dimension:
      return this.Dimension();
    case Ident:
      return this.Identifier();
    case Function:
      return this.parseWithFallback(
        () => {
          const res = this.Function(this.readSequence, this.scope.Value);
          this.skipSC();
          if (this.isDelim(SOLIDUS7)) {
            this.error();
          }
          return res;
        },
        () => {
          return this.Ratio();
        }
      );
    default:
      this.error("Number, dimension, ratio or identifier is expected");
  }
}
function readComparison(expectColon) {
  this.skipSC();
  if (this.isDelim(LESSTHANSIGN) || this.isDelim(GREATERTHANSIGN3)) {
    const value = this.source[this.tokenStart];
    this.next();
    if (this.isDelim(EQUALSSIGN2)) {
      this.next();
      return value + "=";
    }
    return value;
  }
  if (this.isDelim(EQUALSSIGN2)) {
    return "=";
  }
  this.error(`Expected ${expectColon ? '":", ' : ""}"<", ">", "=" or ")"`);
}
function parse18(kind = "unknown") {
  const start = this.tokenStart;
  this.skipSC();
  this.eat(LeftParenthesis);
  const left = readTerm.call(this);
  const leftComparison = readComparison.call(this, left.type === "Identifier");
  const middle = readTerm.call(this);
  let rightComparison = null;
  let right = null;
  if (this.lookupNonWSType(0) !== RightParenthesis) {
    rightComparison = readComparison.call(this);
    right = readTerm.call(this);
  }
  this.skipSC();
  this.eat(RightParenthesis);
  return {
    type: "FeatureRange",
    loc: this.getLocation(start, this.tokenStart),
    kind,
    left,
    leftComparison,
    middle,
    rightComparison,
    right
  };
}
function generate18(node) {
  this.token(LeftParenthesis, "(");
  this.node(node.left);
  this.tokenize(node.leftComparison);
  this.node(node.middle);
  if (node.right) {
    this.tokenize(node.rightComparison);
    this.node(node.right);
  }
  this.token(RightParenthesis, ")");
}

// node_modules/css-tree/lib/syntax/node/Function.js
var Function_exports = {};
__export(Function_exports, {
  generate: () => generate19,
  name: () => name19,
  parse: () => parse19,
  structure: () => structure19,
  walkContext: () => walkContext5
});
var name19 = "Function";
var walkContext5 = "function";
var structure19 = {
  name: String,
  children: [[]]
};
function parse19(readSequence2, recognizer) {
  const start = this.tokenStart;
  const name50 = this.consumeFunctionName();
  const nameLowerCase = name50.toLowerCase();
  let children;
  children = recognizer.hasOwnProperty(nameLowerCase) ? recognizer[nameLowerCase].call(this, recognizer) : readSequence2.call(this, recognizer);
  if (!this.eof) {
    this.eat(RightParenthesis);
  }
  return {
    type: "Function",
    loc: this.getLocation(start, this.tokenStart),
    name: name50,
    children
  };
}
function generate19(node) {
  this.token(Function, node.name + "(");
  this.children(node);
  this.token(RightParenthesis, ")");
}

// node_modules/css-tree/lib/syntax/node/GeneralEnclosed.js
var GeneralEnclosed_exports = {};
__export(GeneralEnclosed_exports, {
  generate: () => generate20,
  name: () => name20,
  parse: () => parse20,
  structure: () => structure20
});
var name20 = "GeneralEnclosed";
var structure20 = {
  kind: String,
  function: [String, null],
  children: [[]]
};
function parse20(kind) {
  const start = this.tokenStart;
  let functionName = null;
  if (this.tokenType === Function) {
    functionName = this.consumeFunctionName();
  } else {
    this.eat(LeftParenthesis);
  }
  const children = this.parseWithFallback(
    () => {
      const startValueToken = this.tokenIndex;
      const children2 = this.readSequence(this.scope.Value);
      if (this.eof === false && this.isBalanceEdge(startValueToken) === false) {
        this.error();
      }
      return children2;
    },
    () => this.createSingleNodeList(
      this.Raw(null, false)
    )
  );
  if (!this.eof) {
    this.eat(RightParenthesis);
  }
  return {
    type: "GeneralEnclosed",
    loc: this.getLocation(start, this.tokenStart),
    kind,
    function: functionName,
    children
  };
}
function generate20(node) {
  if (node.function) {
    this.token(Function, node.function + "(");
  } else {
    this.token(LeftParenthesis, "(");
  }
  this.children(node);
  this.token(RightParenthesis, ")");
}

// node_modules/css-tree/lib/syntax/node/Hash.js
var Hash_exports = {};
__export(Hash_exports, {
  generate: () => generate21,
  name: () => name21,
  parse: () => parse21,
  structure: () => structure21,
  xxx: () => xxx
});
var xxx = "XXX";
var name21 = "Hash";
var structure21 = {
  value: String
};
function parse21() {
  const start = this.tokenStart;
  this.eat(Hash);
  return {
    type: "Hash",
    loc: this.getLocation(start, this.tokenStart),
    value: this.substrToCursor(start + 1)
  };
}
function generate21(node) {
  this.token(Hash, "#" + node.value);
}

// node_modules/css-tree/lib/syntax/node/Identifier.js
var Identifier_exports = {};
__export(Identifier_exports, {
  generate: () => generate22,
  name: () => name22,
  parse: () => parse22,
  structure: () => structure22
});
var name22 = "Identifier";
var structure22 = {
  name: String
};
function parse22() {
  return {
    type: "Identifier",
    loc: this.getLocation(this.tokenStart, this.tokenEnd),
    name: this.consume(Ident)
  };
}
function generate22(node) {
  this.token(Ident, node.name);
}

// node_modules/css-tree/lib/syntax/node/IdSelector.js
var IdSelector_exports = {};
__export(IdSelector_exports, {
  generate: () => generate23,
  name: () => name23,
  parse: () => parse23,
  structure: () => structure23
});
var name23 = "IdSelector";
var structure23 = {
  name: String
};
function parse23() {
  const start = this.tokenStart;
  this.eat(Hash);
  return {
    type: "IdSelector",
    loc: this.getLocation(start, this.tokenStart),
    name: this.substrToCursor(start + 1)
  };
}
function generate23(node) {
  this.token(Delim, "#" + node.name);
}

// node_modules/css-tree/lib/syntax/node/Layer.js
var Layer_exports = {};
__export(Layer_exports, {
  generate: () => generate24,
  name: () => name24,
  parse: () => parse24,
  structure: () => structure24
});
var FULLSTOP3 = 46;
var name24 = "Layer";
var structure24 = {
  name: String
};
function parse24() {
  let tokenStart = this.tokenStart;
  let name50 = this.consume(Ident);
  while (this.isDelim(FULLSTOP3)) {
    this.eat(Delim);
    name50 += "." + this.consume(Ident);
  }
  return {
    type: "Layer",
    loc: this.getLocation(tokenStart, this.tokenStart),
    name: name50
  };
}
function generate24(node) {
  this.tokenize(node.name);
}

// node_modules/css-tree/lib/syntax/node/LayerList.js
var LayerList_exports = {};
__export(LayerList_exports, {
  generate: () => generate25,
  name: () => name25,
  parse: () => parse25,
  structure: () => structure25
});
var name25 = "LayerList";
var structure25 = {
  children: [[
    "Layer"
  ]]
};
function parse25() {
  const children = this.createList();
  this.skipSC();
  while (!this.eof) {
    children.push(this.Layer());
    if (this.lookupTypeNonSC(0) !== Comma) {
      break;
    }
    this.skipSC();
    this.next();
    this.skipSC();
  }
  return {
    type: "LayerList",
    loc: this.getLocationFromList(children),
    children
  };
}
function generate25(node) {
  this.children(node, () => this.token(Comma, ","));
}

// node_modules/css-tree/lib/syntax/node/MediaQuery.js
var MediaQuery_exports = {};
__export(MediaQuery_exports, {
  generate: () => generate26,
  name: () => name26,
  parse: () => parse26,
  structure: () => structure26
});
var name26 = "MediaQuery";
var structure26 = {
  modifier: [String, null],
  mediaType: [String, null],
  condition: ["Condition", null]
};
function parse26() {
  const start = this.tokenStart;
  let modifier = null;
  let mediaType = null;
  let condition = null;
  this.skipSC();
  if (this.tokenType === Ident && this.lookupTypeNonSC(1) !== LeftParenthesis) {
    const ident = this.consume(Ident);
    const identLowerCase = ident.toLowerCase();
    if (identLowerCase === "not" || identLowerCase === "only") {
      this.skipSC();
      modifier = identLowerCase;
      mediaType = this.consume(Ident);
    } else {
      mediaType = ident;
    }
    switch (this.lookupTypeNonSC(0)) {
      case Ident: {
        this.skipSC();
        this.eatIdent("and");
        condition = this.Condition("media");
        break;
      }
      case LeftCurlyBracket:
      case Semicolon:
      case Comma:
      case EOF:
        break;
      default:
        this.error("Identifier or parenthesis is expected");
    }
  } else {
    switch (this.tokenType) {
      case Ident:
      case LeftParenthesis:
      case Function: {
        condition = this.Condition("media");
        break;
      }
      case LeftCurlyBracket:
      case Semicolon:
      case EOF:
        break;
      default:
        this.error("Identifier or parenthesis is expected");
    }
  }
  return {
    type: "MediaQuery",
    loc: this.getLocation(start, this.tokenStart),
    modifier,
    mediaType,
    condition
  };
}
function generate26(node) {
  if (node.mediaType) {
    if (node.modifier) {
      this.token(Ident, node.modifier);
    }
    this.token(Ident, node.mediaType);
    if (node.condition) {
      this.token(Ident, "and");
      this.node(node.condition);
    }
  } else if (node.condition) {
    this.node(node.condition);
  }
}

// node_modules/css-tree/lib/syntax/node/MediaQueryList.js
var MediaQueryList_exports = {};
__export(MediaQueryList_exports, {
  generate: () => generate27,
  name: () => name27,
  parse: () => parse27,
  structure: () => structure27
});
var name27 = "MediaQueryList";
var structure27 = {
  children: [[
    "MediaQuery"
  ]]
};
function parse27() {
  const children = this.createList();
  this.skipSC();
  while (!this.eof) {
    children.push(this.MediaQuery());
    if (this.tokenType !== Comma) {
      break;
    }
    this.next();
  }
  return {
    type: "MediaQueryList",
    loc: this.getLocationFromList(children),
    children
  };
}
function generate27(node) {
  this.children(node, () => this.token(Comma, ","));
}

// node_modules/css-tree/lib/syntax/node/NestingSelector.js
var NestingSelector_exports = {};
__export(NestingSelector_exports, {
  generate: () => generate28,
  name: () => name28,
  parse: () => parse28,
  structure: () => structure28
});
var AMPERSAND5 = 38;
var name28 = "NestingSelector";
var structure28 = {};
function parse28() {
  const start = this.tokenStart;
  this.eatDelim(AMPERSAND5);
  return {
    type: "NestingSelector",
    loc: this.getLocation(start, this.tokenStart)
  };
}
function generate28() {
  this.token(Delim, "&");
}

// node_modules/css-tree/lib/syntax/node/Nth.js
var Nth_exports = {};
__export(Nth_exports, {
  generate: () => generate29,
  name: () => name29,
  parse: () => parse29,
  structure: () => structure29
});
var name29 = "Nth";
var structure29 = {
  nth: ["AnPlusB", "Identifier"],
  selector: ["SelectorList", null]
};
function parse29() {
  this.skipSC();
  const start = this.tokenStart;
  let end = start;
  let selector2 = null;
  let nth2;
  if (this.lookupValue(0, "odd") || this.lookupValue(0, "even")) {
    nth2 = this.Identifier();
  } else {
    nth2 = this.AnPlusB();
  }
  end = this.tokenStart;
  this.skipSC();
  if (this.lookupValue(0, "of")) {
    this.next();
    selector2 = this.SelectorList();
    end = this.tokenStart;
  }
  return {
    type: "Nth",
    loc: this.getLocation(start, end),
    nth: nth2,
    selector: selector2
  };
}
function generate29(node) {
  this.node(node.nth);
  if (node.selector !== null) {
    this.token(Ident, "of");
    this.node(node.selector);
  }
}

// node_modules/css-tree/lib/syntax/node/Number.js
var Number_exports = {};
__export(Number_exports, {
  generate: () => generate30,
  name: () => name30,
  parse: () => parse30,
  structure: () => structure30
});
var name30 = "Number";
var structure30 = {
  value: String
};
function parse30() {
  return {
    type: "Number",
    loc: this.getLocation(this.tokenStart, this.tokenEnd),
    value: this.consume(Number)
  };
}
function generate30(node) {
  this.token(Number, node.value);
}

// node_modules/css-tree/lib/syntax/node/Operator.js
var Operator_exports = {};
__export(Operator_exports, {
  generate: () => generate31,
  name: () => name31,
  parse: () => parse31,
  structure: () => structure31
});
var name31 = "Operator";
var structure31 = {
  value: String
};
function parse31() {
  const start = this.tokenStart;
  this.next();
  return {
    type: "Operator",
    loc: this.getLocation(start, this.tokenStart),
    value: this.substrToCursor(start)
  };
}
function generate31(node) {
  this.tokenize(node.value);
}

// node_modules/css-tree/lib/syntax/node/Parentheses.js
var Parentheses_exports = {};
__export(Parentheses_exports, {
  generate: () => generate32,
  name: () => name32,
  parse: () => parse32,
  structure: () => structure32
});
var name32 = "Parentheses";
var structure32 = {
  children: [[]]
};
function parse32(readSequence2, recognizer) {
  const start = this.tokenStart;
  let children = null;
  this.eat(LeftParenthesis);
  children = readSequence2.call(this, recognizer);
  if (!this.eof) {
    this.eat(RightParenthesis);
  }
  return {
    type: "Parentheses",
    loc: this.getLocation(start, this.tokenStart),
    children
  };
}
function generate32(node) {
  this.token(LeftParenthesis, "(");
  this.children(node);
  this.token(RightParenthesis, ")");
}

// node_modules/css-tree/lib/syntax/node/Percentage.js
var Percentage_exports = {};
__export(Percentage_exports, {
  generate: () => generate33,
  name: () => name33,
  parse: () => parse33,
  structure: () => structure33
});
var name33 = "Percentage";
var structure33 = {
  value: String
};
function parse33() {
  return {
    type: "Percentage",
    loc: this.getLocation(this.tokenStart, this.tokenEnd),
    value: this.consumeNumber(Percentage)
  };
}
function generate33(node) {
  this.token(Percentage, node.value + "%");
}

// node_modules/css-tree/lib/syntax/node/PseudoClassSelector.js
var PseudoClassSelector_exports = {};
__export(PseudoClassSelector_exports, {
  generate: () => generate34,
  name: () => name34,
  parse: () => parse34,
  structure: () => structure34,
  walkContext: () => walkContext6
});
var name34 = "PseudoClassSelector";
var walkContext6 = "function";
var structure34 = {
  name: String,
  children: [["Raw"], null]
};
function parse34() {
  const start = this.tokenStart;
  let children = null;
  let name50;
  let nameLowerCase;
  this.eat(Colon);
  if (this.tokenType === Function) {
    name50 = this.consumeFunctionName();
    nameLowerCase = name50.toLowerCase();
    if (this.lookupNonWSType(0) == RightParenthesis) {
      children = this.createList();
    } else if (hasOwnProperty.call(this.pseudo, nameLowerCase)) {
      this.skipSC();
      children = this.pseudo[nameLowerCase].call(this);
      this.skipSC();
    } else {
      children = this.createList();
      children.push(
        this.Raw(null, false)
      );
    }
    this.eat(RightParenthesis);
  } else {
    name50 = this.consume(Ident);
  }
  return {
    type: "PseudoClassSelector",
    loc: this.getLocation(start, this.tokenStart),
    name: name50,
    children
  };
}
function generate34(node) {
  this.token(Colon, ":");
  if (node.children === null) {
    this.token(Ident, node.name);
  } else {
    this.token(Function, node.name + "(");
    this.children(node);
    this.token(RightParenthesis, ")");
  }
}

// node_modules/css-tree/lib/syntax/node/PseudoElementSelector.js
var PseudoElementSelector_exports = {};
__export(PseudoElementSelector_exports, {
  generate: () => generate35,
  name: () => name35,
  parse: () => parse35,
  structure: () => structure35,
  walkContext: () => walkContext7
});
var name35 = "PseudoElementSelector";
var walkContext7 = "function";
var structure35 = {
  name: String,
  children: [["Raw"], null]
};
function parse35() {
  const start = this.tokenStart;
  let children = null;
  let name50;
  let nameLowerCase;
  this.eat(Colon);
  this.eat(Colon);
  if (this.tokenType === Function) {
    name50 = this.consumeFunctionName();
    nameLowerCase = name50.toLowerCase();
    if (this.lookupNonWSType(0) == RightParenthesis) {
      children = this.createList();
    } else if (hasOwnProperty.call(this.pseudo, nameLowerCase)) {
      this.skipSC();
      children = this.pseudo[nameLowerCase].call(this);
      this.skipSC();
    } else {
      children = this.createList();
      children.push(
        this.Raw(null, false)
      );
    }
    this.eat(RightParenthesis);
  } else {
    name50 = this.consume(Ident);
  }
  return {
    type: "PseudoElementSelector",
    loc: this.getLocation(start, this.tokenStart),
    name: name50,
    children
  };
}
function generate35(node) {
  this.token(Colon, ":");
  this.token(Colon, ":");
  if (node.children === null) {
    this.token(Ident, node.name);
  } else {
    this.token(Function, node.name + "(");
    this.children(node);
    this.token(RightParenthesis, ")");
  }
}

// node_modules/css-tree/lib/syntax/node/Ratio.js
var Ratio_exports = {};
__export(Ratio_exports, {
  generate: () => generate36,
  name: () => name36,
  parse: () => parse36,
  structure: () => structure36
});
var SOLIDUS8 = 47;
function consumeTerm() {
  this.skipSC();
  switch (this.tokenType) {
    case Number:
      return this.Number();
    case Function:
      return this.Function(this.readSequence, this.scope.Value);
    default:
      this.error("Number of function is expected");
  }
}
var name36 = "Ratio";
var structure36 = {
  left: ["Number", "Function"],
  right: ["Number", "Function", null]
};
function parse36() {
  const start = this.tokenStart;
  const left = consumeTerm.call(this);
  let right = null;
  this.skipSC();
  if (this.isDelim(SOLIDUS8)) {
    this.eatDelim(SOLIDUS8);
    right = consumeTerm.call(this);
  }
  return {
    type: "Ratio",
    loc: this.getLocation(start, this.tokenStart),
    left,
    right
  };
}
function generate36(node) {
  this.node(node.left);
  this.token(Delim, "/");
  if (node.right) {
    this.node(node.right);
  } else {
    this.node(Number, 1);
  }
}

// node_modules/css-tree/lib/syntax/node/Raw.js
var Raw_exports = {};
__export(Raw_exports, {
  generate: () => generate37,
  name: () => name37,
  parse: () => parse37,
  structure: () => structure37
});
function getOffsetExcludeWS() {
  if (this.tokenIndex > 0) {
    if (this.lookupType(-1) === WhiteSpace) {
      return this.tokenIndex > 1 ? this.getTokenStart(this.tokenIndex - 1) : this.firstCharOffset;
    }
  }
  return this.tokenStart;
}
var name37 = "Raw";
var structure37 = {
  value: String
};
function parse37(consumeUntil, excludeWhiteSpace) {
  const startOffset = this.getTokenStart(this.tokenIndex);
  let endOffset;
  this.skipUntilBalanced(this.tokenIndex, consumeUntil || this.consumeUntilBalanceEnd);
  if (excludeWhiteSpace && this.tokenStart > startOffset) {
    endOffset = getOffsetExcludeWS.call(this);
  } else {
    endOffset = this.tokenStart;
  }
  return {
    type: "Raw",
    loc: this.getLocation(startOffset, endOffset),
    value: this.substring(startOffset, endOffset)
  };
}
function generate37(node) {
  this.tokenize(node.value);
}

// node_modules/css-tree/lib/syntax/node/Rule.js
var Rule_exports = {};
__export(Rule_exports, {
  generate: () => generate38,
  name: () => name38,
  parse: () => parse38,
  structure: () => structure38,
  walkContext: () => walkContext8
});
function consumeRaw4() {
  return this.Raw(this.consumeUntilLeftCurlyBracket, true);
}
function consumePrelude() {
  const prelude = this.SelectorList();
  if (prelude.type !== "Raw" && this.eof === false && this.tokenType !== LeftCurlyBracket) {
    this.error();
  }
  return prelude;
}
var name38 = "Rule";
var walkContext8 = "rule";
var structure38 = {
  prelude: ["SelectorList", "Raw"],
  block: ["Block"]
};
function parse38() {
  const startToken = this.tokenIndex;
  const startOffset = this.tokenStart;
  let prelude;
  let block;
  if (this.parseRulePrelude) {
    prelude = this.parseWithFallback(consumePrelude, consumeRaw4);
  } else {
    prelude = consumeRaw4.call(this, startToken);
  }
  block = this.Block(true);
  return {
    type: "Rule",
    loc: this.getLocation(startOffset, this.tokenStart),
    prelude,
    block
  };
}
function generate38(node) {
  this.node(node.prelude);
  this.node(node.block);
}

// node_modules/css-tree/lib/syntax/node/Scope.js
var Scope_exports = {};
__export(Scope_exports, {
  generate: () => generate39,
  name: () => name39,
  parse: () => parse39,
  structure: () => structure39
});
var name39 = "Scope";
var structure39 = {
  root: ["SelectorList", "Raw", null],
  limit: ["SelectorList", "Raw", null]
};
function parse39() {
  let root = null;
  let limit = null;
  this.skipSC();
  const startOffset = this.tokenStart;
  if (this.tokenType === LeftParenthesis) {
    this.next();
    this.skipSC();
    root = this.parseWithFallback(
      this.SelectorList,
      () => this.Raw(false, true)
    );
    this.skipSC();
    this.eat(RightParenthesis);
  }
  if (this.lookupNonWSType(0) === Ident) {
    this.skipSC();
    this.eatIdent("to");
    this.skipSC();
    this.eat(LeftParenthesis);
    this.skipSC();
    limit = this.parseWithFallback(
      this.SelectorList,
      () => this.Raw(false, true)
    );
    this.skipSC();
    this.eat(RightParenthesis);
  }
  return {
    type: "Scope",
    loc: this.getLocation(startOffset, this.tokenStart),
    root,
    limit
  };
}
function generate39(node) {
  if (node.root) {
    this.token(LeftParenthesis, "(");
    this.node(node.root);
    this.token(RightParenthesis, ")");
  }
  if (node.limit) {
    this.token(Ident, "to");
    this.token(LeftParenthesis, "(");
    this.node(node.limit);
    this.token(RightParenthesis, ")");
  }
}

// node_modules/css-tree/lib/syntax/node/Selector.js
var Selector_exports = {};
__export(Selector_exports, {
  generate: () => generate40,
  name: () => name40,
  parse: () => parse40,
  structure: () => structure40
});
var name40 = "Selector";
var structure40 = {
  children: [[
    "TypeSelector",
    "IdSelector",
    "ClassSelector",
    "AttributeSelector",
    "PseudoClassSelector",
    "PseudoElementSelector",
    "Combinator"
  ]]
};
function parse40() {
  const children = this.readSequence(this.scope.Selector);
  if (this.getFirstListNode(children) === null) {
    this.error("Selector is expected");
  }
  return {
    type: "Selector",
    loc: this.getLocationFromList(children),
    children
  };
}
function generate40(node) {
  this.children(node);
}

// node_modules/css-tree/lib/syntax/node/SelectorList.js
var SelectorList_exports = {};
__export(SelectorList_exports, {
  generate: () => generate41,
  name: () => name41,
  parse: () => parse41,
  structure: () => structure41,
  walkContext: () => walkContext9
});
var name41 = "SelectorList";
var walkContext9 = "selector";
var structure41 = {
  children: [[
    "Selector",
    "Raw"
  ]]
};
function parse41() {
  const children = this.createList();
  while (!this.eof) {
    children.push(this.Selector());
    if (this.tokenType === Comma) {
      this.next();
      continue;
    }
    break;
  }
  return {
    type: "SelectorList",
    loc: this.getLocationFromList(children),
    children
  };
}
function generate41(node) {
  this.children(node, () => this.token(Comma, ","));
}

// node_modules/css-tree/lib/syntax/node/String.js
var String_exports = {};
__export(String_exports, {
  generate: () => generate42,
  name: () => name42,
  parse: () => parse42,
  structure: () => structure42
});

// node_modules/css-tree/lib/utils/string.js
var REVERSE_SOLIDUS = 92;
var QUOTATION_MARK = 34;
var APOSTROPHE = 39;
function decode(str) {
  const len = str.length;
  const firstChar = str.charCodeAt(0);
  const start = firstChar === QUOTATION_MARK || firstChar === APOSTROPHE ? 1 : 0;
  const end = start === 1 && len > 1 && str.charCodeAt(len - 1) === firstChar ? len - 2 : len - 1;
  let decoded = "";
  for (let i = start; i <= end; i++) {
    let code = str.charCodeAt(i);
    if (code === REVERSE_SOLIDUS) {
      if (i === end) {
        if (i !== len - 1) {
          decoded = str.substr(i + 1);
        }
        break;
      }
      code = str.charCodeAt(++i);
      if (isValidEscape(REVERSE_SOLIDUS, code)) {
        const escapeStart = i - 1;
        const escapeEnd = consumeEscaped(str, escapeStart);
        i = escapeEnd - 1;
        decoded += decodeEscaped(str.substring(escapeStart + 1, escapeEnd));
      } else {
        if (code === 13 && str.charCodeAt(i + 1) === 10) {
          i++;
        }
      }
    } else {
      decoded += str[i];
    }
  }
  return decoded;
}
function encode(str, apostrophe) {
  const quote = apostrophe ? "'" : '"';
  const quoteCode = apostrophe ? APOSTROPHE : QUOTATION_MARK;
  let encoded = "";
  let wsBeforeHexIsNeeded = false;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code === 0) {
      encoded += "\uFFFD";
      continue;
    }
    if (code <= 31 || code === 127) {
      encoded += "\\" + code.toString(16);
      wsBeforeHexIsNeeded = true;
      continue;
    }
    if (code === quoteCode || code === REVERSE_SOLIDUS) {
      encoded += "\\" + str.charAt(i);
      wsBeforeHexIsNeeded = false;
    } else {
      if (wsBeforeHexIsNeeded && (isHexDigit(code) || isWhiteSpace(code))) {
        encoded += " ";
      }
      encoded += str.charAt(i);
      wsBeforeHexIsNeeded = false;
    }
  }
  return quote + encoded + quote;
}

// node_modules/css-tree/lib/syntax/node/String.js
var name42 = "String";
var structure42 = {
  value: String
};
function parse42() {
  return {
    type: "String",
    loc: this.getLocation(this.tokenStart, this.tokenEnd),
    value: decode(this.consume(String2))
  };
}
function generate42(node) {
  this.token(String2, encode(node.value));
}

// node_modules/css-tree/lib/syntax/node/StyleSheet.js
var StyleSheet_exports = {};
__export(StyleSheet_exports, {
  generate: () => generate43,
  name: () => name43,
  parse: () => parse43,
  structure: () => structure43,
  walkContext: () => walkContext10
});
var EXCLAMATIONMARK3 = 33;
function consumeRaw5() {
  return this.Raw(null, false);
}
var name43 = "StyleSheet";
var walkContext10 = "stylesheet";
var structure43 = {
  children: [[
    "Comment",
    "CDO",
    "CDC",
    "Atrule",
    "Rule",
    "Raw"
  ]]
};
function parse43() {
  const start = this.tokenStart;
  const children = this.createList();
  let child;
  scan:
    while (!this.eof) {
      switch (this.tokenType) {
        case WhiteSpace:
          this.next();
          continue;
        case Comment:
          if (this.charCodeAt(this.tokenStart + 2) !== EXCLAMATIONMARK3) {
            this.next();
            continue;
          }
          child = this.Comment();
          break;
        case CDO:
          child = this.CDO();
          break;
        case CDC:
          child = this.CDC();
          break;
        // CSS Syntax Module Level 3
        // §2.2 Error handling
        // At the "top level" of a stylesheet, an <at-keyword-token> starts an at-rule.
        case AtKeyword:
          child = this.parseWithFallback(this.Atrule, consumeRaw5);
          break;
        // Anything else starts a qualified rule ...
        default:
          child = this.parseWithFallback(this.Rule, consumeRaw5);
      }
      children.push(child);
    }
  return {
    type: "StyleSheet",
    loc: this.getLocation(start, this.tokenStart),
    children
  };
}
function generate43(node) {
  this.children(node);
}

// node_modules/css-tree/lib/syntax/node/SupportsDeclaration.js
var SupportsDeclaration_exports = {};
__export(SupportsDeclaration_exports, {
  generate: () => generate44,
  name: () => name44,
  parse: () => parse44,
  structure: () => structure44
});
var name44 = "SupportsDeclaration";
var structure44 = {
  declaration: "Declaration"
};
function parse44() {
  const start = this.tokenStart;
  this.eat(LeftParenthesis);
  this.skipSC();
  const declaration = this.Declaration();
  if (!this.eof) {
    this.eat(RightParenthesis);
  }
  return {
    type: "SupportsDeclaration",
    loc: this.getLocation(start, this.tokenStart),
    declaration
  };
}
function generate44(node) {
  this.token(LeftParenthesis, "(");
  this.node(node.declaration);
  this.token(RightParenthesis, ")");
}

// node_modules/css-tree/lib/syntax/node/TypeSelector.js
var TypeSelector_exports = {};
__export(TypeSelector_exports, {
  generate: () => generate45,
  name: () => name45,
  parse: () => parse45,
  structure: () => structure45
});
var ASTERISK6 = 42;
var VERTICALLINE3 = 124;
function eatIdentifierOrAsterisk() {
  if (this.tokenType !== Ident && this.isDelim(ASTERISK6) === false) {
    this.error("Identifier or asterisk is expected");
  }
  this.next();
}
var name45 = "TypeSelector";
var structure45 = {
  name: String
};
function parse45() {
  const start = this.tokenStart;
  if (this.isDelim(VERTICALLINE3)) {
    this.next();
    eatIdentifierOrAsterisk.call(this);
  } else {
    eatIdentifierOrAsterisk.call(this);
    if (this.isDelim(VERTICALLINE3)) {
      this.next();
      eatIdentifierOrAsterisk.call(this);
    }
  }
  return {
    type: "TypeSelector",
    loc: this.getLocation(start, this.tokenStart),
    name: this.substrToCursor(start)
  };
}
function generate45(node) {
  this.tokenize(node.name);
}

// node_modules/css-tree/lib/syntax/node/UnicodeRange.js
var UnicodeRange_exports = {};
__export(UnicodeRange_exports, {
  generate: () => generate46,
  name: () => name46,
  parse: () => parse46,
  structure: () => structure46
});
var PLUSSIGN6 = 43;
var HYPHENMINUS4 = 45;
var QUESTIONMARK = 63;
function eatHexSequence(offset, allowDash) {
  let len = 0;
  for (let pos = this.tokenStart + offset; pos < this.tokenEnd; pos++) {
    const code = this.charCodeAt(pos);
    if (code === HYPHENMINUS4 && allowDash && len !== 0) {
      eatHexSequence.call(this, offset + len + 1, false);
      return -1;
    }
    if (!isHexDigit(code)) {
      this.error(
        allowDash && len !== 0 ? "Hyphen minus" + (len < 6 ? " or hex digit" : "") + " is expected" : len < 6 ? "Hex digit is expected" : "Unexpected input",
        pos
      );
    }
    if (++len > 6) {
      this.error("Too many hex digits", pos);
    }
    ;
  }
  this.next();
  return len;
}
function eatQuestionMarkSequence(max) {
  let count = 0;
  while (this.isDelim(QUESTIONMARK)) {
    if (++count > max) {
      this.error("Too many question marks");
    }
    this.next();
  }
}
function startsWith(code) {
  if (this.charCodeAt(this.tokenStart) !== code) {
    this.error((code === PLUSSIGN6 ? "Plus sign" : "Hyphen minus") + " is expected");
  }
}
function scanUnicodeRange() {
  let hexLength = 0;
  switch (this.tokenType) {
    case Number:
      hexLength = eatHexSequence.call(this, 1, true);
      if (this.isDelim(QUESTIONMARK)) {
        eatQuestionMarkSequence.call(this, 6 - hexLength);
        break;
      }
      if (this.tokenType === Dimension || this.tokenType === Number) {
        startsWith.call(this, HYPHENMINUS4);
        eatHexSequence.call(this, 1, false);
        break;
      }
      break;
    case Dimension:
      hexLength = eatHexSequence.call(this, 1, true);
      if (hexLength > 0) {
        eatQuestionMarkSequence.call(this, 6 - hexLength);
      }
      break;
    default:
      this.eatDelim(PLUSSIGN6);
      if (this.tokenType === Ident) {
        hexLength = eatHexSequence.call(this, 0, true);
        if (hexLength > 0) {
          eatQuestionMarkSequence.call(this, 6 - hexLength);
        }
        break;
      }
      if (this.isDelim(QUESTIONMARK)) {
        this.next();
        eatQuestionMarkSequence.call(this, 5);
        break;
      }
      this.error("Hex digit or question mark is expected");
  }
}
var name46 = "UnicodeRange";
var structure46 = {
  value: String
};
function parse46() {
  const start = this.tokenStart;
  this.eatIdent("u");
  scanUnicodeRange.call(this);
  return {
    type: "UnicodeRange",
    loc: this.getLocation(start, this.tokenStart),
    value: this.substrToCursor(start)
  };
}
function generate46(node) {
  this.tokenize(node.value);
}

// node_modules/css-tree/lib/syntax/node/Url.js
var Url_exports = {};
__export(Url_exports, {
  generate: () => generate47,
  name: () => name47,
  parse: () => parse47,
  structure: () => structure47
});

// node_modules/css-tree/lib/utils/url.js
var SPACE = 32;
var REVERSE_SOLIDUS2 = 92;
var QUOTATION_MARK2 = 34;
var APOSTROPHE2 = 39;
var LEFTPARENTHESIS = 40;
var RIGHTPARENTHESIS = 41;
function decode2(str) {
  const len = str.length;
  let start = 4;
  let end = str.charCodeAt(len - 1) === RIGHTPARENTHESIS ? len - 2 : len - 1;
  let decoded = "";
  while (start < end && isWhiteSpace(str.charCodeAt(start))) {
    start++;
  }
  while (start < end && isWhiteSpace(str.charCodeAt(end))) {
    end--;
  }
  for (let i = start; i <= end; i++) {
    let code = str.charCodeAt(i);
    if (code === REVERSE_SOLIDUS2) {
      if (i === end) {
        if (i !== len - 1) {
          decoded = str.substr(i + 1);
        }
        break;
      }
      code = str.charCodeAt(++i);
      if (isValidEscape(REVERSE_SOLIDUS2, code)) {
        const escapeStart = i - 1;
        const escapeEnd = consumeEscaped(str, escapeStart);
        i = escapeEnd - 1;
        decoded += decodeEscaped(str.substring(escapeStart + 1, escapeEnd));
      } else {
        if (code === 13 && str.charCodeAt(i + 1) === 10) {
          i++;
        }
      }
    } else {
      decoded += str[i];
    }
  }
  return decoded;
}
function encode2(str) {
  let encoded = "";
  let wsBeforeHexIsNeeded = false;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code === 0) {
      encoded += "\uFFFD";
      continue;
    }
    if (code <= 31 || code === 127) {
      encoded += "\\" + code.toString(16);
      wsBeforeHexIsNeeded = true;
      continue;
    }
    if (code === SPACE || code === REVERSE_SOLIDUS2 || code === QUOTATION_MARK2 || code === APOSTROPHE2 || code === LEFTPARENTHESIS || code === RIGHTPARENTHESIS) {
      encoded += "\\" + str.charAt(i);
      wsBeforeHexIsNeeded = false;
    } else {
      if (wsBeforeHexIsNeeded && isHexDigit(code)) {
        encoded += " ";
      }
      encoded += str.charAt(i);
      wsBeforeHexIsNeeded = false;
    }
  }
  return "url(" + encoded + ")";
}

// node_modules/css-tree/lib/syntax/node/Url.js
var name47 = "Url";
var structure47 = {
  value: String
};
function parse47() {
  const start = this.tokenStart;
  let value;
  switch (this.tokenType) {
    case Url:
      value = decode2(this.consume(Url));
      break;
    case Function:
      if (!this.cmpStr(this.tokenStart, this.tokenEnd, "url(")) {
        this.error("Function name must be `url`");
      }
      this.eat(Function);
      this.skipSC();
      value = decode(this.consume(String2));
      this.skipSC();
      if (!this.eof) {
        this.eat(RightParenthesis);
      }
      break;
    default:
      this.error("Url or Function is expected");
  }
  return {
    type: "Url",
    loc: this.getLocation(start, this.tokenStart),
    value
  };
}
function generate47(node) {
  this.token(Url, encode2(node.value));
}

// node_modules/css-tree/lib/syntax/node/Value.js
var Value_exports = {};
__export(Value_exports, {
  generate: () => generate48,
  name: () => name48,
  parse: () => parse48,
  structure: () => structure48
});
var name48 = "Value";
var structure48 = {
  children: [[]]
};
function parse48() {
  const start = this.tokenStart;
  const children = this.readSequence(this.scope.Value);
  return {
    type: "Value",
    loc: this.getLocation(start, this.tokenStart),
    children
  };
}
function generate48(node) {
  this.children(node);
}

// node_modules/css-tree/lib/syntax/node/WhiteSpace.js
var WhiteSpace_exports = {};
__export(WhiteSpace_exports, {
  generate: () => generate49,
  name: () => name49,
  parse: () => parse49,
  structure: () => structure49
});
var SPACE2 = Object.freeze({
  type: "WhiteSpace",
  loc: null,
  value: " "
});
var name49 = "WhiteSpace";
var structure49 = {
  value: String
};
function parse49() {
  this.eat(WhiteSpace);
  return SPACE2;
}
function generate49(node) {
  this.token(WhiteSpace, node.value);
}

// node_modules/css-tree/lib/syntax/config/parser.js
var parser_default = {
  parseContext: {
    default: "StyleSheet",
    stylesheet: "StyleSheet",
    atrule: "Atrule",
    atrulePrelude(options) {
      return this.AtrulePrelude(options.atrule ? String(options.atrule) : null);
    },
    mediaQueryList: "MediaQueryList",
    mediaQuery: "MediaQuery",
    condition(options) {
      return this.Condition(options.kind);
    },
    rule: "Rule",
    selectorList: "SelectorList",
    selector: "Selector",
    block() {
      return this.Block(true);
    },
    declarationList: "DeclarationList",
    declaration: "Declaration",
    value: "Value"
  },
  features: {
    supports: {
      selector() {
        return this.Selector();
      }
    },
    container: {
      style() {
        return this.Declaration();
      }
    }
  },
  scope: scope_exports,
  atrule: atrule_default,
  pseudo: pseudo_default,
  node: index_parse_exports
};

// node_modules/css-tree/lib/parser/index.js
var parser_default2 = createParser(parser_default);

export {
  Ident,
  Function,
  AtKeyword,
  Hash,
  String2 as String,
  Url,
  BadUrl,
  Delim,
  Number,
  Percentage,
  Dimension,
  WhiteSpace,
  CDC,
  Colon,
  LeftParenthesis,
  RightParenthesis,
  tokenize,
  generate,
  AnPlusB_exports,
  generate2,
  Atrule_exports,
  generate3,
  AtrulePrelude_exports,
  generate4,
  AttributeSelector_exports,
  generate5,
  Block_exports,
  generate6,
  Brackets_exports,
  generate7,
  CDC_exports,
  generate8,
  CDO_exports,
  generate9,
  ClassSelector_exports,
  generate10,
  Combinator_exports,
  generate11,
  Comment_exports,
  generate12,
  Condition_exports,
  generate13,
  Declaration_exports,
  generate14,
  DeclarationList_exports,
  generate15,
  Dimension_exports,
  generate16,
  Feature_exports,
  generate17,
  FeatureFunction_exports,
  generate18,
  FeatureRange_exports,
  generate19,
  Function_exports,
  generate20,
  GeneralEnclosed_exports,
  generate21,
  Hash_exports,
  generate22,
  Identifier_exports,
  generate23,
  IdSelector_exports,
  generate24,
  Layer_exports,
  generate25,
  LayerList_exports,
  generate26,
  MediaQuery_exports,
  generate27,
  MediaQueryList_exports,
  generate28,
  NestingSelector_exports,
  generate29,
  Nth_exports,
  generate30,
  Number_exports,
  generate31,
  Operator_exports,
  generate32,
  Parentheses_exports,
  generate33,
  Percentage_exports,
  generate34,
  PseudoClassSelector_exports,
  generate35,
  PseudoElementSelector_exports,
  generate36,
  Ratio_exports,
  generate37,
  Raw_exports,
  generate38,
  Rule_exports,
  generate39,
  Scope_exports,
  generate40,
  Selector_exports,
  generate41,
  SelectorList_exports,
  generate42,
  String_exports,
  generate43,
  StyleSheet_exports,
  generate44,
  SupportsDeclaration_exports,
  generate45,
  TypeSelector_exports,
  generate46,
  UnicodeRange_exports,
  generate47,
  Url_exports,
  generate48,
  Value_exports,
  generate49,
  WhiteSpace_exports,
  parser_default2 as parser_default
};
