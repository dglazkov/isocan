import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  compileDesignContract,
  contractLonghands,
  parseSrgb,
  resolveContractValue,
  toCss
} from "./chunk-ZRGI5I2I.mjs";
import {
  __export
} from "./chunk-JYOOXWJZ.mjs";

// node_modules/parse5/dist/common/unicode.js
var UNDEFINED_CODE_POINTS = /* @__PURE__ */ new Set([
  65534,
  65535,
  131070,
  131071,
  196606,
  196607,
  262142,
  262143,
  327678,
  327679,
  393214,
  393215,
  458750,
  458751,
  524286,
  524287,
  589822,
  589823,
  655358,
  655359,
  720894,
  720895,
  786430,
  786431,
  851966,
  851967,
  917502,
  917503,
  983038,
  983039,
  1048574,
  1048575,
  1114110,
  1114111
]);
var REPLACEMENT_CHARACTER = "\uFFFD";
var CODE_POINTS;
(function(CODE_POINTS2) {
  CODE_POINTS2[CODE_POINTS2["EOF"] = -1] = "EOF";
  CODE_POINTS2[CODE_POINTS2["NULL"] = 0] = "NULL";
  CODE_POINTS2[CODE_POINTS2["TABULATION"] = 9] = "TABULATION";
  CODE_POINTS2[CODE_POINTS2["CARRIAGE_RETURN"] = 13] = "CARRIAGE_RETURN";
  CODE_POINTS2[CODE_POINTS2["LINE_FEED"] = 10] = "LINE_FEED";
  CODE_POINTS2[CODE_POINTS2["FORM_FEED"] = 12] = "FORM_FEED";
  CODE_POINTS2[CODE_POINTS2["SPACE"] = 32] = "SPACE";
  CODE_POINTS2[CODE_POINTS2["EXCLAMATION_MARK"] = 33] = "EXCLAMATION_MARK";
  CODE_POINTS2[CODE_POINTS2["QUOTATION_MARK"] = 34] = "QUOTATION_MARK";
  CODE_POINTS2[CODE_POINTS2["AMPERSAND"] = 38] = "AMPERSAND";
  CODE_POINTS2[CODE_POINTS2["APOSTROPHE"] = 39] = "APOSTROPHE";
  CODE_POINTS2[CODE_POINTS2["HYPHEN_MINUS"] = 45] = "HYPHEN_MINUS";
  CODE_POINTS2[CODE_POINTS2["SOLIDUS"] = 47] = "SOLIDUS";
  CODE_POINTS2[CODE_POINTS2["DIGIT_0"] = 48] = "DIGIT_0";
  CODE_POINTS2[CODE_POINTS2["DIGIT_9"] = 57] = "DIGIT_9";
  CODE_POINTS2[CODE_POINTS2["SEMICOLON"] = 59] = "SEMICOLON";
  CODE_POINTS2[CODE_POINTS2["LESS_THAN_SIGN"] = 60] = "LESS_THAN_SIGN";
  CODE_POINTS2[CODE_POINTS2["EQUALS_SIGN"] = 61] = "EQUALS_SIGN";
  CODE_POINTS2[CODE_POINTS2["GREATER_THAN_SIGN"] = 62] = "GREATER_THAN_SIGN";
  CODE_POINTS2[CODE_POINTS2["QUESTION_MARK"] = 63] = "QUESTION_MARK";
  CODE_POINTS2[CODE_POINTS2["LATIN_CAPITAL_A"] = 65] = "LATIN_CAPITAL_A";
  CODE_POINTS2[CODE_POINTS2["LATIN_CAPITAL_Z"] = 90] = "LATIN_CAPITAL_Z";
  CODE_POINTS2[CODE_POINTS2["RIGHT_SQUARE_BRACKET"] = 93] = "RIGHT_SQUARE_BRACKET";
  CODE_POINTS2[CODE_POINTS2["GRAVE_ACCENT"] = 96] = "GRAVE_ACCENT";
  CODE_POINTS2[CODE_POINTS2["LATIN_SMALL_A"] = 97] = "LATIN_SMALL_A";
  CODE_POINTS2[CODE_POINTS2["LATIN_SMALL_Z"] = 122] = "LATIN_SMALL_Z";
})(CODE_POINTS || (CODE_POINTS = {}));
var SEQUENCES = {
  DASH_DASH: "--",
  CDATA_START: "[CDATA[",
  DOCTYPE: "doctype",
  SCRIPT: "script",
  PUBLIC: "public",
  SYSTEM: "system"
};
function isSurrogate(cp) {
  return cp >= 55296 && cp <= 57343;
}
function isSurrogatePair(cp) {
  return cp >= 56320 && cp <= 57343;
}
function getSurrogatePairCodePoint(cp1, cp2) {
  return (cp1 - 55296) * 1024 + 9216 + cp2;
}
function isControlCodePoint(cp) {
  return cp !== 32 && cp !== 10 && cp !== 13 && cp !== 9 && cp !== 12 && cp >= 1 && cp <= 31 || cp >= 127 && cp <= 159;
}
function isUndefinedCodePoint(cp) {
  return cp >= 64976 && cp <= 65007 || UNDEFINED_CODE_POINTS.has(cp);
}

// node_modules/parse5/dist/common/error-codes.js
var ERR;
(function(ERR2) {
  ERR2["controlCharacterInInputStream"] = "control-character-in-input-stream";
  ERR2["noncharacterInInputStream"] = "noncharacter-in-input-stream";
  ERR2["surrogateInInputStream"] = "surrogate-in-input-stream";
  ERR2["nonVoidHtmlElementStartTagWithTrailingSolidus"] = "non-void-html-element-start-tag-with-trailing-solidus";
  ERR2["endTagWithAttributes"] = "end-tag-with-attributes";
  ERR2["endTagWithTrailingSolidus"] = "end-tag-with-trailing-solidus";
  ERR2["unexpectedSolidusInTag"] = "unexpected-solidus-in-tag";
  ERR2["unexpectedNullCharacter"] = "unexpected-null-character";
  ERR2["unexpectedQuestionMarkInsteadOfTagName"] = "unexpected-question-mark-instead-of-tag-name";
  ERR2["invalidFirstCharacterOfTagName"] = "invalid-first-character-of-tag-name";
  ERR2["unexpectedEqualsSignBeforeAttributeName"] = "unexpected-equals-sign-before-attribute-name";
  ERR2["missingEndTagName"] = "missing-end-tag-name";
  ERR2["unexpectedCharacterInAttributeName"] = "unexpected-character-in-attribute-name";
  ERR2["unknownNamedCharacterReference"] = "unknown-named-character-reference";
  ERR2["missingSemicolonAfterCharacterReference"] = "missing-semicolon-after-character-reference";
  ERR2["unexpectedCharacterAfterDoctypeSystemIdentifier"] = "unexpected-character-after-doctype-system-identifier";
  ERR2["unexpectedCharacterInUnquotedAttributeValue"] = "unexpected-character-in-unquoted-attribute-value";
  ERR2["eofBeforeTagName"] = "eof-before-tag-name";
  ERR2["eofInTag"] = "eof-in-tag";
  ERR2["missingAttributeValue"] = "missing-attribute-value";
  ERR2["missingWhitespaceBetweenAttributes"] = "missing-whitespace-between-attributes";
  ERR2["missingWhitespaceAfterDoctypePublicKeyword"] = "missing-whitespace-after-doctype-public-keyword";
  ERR2["missingWhitespaceBetweenDoctypePublicAndSystemIdentifiers"] = "missing-whitespace-between-doctype-public-and-system-identifiers";
  ERR2["missingWhitespaceAfterDoctypeSystemKeyword"] = "missing-whitespace-after-doctype-system-keyword";
  ERR2["missingQuoteBeforeDoctypePublicIdentifier"] = "missing-quote-before-doctype-public-identifier";
  ERR2["missingQuoteBeforeDoctypeSystemIdentifier"] = "missing-quote-before-doctype-system-identifier";
  ERR2["missingDoctypePublicIdentifier"] = "missing-doctype-public-identifier";
  ERR2["missingDoctypeSystemIdentifier"] = "missing-doctype-system-identifier";
  ERR2["abruptDoctypePublicIdentifier"] = "abrupt-doctype-public-identifier";
  ERR2["abruptDoctypeSystemIdentifier"] = "abrupt-doctype-system-identifier";
  ERR2["cdataInHtmlContent"] = "cdata-in-html-content";
  ERR2["incorrectlyOpenedComment"] = "incorrectly-opened-comment";
  ERR2["eofInScriptHtmlCommentLikeText"] = "eof-in-script-html-comment-like-text";
  ERR2["eofInDoctype"] = "eof-in-doctype";
  ERR2["nestedComment"] = "nested-comment";
  ERR2["abruptClosingOfEmptyComment"] = "abrupt-closing-of-empty-comment";
  ERR2["eofInComment"] = "eof-in-comment";
  ERR2["incorrectlyClosedComment"] = "incorrectly-closed-comment";
  ERR2["eofInCdata"] = "eof-in-cdata";
  ERR2["absenceOfDigitsInNumericCharacterReference"] = "absence-of-digits-in-numeric-character-reference";
  ERR2["nullCharacterReference"] = "null-character-reference";
  ERR2["surrogateCharacterReference"] = "surrogate-character-reference";
  ERR2["characterReferenceOutsideUnicodeRange"] = "character-reference-outside-unicode-range";
  ERR2["controlCharacterReference"] = "control-character-reference";
  ERR2["noncharacterCharacterReference"] = "noncharacter-character-reference";
  ERR2["missingWhitespaceBeforeDoctypeName"] = "missing-whitespace-before-doctype-name";
  ERR2["missingDoctypeName"] = "missing-doctype-name";
  ERR2["invalidCharacterSequenceAfterDoctypeName"] = "invalid-character-sequence-after-doctype-name";
  ERR2["duplicateAttribute"] = "duplicate-attribute";
  ERR2["nonConformingDoctype"] = "non-conforming-doctype";
  ERR2["missingDoctype"] = "missing-doctype";
  ERR2["misplacedDoctype"] = "misplaced-doctype";
  ERR2["endTagWithoutMatchingOpenElement"] = "end-tag-without-matching-open-element";
  ERR2["closingOfElementWithOpenChildElements"] = "closing-of-element-with-open-child-elements";
  ERR2["disallowedContentInNoscriptInHead"] = "disallowed-content-in-noscript-in-head";
  ERR2["openElementsLeftAfterEof"] = "open-elements-left-after-eof";
  ERR2["abandonedHeadElementChild"] = "abandoned-head-element-child";
  ERR2["misplacedStartTagForHeadElement"] = "misplaced-start-tag-for-head-element";
  ERR2["nestedNoscriptInHead"] = "nested-noscript-in-head";
  ERR2["eofInElementThatCanContainOnlyText"] = "eof-in-element-that-can-contain-only-text";
})(ERR || (ERR = {}));

// node_modules/parse5/dist/tokenizer/preprocessor.js
var DEFAULT_BUFFER_WATERLINE = 1 << 16;
var Preprocessor = class {
  constructor(handler) {
    this.handler = handler;
    this.html = "";
    this.pos = -1;
    this.lastGapPos = -2;
    this.gapStack = [];
    this.skipNextNewLine = false;
    this.lastChunkWritten = false;
    this.endOfChunkHit = false;
    this.bufferWaterline = DEFAULT_BUFFER_WATERLINE;
    this.isEol = false;
    this.lineStartPos = 0;
    this.droppedBufferSize = 0;
    this.line = 1;
    this.lastErrOffset = -1;
  }
  /** The column on the current line. If we just saw a gap (eg. a surrogate pair), return the index before. */
  get col() {
    return this.pos - this.lineStartPos + Number(this.lastGapPos !== this.pos);
  }
  get offset() {
    return this.droppedBufferSize + this.pos;
  }
  getError(code, cpOffset) {
    const { line, col, offset } = this;
    const startCol = col + cpOffset;
    const startOffset = offset + cpOffset;
    return {
      code,
      startLine: line,
      endLine: line,
      startCol,
      endCol: startCol,
      startOffset,
      endOffset: startOffset
    };
  }
  _err(code) {
    if (this.handler.onParseError && this.lastErrOffset !== this.offset) {
      this.lastErrOffset = this.offset;
      this.handler.onParseError(this.getError(code, 0));
    }
  }
  _addGap() {
    this.gapStack.push(this.lastGapPos);
    this.lastGapPos = this.pos;
  }
  _processSurrogate(cp) {
    if (this.pos !== this.html.length - 1) {
      const nextCp = this.html.charCodeAt(this.pos + 1);
      if (isSurrogatePair(nextCp)) {
        this.pos++;
        this._addGap();
        return getSurrogatePairCodePoint(cp, nextCp);
      }
    } else if (!this.lastChunkWritten) {
      this.endOfChunkHit = true;
      return CODE_POINTS.EOF;
    }
    this._err(ERR.surrogateInInputStream);
    return cp;
  }
  willDropParsedChunk() {
    return this.pos > this.bufferWaterline;
  }
  dropParsedChunk() {
    if (this.willDropParsedChunk()) {
      this.html = this.html.substring(this.pos);
      this.lineStartPos -= this.pos;
      this.droppedBufferSize += this.pos;
      this.pos = 0;
      this.lastGapPos = -2;
      this.gapStack.length = 0;
    }
  }
  write(chunk, isLastChunk) {
    if (this.html.length > 0) {
      this.html += chunk;
    } else {
      this.html = chunk;
    }
    this.endOfChunkHit = false;
    this.lastChunkWritten = isLastChunk;
  }
  insertHtmlAtCurrentPos(chunk) {
    this.html = this.html.substring(0, this.pos + 1) + chunk + this.html.substring(this.pos + 1);
    this.endOfChunkHit = false;
  }
  startsWith(pattern, caseSensitive) {
    if (this.pos + pattern.length > this.html.length) {
      this.endOfChunkHit = !this.lastChunkWritten;
      return false;
    }
    if (caseSensitive) {
      return this.html.startsWith(pattern, this.pos);
    }
    for (let i = 0; i < pattern.length; i++) {
      const cp = this.html.charCodeAt(this.pos + i) | 32;
      if (cp !== pattern.charCodeAt(i)) {
        return false;
      }
    }
    return true;
  }
  peek(offset) {
    const pos = this.pos + offset;
    if (pos >= this.html.length) {
      this.endOfChunkHit = !this.lastChunkWritten;
      return CODE_POINTS.EOF;
    }
    const code = this.html.charCodeAt(pos);
    return code === CODE_POINTS.CARRIAGE_RETURN ? CODE_POINTS.LINE_FEED : code;
  }
  advance() {
    this.pos++;
    if (this.isEol) {
      this.isEol = false;
      this.line++;
      this.lineStartPos = this.pos;
    }
    if (this.pos >= this.html.length) {
      this.endOfChunkHit = !this.lastChunkWritten;
      return CODE_POINTS.EOF;
    }
    let cp = this.html.charCodeAt(this.pos);
    if (cp === CODE_POINTS.CARRIAGE_RETURN) {
      this.isEol = true;
      this.skipNextNewLine = true;
      return CODE_POINTS.LINE_FEED;
    }
    if (cp === CODE_POINTS.LINE_FEED) {
      this.isEol = true;
      if (this.skipNextNewLine) {
        this.line--;
        this.skipNextNewLine = false;
        this._addGap();
        return this.advance();
      }
    }
    this.skipNextNewLine = false;
    if (isSurrogate(cp)) {
      cp = this._processSurrogate(cp);
    }
    const isCommonValidRange = this.handler.onParseError === null || cp > 31 && cp < 127 || cp === CODE_POINTS.LINE_FEED || cp === CODE_POINTS.CARRIAGE_RETURN || cp > 159 && cp < 64976;
    if (!isCommonValidRange) {
      this._checkForProblematicCharacters(cp);
    }
    return cp;
  }
  _checkForProblematicCharacters(cp) {
    if (isControlCodePoint(cp)) {
      this._err(ERR.controlCharacterInInputStream);
    } else if (isUndefinedCodePoint(cp)) {
      this._err(ERR.noncharacterInInputStream);
    }
  }
  retreat(count) {
    this.pos -= count;
    while (this.pos < this.lastGapPos) {
      this.lastGapPos = this.gapStack.pop();
      this.pos--;
    }
    this.isEol = false;
  }
};

// node_modules/parse5/dist/common/token.js
var TokenType;
(function(TokenType2) {
  TokenType2[TokenType2["CHARACTER"] = 0] = "CHARACTER";
  TokenType2[TokenType2["NULL_CHARACTER"] = 1] = "NULL_CHARACTER";
  TokenType2[TokenType2["WHITESPACE_CHARACTER"] = 2] = "WHITESPACE_CHARACTER";
  TokenType2[TokenType2["START_TAG"] = 3] = "START_TAG";
  TokenType2[TokenType2["END_TAG"] = 4] = "END_TAG";
  TokenType2[TokenType2["COMMENT"] = 5] = "COMMENT";
  TokenType2[TokenType2["DOCTYPE"] = 6] = "DOCTYPE";
  TokenType2[TokenType2["EOF"] = 7] = "EOF";
  TokenType2[TokenType2["HIBERNATION"] = 8] = "HIBERNATION";
})(TokenType || (TokenType = {}));
function getTokenAttr(token, attrName) {
  for (let i = token.attrs.length - 1; i >= 0; i--) {
    if (token.attrs[i].name === attrName) {
      return token.attrs[i].value;
    }
  }
  return null;
}

// node_modules/entities/dist/decode-codepoint.js
var c1 = [
  8364,
  0,
  8218,
  402,
  8222,
  8230,
  8224,
  8225,
  710,
  8240,
  352,
  8249,
  338,
  0,
  381,
  0,
  0,
  8216,
  8217,
  8220,
  8221,
  8226,
  8211,
  8212,
  732,
  8482,
  353,
  8250,
  339,
  0,
  382,
  376
];
function isInvalidCodePoint(codePoint) {
  return codePoint === 0 || codePoint >= 55296 && codePoint <= 57343 || codePoint > 1114111;
}
function replaceCodePoint(codePoint) {
  if (isInvalidCodePoint(codePoint)) {
    return 65533;
  }
  if (codePoint >= 128 && codePoint <= 159) {
    return c1[codePoint - 128] || codePoint;
  }
  return codePoint;
}
function replaceCodePointXML(codePoint) {
  return isInvalidCodePoint(codePoint) ? 65533 : codePoint;
}
function codePointToString(codePoint) {
  return codePoint - 1 >>> 0 < 127 || codePoint - 160 >>> 0 < 55136 ? String.fromCharCode(codePoint) : String.fromCodePoint(replaceCodePoint(codePoint));
}

// node_modules/entities/dist/internal/decode-shared.js
var BASE91_INVERSE = /* @__PURE__ */ (() => {
  const table = new Uint8Array(127);
  let code = 0;
  for (let char = 33; char <= 126; char++) {
    if (char !== 34 && char !== 36 && char !== 92) {
      table[char] = code++;
    }
  }
  return table;
})();
function decodeTrieDict(input, resultLength, atomCount, dict1AtomCount, ngramCount, dictSize) {
  const base = 91;
  const inputLength = input.length;
  const twoCharBias = dictSize * (base - 1);
  let pos = 0;
  const readSlotCode = () => {
    const c12 = BASE91_INVERSE[input.charCodeAt(pos++)];
    return c12 < dictSize ? c12 : c12 * base - twoCharBias + BASE91_INVERSE[input.charCodeAt(pos++)];
  };
  const dict2AtomCount = atomCount - dict1AtomCount;
  const slotCount = atomCount + ngramCount;
  const single = new Int32Array(slotCount);
  single.fill(-1, dict1AtomCount, dictSize);
  single.fill(-1, dictSize + dict2AtomCount, slotCount);
  const start = new Int32Array(slotCount);
  const length = new Int32Array(slotCount);
  function decodeDelta(count, off) {
    let previous = 0;
    let slot = off;
    const end = off + count;
    while (slot < end) {
      const code = BASE91_INVERSE[input.charCodeAt(pos++)];
      if (code < 89) {
        previous += code;
        single[slot++] = previous;
      } else if (code === 89) {
        let runLength = BASE91_INVERSE[input.charCodeAt(pos++)] + 2;
        while (runLength--)
          single[slot++] = ++previous;
      } else {
        const next = BASE91_INVERSE[input.charCodeAt(pos++)];
        previous += 89 + // eslint-disable-next-line unicorn/prefer-minimal-ternary -- branches read a different number of side-effecting input bytes
        (next < 90 ? next * base + BASE91_INVERSE[input.charCodeAt(pos++)] : BASE91_INVERSE[input.charCodeAt(pos++)] * 8281 + BASE91_INVERSE[input.charCodeAt(pos++)] * base + BASE91_INVERSE[input.charCodeAt(pos++)]);
        single[slot++] = previous;
      }
    }
  }
  decodeDelta(dict1AtomCount, 0);
  decodeDelta(dict2AtomCount, dictSize);
  const references = new Int32Array(ngramCount * 2);
  let poolSize = 0;
  let ngramIndex = 0;
  function readNgramReferences(count, startSlot) {
    for (let index = 0; index < count; index++) {
      const slot = startSlot + index;
      const a = readSlotCode();
      const b = readSlotCode();
      references[ngramIndex * 2] = a;
      references[ngramIndex * 2 + 1] = b;
      ngramIndex += 1;
      start[slot] = poolSize;
      const entryLength = (single[a] < 0 ? length[a] : 1) + (single[b] < 0 ? length[b] : 1);
      length[slot] = entryLength;
      poolSize += entryLength;
    }
  }
  readNgramReferences(ngramCount - dictSize + dict1AtomCount, dictSize + dict2AtomCount);
  readNgramReferences(dictSize - dict1AtomCount, dict1AtomCount);
  const pool = new Uint16Array(poolSize);
  let write = 0;
  for (let index = 0; index < ngramIndex; index++) {
    for (let half = 0; half < 2; half++) {
      const source = references[index * 2 + half];
      const value = single[source];
      if (value < 0) {
        let read = start[source];
        const readEnd = read + length[source];
        while (read < readEnd)
          pool[write++] = pool[read++];
      } else {
        pool[write++] = value;
      }
    }
  }
  const out = new Uint16Array(resultLength);
  let outIndex = 0;
  while (pos < inputLength) {
    let slot = BASE91_INVERSE[input.charCodeAt(pos++)];
    if (slot >= dictSize) {
      slot = slot * base - twoCharBias + BASE91_INVERSE[input.charCodeAt(pos++)];
    }
    const value = single[slot];
    if (value < 0) {
      let read = start[slot];
      const readEnd = read + length[slot];
      while (read < readEnd)
        out[outIndex++] = pool[read++];
    } else {
      out[outIndex++] = value;
    }
  }
  return out;
}

// node_modules/entities/dist/generated/decode-data-html.js
var htmlDecodeTree = /* @__PURE__ */ decodeTrieDict("!}.&u%}'&}*'~!6*)%&,~!J~!J~%L~y<~!R,~~%Lu~~#GD~~#|)1#%}^%}2%+#.##%##%}&%##%'#%##&%#%#'%#&#%#&#'#%%#&#%##%#)%''%&%#%#'%#%%#%%}%%%#%#&(23#%%#&-%0%('1#(##%#'##+%'*.:1}#%#6-+(%'%%#%%%}#L'2351&('%}&/N'(0(/*-%(%%}#'+&T%7.2}#&%&#%#36/5##%&%%#&#%%#))2%%##%&&'0~!#*+&'%1~!%).'3q?&%'1~!.##%6(~!+%%%(Gw'rT~!E#<nA%#jZ~!H%(~!42##~!*31&~!G%U~#)5~#`3~!J~!Z~%]~%Y~%C~!q~!u~#kz~%#~!6'~!D~!U~!?~#T~!c%~!G#'~%7|~!G~!J~!G&~#pb~(Df}#%}*&}#%##%##%##&#-}&'#'&%#.++}%mI,#,@&(}*%}*'%&##&#%##%}&0}#.},U},%}+%}&%}#%##&}B%(}(%}+%)})%##%#&}&%##%&}<%}>%#%&}*%}(%}9%}/%})%}*%}*%}?&}&%}3%}&*#%})%#%#)}#&#-#+*%E%%'%'#%}#*V##&##I}#&&##%&%#&&Qf%%))w/0+&%#(#.%-''''++++7}>%4'',##1,#%#&%##&#'##&#*#9)%&%}#*}%,#+P(%A&%#'&##wSD',9E00#y#@}(+}&%&>~!#~!X}#*}(&&}(&}(,%}%&#+&}#&}I%#%}%)#(},'%#*}4%%#%}(''}#/##(##),%-##%%)#&}(.}&%#&}%%}*&#%},&&}&%}#%*'#%})%}D&}&%}-&}6&#&}-,%}#%})-(~+`~,=?~I9'9%~!,#%})%})%}@%}?%}(~!?~#<~#pP~#BG~#=1#%K+~#?#~%;)~#A~#mF1~#A'~'X%'~#lR~#N~'N~#r~#m#-~#i'?%#'%~#B%##%,%#~#_%#0%~#]732~,w~2+#:&#%&'0%&>%}#>##F+)#%&&#(+_}4&}-%}(&}@&}O7Fdf0@+/v4}&WU##&/0#&'('B#%}.%}'+#%}#%%&#&%#%##+#&#)#6#'#.},%}c%},%#%##%&#&%#&~#>'*-.%##%##%}#%%}%'~#)D1}#%*&~#_%%'(~#S2%'.}#~#=##*'*-%}&'%'##&&~'E%.#&~#M4}%%##&'%#~#O1##%&#'+~#<B%##%%'%+~#;#@%}#&%#&&%#(~#H1}'%'##&&~#?A}&'~#D#%32}'&&&&~#[}'(#%}'~#;C})&}%%#%~#=&%,3}%'(#%%~#^'#&&)#%'~#Y%-~#d-%'~#^%%&#&&&}#~#b~2t*&'~&(~&@~0%~e~3}%*''0})&}+~!9##-}#%-hD*)1fC#%/&/fB#40~!+#)*4~!+~!K'&:~!/*7~!.#~!H~!L':~%x&~!H#~!*~%1~!I#~!+A~#p'~!F~~#-#~,,(~.Z~!V~%;'B'mq-W~!N~%I%#&&#&}#%},%%}'%}+X#%}#&}(%}'%}<%}#%}%%'}'%}:~![)9@~%>~#UA%-%##&~!C%~!-.9:~!1~!-^2/:a~!y,D*J#-5)/4~%23,~#G~!L1~!0X3`~!2+~!!0-~&E~!W~!o,>Y&]~%cZx_&~#O*9#A#'#+I'%#)~!0B*-5A+-((F&*M#)(-7-5+'-3a5Vi~!Y~!?+[)%3),ERHm~!+:D,VG.+)?fB%%*(%)'(#&80%1'8`K8?`+'Z#&O&'H5#*9)A%%5&3))0%39+.*7#()&&*=4@**L)<'_&*+..;(#*+)./&0#3)%')-8(4ixD(&.}%,('aI:,)%,k2231T)I'#/-W7,/'Q#.'Y24+h')37</31&83##&0#),H(?'&?/1##%#&&#%''-%&&&#(&''&#.-'%#%%(,')*'&#&#'##%(%(#%('#&##%%%%('%#%#%%#%#&%##h>w+v<ayvyvcg.uuhKr}g/v|g>u9i[~>g5uI~=RvdwEg;v/g;uk!!TTSx]@RT!U!#!@VBRUU!'UTe-d0c`e&gSdicedFcrdTaqb.kYcAohdYd@a3e+d}dMdtd.aJ#bqcK`dle/e.e'dwdPdodddjbEb}ogd^ofdpduc6j?l%d{drdqc)d7bacOdQ%T#Y)X.sR[yH>6Vyv3[xwLu>vo'!*.[yBacahoj>6Rew3[xqdZa#!a&#^(X-[yG>6Vyu3[xvg3sEr|g.u/Ri9db0T#^(Xa)!-[y;>6Vylg4wKs{JwNZt3@3r=c4Z([xlg;wKt!cpq's@v7A'*a(a+!-a#[y<3Dt?3Dt'>6Vym3[xmg9rxsNJwLZt4~?r?db1T#`-!(Xa,!0[yS>6Vz%NuQs.g4wKtnJwNZtS@3r>c4Z([y%g;wKtrdga8!a(!#&T*Y-Xa#!a0<or[yc3Dtq>6Vz43[y3JwNZtf@3s!Ju}!%Dti:pm3c_%X#tjB5pkd6q!r]u?voC'*-a.a2!0a&a+[yI3DtI3Ds~3DtH>6Vyw3[xx;:s#~<5pKJwNZtE@3r~d`a)!a2T#a.(!+U.X1[yT3Dt`3Dtv>6Vz&3[y&g9rxwzcxstPu.<rAJwLZtT~?r@dZa%!a.&^*Za(/Reu[ya>6Vz23[y1g3sEr}wkg{NuQRg{ci(U#5@b`~,cg#U(2WnH5wugcRh7dX#T(Y,a'Ta!!a,[yZ<]mj>6Vz,3[y+Pv#5ReZKu+=,%!H}7ABwkaS?Rh:BcW(X#<]mrj:ubv/ARekdg%!(!a.*Ta(Y.X1!#sP>Rl*Dt6[y>>6Vyo3Wf*jOvuumvuRgRJuq*!:9<B@bX~3jVv&v@s@5Re[d/rQt{uAvo&a&a*)a2!,0Wf!3Dt0=Bs'>6Re}3[xy~<5s%JwJZt1~Gs)c;&!#2sJkNuXvzq7rxu,Re8dka4!a8(aEZ+a@Y.X1Xa)[yd=Bs(3DtP>6Vz53[y4cX#X&Re:avRe9~<5s&JwJZtQ~Gs*i^rzvdRg+Jv{%!2sbB@bX}kdga,!Za?&^*T1/!a'Dt+[y6>6Vyf3Wf%g/u;s4hGu6?Rh-JvZ,!c%#&RoX54Rivj7uyvf8RgTKvZB%*!2sGh<vu5Rgq<=C::9bb~#dZ#T&Ta6Y.X*Dt>[y93Wf)coZ(T,6VyifluvRgC@95@B@bX~/hFu34cC#T,k/unq8w8Q5RkUklwQuzunq8w8Q5Rk8d/rJu?v8w9)-&!a0a;a&aIWejg3sEr/h1s<DtDJvyZqY5aws3Jvy!&Wei~Hr1:au5@Bag>23E~5c:Z&bX};kKv?w&unuVu5Rjc;>bs)#~@:Rh.=ay<a]C;b`}Vd6s/t{uAvoaxa()!a,a7%-a#a2Dt,[yF2Wo[>6Vyt3[xuNuPRi&NuPwpi#RoWh?vf8Ri%Jv]!%Ri:KvxD!.'2WeAjZu`q9rxu,Re7woeAg-unLq(qA_/*2Wg_g3u5q^9:4E}/jTrxrzv=Wkkd~0UX#^^Xa-a1a5T&a=U1a'*aEa]!a*aPaA-adok[y54Rn>;:p3~Dp5g9rpsFNvZqjg3uJp4~<5p0Pw;5qlJwNZt*@3p1Pw:5p/Ou!5p2JvG'!6Vye=<qnJvh_[xhg3v,Rh3kOwOw-sDuev/Re^dha[a%!%!a+#Ta7)-5TaCaO!aka!a)sf[yb2>Rl!9ARiq5E}Qg=ucRkBE|oJrJ_@Wk~@Wk{JrJ_@Wk|@WkyJrJ_@Wk}@WkzJvO_[y2g-vMRmiKuYC!)&>Ri;>Ri<@3RkNc](X#@9Rk=g5vuRmhKvDB!+'=]meg3u4Rmgd)#Y'Vz3CARmfd`a+!%T'!+#Ta1Ta6TaM-sTDt9[yA9sYd'%Y#s[[xpj:ueunaXRgEjRq,v-vuqdd2'`#6Rev<32@5>:2<E}5xIo9a*X#Y(;5RePJvD_g>vyRgNj8w)v8<wggs:RgXiZt|vjx,hSq3ah!-(~@:Ro/Ou!5RhWj^v(pyw8unRhUdx-UY#^Ua.a3a70!)%UX1TaDa)'omRiRRhE[y:3Dsz=Br,>6Vyj3[xkg6ruwjcqsrPw;5r*Ku]D'Zt-@3r(~?r.i[vwv]dU1a--U#`a4(g/vsRhPOu!5RhLj:rmu9Wo!~@:wdh@g/vsRiTjXuvvNr}:RhBj^v(pyw8unRn]dz1UYa'a+^Y(!aETZalaRY.Ta?a4[yDJw1!#qLsW>6Vyrfzq-pLflpwRe|Js>%!Dt@3Dt&Jvy_[xs~HrnjMuwpsw'RecKu+D#'!t<~Grl~?rjg5u-x,gwp{ah!-(~@:Rg~Ou!5Rh'jXuvvNr}:Rh#cW#X/c;&!#2sLi[v7u7RgpJv)(!iLrxu,Re6j7v@s@5Se[e7d`aW!Za(a`T.a#!a3!&aDa-!9)Dt_=6s+3[x~~DR|h~DS6avhGun5RkZj3w)v-]mkKunB!&*]kb97R|i<ARk<c:Z(6Vy}Juh'!wziMRoS:F|vkLuauJv5vtvQRh1d='T+Y#VyO~DR|jcF#T'7R|g97R|kJv3'!ay<Rj,Jvh&!:ReXcsa6*a+#a#_aIRf9aLRf?c,Z&Rf5Rf7c.Z&Rf;Rf>cQ#%T'p-Rf8Rf=ct#%'(*!,p,Rf4p+Rf6Rf:Rf<d~'Ua%U*^UYa(!a,-!#a4YaTalaEX0a8a<Weo3Dt/3Dsx=Br93Wen~Dr;~<5p<JwNZt2@3p=Pw:5p;Ou!5r3c7&!#:p>3Ds}KvGB)_6Vyk2sM=<r7x'eovA(!hFu1ARf}cV#X&@r5j6rvwQa^Rf3c=Za'wkghJv__g;unRggA53B9=b^}%j6uduo5Jq;!(hIv%2Re`Ou4ARe_e%a#^^^Xa&!a*a2!&a6YaP!*ad!#a:aE/5Rn?[y@>6Vyp;:pE~DrY~<5pBJwNZt8@3pCh=rt3rWPw:5pAJup_[xoNuPpF9c!#'45pD5ARn)d8#X'X*3@rU72s]h>v<<sSjJpqvewOJq/(!hNw'5ReBk0s2u3w/w'5ReE5@Jq.!a+JQ!&WeU23d(#Y&RjG5]jBk!u7w&u0udARjEe#+^^^Ub#!a2/a`Z(agT1!a-a;|@TaG!aS[yV=Re~fow'RguNuPRe?bz#'>RoUWeL>:Cbb|?JwPZtVg6ruRmzJvD'!6Vz(g/vmRh~Jvy_[y(g9voRgyx*cy(#2>Ri2B9b]~9kIw9u7rluJu3Rg]dI#a%UY'@=p%CAx.gQZ&RhwwygtRm{x5g_Z'+ABqR9Woa=Bp&dV#^*Xa'!&@o{g4v]Rk;Jv{!%Rk[wkkiA5RkiwwfUB=x,fUuqC&*!>RfTg8v0RfV~ARfSd;rJsAuAv9wR'ae+/aO!a@aza/a#[yQ@Wg!2Wemg3sEr0JvB_g>uvReWg2v+Re=KupB_+[y!2AbY~-~Hr2AJwD!(h<~El>h<~El?Kun@+_:9b`}Kg-v/Ri3g;vtwyk_9]k_d=&T#*U.6qh@Ab`|K9:H|CJv[!&3Dtex'fDwC%!Rf[9WlMd[(^X,!a%Z06Vz!@WgBg=v~Rgvg,QRe@awd,#Y+jTv|Q~EfWj]uNr|~FRfXdy#Y&^Ua%!aO.!(a)Ua;=!a@aKap!a-,a!Ta]a[rSa]p?[y82sK=Bq~;:p:~<5p8Pw:5p7d'#Y'Wf(;RnRi[u4w&RgJJvG'!6Vyh=<r#ijuuv/sIKuYD'ZtG@3p9~Gr&d2#`(g<vtRgFj`u5w&rqpxRf2CJuY!+:wfnTOu!5Rg}jNs1ucv&RfwJvA!&3@q|BDcC#T,k/unq8w8Q5RkTklwQuzunq8w8Q5Rk9dga#!a'!a=#a0!:+Tb*b@aO.a4!aba8aFJv^}?!VyR~Dr<g;u%Rn.~<5p[x'e`wNZtR@3p]Pw:5pZhNvjBp.woe_g5u-r4JwF!%DtO3:ooc7&!#:p^3DtpLuGw(!+%)Dtk6Vz#2sd=<r8d'#Y([y#<x3gJt`w@!)%}MRiowzikRij=]ilxAf3,U(#B2Rf#g0v-Rm[ck{`U#]giKv3>)!&6Ri154s,KuGB_%@r68r:dJ|t`#X(9<E|u2@H|rx3gJu?w'!+'1Nu7Reg4=H~+9<wxgY95Rm]xLggZ-`(X}U2:Ri4h<uOawRmsJv__5@bb{jbV~3dka#a'a]!,#a+U=a>b6a3b%!/aKa/)!arwve^VyJ;:pR~DpTg3uJpS~<5pOPw;5qmPw:5pNOu!5pQJvG'!6Vyx=<qoJvA!{~Jup!%@qk7Rn/KvyD!}''[xz;>wkh'?Rh,x8gyt`w5D!&),(SgyccRgztJ@3pPB5p#d'(Y#<]mmifubw&RgoJvE&!82s^JvF&!8Rf,ADb]~;x=h'rNu]vK!,%'*0RnORh)4Rh*AqQg-vaRnNg;wHwkh'ba~4cE#Ta*x3gctyw@'!+%RnFRnD<4Rn@hFvK5RnCxWg[#`&a0Ua()`1Rm75Rg[c]%X#qi8Rg^NvdRj>BwzgZauwji7Rm6A4wgg]d1#&(*,.0a#Rm;Rm<Rm=Rm>Rm?Rm@RmARmBe%#^^^Xaea?aC/b+(,!a+a#!a/!>a&Ta<aKbD!2wphBRnk[yPw}hE|.=Br-3Dtm>6Vy~g6urRf.x,hPrNav!%'RnqRo%Ro#Nu;q[Pw;5r+JwNZtM@3r)d'#Y'Weh;xChL#`&RnmRnoKu}>%(!Rne~Bs-;2wjcussJv+'!aYSO}6@B<5?ba~8LrNvj!.%*ROwungw~ng~:9;Ri^>wtnig;wHRnixDh@|(UZ.x1h@|)!#:2<H|*xHn]#-UX'3Ro)z=iT}6ARns=Bwsn_wpnaRncw]aR(#UXa&Ua*a/=]iPd'#Y&Ro'WnXf{QRm2hNvj]nZd`'T~&1`{|`#9b]{}c:'!#Wl{>@=be}]?cl{{U#:5Abb}Jds#^YaF!a*b4a#a3aPa>&Tb!bH!*a_!Eau?/a&RjY<]gj>6Vz*;:pe~DrZg,QRj1JwNZtX@wihspcJvZ&!VyX9WmOJu|!|N2WmHJvh&!]ht~Bpbcn&T(!#RmQ<s7Nu;padH#X'`+WmJ@>RmKCARhnKup=!)&Wf+:RhqNuPpf9c!#'45pd5AwghpARn(Ls@w!%,)!RmP@Wfe<E|IJva!&WmNg8vsRmLd`*.`#Y'Xa!axRn*]hrA8Rhug5s@rXg8u!RmMd8#X'X*3@rV72smdI*#UY&RmICARho~GsgxVgd)Ta'U-Y&Xa!T#RnEWnA@Wffg1uDRi0hFvK5RnBxGnG&#`%owp)@wsf+bX}Ze-*1!a*^^^Ua|!#a.aq&Ya2!a>.a6!a:aO`aJDtL[y`@Wg#>6Vz12@wzoYRoZNuPRi!NuPRhzg=ucRi,@=b`{Yg=ucRi-ACJvB!&Sh[ebSh]ebi`wUuFRm4Jw2_[y0JvB!.<Ju(!&SoG}6Shd}6<Ju(!&SoH}6She}6Kur@._g5vHRieJvx!{L2G{Kx6gd'T#?Rh82Wi5cZ#X(g1w)Rm5dW-Y(Ta#!a)!#aYa=wnfE=su2>>bU{0j9udv:<svj8uQv-7RgHdE%#^'sq9sp=>Bb_{TJv`!&g/r|snj6v(us5d,#Y(56H}[978H}]Jw5!&g1rushJvB!+j;v{u5?zDhd}6}bj;v{u5?zDhe}6}ce*#`(^^^a[aea!=!a6a*aoXb1a.!aAbL!b>,b'aL!aV@Wf|2Wlg3[y/JwNZt^@3piPw:5pgJunZou3@rsJva&!Vy_g<v~Rm#JvG'!6Vz0=<r{Ju{%!:pj@WfsiXuJu3Rm:JvZ&!WfA~Bph@c4Z&Dtwax5rubx(#:awRk1@d,#Y&RfjRfid1#,Y(@Wfp2Wlrg5s@ryKu[@!,'=]ig9wlk?Rk>g5u-rqJvy'!@9RkQcH(T#=>Ri~@<wkj(Wj(KuZB*!&<7rw@9RkRcH(T#=>Ri}@<wkj)Wj)dg(Ta2Xa9X#`-!a*CARhg@@=I}d9x;c~#X%so=<sj>2@@=aybb}XjWv0Q~EfEj3vLv;<d,#Y(56H}`978H}_dgaPaFa'a/!#a3Y0a_a;a|!1(a7-[yE3[xt;:pJNvZrrg3uJrvJwNZt=@3pIh=rt3rxPw:5pGOu!5rpJvG'!6Vys=<rz@c4Z&Dt(ax5rtJvZ!&~BpH@wsfNg-vaRlNci*U#=<wei<F}a5@Jq.!a*JQ!%@qZ23d(#Y&RjH5]jCk!u7w&u0udARjFd/prq=tyvpaEa(a:.!a1aZ(@@=I}:9wpd%=<sX55w_h}@@=I{t=ay<aU@@=I}T=ay<2@@=I})?C9:9au@9Cb]}DP~=x-fAZ(2Wl1=ay<aU@@=I}>5@d##Y+jTv|vV~EfFj]uNpn~FRfGdgaK!Z2&!a8a-Tb({E!acTbM*!a(DtY[yYd'%Y#sl[y*hHvh>Re5x2c{Z}.j4uCvcawRiMd+#X+_x&d!},<5RkX;2Hzw@x,gavfB-!{CcF&T#Roe;RodwWbBg5urRgaKvHC*_6Vz+<4opieuew&Rmq@d]&Y)X,T#X0Rh}<BqP=4qS9:ReMg/ujReNJw0!/<Jui%!bd{kawwnemRelAxUa?a3#*.&UX(Ya+a/RhvRnQ<o}9Wmtd-#Y&RgSRmw9;Rmxay=Rmyg-vaRmuxEhSrNu,v-voC!%(aR.a(a7+1Ro1>Ro5CE{A9b]{@;5x#eO{:g;urRi+KrNA!%(Ro3>Ro79;Ri_Ku@>{;&!x%gX|{KunA_+g5QRj/g3u5Rj#g>uERj%wio/xRhS&!,!#^1U}wba{8>>@=be}qC@:D5ba{7Ku+A&!}x?ba}t>>@=be}se(aA^^^Uat!b0#{pa+awUazbGa#aLb9bgaWac'a5TbS=Br!d1#`%scp_Jvl!#rT>Re0JvX&!VyN=H{Fcm#U&:pY=ReaJv2&!]h0=]nUJvG'!6Vy|=<r%JrM_=]h2@Wlud'#)U'Wf'b]{i=]h/Jvh!&~BpWg=v]RnMx+ny#'Nu;pVwjnu=]nwxJnx,T#`&Reqwjnt=]nvieu9vrRjLLuYwP(#+!th@wih5pX~Gr'g5v/Rh4KunA'!-CARnP@wwiN:Rm_9x'cvw>!|l=<saKvAA!0&3@q}>w^e1bp#&Re2Re3BDx7gH#T|f5H|eKuZ>!%(:qNAH{]Jv6!+3B2B9=b^{X<5<B92:E{ZLvhwA(a;a%!igQuyRmad+#Y}m@3Rh5d8#X'X*:AqUAHzmaxwbh<aXRnVcF}RT#Nw&cj#U(BWnug/vsRntdka)(a3+.Zb7aYYan1!bVa@Xa}[y^@b[{G=H{+hFu73Rj&Pv#5ReQcK%T#sig1v{Rj'Ku+D#'!t]~Grm~?rkKuMB!01d5#`'Vy.ta3Dtu~Hroc8#'{^45s85AwZbP&!#Rn!wghxWn#KvEA!)&2RlA2RlBx:h|#(T,=]j09Wobz>x]z/@awRoTd+#Y(az]hFhCrm4d,#Y+jTv|Q~EfMj]uNr|~FRfOdCa!Xa9_X#@<plJvf!%b`{(9;Rgwc;.!#2x7cw#T|UDb]|T5Ju={(!=@E{&Jv)&!Ab`{'awJvf!~*>>@=be{#KuY>!+&4Ezyi[ugv&RjIdea+T)#UXa&T-T&a!Rh9auRmW=]kLg5vuRn+g3u4Rn-Ow6ARn,hHus5xNk?#UX(U~)/g8v0RkD~AwkkF?Ri.OuNBwkkA?Ri/d|a2`a*^UYa.!aBTZaTa'Xa;!(!2!-a#b2[yC>6Vyq3[xr2Wi?g1rusVh%s?DtF~<5rbJs;%!DtBfswKtCj[uvuSsEu3RgVx3o:u+wN'*Zt;@3rd~Grh~?rfg8w)Lq)qE&-a%!>bI|`jWv0vV~EfCjTv|vV~Ef@j]uNpn~FRfBcK#T']gWNu7x,k7q4ai(0!hHv8<RhmkMu9vrsBuev/RhlCJvB!,g<v{wchh~@:Rhji[vrv{wchi~@:RhkdS&a5UY#Ta!RgPwwiI5BwciI~@:Rh`x'iJvj'!5]iJPu8Bwch]~@:Rhach)U#h3rp]gLh@t|Ax,hTq3ah!-(~@:Ro0Ou!5RhXj^v(pyw8unRhVd|)`,^UYas!a?/a2Z'a^Ta{Tb7Ta(a#!a,Wf&9sZ3DtAadamov=Bqt3[xig8vsRm~>waiL2b`{QJv*_Ouv2qgj<v]v2BqfdR'X*X#Y-@3qr~Gqv~?p6hHv-]glPup5Lq+q?_%*b_{qF{n9b^{rOu4ARhpKvCD!+&~Bqp:5Dbb}nwoiKl&unuTuBv]v+ueunaXRf0=Jvh!0nKufu8v1w&w7q%w&uHrz:Rgnj5w,uxDJq/(!hNw'5ReCk0s2u3w/w'5ReFd>Za&!*UaA=<wkgsRnSJv^!%Refifw3vyRgOKu_B'!,<]gkiiu:w&Rh<=C@a^<B57@2F{[<B5@aW:=3away9A5aW=<B=C@a^<B57@2F{Ie-#`(^^^bCara.b8aza6!/bZ,!adTbnTbOb+aFaS!aAT9@Wf~2Wli3Dtl2@d,#Y&RfnRfmJwJZtN~GqyJva&!VyMg<v~Rm%iXuJu3Rm9Jv[_=]ih9wlkDRkCd1#`(@Wg>2Wls3cH#T(@<Rj*=>Ri|b~'#23s9h<~El.d'#Y&Dtxi^rzvdRl#d*#U%(o|B2s`hJwSaxRmDKv4B&!1:Rmdd5#`'Vx}to~Hq{x'f1v3(!BA5ba|bJv_&!Wfug1v]ReIdO+U/Y#&G}-8wze=Rh{g1v]ReHg/uQRf/by#)ibQwERl/cH#T(@<Rj+=>Ri{cNu+vlax-!(#a0qa9<Rii2;;bU{H;x<i=&X#Rk`<4wwi=C9H~8xAI(Y#<azRi@45wXI<B9;5bb~7dL(X#Xa(+!aL6Vy{g5QqOau:5au2@ay547EzbxOcU(UX-T#Ta#:Cbb|A?wjh/b_|SOw6ARgtihr}u7Rhy<d1#T)X1@@=I|~=ay<2@@=aybb}Sj3vLv;<d,#Y(56H}A978H}@dGpvs@uAu`vcw9*!aFa+ai%(b!aXa8.a?a[ozWey=sU2@G}Nch&U#Rf_WexKu+D#'!t:~Gr`~?r^j]uNr|~FRg*j^psurwJt|RmcKv)@&!)7Rkv~Br[@wxfO:Rl3co#U'6Rezj_q#vIuavjRltwzeyh@vr5JqD0!>aY?C9:9au@9Cb]}9cl#U*5;5<H||jbuus1ucv&Rfvg1v~d/pppzqFr^a--a~!aMat1(hFv;Wiz@@=Izoj5uuv-7Rix~Cw`fk2WlVcZ#X,k)u3vWs@u2]ktg;wEx'fBq(_2Wg/jTv|vV~EfoJv]!15x'hzqG!(P~EfU~CRl_j6v(us5x4i-#T(2WmZ?C2F|d>Kq<aj1!*jTqIsBv=Wl`~Cw`fi2WlWj`v0u*~>RlR=c>Z,k#u3vWs@u2]kr<c1Z+jTqIsBv=Wla~Cw`fm2WlXdmb3!a{(arZa`bkTa%TbQTa-a9+c'!aM!/[yL=Bqug.w'RifhFvyDRj.g>vgwyk^9]k^Jv3_@WfbAARkhJw2_[x|JvB_wkoIRoKwkoJRoLd'(Y#<]gm=<9<H|yd'%_X#skDtb3awwqkgNulRkgdB#^',9:p'hJwSaxRmEBwVb8@4=H|qLu+w50&!)@3qs~?pU>Awwn;;Rn=c:Z'ARn<=<qwKvC@!/&~BqqJv6!&]eVb^z^xRge'/a%+^`#Sge}6<4Rn3=]n0Pw2>Rn8Jw0!&>Rn:>Rn6cY#a7+!a&=<wkaNw~h3z_c5Z{=wjh#=]nLKv^D!&)Vyz=bW|swYb<WetcG#T(2wxa@qVx@gD#Y&b^|V5JwG&!5bb|pg/w&RgD@x=kHs=uAvn!a%%/'+RmSRh694Ro`g-vaRmRhHv-]mlxCcS#`&ba~.5cD#Ta)P~=d,#Y(56H{>978H{Dd_#{2^Y%_+qbbb{6g3sERhsbU{?dfa.,`a(Xa<!aiX#(55RiG54RiHcI#T'WiU3RiVNvdwtfcRlKNvdd,#Y&RlHRlExQgf.1*^T'X#Sgf}6Wn4=]hfPrk>Rn7Jw0!&>Rn5>Rn9Lunw?&a2!,5<oq@@wqfdRlJj5Q~=d,#Y(~ARfcOuN]fdDKw;ay(}i!547E}j?cI#T(@5bV}iCbV}hdv(^^Tb?a40,b##Tbo!a*bR!a<b|a/!aKai!aU[yK=]o^g:v>ReGJwPZtK<7Rh+h<~El,Pv#5ReR@awwxjCg,ulRjDJv6&!]j!z?aQeeg>w=Sh<eeJw;!&axEzOg,Qosc!#*:wkeJ]eJ>x'h-u(!%Ro.w~h.zPdNZ(X,Ya![x{;9ReY;wkgxRiF:x?ap#Y&RmUg<s2Rkod]+UY0TZ'!a&A9sw<=bczLNvuw{gqzNhJwSaxRmCKuLay!#&s_Rf-55b^{uJvZa!!c%#(55Ri654wmiu5RiuawLu,vp!+}^%b_}Y9;wkgxba}o>A9:=b^}zKuh=a''!3awRk3c*'!#aHRk6c+Z&Rk5Rk4Jv)&!awRjSawd9*`#0?C2@EzMj8u<uJ5RmbjQrquJu3x,k>uq@_+=ayb^|W~ARkEOuN]k@7dhzV^X/X&a-#zRzSb`zXcJzTT#2WkVKvDBzW!%FzY9;5bbzWjQrquJu3Jw3%!b`zU=ayb^zQd:#X(T-a!6Vyywxh}=b]{Jg=u1RiAdGp~qHtzv!w(wA+a+a;<!aJaYai'anasb(=azRmV:Cbb{MLq2vb!%')RjuRjrRjtRjqx3jnqCw3!%')Rk(Rk+Rk&Rk)Lq2vb!%')Rj{RjxRjzRjwLq2vb!%')RjsRjpRjfRjex3jcqCw3!%')Rk'Rk*RjkRjl9<CbbzfOu4ARhxLq2vb!%')RjyRjvRjhRjgx=joq*uKvb!%')+-Rk.Rk%Rj~Rk-Rk#Rj}x=jdq*uKvb!%')+-Rk,Rk!Rj|RjmRjjRjidAq&qKs@uAv8Aa.'*-a@a&0!aM@a5[y73Dsy3Ds|3Dt):wxgI2sHJwJZt.~Gqxwsf0ikrzt}Rl0Jvy_[xj~HqzKv_A|D!&WfP8axRoVcf,U#k(v]v+ueunaXRf1Ju}'!g8u#Ri=jQw!sCunLprq>!,')~<5qeGzq9F{W=c##%s5au:5aU3CBE|;d4#X(D!a&6Vygx(b;#(=]ed?C2F{N<capoq2r[a&!aPa9,'Pw;5s:@@=I|,55w_h|@@=IzcP~=x'fCqB_2Wl2>aU@@=I|1OuNBc1Z+jTqIsBv=Wlc~Cw`fl2WlZ~AcTa%!Z+jTqIsBv=Wlb~Cw`fh2WlYk+uNqJsBv=WlSg,u3dca3#UXaMYa)TaB-=cM|7T#<bI}l5@B932:aV2G{BOuNBJq:|M!5Ezt=<B=C@a^<B57@2F{v>cB{/T#=ay<bI{3Jv6!a.6BKq0ah&+!5E}HP~Ef{978BaU@@=Iza<7d#.Y#978BaU@@=IzH~AJq0!(@@=IzG978BaU@@=IzFe,aU*Y&^^^bvJb,b:bFad!a,c2Ta>aL.bo6!a#CbTa'T#Re{2Wlh2@G{yg6t~Ro_NvdRfticuRQRllJv3&!x&c|zs@Jw3!%RflwpfkRlpKuL;%(!Re<@G|C2GzdhIvuBwgjAg-u0RjAKQB%!(GzZ@G|5NuuRl7d='T+Y#Vy[g<v~Rm!==G|>JvA!)@wma=]m1ifuaw&RmnLs@vT'!|/+[y,g:v>ReTJw1!#qX=x!eC{bLu+wT&)ZtZauq_~Graci&U#F|89:r_Lupvq!.)&2RlG8RfaC=x!eF{_h?rpWlmd&'!#X|&]k::xJey#`'T|+<E|&2@H|%dE#(^,g;u.RiEg6vjRiC9xCkA{O|zY#g=ucRmXKs0@!&*@G|m@awRknJuh!,3d(}gY}eJvj!%Rm):Jw3!%Rm+Rm-Ls0w(&!a(a#@b[|6cZ#X'7RkxWgAOu4ARn'dH'U#Y*Vz-Wm'CARm}d]*#a%^a*T'aK!a<9bV{PC=p*Jw4!&SgxcbB5r]idw(wBRmF7xFkt#&`(Rm/Rm8E|!JuY_9:Rl5=wrgr2:bbxd@xXfB(a*#T+!.X0X1Ta/a'T&RlDRfL>RlyARl9b[z[>RfZ:RlL:RfRwlg/ARl;9;RlxKv,A/!%7s69<74=BA5ba{-8Bde#`a<XaKYa1,a'P~=wxfB2bZ}}?C972@@=I}r8@55B9;5bb}G978B2@@=aybb}3j3vLv;<Jw3&!>Rfk=ayb^}4~Ad1#`*@@=aybb{w2@>==<bbz]dx+UY#^UaF!a9!bB'Ya1.!ajXa#%olRhD[y=3Dt#Ov5BrHKuMB%!(Rf^Wep~HrJwkiQjKr|~FRg)Ku+D#'!t5~GrF~?rDdV)UY,Z/_7RkuG{<~BrBg,rlsO:235B@bX}|d?a1!#`(6Vyn5@d##Y+jTv|vV~EfIj]uNpn~FRfH7Lq2vb1!a9-978BaU@@=Iz9978BbU}#~AJq0!(@@=Iz8978BaU@@=Iz7~AJQ|}!978BbU}!JvkaK!AdUa21-U#`a+(g/vsRn~Ou!5RPj:rmu9WhOjXuvvNr}:RhAj^v(pyw8unRn[kPr}p|u7vwv]RiSBd;pppzq@qHQa?(b.!a.a`@.|xa(hFv;Wiyj5uuv-7Riw~Cw`fg2WlU978BbU|wOuNBJqG!(P~EfD~CRlQcZ#X,k)u3vWs@u2]ksg;wEx'f@q1_2Wg.j]uNpn~FRfqJv]!15x'h{qG!(@@=IzK~CRl^j6v(us5x4i,#T(2WmY?C2F{1>Kq<aj1!*jTqIsBv=Wld~Cw`fj2Wl[j`v0u*~>RlT=c>Z,k#u3vWs@u2]kq<c1Z+jTqIsBv=Wle~Cw`fn2Wl]dn1#c(a(b^a2!b/bAT(bj!aDa7bu,a_a{c0!2T0g:v>ReD2@G{42@G{5~DpM~<5rc=Bx6i>{RT#RnI@zCx]y]z:2Jv[!zr5Awyk]9]k]dD(Y+X#6Vz.g=wKtgwhaCwgmTWj2Lu,w%_+/[y-B;b^xeg3u3Rj-2@bX{*KrJ<!+'@Wg(g?QRlC@Jv`!%b[zIwsfII}8JQ_@w|kW|=Jv(%!AqcOuNBJvEzh!bYzjLs@wP#(0!oy@>RkdJwMZtc3Dtd@BcG#T'9bWxg2@2Fznd*#Y+;2x'c}w<zizixNgwa#Z'U+!/!a'!a+w~g~z6wcn{Rn}wcnzRn|5Rh%=]nJg5vuRmvNvdRlvcprJu}w*az*a#!%.a.'Bot9qT]kj@Wg'ay2Gzv@Jv`!%b[zEwsfHI}1;ck#Ux`<Cbbx_Lu+w!a&0*!wko*wwo,So,}6Juqxf!E}PigQuyRm`d3(`#8>Rn%:A5B;bZ~%KvhCa!a2!x>k7#Uxb@b{#xaRk7Jw0!)>wwhlShl}6>wwhmShm}6CJvB!.x'hhvj{!!5Bwkhhbaz}x'hivjz~!5Bwkhibaz|xEhTrNu,v-vpD!a%&/)a3a.,%Ro2t[CE{)@3re9b]{%wjo09:rgc:Z&Ro6=<riifuaw&RmoKrNA!%(Ro4>Ro89;Ri`dSaL'UYzxZb)7Rka3xRhT&!,!#^1U}vbaz{>>@=be}yC@:D5bazzKu+A&!}{?ba}y>>@=be}wxBh[t`u~vJvr!%a!a()a,a0a4RoC=]o;Ju(!%RoGRhdwjh`=]oAg>w#Ro?g5vuRo=NvdRl|Ku]C.!&;RoEJvB!%RoORoMBx'h[v+_?w~h`}~5?w~hd~!xKh]oiptu-utv.vp!#%&a30a@a'a+(a/aOp(o~p!RoDJu(!%RoHRhewjha=]oBNvdRl}g>w#Ro@g5vuRo>c[#X']o<CauRoRAd-#Y':RkpauRoQKu]C.!&;RoFJvB!%RoNRoPBx'h]v+_?w~ha}t5?w~he}ue!/UbhYacXaW^Tc&a;b:a-c/#b&aja1(!cL+!bKbt!bmcRc9aIc?8[yW3Dtt94Rg`Jv}!&SiRMzBhEebShEMNuPRe>x7gL#TzuwjirRipc<Z&>on;>z=h-MSh.Mwqczx'a7vj&!>Re4@=ResJt__NuPRi*NuPRi)j]uNr|~FRfzKrJ>_+@Wfy@Wf]2WocKrJ<!+'@Wg%g/QRl@@Jv`!&awRl<wsfFIzgLu(w*!.*&ShBMwvhIRhI9;RhNx1hK'!#Sn]Mx1hK~0!#:2<H~7cNu+w7D*'1ZtW>Rn1~?rOc:Z&Rn2=<rQ<7wjh&=BSnLMc]#X(6Vz)w[b=a!U#9wzgMc3#&(RgMRitRis<x,gKt`ax!&+SioM=BSilMc3#&(RgKRinRimKurB,!&SiQMzBhDebShDM6BJQ!(P~Efx978B2@@=I}WLrJw!!,a*&@G}O@9wkibRid@@x'fKwC!&SlDMSfLMjUv~Q~EfKKv3@a+!(hFv-]mpx/hYZ(C5RiWz<o/MwkhY?So/M@x,gbvfB*&!SgEM:SoeeehFu3:Rgbda(,^TZa)X/7Sg[eb:2RgI~BrMC@wgkc:wwkcRerx3h(uUvK!&*,SnOM4Sh*MArRg;wHRh(x=h;rJvPwI!a4',a'0@Wg&=BSh/Mg>w=Rh=g3w*wwgGRgGcW(X#;Sg}M2Gzk@Jv`!&awRl=wsfGIz`dKZ*T'Y-:RhR7RhQg5u-p`j6v(us5d,#Y+~Awkia?RicOuNBwkibba}Ld6p~tyu_vbAa'a+!a/'a3aEa8a!>Sh,ebJv{!&Sh@ebSaReb9;SgwebNuPRi(NvdRl)NuPRi'hHu^<Rm^Jvv_@Wl(g;u1Si/ebKu'B&!*Sh?eb@Wl'z@aPeb95Si.ebcpputyvjB)!,&a+0a%ShAMWeK@G}C@WfJ9;RhMwvhH9w{ia}ix,hJvRA1(!zAn[MRhHx1hJ~*!#hFv(BSn[MBJQ!(@@=I~'978B2@@=I}2db.Ua<'X}+T#a0XaG2G}E;wkg|wuh!Rh!x,hZu,@)!&So0MVy)C5RiXACJvB!&5RiY5RiZg8w)cG}*T#2@bU}=KsA>(!a.3wkhZba~(x,h^u(A!&(SoCMRhb5Bz=h[eb?w~hb~6x,h_u(A!&(SoDMRhc5Bz=h]eb?w~hc~6e)aA1T#T,^^^c-bMb&blcPaP(a/!0!bA=b5c@a(!bfbrc#2afwmhARnjwchORnp2Wlf3DtsNvdRl-2@wpa<]m0bx(#:awRk2@Jw3!%RfhwpfgRlnKQB%!(G{V@G|'NuuRl6d='T+Y#VyUg<v~Rl~==G|<Jv+'!aYShC}6@B<5?ba~8@Jw3'!g2QRljhLrpWlOd+#Y'g.w'rIg>w*wgj@g-u0Rj@Lu+wT&)ZtUauq]~GrGci&U#F|39:rELrNvj!.%*RhCwunfw~nf~:9;Ri]>wtnhg;wHRnhx3hDs@v~!/+'@Wfr@9RkSNu&Rlo=@<5GzoKs0@_+@Wl+@awRkmJuh!-3d(}pY#qWJvj!%Rm(:Jw3!%Rm,Rm*de&!1U-U#`)Re;@G|.@9Ri82@wjfvRlq=@<5GzpLvOvr!).&2RlF8Rf`C=x!eE{.Jw3_g2QRlkhLrpWlPde(!#U{s,UXa*Ta'[y'g:v>ReS;x0PZ&RnlRnn~HrKJw1}f!=x!eB|2w]aP(#Xa&a*Ta.Ua2a7=]iOd'#Y&Ro&WnWg;u.RiDg6vjRiBNvdRlzhNvj]nYJuW_2Wm3x)kFze{9d])!a.!,Y01!#&aC!a3RndC=ox~BrC@2b^{pg,rlse7x'ksuq!%Rm.E{xidw(wBRmGx9o+)X#wwo-So-}69:Rl4@xSf@a#XZ'X)X,Ta(/ARl8b[xc>RfY:RlI:RfQwlg.ARl:9;Rlwdn'#^XafaQa1X1TaHTa)@b[{zcZ#X'7RkwWg@Ou4ARn&x)kG#{,g7u/RkGdH'U#Y*Vz'Wm&CARm|bx#(A]gUbUzJj9Q~=d,#Y(56H}l978H{U7d,0#U*2>ABb_xZ978BbU{e~AJQ{g!978BbU{hxMh?ad{oUYZ.x1h?{l!#:2<H{mx3n[t{vl!,&a%3Ro(z=iS}6ARnr=Bwsn^wvn`Rnbd`*T}B0!#^X'BG{c9b]{a>>@=be}F?JvS!&BG{d7BG}(Bde#`a1X,Ya@!a'P~=wxf@2bZ}I56B2@@=aybb}08@55B9;5bb}<j3vLv;<Jw3&!>Rfg=ayb^}&OuNBKuLA!)a!P~=x#fD{f2@>==<bbzl?C972@@=Ix^d6rSu,v7w*C(0a)a6#B+a%!sQ[y?3Dt%3[xn~<5rLOu!5p@Ku+D#'!t7~GrP~?rNKvlaya7'!h+v-5qMg=t|cd,U#5AAaa5Abb{S@52B5@a[@52B5Gx[iXueu;d<#`a(!/549C;ag>23ExY5@Dah89b^~689Jv)!~2b[~1Lv'w(%*!a#bX|aPrmawRe]keu7uhv-q6rxu,q`xTo]/a5aU!bNaDXbi!b-!ao!b<bwA!#5@B932:aV2G|:d-)Y#hJrL>RhG<7@C5<H|_=Cau:5aj5@B932:bJ|ng>vIbs)#?C2F|9jPv0w.vISh-MKvUaz(.!9ABbb|[5;5<H|Eg>unwfh;9:4E|YjQsBt|vjx'hYq3!(?C2F|J:2<BaY?C2F|GOu!5x,g|p{ah!-(?C2F|c9:4E|OjXuvvNr}:Rh&i[w*t|cd+U#jJvsu)vsSn~Mkfrmu9p}u7vwv]So!McW#Xa!ax5@A5aY:5;5<H|>kJv~vYrquJu3x4ib#T)2@SmZM?C2F|Bj:rmu9@xPhI(a*a#U#`a3-5Abb|L~@:RhK9:4E|0@52B5G|#C::aY?C2F|-:2<BaY?C2F|.5Jvk!a)javYrquJu3x4ia#T)2@SmYM?C2F|HAxPhH(!a#U#`a*-5Abb|4~@:RhJ9:4E|R@52B5G|F:2<BaY?C2F|Sc^#Xa2j=Qq5CJvB!-g<v{z;hhM?C2F|Zi[vrv{z;hiM?C2F|XKsA>!a)-g<v{z;h[eb?C2F|]i[vrv{z;h]eb?C2F|^iZu.vix,hZq3ah!.(?C2F|QOu!5ShXM:2<BaY?C2F|P", 13494, 2713, 49, 25, 61);

// node_modules/entities/dist/generated/decode-data-xml.js
var xmlDecodeTree = /* @__PURE__ */ new Uint16Array([
  512,
  26465,
  29036,
  7,
  0,
  2,
  4,
  116,
  24638,
  116,
  24636,
  8693,
  29807,
  24610,
  621,
  1,
  0,
  0,
  3,
  112,
  24614,
  111,
  115,
  24615
]);

// node_modules/entities/dist/internal/bin-trie-flags.js
var BinTrieFlags;
(function(BinTrieFlags2) {
  BinTrieFlags2[BinTrieFlags2["VALUE_LENGTH"] = 49152] = "VALUE_LENGTH";
  BinTrieFlags2[BinTrieFlags2["FLAG13"] = 8192] = "FLAG13";
  BinTrieFlags2[BinTrieFlags2["BRANCH_LENGTH"] = 8064] = "BRANCH_LENGTH";
  BinTrieFlags2[BinTrieFlags2["JUMP_TABLE"] = 127] = "JUMP_TABLE";
  BinTrieFlags2[BinTrieFlags2["VALUE_MASK"] = 8191] = "VALUE_MASK";
})(BinTrieFlags || (BinTrieFlags = {}));

// node_modules/entities/dist/decode.js
var CharCodes;
(function(CharCodes2) {
  CharCodes2[CharCodes2["AMP"] = 38] = "AMP";
  CharCodes2[CharCodes2["NUM"] = 35] = "NUM";
  CharCodes2[CharCodes2["SEMI"] = 59] = "SEMI";
  CharCodes2[CharCodes2["EQUALS"] = 61] = "EQUALS";
  CharCodes2[CharCodes2["ZERO"] = 48] = "ZERO";
  CharCodes2[CharCodes2["NINE"] = 57] = "NINE";
  CharCodes2[CharCodes2["LOWER_A"] = 97] = "LOWER_A";
  CharCodes2[CharCodes2["LOWER_X"] = 120] = "LOWER_X";
})(CharCodes || (CharCodes = {}));
var TO_LOWER_BIT = 32;
var CONSUMED_SHIFT = 21;
var CODE_POINT_MASK = 2097151;
var CONSUMED_OVERFLOW = 2047;
var longNumericConsumed = 0;
function unpackConsumed(packed) {
  const consumed = packed >>> CONSUMED_SHIFT;
  return consumed === CONSUMED_OVERFLOW ? longNumericConsumed : consumed;
}
function isNumber(code) {
  return code - CharCodes.ZERO >>> 0 <= 9;
}
function isHexadecimalCharacter(code) {
  return (code | TO_LOWER_BIT) - CharCodes.LOWER_A >>> 0 <= 5;
}
function isAlpha(code) {
  return (code | TO_LOWER_BIT) - CharCodes.LOWER_A >>> 0 <= 25;
}
function isEntityInAttributeInvalidEnd(code) {
  return code === CharCodes.EQUALS || isAlpha(code) || isNumber(code);
}
var EntityDecoderState;
(function(EntityDecoderState2) {
  EntityDecoderState2[EntityDecoderState2["EntityStart"] = 0] = "EntityStart";
  EntityDecoderState2[EntityDecoderState2["NumericStart"] = 1] = "NumericStart";
  EntityDecoderState2[EntityDecoderState2["NumericDecimal"] = 2] = "NumericDecimal";
  EntityDecoderState2[EntityDecoderState2["NumericHex"] = 3] = "NumericHex";
  EntityDecoderState2[EntityDecoderState2["NamedEntity"] = 4] = "NamedEntity";
})(EntityDecoderState || (EntityDecoderState = {}));
var DecodingMode;
(function(DecodingMode2) {
  DecodingMode2[DecodingMode2["Legacy"] = 0] = "Legacy";
  DecodingMode2[DecodingMode2["Strict"] = 1] = "Strict";
  DecodingMode2[DecodingMode2["Attribute"] = 2] = "Attribute";
})(DecodingMode || (DecodingMode = {}));
var EntityDecoder = class {
  decodeTree;
  emitCodePoint;
  errors;
  /** The current state of the decoder. */
  state = EntityDecoderState.EntityStart;
  /** Characters that were consumed while parsing an entity. */
  consumed = 1;
  /**
   * The result of the entity.
   *
   * For named entities: the trie index of the best legacy match so far
   * (0 = none). For numeric entities: the accumulated code point.
   */
  result = 0;
  /** The current index in the decode tree. */
  treeIndex = 0;
  /**
   * Characters consumed since the last recorded legacy match, plus one.
   * Invariant at the top of the `stateNamedEntity` loop: `excess` equals
   * the number of unrecorded consumed characters + 1.
   */
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: False positive (read via destructuring)
  excess = 1;
  /** The mode in which the decoder is operating. */
  decodeMode = DecodingMode.Strict;
  /** The number of characters that have been consumed in the current run. */
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: False positive
  runConsumed = 0;
  constructor(decodeTree, emitCodePoint, errors) {
    this.decodeTree = decodeTree;
    this.emitCodePoint = emitCodePoint;
    this.errors = errors;
  }
  /**
   * Resets the instance to make it reusable.
   * @param decodeMode Entity decoding mode to use.
   */
  startEntity(decodeMode) {
    this.decodeMode = decodeMode;
    this.state = EntityDecoderState.EntityStart;
    this.result = 0;
    this.treeIndex = 0;
    this.excess = 1;
    this.consumed = 1;
    this.runConsumed = 0;
  }
  /**
   * Write an entity to the decoder. This can be called multiple times with partial entities.
   * If the entity is incomplete, the decoder will return -1.
   *
   * Mirrors the non-streaming `decodeWithTrie`, but with the ability to stop decoding if the
   * entity is incomplete, and resume when the next string is written.
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The offset at which the entity begins. Should be 0 if this is not the first call.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  write(input, offset) {
    switch (this.state) {
      case EntityDecoderState.EntityStart: {
        if (input.charCodeAt(offset) === CharCodes.NUM) {
          this.state = EntityDecoderState.NumericStart;
          this.consumed += 1;
          return this.stateNumericStart(input, offset + 1);
        }
        this.state = EntityDecoderState.NamedEntity;
        return this.stateNamedEntity(input, offset);
      }
      case EntityDecoderState.NumericStart: {
        return this.stateNumericStart(input, offset);
      }
      case EntityDecoderState.NumericDecimal: {
        return this.stateNumericDecimal(input, offset);
      }
      case EntityDecoderState.NumericHex: {
        return this.stateNumericHex(input, offset);
      }
      default: {
        return this.stateNamedEntity(input, offset);
      }
    }
  }
  /**
   * Switches between the numeric decimal and hexadecimal states.
   *
   * Equivalent to the `Numeric character reference state` in the HTML spec.
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The current offset.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  // eslint-disable-next-line unicorn/consistent-class-member-order
  stateNumericStart(input, offset) {
    if (offset >= input.length) {
      return -1;
    }
    if ((input.charCodeAt(offset) | TO_LOWER_BIT) === CharCodes.LOWER_X) {
      this.state = EntityDecoderState.NumericHex;
      this.consumed += 1;
      return this.stateNumericHex(input, offset + 1);
    }
    this.state = EntityDecoderState.NumericDecimal;
    return this.stateNumericDecimal(input, offset);
  }
  /**
   * Parses a hexadecimal numeric entity.
   *
   * Equivalent to the `Hexademical character reference state` in the HTML
   * spec. Digit parsing matches the hex loop in `parseNumericEntity`.
   * The accumulated value is preserved for numeric validation callbacks.
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The current offset.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  stateNumericHex(input, offset) {
    const inputLength = input.length;
    let { result } = this;
    let { consumed } = this;
    while (offset < inputLength) {
      const char = input.charCodeAt(offset);
      if (isNumber(char) || isHexadecimalCharacter(char)) {
        const digit = char <= CharCodes.NINE ? char - CharCodes.ZERO : (char | TO_LOWER_BIT) - CharCodes.LOWER_A + 10;
        result = result * 16 + digit;
        consumed += 1;
        offset += 1;
      } else {
        this.result = result;
        this.consumed = consumed;
        return this.emitNumericEntity(char, 3);
      }
    }
    this.result = result;
    this.consumed = consumed;
    return -1;
  }
  /**
   * Parses a decimal numeric entity.
   *
   * Equivalent to the `Decimal character reference state` in the HTML
   * spec. Digit parsing matches the decimal loop in `parseNumericEntity`.
   * The accumulated value is preserved for numeric validation callbacks.
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The current offset.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  stateNumericDecimal(input, offset) {
    const inputLength = input.length;
    let { result } = this;
    let { consumed } = this;
    while (offset < inputLength) {
      const digit = input.charCodeAt(offset) - CharCodes.ZERO;
      if (digit >>> 0 > 9) {
        this.result = result;
        this.consumed = consumed;
        return this.emitNumericEntity(digit + CharCodes.ZERO, 2);
      }
      result = result * 10 + digit;
      consumed += 1;
      offset += 1;
    }
    this.result = result;
    this.consumed = consumed;
    return -1;
  }
  /**
   * Validate and emit a numeric entity.
   *
   * Implements the logic from the `Hexademical character reference start
   * state` and `Numeric character reference end state` in the HTML spec.
   * @param lastCp The last code point of the entity. Used to see if the
   *               entity was terminated with a semicolon.
   * @param expectedLength The minimum number of characters that should be
   *                       consumed. Used to validate that at least one digit
   *                       was consumed.
   * @returns The number of characters that were consumed.
   */
  emitNumericEntity(lastCp, expectedLength) {
    if (this.consumed <= expectedLength) {
      this.errors?.absenceOfDigitsInNumericCharacterReference(this.consumed);
      return 0;
    }
    if (lastCp === CharCodes.SEMI) {
      this.consumed += 1;
    } else if (this.decodeMode === DecodingMode.Strict) {
      return 0;
    }
    this.emitCodePoint((this.decodeTree === xmlDecodeTree ? replaceCodePointXML : replaceCodePoint)(this.result), this.consumed);
    if (this.errors) {
      if (lastCp !== CharCodes.SEMI) {
        this.errors.missingSemicolonAfterCharacterReference();
      }
      this.errors.validateNumericCharacterReference(this.result);
    }
    return this.consumed;
  }
  /**
   * Flush locally-tracked walk state back to the fields, then emit the
   * recorded legacy match or reject (cold path — at most once per
   * entity). Called after failed navigation (leaf node, branch miss, or
   * compact-run mismatch). In attribute mode, reject if no legacy was
   * recorded at the current node, if we descended past it, or if the
   * pending input character is an invalid attribute terminator.
   * @param consumed Locally-tracked consumed count.
   * @param excess Locally-tracked excess count.
   * @param char Pending input character (may be the mismatching char).
   * @param valueLength Value length at the current trie node.
   */
  flushAndEmitLegacyOrReject(consumed, excess, char, valueLength) {
    this.consumed = consumed;
    this.excess = excess;
    return this.result === 0 || this.decodeMode === DecodingMode.Attribute && (valueLength === 0 || excess > 1 || isEntityInAttributeInvalidEnd(char)) ? 0 : this.emitNotTerminatedNamedEntity();
  }
  /**
   * Parses a named entity.
   *
   * Equivalent to the `Named character reference state` in the HTML spec.
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The current offset.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  stateNamedEntity(input, offset) {
    const { decodeTree } = this;
    const inputLength = input.length;
    const isStrict = this.decodeMode === DecodingMode.Strict;
    let { treeIndex } = this;
    let { excess } = this;
    let { consumed } = this;
    let current = decodeTree[treeIndex];
    while (offset < inputLength) {
      while ((current & (BinTrieFlags.VALUE_LENGTH | BinTrieFlags.FLAG13)) === 0 && (current & BinTrieFlags.JUMP_TABLE) !== 0) {
        const char2 = input.charCodeAt(offset);
        const jumpOffset = current & BinTrieFlags.JUMP_TABLE;
        const branchCount = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
        if (branchCount === 0) {
          if (char2 !== jumpOffset) {
            return this.flushAndEmitLegacyOrReject(consumed, excess, char2, 0);
          }
          treeIndex += 1;
        } else {
          const slot = char2 - jumpOffset;
          if (slot >>> 0 >= branchCount) {
            return this.flushAndEmitLegacyOrReject(consumed, excess, char2, 0);
          }
          const stored = decodeTree[treeIndex + 1 + slot];
          if (stored === 0) {
            return this.flushAndEmitLegacyOrReject(consumed, excess, char2, 0);
          }
          treeIndex = treeIndex + branchCount + stored & 65535;
        }
        current = decodeTree[treeIndex];
        offset += 1;
        excess += 1;
        if (offset >= inputLength)
          break;
      }
      if (offset >= inputLength)
        break;
      if ((current & (BinTrieFlags.VALUE_LENGTH | BinTrieFlags.FLAG13)) === BinTrieFlags.FLAG13) {
        const runLength = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
        let { runConsumed } = this;
        if (runConsumed === 0) {
          const char2 = input.charCodeAt(offset);
          if (char2 !== (current & BinTrieFlags.JUMP_TABLE)) {
            return this.flushAndEmitLegacyOrReject(consumed, excess, char2, 0);
          }
          offset += 1;
          excess += 1;
          runConsumed = 1;
        }
        while (runConsumed < runLength) {
          if (offset >= inputLength) {
            this.treeIndex = treeIndex;
            this.excess = excess;
            this.consumed = consumed;
            this.runConsumed = runConsumed;
            return -1;
          }
          const charIndexInPacked = runConsumed - 1;
          const packedWord = decodeTree[treeIndex + 1 + (charIndexInPacked >> 1)];
          const expectedChar = packedWord >> ((charIndexInPacked & 1) << 3) & 255;
          const char2 = input.charCodeAt(offset);
          if (char2 !== expectedChar) {
            this.runConsumed = 0;
            return this.flushAndEmitLegacyOrReject(consumed, excess, char2, 0);
          }
          offset += 1;
          excess += 1;
          runConsumed += 1;
        }
        this.runConsumed = 0;
        treeIndex += 1 + (runLength >> 1);
        current = decodeTree[treeIndex];
        continue;
      }
      const valueLength = current >>> 14;
      const char = input.charCodeAt(offset);
      if (valueLength !== 0) {
        if (!isStrict && (current & BinTrieFlags.FLAG13) === 0) {
          this.result = treeIndex;
          consumed += excess - 1;
          excess = 1;
        }
        if (char === CharCodes.SEMI) {
          return this.emitNamedEntityData(treeIndex, valueLength, consumed + excess);
        }
        if (valueLength === 1) {
          return this.flushAndEmitLegacyOrReject(consumed, excess, char, valueLength);
        }
      }
      const next = determineBranch(decodeTree, current, treeIndex + (valueLength || 1), char);
      if (next < 0) {
        return this.flushAndEmitLegacyOrReject(consumed, excess, char, valueLength);
      }
      treeIndex = next;
      current = decodeTree[treeIndex];
      offset += 1;
      excess += 1;
    }
    if (!isStrict && current >>> 14 !== 0 && (current & BinTrieFlags.FLAG13) === 0) {
      this.result = treeIndex;
      consumed += excess - 1;
      excess = 1;
    }
    this.treeIndex = treeIndex;
    this.excess = excess;
    this.consumed = consumed;
    return -1;
  }
  /**
   * Emit a named entity that was not terminated with a semicolon.
   * @returns The number of characters consumed.
   */
  emitNotTerminatedNamedEntity() {
    const { result, decodeTree } = this;
    const valueLength = decodeTree[result] >>> 14;
    this.emitNamedEntityData(result, valueLength, this.consumed);
    this.errors?.missingSemicolonAfterCharacterReference();
    return this.consumed;
  }
  /**
   * Emit a named entity.
   * @param result The index of the entity in the decode tree.
   * @param valueLength Encoded value length (header plus any value words).
   * @param consumed The number of characters consumed.
   * @returns The number of characters consumed.
   */
  emitNamedEntityData(result, valueLength, consumed) {
    const { decodeTree } = this;
    this.emitCodePoint(valueLength === 1 ? decodeTree[result] & BinTrieFlags.VALUE_MASK : decodeTree[result + 1], consumed);
    if (valueLength === 3) {
      this.emitCodePoint(decodeTree[result + 2], consumed);
    }
    return consumed;
  }
  /**
   * Signal to the parser that the end of the input was reached.
   *
   * Remaining data will be emitted and relevant errors will be produced.
   * @returns The number of characters consumed.
   */
  end() {
    switch (this.state) {
      case EntityDecoderState.NamedEntity: {
        return this.result !== 0 && (this.decodeMode !== DecodingMode.Attribute || this.result === this.treeIndex) ? this.emitNotTerminatedNamedEntity() : 0;
      }
      // Otherwise, emit a numeric entity if we have one.
      case EntityDecoderState.NumericDecimal: {
        return this.emitNumericEntity(0, 2);
      }
      case EntityDecoderState.NumericHex: {
        return this.emitNumericEntity(0, 3);
      }
      case EntityDecoderState.NumericStart: {
        this.errors?.absenceOfDigitsInNumericCharacterReference(this.consumed);
        return 0;
      }
      default: {
        return 0;
      }
    }
  }
};
function determineBranch(decodeTree, current, nodeIndex, char) {
  const branchCount = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
  const jumpOffset = current & BinTrieFlags.JUMP_TABLE;
  if (jumpOffset) {
    if (branchCount === 0) {
      return char === jumpOffset ? nodeIndex : -1;
    }
    const slot = char - jumpOffset;
    if (slot >>> 0 >= branchCount)
      return -1;
    const stored = decodeTree[nodeIndex + slot];
    return stored === 0 ? -1 : nodeIndex + branchCount + stored - 1 & 65535;
  }
  if (branchCount === 0)
    return -1;
  const packedKeySlots = branchCount + 1 >> 1;
  const branchEnd = nodeIndex + packedKeySlots + branchCount;
  for (let index = 0; index < branchCount; index++) {
    const packed = decodeTree[nodeIndex + (index >> 1)];
    const key = packed >> ((index & 1) << 3) & 255;
    if (key === char) {
      const pointerIndex = nodeIndex + packedKeySlots + index;
      return branchEnd + decodeTree[pointerIndex] & 65535;
    }
    if (key > char)
      return -1;
  }
  return -1;
}
function readTrieValue(decodeTree, nodeIndex, valueLength) {
  if (valueLength === 1) {
    return String.fromCharCode(decodeTree[nodeIndex] & BinTrieFlags.VALUE_MASK);
  }
  if (valueLength === 2) {
    return String.fromCharCode(decodeTree[nodeIndex + 1]);
  }
  return String.fromCharCode(decodeTree[nodeIndex + 1], decodeTree[nodeIndex + 2]);
}
function parseNumericEntity(input, numberStart, inputLength) {
  let offset = numberStart + 1;
  let cp = 0;
  let digitStart = offset;
  if (offset < inputLength && (input.charCodeAt(offset) | TO_LOWER_BIT) === CharCodes.LOWER_X) {
    offset += 1;
    digitStart = offset;
    while (offset < inputLength) {
      const char = input.charCodeAt(offset);
      if (isNumber(char)) {
        cp = cp * 16 + (char - CharCodes.ZERO);
      } else if (isHexadecimalCharacter(char)) {
        cp = cp * 16 + ((char | TO_LOWER_BIT) - CharCodes.LOWER_A + 10);
      } else {
        break;
      }
      offset += 1;
    }
  } else {
    while (offset < inputLength) {
      const digit = input.charCodeAt(offset) - CharCodes.ZERO;
      if (digit >>> 0 > 9)
        break;
      cp = cp * 10 + digit;
      offset += 1;
    }
  }
  if (offset === digitStart)
    return 0;
  if (offset < inputLength && input.charCodeAt(offset) === CharCodes.SEMI) {
    offset += 1;
  }
  if (cp > 1114111)
    cp = 1114112;
  let consumed = offset - numberStart;
  if (consumed >= CONSUMED_OVERFLOW) {
    longNumericConsumed = consumed;
    consumed = CONSUMED_OVERFLOW;
  }
  return consumed << CONSUMED_SHIFT | cp;
}
function decodeWithTrie(input, isStrict, isAttribute) {
  const decodeTree = htmlDecodeTree;
  let offset = input.indexOf("&");
  if (offset < 0)
    return input;
  const inputLength = input.length;
  let chunkStart = 0;
  let result = "";
  const root = decodeTree[0];
  const rootJumpOffset = root & BinTrieFlags.JUMP_TABLE;
  const rootBranchCount = (root & BinTrieFlags.BRANCH_LENGTH) >> 7;
  do {
    const entityStart = offset + 1;
    const firstChar = input.charCodeAt(entityStart);
    let consumed;
    let value;
    if (firstChar === CharCodes.NUM) {
      const packed = parseNumericEntity(input, entityStart, inputLength);
      consumed = unpackConsumed(packed);
      if (isStrict && consumed > 0 && input.charCodeAt(entityStart + consumed - 1) !== CharCodes.SEMI) {
        consumed = 0;
      }
      value = consumed === 0 ? "" : codePointToString(packed & CODE_POINT_MASK);
    } else if (isAlpha(firstChar)) {
      consumed = 0;
      value = "";
      const rootSlotIndex = firstChar - rootJumpOffset;
      let nodeIndex;
      if (rootSlotIndex >>> 0 < rootBranchCount) {
        const stored = decodeTree[1 + rootSlotIndex];
        nodeIndex = stored === 0 ? -1 : rootBranchCount + stored & 65535;
      } else {
        nodeIndex = -1;
      }
      let bestNodeIndex = 0;
      let bestValueLength = 0;
      let current = nodeIndex < 0 ? 0 : decodeTree[nodeIndex];
      let index = entityStart + 1;
      trie: while (index < inputLength) {
        while (
          // Value-less, non-run node with a nonzero jump offset.
          (current & (BinTrieFlags.VALUE_LENGTH | BinTrieFlags.FLAG13)) === 0 && (current & BinTrieFlags.JUMP_TABLE) !== 0
        ) {
          const jumpOffset = current & BinTrieFlags.JUMP_TABLE;
          const branchCount = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
          if (branchCount === 0) {
            if (input.charCodeAt(index) !== jumpOffset)
              break trie;
            nodeIndex += 1;
          } else {
            const slot = input.charCodeAt(index) - jumpOffset;
            if (slot >>> 0 >= branchCount)
              break trie;
            const stored = decodeTree[nodeIndex + 1 + slot];
            if (stored === 0)
              break trie;
            nodeIndex = nodeIndex + branchCount + stored & 65535;
          }
          current = decodeTree[nodeIndex];
          index += 1;
          if (index >= inputLength)
            break trie;
        }
        if ((current & (BinTrieFlags.VALUE_LENGTH | BinTrieFlags.FLAG13)) === BinTrieFlags.FLAG13) {
          const runLength = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
          if (input.charCodeAt(index) !== (current & BinTrieFlags.JUMP_TABLE)) {
            break;
          }
          index += 1;
          const remaining = runLength - 1;
          let wordIndex = nodeIndex + 1;
          let charIndexInPacked = 0;
          for (; charIndexInPacked + 1 < remaining; charIndexInPacked += 2) {
            const packed = decodeTree[wordIndex];
            if (input.charCodeAt(index) !== (packed & 255))
              break trie;
            index += 1;
            if (input.charCodeAt(index) !== (packed >> 8 & 255))
              break trie;
            index += 1;
            wordIndex += 1;
          }
          if (charIndexInPacked < remaining) {
            if (input.charCodeAt(index) !== (decodeTree[wordIndex] & 255))
              break;
            index += 1;
          }
          nodeIndex += 1 + (runLength >> 1);
          current = decodeTree[nodeIndex];
          continue;
        }
        const valueLength = current >>> 14;
        const char = input.charCodeAt(index);
        if (valueLength !== 0) {
          if (char === CharCodes.SEMI) {
            consumed = index - entityStart + 1;
            value = valueLength === 1 ? String.fromCharCode(current & BinTrieFlags.VALUE_MASK) : readTrieValue(decodeTree, nodeIndex, valueLength);
            break;
          }
          if (!isStrict && (current & BinTrieFlags.FLAG13) === 0) {
            consumed = index - entityStart;
            bestNodeIndex = nodeIndex;
            bestValueLength = valueLength;
          }
          if (valueLength === 1)
            break;
        }
        const next = determineBranch(decodeTree, current, nodeIndex + (valueLength || 1), char);
        if (next < 0)
          break;
        nodeIndex = next;
        current = decodeTree[nodeIndex];
        index += 1;
      }
      if (value === "") {
        const finalVL = current >>> 14;
        if (finalVL !== 0 && !isStrict && (current & BinTrieFlags.FLAG13) === 0) {
          consumed = index - entityStart;
          bestNodeIndex = nodeIndex;
          bestValueLength = finalVL;
        }
        if (consumed > 0) {
          value = readTrieValue(decodeTree, bestNodeIndex, bestValueLength);
        }
      }
    } else {
      consumed = 0;
      value = "";
    }
    if (consumed === 0 || isAttribute && firstChar !== CharCodes.NUM && input.charCodeAt(entityStart + consumed - 1) !== CharCodes.SEMI && entityStart + consumed < inputLength && isEntityInAttributeInvalidEnd(input.charCodeAt(entityStart + consumed))) {
      offset = entityStart;
    } else {
      if (chunkStart < offset) {
        result += input.slice(chunkStart, offset);
      }
      result += value;
      offset = chunkStart = entityStart + consumed;
    }
    if (input.charCodeAt(offset) !== CharCodes.AMP) {
      offset = input.indexOf("&", offset);
    }
  } while (offset >= 0);
  return result + input.slice(chunkStart);
}
function decodeHTMLAttribute(htmlAttribute) {
  return decodeWithTrie(htmlAttribute, false, true);
}

// node_modules/parse5/dist/common/html.js
var NS;
(function(NS2) {
  NS2["HTML"] = "http://www.w3.org/1999/xhtml";
  NS2["MATHML"] = "http://www.w3.org/1998/Math/MathML";
  NS2["SVG"] = "http://www.w3.org/2000/svg";
  NS2["XLINK"] = "http://www.w3.org/1999/xlink";
  NS2["XML"] = "http://www.w3.org/XML/1998/namespace";
  NS2["XMLNS"] = "http://www.w3.org/2000/xmlns/";
})(NS || (NS = {}));
var ATTRS;
(function(ATTRS2) {
  ATTRS2["TYPE"] = "type";
  ATTRS2["ACTION"] = "action";
  ATTRS2["ENCODING"] = "encoding";
  ATTRS2["PROMPT"] = "prompt";
  ATTRS2["NAME"] = "name";
  ATTRS2["COLOR"] = "color";
  ATTRS2["FACE"] = "face";
  ATTRS2["SIZE"] = "size";
})(ATTRS || (ATTRS = {}));
var DOCUMENT_MODE;
(function(DOCUMENT_MODE2) {
  DOCUMENT_MODE2["NO_QUIRKS"] = "no-quirks";
  DOCUMENT_MODE2["QUIRKS"] = "quirks";
  DOCUMENT_MODE2["LIMITED_QUIRKS"] = "limited-quirks";
})(DOCUMENT_MODE || (DOCUMENT_MODE = {}));
var TAG_NAMES;
(function(TAG_NAMES2) {
  TAG_NAMES2["A"] = "a";
  TAG_NAMES2["ADDRESS"] = "address";
  TAG_NAMES2["ANNOTATION_XML"] = "annotation-xml";
  TAG_NAMES2["APPLET"] = "applet";
  TAG_NAMES2["AREA"] = "area";
  TAG_NAMES2["ARTICLE"] = "article";
  TAG_NAMES2["ASIDE"] = "aside";
  TAG_NAMES2["B"] = "b";
  TAG_NAMES2["BASE"] = "base";
  TAG_NAMES2["BASEFONT"] = "basefont";
  TAG_NAMES2["BGSOUND"] = "bgsound";
  TAG_NAMES2["BIG"] = "big";
  TAG_NAMES2["BLOCKQUOTE"] = "blockquote";
  TAG_NAMES2["BODY"] = "body";
  TAG_NAMES2["BR"] = "br";
  TAG_NAMES2["BUTTON"] = "button";
  TAG_NAMES2["CAPTION"] = "caption";
  TAG_NAMES2["CENTER"] = "center";
  TAG_NAMES2["CODE"] = "code";
  TAG_NAMES2["COL"] = "col";
  TAG_NAMES2["COLGROUP"] = "colgroup";
  TAG_NAMES2["DD"] = "dd";
  TAG_NAMES2["DESC"] = "desc";
  TAG_NAMES2["DETAILS"] = "details";
  TAG_NAMES2["DIALOG"] = "dialog";
  TAG_NAMES2["DIR"] = "dir";
  TAG_NAMES2["DIV"] = "div";
  TAG_NAMES2["DL"] = "dl";
  TAG_NAMES2["DT"] = "dt";
  TAG_NAMES2["EM"] = "em";
  TAG_NAMES2["EMBED"] = "embed";
  TAG_NAMES2["FIELDSET"] = "fieldset";
  TAG_NAMES2["FIGCAPTION"] = "figcaption";
  TAG_NAMES2["FIGURE"] = "figure";
  TAG_NAMES2["FONT"] = "font";
  TAG_NAMES2["FOOTER"] = "footer";
  TAG_NAMES2["FOREIGN_OBJECT"] = "foreignObject";
  TAG_NAMES2["FORM"] = "form";
  TAG_NAMES2["FRAME"] = "frame";
  TAG_NAMES2["FRAMESET"] = "frameset";
  TAG_NAMES2["H1"] = "h1";
  TAG_NAMES2["H2"] = "h2";
  TAG_NAMES2["H3"] = "h3";
  TAG_NAMES2["H4"] = "h4";
  TAG_NAMES2["H5"] = "h5";
  TAG_NAMES2["H6"] = "h6";
  TAG_NAMES2["HEAD"] = "head";
  TAG_NAMES2["HEADER"] = "header";
  TAG_NAMES2["HGROUP"] = "hgroup";
  TAG_NAMES2["HR"] = "hr";
  TAG_NAMES2["HTML"] = "html";
  TAG_NAMES2["I"] = "i";
  TAG_NAMES2["IMG"] = "img";
  TAG_NAMES2["IMAGE"] = "image";
  TAG_NAMES2["INPUT"] = "input";
  TAG_NAMES2["IFRAME"] = "iframe";
  TAG_NAMES2["KEYGEN"] = "keygen";
  TAG_NAMES2["LABEL"] = "label";
  TAG_NAMES2["LI"] = "li";
  TAG_NAMES2["LINK"] = "link";
  TAG_NAMES2["LISTING"] = "listing";
  TAG_NAMES2["MAIN"] = "main";
  TAG_NAMES2["MALIGNMARK"] = "malignmark";
  TAG_NAMES2["MARQUEE"] = "marquee";
  TAG_NAMES2["MATH"] = "math";
  TAG_NAMES2["MENU"] = "menu";
  TAG_NAMES2["META"] = "meta";
  TAG_NAMES2["MGLYPH"] = "mglyph";
  TAG_NAMES2["MI"] = "mi";
  TAG_NAMES2["MO"] = "mo";
  TAG_NAMES2["MN"] = "mn";
  TAG_NAMES2["MS"] = "ms";
  TAG_NAMES2["MTEXT"] = "mtext";
  TAG_NAMES2["NAV"] = "nav";
  TAG_NAMES2["NOBR"] = "nobr";
  TAG_NAMES2["NOFRAMES"] = "noframes";
  TAG_NAMES2["NOEMBED"] = "noembed";
  TAG_NAMES2["NOSCRIPT"] = "noscript";
  TAG_NAMES2["OBJECT"] = "object";
  TAG_NAMES2["OL"] = "ol";
  TAG_NAMES2["OPTGROUP"] = "optgroup";
  TAG_NAMES2["OPTION"] = "option";
  TAG_NAMES2["P"] = "p";
  TAG_NAMES2["PARAM"] = "param";
  TAG_NAMES2["PLAINTEXT"] = "plaintext";
  TAG_NAMES2["PRE"] = "pre";
  TAG_NAMES2["RB"] = "rb";
  TAG_NAMES2["RP"] = "rp";
  TAG_NAMES2["RT"] = "rt";
  TAG_NAMES2["RTC"] = "rtc";
  TAG_NAMES2["RUBY"] = "ruby";
  TAG_NAMES2["S"] = "s";
  TAG_NAMES2["SCRIPT"] = "script";
  TAG_NAMES2["SEARCH"] = "search";
  TAG_NAMES2["SECTION"] = "section";
  TAG_NAMES2["SELECT"] = "select";
  TAG_NAMES2["SOURCE"] = "source";
  TAG_NAMES2["SMALL"] = "small";
  TAG_NAMES2["SPAN"] = "span";
  TAG_NAMES2["STRIKE"] = "strike";
  TAG_NAMES2["STRONG"] = "strong";
  TAG_NAMES2["STYLE"] = "style";
  TAG_NAMES2["SUB"] = "sub";
  TAG_NAMES2["SUMMARY"] = "summary";
  TAG_NAMES2["SUP"] = "sup";
  TAG_NAMES2["TABLE"] = "table";
  TAG_NAMES2["TBODY"] = "tbody";
  TAG_NAMES2["TEMPLATE"] = "template";
  TAG_NAMES2["TEXTAREA"] = "textarea";
  TAG_NAMES2["TFOOT"] = "tfoot";
  TAG_NAMES2["TD"] = "td";
  TAG_NAMES2["TH"] = "th";
  TAG_NAMES2["THEAD"] = "thead";
  TAG_NAMES2["TITLE"] = "title";
  TAG_NAMES2["TR"] = "tr";
  TAG_NAMES2["TRACK"] = "track";
  TAG_NAMES2["TT"] = "tt";
  TAG_NAMES2["U"] = "u";
  TAG_NAMES2["UL"] = "ul";
  TAG_NAMES2["SVG"] = "svg";
  TAG_NAMES2["VAR"] = "var";
  TAG_NAMES2["WBR"] = "wbr";
  TAG_NAMES2["XMP"] = "xmp";
})(TAG_NAMES || (TAG_NAMES = {}));
var TAG_ID;
(function(TAG_ID2) {
  TAG_ID2[TAG_ID2["UNKNOWN"] = 0] = "UNKNOWN";
  TAG_ID2[TAG_ID2["A"] = 1] = "A";
  TAG_ID2[TAG_ID2["ADDRESS"] = 2] = "ADDRESS";
  TAG_ID2[TAG_ID2["ANNOTATION_XML"] = 3] = "ANNOTATION_XML";
  TAG_ID2[TAG_ID2["APPLET"] = 4] = "APPLET";
  TAG_ID2[TAG_ID2["AREA"] = 5] = "AREA";
  TAG_ID2[TAG_ID2["ARTICLE"] = 6] = "ARTICLE";
  TAG_ID2[TAG_ID2["ASIDE"] = 7] = "ASIDE";
  TAG_ID2[TAG_ID2["B"] = 8] = "B";
  TAG_ID2[TAG_ID2["BASE"] = 9] = "BASE";
  TAG_ID2[TAG_ID2["BASEFONT"] = 10] = "BASEFONT";
  TAG_ID2[TAG_ID2["BGSOUND"] = 11] = "BGSOUND";
  TAG_ID2[TAG_ID2["BIG"] = 12] = "BIG";
  TAG_ID2[TAG_ID2["BLOCKQUOTE"] = 13] = "BLOCKQUOTE";
  TAG_ID2[TAG_ID2["BODY"] = 14] = "BODY";
  TAG_ID2[TAG_ID2["BR"] = 15] = "BR";
  TAG_ID2[TAG_ID2["BUTTON"] = 16] = "BUTTON";
  TAG_ID2[TAG_ID2["CAPTION"] = 17] = "CAPTION";
  TAG_ID2[TAG_ID2["CENTER"] = 18] = "CENTER";
  TAG_ID2[TAG_ID2["CODE"] = 19] = "CODE";
  TAG_ID2[TAG_ID2["COL"] = 20] = "COL";
  TAG_ID2[TAG_ID2["COLGROUP"] = 21] = "COLGROUP";
  TAG_ID2[TAG_ID2["DD"] = 22] = "DD";
  TAG_ID2[TAG_ID2["DESC"] = 23] = "DESC";
  TAG_ID2[TAG_ID2["DETAILS"] = 24] = "DETAILS";
  TAG_ID2[TAG_ID2["DIALOG"] = 25] = "DIALOG";
  TAG_ID2[TAG_ID2["DIR"] = 26] = "DIR";
  TAG_ID2[TAG_ID2["DIV"] = 27] = "DIV";
  TAG_ID2[TAG_ID2["DL"] = 28] = "DL";
  TAG_ID2[TAG_ID2["DT"] = 29] = "DT";
  TAG_ID2[TAG_ID2["EM"] = 30] = "EM";
  TAG_ID2[TAG_ID2["EMBED"] = 31] = "EMBED";
  TAG_ID2[TAG_ID2["FIELDSET"] = 32] = "FIELDSET";
  TAG_ID2[TAG_ID2["FIGCAPTION"] = 33] = "FIGCAPTION";
  TAG_ID2[TAG_ID2["FIGURE"] = 34] = "FIGURE";
  TAG_ID2[TAG_ID2["FONT"] = 35] = "FONT";
  TAG_ID2[TAG_ID2["FOOTER"] = 36] = "FOOTER";
  TAG_ID2[TAG_ID2["FOREIGN_OBJECT"] = 37] = "FOREIGN_OBJECT";
  TAG_ID2[TAG_ID2["FORM"] = 38] = "FORM";
  TAG_ID2[TAG_ID2["FRAME"] = 39] = "FRAME";
  TAG_ID2[TAG_ID2["FRAMESET"] = 40] = "FRAMESET";
  TAG_ID2[TAG_ID2["H1"] = 41] = "H1";
  TAG_ID2[TAG_ID2["H2"] = 42] = "H2";
  TAG_ID2[TAG_ID2["H3"] = 43] = "H3";
  TAG_ID2[TAG_ID2["H4"] = 44] = "H4";
  TAG_ID2[TAG_ID2["H5"] = 45] = "H5";
  TAG_ID2[TAG_ID2["H6"] = 46] = "H6";
  TAG_ID2[TAG_ID2["HEAD"] = 47] = "HEAD";
  TAG_ID2[TAG_ID2["HEADER"] = 48] = "HEADER";
  TAG_ID2[TAG_ID2["HGROUP"] = 49] = "HGROUP";
  TAG_ID2[TAG_ID2["HR"] = 50] = "HR";
  TAG_ID2[TAG_ID2["HTML"] = 51] = "HTML";
  TAG_ID2[TAG_ID2["I"] = 52] = "I";
  TAG_ID2[TAG_ID2["IMG"] = 53] = "IMG";
  TAG_ID2[TAG_ID2["IMAGE"] = 54] = "IMAGE";
  TAG_ID2[TAG_ID2["INPUT"] = 55] = "INPUT";
  TAG_ID2[TAG_ID2["IFRAME"] = 56] = "IFRAME";
  TAG_ID2[TAG_ID2["KEYGEN"] = 57] = "KEYGEN";
  TAG_ID2[TAG_ID2["LABEL"] = 58] = "LABEL";
  TAG_ID2[TAG_ID2["LI"] = 59] = "LI";
  TAG_ID2[TAG_ID2["LINK"] = 60] = "LINK";
  TAG_ID2[TAG_ID2["LISTING"] = 61] = "LISTING";
  TAG_ID2[TAG_ID2["MAIN"] = 62] = "MAIN";
  TAG_ID2[TAG_ID2["MALIGNMARK"] = 63] = "MALIGNMARK";
  TAG_ID2[TAG_ID2["MARQUEE"] = 64] = "MARQUEE";
  TAG_ID2[TAG_ID2["MATH"] = 65] = "MATH";
  TAG_ID2[TAG_ID2["MENU"] = 66] = "MENU";
  TAG_ID2[TAG_ID2["META"] = 67] = "META";
  TAG_ID2[TAG_ID2["MGLYPH"] = 68] = "MGLYPH";
  TAG_ID2[TAG_ID2["MI"] = 69] = "MI";
  TAG_ID2[TAG_ID2["MO"] = 70] = "MO";
  TAG_ID2[TAG_ID2["MN"] = 71] = "MN";
  TAG_ID2[TAG_ID2["MS"] = 72] = "MS";
  TAG_ID2[TAG_ID2["MTEXT"] = 73] = "MTEXT";
  TAG_ID2[TAG_ID2["NAV"] = 74] = "NAV";
  TAG_ID2[TAG_ID2["NOBR"] = 75] = "NOBR";
  TAG_ID2[TAG_ID2["NOFRAMES"] = 76] = "NOFRAMES";
  TAG_ID2[TAG_ID2["NOEMBED"] = 77] = "NOEMBED";
  TAG_ID2[TAG_ID2["NOSCRIPT"] = 78] = "NOSCRIPT";
  TAG_ID2[TAG_ID2["OBJECT"] = 79] = "OBJECT";
  TAG_ID2[TAG_ID2["OL"] = 80] = "OL";
  TAG_ID2[TAG_ID2["OPTGROUP"] = 81] = "OPTGROUP";
  TAG_ID2[TAG_ID2["OPTION"] = 82] = "OPTION";
  TAG_ID2[TAG_ID2["P"] = 83] = "P";
  TAG_ID2[TAG_ID2["PARAM"] = 84] = "PARAM";
  TAG_ID2[TAG_ID2["PLAINTEXT"] = 85] = "PLAINTEXT";
  TAG_ID2[TAG_ID2["PRE"] = 86] = "PRE";
  TAG_ID2[TAG_ID2["RB"] = 87] = "RB";
  TAG_ID2[TAG_ID2["RP"] = 88] = "RP";
  TAG_ID2[TAG_ID2["RT"] = 89] = "RT";
  TAG_ID2[TAG_ID2["RTC"] = 90] = "RTC";
  TAG_ID2[TAG_ID2["RUBY"] = 91] = "RUBY";
  TAG_ID2[TAG_ID2["S"] = 92] = "S";
  TAG_ID2[TAG_ID2["SCRIPT"] = 93] = "SCRIPT";
  TAG_ID2[TAG_ID2["SEARCH"] = 94] = "SEARCH";
  TAG_ID2[TAG_ID2["SECTION"] = 95] = "SECTION";
  TAG_ID2[TAG_ID2["SELECT"] = 96] = "SELECT";
  TAG_ID2[TAG_ID2["SOURCE"] = 97] = "SOURCE";
  TAG_ID2[TAG_ID2["SMALL"] = 98] = "SMALL";
  TAG_ID2[TAG_ID2["SPAN"] = 99] = "SPAN";
  TAG_ID2[TAG_ID2["STRIKE"] = 100] = "STRIKE";
  TAG_ID2[TAG_ID2["STRONG"] = 101] = "STRONG";
  TAG_ID2[TAG_ID2["STYLE"] = 102] = "STYLE";
  TAG_ID2[TAG_ID2["SUB"] = 103] = "SUB";
  TAG_ID2[TAG_ID2["SUMMARY"] = 104] = "SUMMARY";
  TAG_ID2[TAG_ID2["SUP"] = 105] = "SUP";
  TAG_ID2[TAG_ID2["TABLE"] = 106] = "TABLE";
  TAG_ID2[TAG_ID2["TBODY"] = 107] = "TBODY";
  TAG_ID2[TAG_ID2["TEMPLATE"] = 108] = "TEMPLATE";
  TAG_ID2[TAG_ID2["TEXTAREA"] = 109] = "TEXTAREA";
  TAG_ID2[TAG_ID2["TFOOT"] = 110] = "TFOOT";
  TAG_ID2[TAG_ID2["TD"] = 111] = "TD";
  TAG_ID2[TAG_ID2["TH"] = 112] = "TH";
  TAG_ID2[TAG_ID2["THEAD"] = 113] = "THEAD";
  TAG_ID2[TAG_ID2["TITLE"] = 114] = "TITLE";
  TAG_ID2[TAG_ID2["TR"] = 115] = "TR";
  TAG_ID2[TAG_ID2["TRACK"] = 116] = "TRACK";
  TAG_ID2[TAG_ID2["TT"] = 117] = "TT";
  TAG_ID2[TAG_ID2["U"] = 118] = "U";
  TAG_ID2[TAG_ID2["UL"] = 119] = "UL";
  TAG_ID2[TAG_ID2["SVG"] = 120] = "SVG";
  TAG_ID2[TAG_ID2["VAR"] = 121] = "VAR";
  TAG_ID2[TAG_ID2["WBR"] = 122] = "WBR";
  TAG_ID2[TAG_ID2["XMP"] = 123] = "XMP";
})(TAG_ID || (TAG_ID = {}));
var TAG_NAME_TO_ID = /* @__PURE__ */ new Map([
  [TAG_NAMES.A, TAG_ID.A],
  [TAG_NAMES.ADDRESS, TAG_ID.ADDRESS],
  [TAG_NAMES.ANNOTATION_XML, TAG_ID.ANNOTATION_XML],
  [TAG_NAMES.APPLET, TAG_ID.APPLET],
  [TAG_NAMES.AREA, TAG_ID.AREA],
  [TAG_NAMES.ARTICLE, TAG_ID.ARTICLE],
  [TAG_NAMES.ASIDE, TAG_ID.ASIDE],
  [TAG_NAMES.B, TAG_ID.B],
  [TAG_NAMES.BASE, TAG_ID.BASE],
  [TAG_NAMES.BASEFONT, TAG_ID.BASEFONT],
  [TAG_NAMES.BGSOUND, TAG_ID.BGSOUND],
  [TAG_NAMES.BIG, TAG_ID.BIG],
  [TAG_NAMES.BLOCKQUOTE, TAG_ID.BLOCKQUOTE],
  [TAG_NAMES.BODY, TAG_ID.BODY],
  [TAG_NAMES.BR, TAG_ID.BR],
  [TAG_NAMES.BUTTON, TAG_ID.BUTTON],
  [TAG_NAMES.CAPTION, TAG_ID.CAPTION],
  [TAG_NAMES.CENTER, TAG_ID.CENTER],
  [TAG_NAMES.CODE, TAG_ID.CODE],
  [TAG_NAMES.COL, TAG_ID.COL],
  [TAG_NAMES.COLGROUP, TAG_ID.COLGROUP],
  [TAG_NAMES.DD, TAG_ID.DD],
  [TAG_NAMES.DESC, TAG_ID.DESC],
  [TAG_NAMES.DETAILS, TAG_ID.DETAILS],
  [TAG_NAMES.DIALOG, TAG_ID.DIALOG],
  [TAG_NAMES.DIR, TAG_ID.DIR],
  [TAG_NAMES.DIV, TAG_ID.DIV],
  [TAG_NAMES.DL, TAG_ID.DL],
  [TAG_NAMES.DT, TAG_ID.DT],
  [TAG_NAMES.EM, TAG_ID.EM],
  [TAG_NAMES.EMBED, TAG_ID.EMBED],
  [TAG_NAMES.FIELDSET, TAG_ID.FIELDSET],
  [TAG_NAMES.FIGCAPTION, TAG_ID.FIGCAPTION],
  [TAG_NAMES.FIGURE, TAG_ID.FIGURE],
  [TAG_NAMES.FONT, TAG_ID.FONT],
  [TAG_NAMES.FOOTER, TAG_ID.FOOTER],
  [TAG_NAMES.FOREIGN_OBJECT, TAG_ID.FOREIGN_OBJECT],
  [TAG_NAMES.FORM, TAG_ID.FORM],
  [TAG_NAMES.FRAME, TAG_ID.FRAME],
  [TAG_NAMES.FRAMESET, TAG_ID.FRAMESET],
  [TAG_NAMES.H1, TAG_ID.H1],
  [TAG_NAMES.H2, TAG_ID.H2],
  [TAG_NAMES.H3, TAG_ID.H3],
  [TAG_NAMES.H4, TAG_ID.H4],
  [TAG_NAMES.H5, TAG_ID.H5],
  [TAG_NAMES.H6, TAG_ID.H6],
  [TAG_NAMES.HEAD, TAG_ID.HEAD],
  [TAG_NAMES.HEADER, TAG_ID.HEADER],
  [TAG_NAMES.HGROUP, TAG_ID.HGROUP],
  [TAG_NAMES.HR, TAG_ID.HR],
  [TAG_NAMES.HTML, TAG_ID.HTML],
  [TAG_NAMES.I, TAG_ID.I],
  [TAG_NAMES.IMG, TAG_ID.IMG],
  [TAG_NAMES.IMAGE, TAG_ID.IMAGE],
  [TAG_NAMES.INPUT, TAG_ID.INPUT],
  [TAG_NAMES.IFRAME, TAG_ID.IFRAME],
  [TAG_NAMES.KEYGEN, TAG_ID.KEYGEN],
  [TAG_NAMES.LABEL, TAG_ID.LABEL],
  [TAG_NAMES.LI, TAG_ID.LI],
  [TAG_NAMES.LINK, TAG_ID.LINK],
  [TAG_NAMES.LISTING, TAG_ID.LISTING],
  [TAG_NAMES.MAIN, TAG_ID.MAIN],
  [TAG_NAMES.MALIGNMARK, TAG_ID.MALIGNMARK],
  [TAG_NAMES.MARQUEE, TAG_ID.MARQUEE],
  [TAG_NAMES.MATH, TAG_ID.MATH],
  [TAG_NAMES.MENU, TAG_ID.MENU],
  [TAG_NAMES.META, TAG_ID.META],
  [TAG_NAMES.MGLYPH, TAG_ID.MGLYPH],
  [TAG_NAMES.MI, TAG_ID.MI],
  [TAG_NAMES.MO, TAG_ID.MO],
  [TAG_NAMES.MN, TAG_ID.MN],
  [TAG_NAMES.MS, TAG_ID.MS],
  [TAG_NAMES.MTEXT, TAG_ID.MTEXT],
  [TAG_NAMES.NAV, TAG_ID.NAV],
  [TAG_NAMES.NOBR, TAG_ID.NOBR],
  [TAG_NAMES.NOFRAMES, TAG_ID.NOFRAMES],
  [TAG_NAMES.NOEMBED, TAG_ID.NOEMBED],
  [TAG_NAMES.NOSCRIPT, TAG_ID.NOSCRIPT],
  [TAG_NAMES.OBJECT, TAG_ID.OBJECT],
  [TAG_NAMES.OL, TAG_ID.OL],
  [TAG_NAMES.OPTGROUP, TAG_ID.OPTGROUP],
  [TAG_NAMES.OPTION, TAG_ID.OPTION],
  [TAG_NAMES.P, TAG_ID.P],
  [TAG_NAMES.PARAM, TAG_ID.PARAM],
  [TAG_NAMES.PLAINTEXT, TAG_ID.PLAINTEXT],
  [TAG_NAMES.PRE, TAG_ID.PRE],
  [TAG_NAMES.RB, TAG_ID.RB],
  [TAG_NAMES.RP, TAG_ID.RP],
  [TAG_NAMES.RT, TAG_ID.RT],
  [TAG_NAMES.RTC, TAG_ID.RTC],
  [TAG_NAMES.RUBY, TAG_ID.RUBY],
  [TAG_NAMES.S, TAG_ID.S],
  [TAG_NAMES.SCRIPT, TAG_ID.SCRIPT],
  [TAG_NAMES.SEARCH, TAG_ID.SEARCH],
  [TAG_NAMES.SECTION, TAG_ID.SECTION],
  [TAG_NAMES.SELECT, TAG_ID.SELECT],
  [TAG_NAMES.SOURCE, TAG_ID.SOURCE],
  [TAG_NAMES.SMALL, TAG_ID.SMALL],
  [TAG_NAMES.SPAN, TAG_ID.SPAN],
  [TAG_NAMES.STRIKE, TAG_ID.STRIKE],
  [TAG_NAMES.STRONG, TAG_ID.STRONG],
  [TAG_NAMES.STYLE, TAG_ID.STYLE],
  [TAG_NAMES.SUB, TAG_ID.SUB],
  [TAG_NAMES.SUMMARY, TAG_ID.SUMMARY],
  [TAG_NAMES.SUP, TAG_ID.SUP],
  [TAG_NAMES.TABLE, TAG_ID.TABLE],
  [TAG_NAMES.TBODY, TAG_ID.TBODY],
  [TAG_NAMES.TEMPLATE, TAG_ID.TEMPLATE],
  [TAG_NAMES.TEXTAREA, TAG_ID.TEXTAREA],
  [TAG_NAMES.TFOOT, TAG_ID.TFOOT],
  [TAG_NAMES.TD, TAG_ID.TD],
  [TAG_NAMES.TH, TAG_ID.TH],
  [TAG_NAMES.THEAD, TAG_ID.THEAD],
  [TAG_NAMES.TITLE, TAG_ID.TITLE],
  [TAG_NAMES.TR, TAG_ID.TR],
  [TAG_NAMES.TRACK, TAG_ID.TRACK],
  [TAG_NAMES.TT, TAG_ID.TT],
  [TAG_NAMES.U, TAG_ID.U],
  [TAG_NAMES.UL, TAG_ID.UL],
  [TAG_NAMES.SVG, TAG_ID.SVG],
  [TAG_NAMES.VAR, TAG_ID.VAR],
  [TAG_NAMES.WBR, TAG_ID.WBR],
  [TAG_NAMES.XMP, TAG_ID.XMP]
]);
function getTagID(tagName) {
  var _a;
  return (_a = TAG_NAME_TO_ID.get(tagName)) !== null && _a !== void 0 ? _a : TAG_ID.UNKNOWN;
}
var $ = TAG_ID;
var SPECIAL_ELEMENTS = {
  [NS.HTML]: /* @__PURE__ */ new Set([
    $.ADDRESS,
    $.APPLET,
    $.AREA,
    $.ARTICLE,
    $.ASIDE,
    $.BASE,
    $.BASEFONT,
    $.BGSOUND,
    $.BLOCKQUOTE,
    $.BODY,
    $.BR,
    $.BUTTON,
    $.CAPTION,
    $.CENTER,
    $.COL,
    $.COLGROUP,
    $.DD,
    $.DETAILS,
    $.DIR,
    $.DIV,
    $.DL,
    $.DT,
    $.EMBED,
    $.FIELDSET,
    $.FIGCAPTION,
    $.FIGURE,
    $.FOOTER,
    $.FORM,
    $.FRAME,
    $.FRAMESET,
    $.H1,
    $.H2,
    $.H3,
    $.H4,
    $.H5,
    $.H6,
    $.HEAD,
    $.HEADER,
    $.HGROUP,
    $.HR,
    $.HTML,
    $.IFRAME,
    $.IMG,
    $.INPUT,
    $.LI,
    $.LINK,
    $.LISTING,
    $.MAIN,
    $.MARQUEE,
    $.MENU,
    $.META,
    $.NAV,
    $.NOEMBED,
    $.NOFRAMES,
    $.NOSCRIPT,
    $.OBJECT,
    $.OL,
    $.P,
    $.PARAM,
    $.PLAINTEXT,
    $.PRE,
    $.SCRIPT,
    $.SECTION,
    $.SELECT,
    $.SOURCE,
    $.STYLE,
    $.SUMMARY,
    $.TABLE,
    $.TBODY,
    $.TD,
    $.TEMPLATE,
    $.TEXTAREA,
    $.TFOOT,
    $.TH,
    $.THEAD,
    $.TITLE,
    $.TR,
    $.TRACK,
    $.UL,
    $.WBR,
    $.XMP
  ]),
  [NS.MATHML]: /* @__PURE__ */ new Set([$.MI, $.MO, $.MN, $.MS, $.MTEXT, $.ANNOTATION_XML]),
  [NS.SVG]: /* @__PURE__ */ new Set([$.TITLE, $.FOREIGN_OBJECT, $.DESC]),
  [NS.XLINK]: /* @__PURE__ */ new Set(),
  [NS.XML]: /* @__PURE__ */ new Set(),
  [NS.XMLNS]: /* @__PURE__ */ new Set()
};
var NUMBERED_HEADERS = /* @__PURE__ */ new Set([$.H1, $.H2, $.H3, $.H4, $.H5, $.H6]);
var UNESCAPED_TEXT = /* @__PURE__ */ new Set([
  TAG_NAMES.STYLE,
  TAG_NAMES.SCRIPT,
  TAG_NAMES.XMP,
  TAG_NAMES.IFRAME,
  TAG_NAMES.NOEMBED,
  TAG_NAMES.NOFRAMES,
  TAG_NAMES.PLAINTEXT
]);

// node_modules/parse5/dist/tokenizer/index.js
var State;
(function(State2) {
  State2[State2["DATA"] = 0] = "DATA";
  State2[State2["RCDATA"] = 1] = "RCDATA";
  State2[State2["RAWTEXT"] = 2] = "RAWTEXT";
  State2[State2["SCRIPT_DATA"] = 3] = "SCRIPT_DATA";
  State2[State2["PLAINTEXT"] = 4] = "PLAINTEXT";
  State2[State2["TAG_OPEN"] = 5] = "TAG_OPEN";
  State2[State2["END_TAG_OPEN"] = 6] = "END_TAG_OPEN";
  State2[State2["TAG_NAME"] = 7] = "TAG_NAME";
  State2[State2["RCDATA_LESS_THAN_SIGN"] = 8] = "RCDATA_LESS_THAN_SIGN";
  State2[State2["RCDATA_END_TAG_OPEN"] = 9] = "RCDATA_END_TAG_OPEN";
  State2[State2["RCDATA_END_TAG_NAME"] = 10] = "RCDATA_END_TAG_NAME";
  State2[State2["RAWTEXT_LESS_THAN_SIGN"] = 11] = "RAWTEXT_LESS_THAN_SIGN";
  State2[State2["RAWTEXT_END_TAG_OPEN"] = 12] = "RAWTEXT_END_TAG_OPEN";
  State2[State2["RAWTEXT_END_TAG_NAME"] = 13] = "RAWTEXT_END_TAG_NAME";
  State2[State2["SCRIPT_DATA_LESS_THAN_SIGN"] = 14] = "SCRIPT_DATA_LESS_THAN_SIGN";
  State2[State2["SCRIPT_DATA_END_TAG_OPEN"] = 15] = "SCRIPT_DATA_END_TAG_OPEN";
  State2[State2["SCRIPT_DATA_END_TAG_NAME"] = 16] = "SCRIPT_DATA_END_TAG_NAME";
  State2[State2["SCRIPT_DATA_ESCAPE_START"] = 17] = "SCRIPT_DATA_ESCAPE_START";
  State2[State2["SCRIPT_DATA_ESCAPE_START_DASH"] = 18] = "SCRIPT_DATA_ESCAPE_START_DASH";
  State2[State2["SCRIPT_DATA_ESCAPED"] = 19] = "SCRIPT_DATA_ESCAPED";
  State2[State2["SCRIPT_DATA_ESCAPED_DASH"] = 20] = "SCRIPT_DATA_ESCAPED_DASH";
  State2[State2["SCRIPT_DATA_ESCAPED_DASH_DASH"] = 21] = "SCRIPT_DATA_ESCAPED_DASH_DASH";
  State2[State2["SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN"] = 22] = "SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN";
  State2[State2["SCRIPT_DATA_ESCAPED_END_TAG_OPEN"] = 23] = "SCRIPT_DATA_ESCAPED_END_TAG_OPEN";
  State2[State2["SCRIPT_DATA_ESCAPED_END_TAG_NAME"] = 24] = "SCRIPT_DATA_ESCAPED_END_TAG_NAME";
  State2[State2["SCRIPT_DATA_DOUBLE_ESCAPE_START"] = 25] = "SCRIPT_DATA_DOUBLE_ESCAPE_START";
  State2[State2["SCRIPT_DATA_DOUBLE_ESCAPED"] = 26] = "SCRIPT_DATA_DOUBLE_ESCAPED";
  State2[State2["SCRIPT_DATA_DOUBLE_ESCAPED_DASH"] = 27] = "SCRIPT_DATA_DOUBLE_ESCAPED_DASH";
  State2[State2["SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH"] = 28] = "SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH";
  State2[State2["SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN"] = 29] = "SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN";
  State2[State2["SCRIPT_DATA_DOUBLE_ESCAPE_END"] = 30] = "SCRIPT_DATA_DOUBLE_ESCAPE_END";
  State2[State2["BEFORE_ATTRIBUTE_NAME"] = 31] = "BEFORE_ATTRIBUTE_NAME";
  State2[State2["ATTRIBUTE_NAME"] = 32] = "ATTRIBUTE_NAME";
  State2[State2["AFTER_ATTRIBUTE_NAME"] = 33] = "AFTER_ATTRIBUTE_NAME";
  State2[State2["BEFORE_ATTRIBUTE_VALUE"] = 34] = "BEFORE_ATTRIBUTE_VALUE";
  State2[State2["ATTRIBUTE_VALUE_DOUBLE_QUOTED"] = 35] = "ATTRIBUTE_VALUE_DOUBLE_QUOTED";
  State2[State2["ATTRIBUTE_VALUE_SINGLE_QUOTED"] = 36] = "ATTRIBUTE_VALUE_SINGLE_QUOTED";
  State2[State2["ATTRIBUTE_VALUE_UNQUOTED"] = 37] = "ATTRIBUTE_VALUE_UNQUOTED";
  State2[State2["AFTER_ATTRIBUTE_VALUE_QUOTED"] = 38] = "AFTER_ATTRIBUTE_VALUE_QUOTED";
  State2[State2["SELF_CLOSING_START_TAG"] = 39] = "SELF_CLOSING_START_TAG";
  State2[State2["BOGUS_COMMENT"] = 40] = "BOGUS_COMMENT";
  State2[State2["MARKUP_DECLARATION_OPEN"] = 41] = "MARKUP_DECLARATION_OPEN";
  State2[State2["COMMENT_START"] = 42] = "COMMENT_START";
  State2[State2["COMMENT_START_DASH"] = 43] = "COMMENT_START_DASH";
  State2[State2["COMMENT"] = 44] = "COMMENT";
  State2[State2["COMMENT_LESS_THAN_SIGN"] = 45] = "COMMENT_LESS_THAN_SIGN";
  State2[State2["COMMENT_LESS_THAN_SIGN_BANG"] = 46] = "COMMENT_LESS_THAN_SIGN_BANG";
  State2[State2["COMMENT_LESS_THAN_SIGN_BANG_DASH"] = 47] = "COMMENT_LESS_THAN_SIGN_BANG_DASH";
  State2[State2["COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH"] = 48] = "COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH";
  State2[State2["COMMENT_END_DASH"] = 49] = "COMMENT_END_DASH";
  State2[State2["COMMENT_END"] = 50] = "COMMENT_END";
  State2[State2["COMMENT_END_BANG"] = 51] = "COMMENT_END_BANG";
  State2[State2["DOCTYPE"] = 52] = "DOCTYPE";
  State2[State2["BEFORE_DOCTYPE_NAME"] = 53] = "BEFORE_DOCTYPE_NAME";
  State2[State2["DOCTYPE_NAME"] = 54] = "DOCTYPE_NAME";
  State2[State2["AFTER_DOCTYPE_NAME"] = 55] = "AFTER_DOCTYPE_NAME";
  State2[State2["AFTER_DOCTYPE_PUBLIC_KEYWORD"] = 56] = "AFTER_DOCTYPE_PUBLIC_KEYWORD";
  State2[State2["BEFORE_DOCTYPE_PUBLIC_IDENTIFIER"] = 57] = "BEFORE_DOCTYPE_PUBLIC_IDENTIFIER";
  State2[State2["DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED"] = 58] = "DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED";
  State2[State2["DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED"] = 59] = "DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED";
  State2[State2["AFTER_DOCTYPE_PUBLIC_IDENTIFIER"] = 60] = "AFTER_DOCTYPE_PUBLIC_IDENTIFIER";
  State2[State2["BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS"] = 61] = "BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS";
  State2[State2["AFTER_DOCTYPE_SYSTEM_KEYWORD"] = 62] = "AFTER_DOCTYPE_SYSTEM_KEYWORD";
  State2[State2["BEFORE_DOCTYPE_SYSTEM_IDENTIFIER"] = 63] = "BEFORE_DOCTYPE_SYSTEM_IDENTIFIER";
  State2[State2["DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED"] = 64] = "DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED";
  State2[State2["DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED"] = 65] = "DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED";
  State2[State2["AFTER_DOCTYPE_SYSTEM_IDENTIFIER"] = 66] = "AFTER_DOCTYPE_SYSTEM_IDENTIFIER";
  State2[State2["BOGUS_DOCTYPE"] = 67] = "BOGUS_DOCTYPE";
  State2[State2["CDATA_SECTION"] = 68] = "CDATA_SECTION";
  State2[State2["CDATA_SECTION_BRACKET"] = 69] = "CDATA_SECTION_BRACKET";
  State2[State2["CDATA_SECTION_END"] = 70] = "CDATA_SECTION_END";
  State2[State2["CHARACTER_REFERENCE"] = 71] = "CHARACTER_REFERENCE";
  State2[State2["AMBIGUOUS_AMPERSAND"] = 72] = "AMBIGUOUS_AMPERSAND";
})(State || (State = {}));
var TokenizerMode = {
  DATA: State.DATA,
  RCDATA: State.RCDATA,
  RAWTEXT: State.RAWTEXT,
  SCRIPT_DATA: State.SCRIPT_DATA,
  PLAINTEXT: State.PLAINTEXT,
  CDATA_SECTION: State.CDATA_SECTION
};
function isAsciiDigit(cp) {
  return cp >= CODE_POINTS.DIGIT_0 && cp <= CODE_POINTS.DIGIT_9;
}
function isAsciiUpper(cp) {
  return cp >= CODE_POINTS.LATIN_CAPITAL_A && cp <= CODE_POINTS.LATIN_CAPITAL_Z;
}
function isAsciiLower(cp) {
  return cp >= CODE_POINTS.LATIN_SMALL_A && cp <= CODE_POINTS.LATIN_SMALL_Z;
}
function isAsciiLetter(cp) {
  return isAsciiLower(cp) || isAsciiUpper(cp);
}
function isAsciiAlphaNumeric(cp) {
  return isAsciiLetter(cp) || isAsciiDigit(cp);
}
function toAsciiLower(cp) {
  return cp + 32;
}
function isWhitespace(cp) {
  return cp === CODE_POINTS.SPACE || cp === CODE_POINTS.LINE_FEED || cp === CODE_POINTS.TABULATION || cp === CODE_POINTS.FORM_FEED;
}
function isScriptDataDoubleEscapeSequenceEnd(cp) {
  return isWhitespace(cp) || cp === CODE_POINTS.SOLIDUS || cp === CODE_POINTS.GREATER_THAN_SIGN;
}
function getErrorForNumericCharacterReference(code) {
  if (code === CODE_POINTS.NULL) {
    return ERR.nullCharacterReference;
  } else if (code > 1114111) {
    return ERR.characterReferenceOutsideUnicodeRange;
  } else if (isSurrogate(code)) {
    return ERR.surrogateCharacterReference;
  } else if (isUndefinedCodePoint(code)) {
    return ERR.noncharacterCharacterReference;
  } else if (isControlCodePoint(code) || code === CODE_POINTS.CARRIAGE_RETURN) {
    return ERR.controlCharacterReference;
  }
  return null;
}
var Tokenizer = class {
  constructor(options, handler) {
    this.options = options;
    this.handler = handler;
    this.paused = false;
    this.inLoop = false;
    this.inForeignNode = false;
    this.lastStartTagName = "";
    this.active = false;
    this.state = State.DATA;
    this.returnState = State.DATA;
    this.entityStartPos = 0;
    this.consumedAfterSnapshot = -1;
    this.currentCharacterToken = null;
    this.currentToken = null;
    this.currentAttr = { name: "", value: "" };
    this.preprocessor = new Preprocessor(handler);
    this.currentLocation = this.getCurrentLocation(-1);
    this.entityDecoder = new EntityDecoder(htmlDecodeTree, (cp, consumed) => {
      this.preprocessor.pos = this.entityStartPos + consumed - 1;
      this._flushCodePointConsumedAsCharacterReference(cp);
    }, handler.onParseError ? {
      missingSemicolonAfterCharacterReference: () => {
        this._err(ERR.missingSemicolonAfterCharacterReference, 1);
      },
      absenceOfDigitsInNumericCharacterReference: (consumed) => {
        this._err(ERR.absenceOfDigitsInNumericCharacterReference, this.entityStartPos - this.preprocessor.pos + consumed);
      },
      validateNumericCharacterReference: (code) => {
        const error = getErrorForNumericCharacterReference(code);
        if (error)
          this._err(error, 1);
      }
    } : void 0);
  }
  //Errors
  _err(code, cpOffset = 0) {
    var _a, _b;
    (_b = (_a = this.handler).onParseError) === null || _b === void 0 ? void 0 : _b.call(_a, this.preprocessor.getError(code, cpOffset));
  }
  // NOTE: `offset` may never run across line boundaries.
  getCurrentLocation(offset) {
    if (!this.options.sourceCodeLocationInfo) {
      return null;
    }
    return {
      startLine: this.preprocessor.line,
      startCol: this.preprocessor.col - offset,
      startOffset: this.preprocessor.offset - offset,
      endLine: -1,
      endCol: -1,
      endOffset: -1
    };
  }
  _runParsingLoop() {
    if (this.inLoop)
      return;
    this.inLoop = true;
    while (this.active && !this.paused) {
      this.consumedAfterSnapshot = 0;
      const cp = this._consume();
      if (!this._ensureHibernation()) {
        this._callState(cp);
      }
    }
    this.inLoop = false;
  }
  //API
  pause() {
    this.paused = true;
  }
  resume(writeCallback) {
    if (!this.paused) {
      throw new Error("Parser was already resumed");
    }
    this.paused = false;
    if (this.inLoop)
      return;
    this._runParsingLoop();
    if (!this.paused) {
      writeCallback === null || writeCallback === void 0 ? void 0 : writeCallback();
    }
  }
  write(chunk, isLastChunk, writeCallback) {
    this.active = true;
    this.preprocessor.write(chunk, isLastChunk);
    this._runParsingLoop();
    if (!this.paused) {
      writeCallback === null || writeCallback === void 0 ? void 0 : writeCallback();
    }
  }
  insertHtmlAtCurrentPos(chunk) {
    this.active = true;
    this.preprocessor.insertHtmlAtCurrentPos(chunk);
    this._runParsingLoop();
  }
  //Hibernation
  _ensureHibernation() {
    if (this.preprocessor.endOfChunkHit) {
      this.preprocessor.retreat(this.consumedAfterSnapshot);
      this.consumedAfterSnapshot = 0;
      this.active = false;
      return true;
    }
    return false;
  }
  //Consumption
  _consume() {
    this.consumedAfterSnapshot++;
    return this.preprocessor.advance();
  }
  _advanceBy(count) {
    this.consumedAfterSnapshot += count;
    for (let i = 0; i < count; i++) {
      this.preprocessor.advance();
    }
  }
  _consumeSequenceIfMatch(pattern, caseSensitive) {
    if (this.preprocessor.startsWith(pattern, caseSensitive)) {
      this._advanceBy(pattern.length - 1);
      return true;
    }
    return false;
  }
  //Token creation
  _createStartTagToken() {
    this.currentToken = {
      type: TokenType.START_TAG,
      tagName: "",
      tagID: TAG_ID.UNKNOWN,
      selfClosing: false,
      ackSelfClosing: false,
      attrs: [],
      location: this.getCurrentLocation(1)
    };
  }
  _createEndTagToken() {
    this.currentToken = {
      type: TokenType.END_TAG,
      tagName: "",
      tagID: TAG_ID.UNKNOWN,
      selfClosing: false,
      ackSelfClosing: false,
      attrs: [],
      location: this.getCurrentLocation(2)
    };
  }
  _createCommentToken(offset) {
    this.currentToken = {
      type: TokenType.COMMENT,
      data: "",
      location: this.getCurrentLocation(offset)
    };
  }
  _createDoctypeToken(initialName) {
    this.currentToken = {
      type: TokenType.DOCTYPE,
      name: initialName,
      forceQuirks: false,
      publicId: null,
      systemId: null,
      location: this.currentLocation
    };
  }
  _createCharacterToken(type, chars) {
    this.currentCharacterToken = {
      type,
      chars,
      location: this.currentLocation
    };
  }
  //Tag attributes
  _createAttr(attrNameFirstCh) {
    this.currentAttr = {
      name: attrNameFirstCh,
      value: ""
    };
    this.currentLocation = this.getCurrentLocation(0);
  }
  _leaveAttrName() {
    var _a;
    var _b;
    const token = this.currentToken;
    if (getTokenAttr(token, this.currentAttr.name) === null) {
      token.attrs.push(this.currentAttr);
      if (token.location && this.currentLocation) {
        const attrLocations = (_a = (_b = token.location).attrs) !== null && _a !== void 0 ? _a : _b.attrs = /* @__PURE__ */ Object.create(null);
        attrLocations[this.currentAttr.name] = this.currentLocation;
        this._leaveAttrValue();
      }
    } else {
      this._err(ERR.duplicateAttribute);
    }
  }
  _leaveAttrValue() {
    if (this.currentLocation) {
      this.currentLocation.endLine = this.preprocessor.line;
      this.currentLocation.endCol = this.preprocessor.col;
      this.currentLocation.endOffset = this.preprocessor.offset;
    }
  }
  //Token emission
  prepareToken(ct) {
    this._emitCurrentCharacterToken(ct.location);
    this.currentToken = null;
    if (ct.location) {
      ct.location.endLine = this.preprocessor.line;
      ct.location.endCol = this.preprocessor.col + 1;
      ct.location.endOffset = this.preprocessor.offset + 1;
    }
    this.currentLocation = this.getCurrentLocation(-1);
  }
  emitCurrentTagToken() {
    const ct = this.currentToken;
    this.prepareToken(ct);
    ct.tagID = getTagID(ct.tagName);
    if (ct.type === TokenType.START_TAG) {
      this.lastStartTagName = ct.tagName;
      this.handler.onStartTag(ct);
    } else {
      if (ct.attrs.length > 0) {
        this._err(ERR.endTagWithAttributes);
      }
      if (ct.selfClosing) {
        this._err(ERR.endTagWithTrailingSolidus);
      }
      this.handler.onEndTag(ct);
    }
    this.preprocessor.dropParsedChunk();
  }
  emitCurrentComment(ct) {
    this.prepareToken(ct);
    this.handler.onComment(ct);
    this.preprocessor.dropParsedChunk();
  }
  emitCurrentDoctype(ct) {
    this.prepareToken(ct);
    this.handler.onDoctype(ct);
    this.preprocessor.dropParsedChunk();
  }
  _emitCurrentCharacterToken(nextLocation) {
    if (this.currentCharacterToken) {
      if (nextLocation && this.currentCharacterToken.location) {
        this.currentCharacterToken.location.endLine = nextLocation.startLine;
        this.currentCharacterToken.location.endCol = nextLocation.startCol;
        this.currentCharacterToken.location.endOffset = nextLocation.startOffset;
      }
      switch (this.currentCharacterToken.type) {
        case TokenType.CHARACTER: {
          this.handler.onCharacter(this.currentCharacterToken);
          break;
        }
        case TokenType.NULL_CHARACTER: {
          this.handler.onNullCharacter(this.currentCharacterToken);
          break;
        }
        case TokenType.WHITESPACE_CHARACTER: {
          this.handler.onWhitespaceCharacter(this.currentCharacterToken);
          break;
        }
      }
      this.currentCharacterToken = null;
    }
  }
  _emitEOFToken() {
    const location = this.getCurrentLocation(0);
    if (location) {
      location.endLine = location.startLine;
      location.endCol = location.startCol;
      location.endOffset = location.startOffset;
    }
    this._emitCurrentCharacterToken(location);
    this.handler.onEof({ type: TokenType.EOF, location });
    this.active = false;
  }
  //Characters emission
  //OPTIMIZATION: The specification uses only one type of character token (one token per character).
  //This causes a huge memory overhead and a lot of unnecessary parser loops. parse5 uses 3 groups of characters.
  //If we have a sequence of characters that belong to the same group, the parser can process it
  //as a single solid character token.
  //So, there are 3 types of character tokens in parse5:
  //1)TokenType.NULL_CHARACTER - \u0000-character sequences (e.g. '\u0000\u0000\u0000')
  //2)TokenType.WHITESPACE_CHARACTER - any whitespace/new-line character sequences (e.g. '\n  \r\t   \f')
  //3)TokenType.CHARACTER - any character sequence which don't belong to groups 1 and 2 (e.g. 'abcdef1234@@#$%^')
  _appendCharToCurrentCharacterToken(type, ch) {
    if (this.currentCharacterToken) {
      if (this.currentCharacterToken.type === type) {
        this.currentCharacterToken.chars += ch;
        return;
      } else {
        this.currentLocation = this.getCurrentLocation(0);
        this._emitCurrentCharacterToken(this.currentLocation);
        this.preprocessor.dropParsedChunk();
      }
    }
    this._createCharacterToken(type, ch);
  }
  _emitCodePoint(cp) {
    const type = isWhitespace(cp) ? TokenType.WHITESPACE_CHARACTER : cp === CODE_POINTS.NULL ? TokenType.NULL_CHARACTER : TokenType.CHARACTER;
    this._appendCharToCurrentCharacterToken(type, cp < 65536 ? String.fromCharCode(cp) : String.fromCodePoint(cp));
  }
  //NOTE: used when we emit characters explicitly.
  //This is always for non-whitespace and non-null characters, which allows us to avoid additional checks.
  _emitChars(ch) {
    this._appendCharToCurrentCharacterToken(TokenType.CHARACTER, ch);
  }
  // Character reference helpers
  _startCharacterReference() {
    this.returnState = this.state;
    this.state = State.CHARACTER_REFERENCE;
    this.entityStartPos = this.preprocessor.pos;
    this.entityDecoder.startEntity(this._isCharacterReferenceInAttribute() ? DecodingMode.Attribute : DecodingMode.Legacy);
  }
  _isCharacterReferenceInAttribute() {
    return this.returnState === State.ATTRIBUTE_VALUE_DOUBLE_QUOTED || this.returnState === State.ATTRIBUTE_VALUE_SINGLE_QUOTED || this.returnState === State.ATTRIBUTE_VALUE_UNQUOTED;
  }
  _flushCodePointConsumedAsCharacterReference(cp) {
    if (this._isCharacterReferenceInAttribute()) {
      this.currentAttr.value += String.fromCodePoint(cp);
    } else {
      this._emitCodePoint(cp);
    }
  }
  // Calling states this way turns out to be much faster than any other approach.
  _callState(cp) {
    switch (this.state) {
      case State.DATA: {
        this._stateData(cp);
        break;
      }
      case State.RCDATA: {
        this._stateRcdata(cp);
        break;
      }
      case State.RAWTEXT: {
        this._stateRawtext(cp);
        break;
      }
      case State.SCRIPT_DATA: {
        this._stateScriptData(cp);
        break;
      }
      case State.PLAINTEXT: {
        this._statePlaintext(cp);
        break;
      }
      case State.TAG_OPEN: {
        this._stateTagOpen(cp);
        break;
      }
      case State.END_TAG_OPEN: {
        this._stateEndTagOpen(cp);
        break;
      }
      case State.TAG_NAME: {
        this._stateTagName(cp);
        break;
      }
      case State.RCDATA_LESS_THAN_SIGN: {
        this._stateRcdataLessThanSign(cp);
        break;
      }
      case State.RCDATA_END_TAG_OPEN: {
        this._stateRcdataEndTagOpen(cp);
        break;
      }
      case State.RCDATA_END_TAG_NAME: {
        this._stateRcdataEndTagName(cp);
        break;
      }
      case State.RAWTEXT_LESS_THAN_SIGN: {
        this._stateRawtextLessThanSign(cp);
        break;
      }
      case State.RAWTEXT_END_TAG_OPEN: {
        this._stateRawtextEndTagOpen(cp);
        break;
      }
      case State.RAWTEXT_END_TAG_NAME: {
        this._stateRawtextEndTagName(cp);
        break;
      }
      case State.SCRIPT_DATA_LESS_THAN_SIGN: {
        this._stateScriptDataLessThanSign(cp);
        break;
      }
      case State.SCRIPT_DATA_END_TAG_OPEN: {
        this._stateScriptDataEndTagOpen(cp);
        break;
      }
      case State.SCRIPT_DATA_END_TAG_NAME: {
        this._stateScriptDataEndTagName(cp);
        break;
      }
      case State.SCRIPT_DATA_ESCAPE_START: {
        this._stateScriptDataEscapeStart(cp);
        break;
      }
      case State.SCRIPT_DATA_ESCAPE_START_DASH: {
        this._stateScriptDataEscapeStartDash(cp);
        break;
      }
      case State.SCRIPT_DATA_ESCAPED: {
        this._stateScriptDataEscaped(cp);
        break;
      }
      case State.SCRIPT_DATA_ESCAPED_DASH: {
        this._stateScriptDataEscapedDash(cp);
        break;
      }
      case State.SCRIPT_DATA_ESCAPED_DASH_DASH: {
        this._stateScriptDataEscapedDashDash(cp);
        break;
      }
      case State.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN: {
        this._stateScriptDataEscapedLessThanSign(cp);
        break;
      }
      case State.SCRIPT_DATA_ESCAPED_END_TAG_OPEN: {
        this._stateScriptDataEscapedEndTagOpen(cp);
        break;
      }
      case State.SCRIPT_DATA_ESCAPED_END_TAG_NAME: {
        this._stateScriptDataEscapedEndTagName(cp);
        break;
      }
      case State.SCRIPT_DATA_DOUBLE_ESCAPE_START: {
        this._stateScriptDataDoubleEscapeStart(cp);
        break;
      }
      case State.SCRIPT_DATA_DOUBLE_ESCAPED: {
        this._stateScriptDataDoubleEscaped(cp);
        break;
      }
      case State.SCRIPT_DATA_DOUBLE_ESCAPED_DASH: {
        this._stateScriptDataDoubleEscapedDash(cp);
        break;
      }
      case State.SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH: {
        this._stateScriptDataDoubleEscapedDashDash(cp);
        break;
      }
      case State.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN: {
        this._stateScriptDataDoubleEscapedLessThanSign(cp);
        break;
      }
      case State.SCRIPT_DATA_DOUBLE_ESCAPE_END: {
        this._stateScriptDataDoubleEscapeEnd(cp);
        break;
      }
      case State.BEFORE_ATTRIBUTE_NAME: {
        this._stateBeforeAttributeName(cp);
        break;
      }
      case State.ATTRIBUTE_NAME: {
        this._stateAttributeName(cp);
        break;
      }
      case State.AFTER_ATTRIBUTE_NAME: {
        this._stateAfterAttributeName(cp);
        break;
      }
      case State.BEFORE_ATTRIBUTE_VALUE: {
        this._stateBeforeAttributeValue(cp);
        break;
      }
      case State.ATTRIBUTE_VALUE_DOUBLE_QUOTED: {
        this._stateAttributeValueDoubleQuoted(cp);
        break;
      }
      case State.ATTRIBUTE_VALUE_SINGLE_QUOTED: {
        this._stateAttributeValueSingleQuoted(cp);
        break;
      }
      case State.ATTRIBUTE_VALUE_UNQUOTED: {
        this._stateAttributeValueUnquoted(cp);
        break;
      }
      case State.AFTER_ATTRIBUTE_VALUE_QUOTED: {
        this._stateAfterAttributeValueQuoted(cp);
        break;
      }
      case State.SELF_CLOSING_START_TAG: {
        this._stateSelfClosingStartTag(cp);
        break;
      }
      case State.BOGUS_COMMENT: {
        this._stateBogusComment(cp);
        break;
      }
      case State.MARKUP_DECLARATION_OPEN: {
        this._stateMarkupDeclarationOpen(cp);
        break;
      }
      case State.COMMENT_START: {
        this._stateCommentStart(cp);
        break;
      }
      case State.COMMENT_START_DASH: {
        this._stateCommentStartDash(cp);
        break;
      }
      case State.COMMENT: {
        this._stateComment(cp);
        break;
      }
      case State.COMMENT_LESS_THAN_SIGN: {
        this._stateCommentLessThanSign(cp);
        break;
      }
      case State.COMMENT_LESS_THAN_SIGN_BANG: {
        this._stateCommentLessThanSignBang(cp);
        break;
      }
      case State.COMMENT_LESS_THAN_SIGN_BANG_DASH: {
        this._stateCommentLessThanSignBangDash(cp);
        break;
      }
      case State.COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH: {
        this._stateCommentLessThanSignBangDashDash(cp);
        break;
      }
      case State.COMMENT_END_DASH: {
        this._stateCommentEndDash(cp);
        break;
      }
      case State.COMMENT_END: {
        this._stateCommentEnd(cp);
        break;
      }
      case State.COMMENT_END_BANG: {
        this._stateCommentEndBang(cp);
        break;
      }
      case State.DOCTYPE: {
        this._stateDoctype(cp);
        break;
      }
      case State.BEFORE_DOCTYPE_NAME: {
        this._stateBeforeDoctypeName(cp);
        break;
      }
      case State.DOCTYPE_NAME: {
        this._stateDoctypeName(cp);
        break;
      }
      case State.AFTER_DOCTYPE_NAME: {
        this._stateAfterDoctypeName(cp);
        break;
      }
      case State.AFTER_DOCTYPE_PUBLIC_KEYWORD: {
        this._stateAfterDoctypePublicKeyword(cp);
        break;
      }
      case State.BEFORE_DOCTYPE_PUBLIC_IDENTIFIER: {
        this._stateBeforeDoctypePublicIdentifier(cp);
        break;
      }
      case State.DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED: {
        this._stateDoctypePublicIdentifierDoubleQuoted(cp);
        break;
      }
      case State.DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED: {
        this._stateDoctypePublicIdentifierSingleQuoted(cp);
        break;
      }
      case State.AFTER_DOCTYPE_PUBLIC_IDENTIFIER: {
        this._stateAfterDoctypePublicIdentifier(cp);
        break;
      }
      case State.BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS: {
        this._stateBetweenDoctypePublicAndSystemIdentifiers(cp);
        break;
      }
      case State.AFTER_DOCTYPE_SYSTEM_KEYWORD: {
        this._stateAfterDoctypeSystemKeyword(cp);
        break;
      }
      case State.BEFORE_DOCTYPE_SYSTEM_IDENTIFIER: {
        this._stateBeforeDoctypeSystemIdentifier(cp);
        break;
      }
      case State.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED: {
        this._stateDoctypeSystemIdentifierDoubleQuoted(cp);
        break;
      }
      case State.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED: {
        this._stateDoctypeSystemIdentifierSingleQuoted(cp);
        break;
      }
      case State.AFTER_DOCTYPE_SYSTEM_IDENTIFIER: {
        this._stateAfterDoctypeSystemIdentifier(cp);
        break;
      }
      case State.BOGUS_DOCTYPE: {
        this._stateBogusDoctype(cp);
        break;
      }
      case State.CDATA_SECTION: {
        this._stateCdataSection(cp);
        break;
      }
      case State.CDATA_SECTION_BRACKET: {
        this._stateCdataSectionBracket(cp);
        break;
      }
      case State.CDATA_SECTION_END: {
        this._stateCdataSectionEnd(cp);
        break;
      }
      case State.CHARACTER_REFERENCE: {
        this._stateCharacterReference();
        break;
      }
      case State.AMBIGUOUS_AMPERSAND: {
        this._stateAmbiguousAmpersand(cp);
        break;
      }
      default: {
        throw new Error("Unknown state");
      }
    }
  }
  // State machine
  // Data state
  //------------------------------------------------------------------
  _stateData(cp) {
    switch (cp) {
      case CODE_POINTS.LESS_THAN_SIGN: {
        this.state = State.TAG_OPEN;
        break;
      }
      case CODE_POINTS.AMPERSAND: {
        this._startCharacterReference();
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this._emitCodePoint(cp);
        break;
      }
      case CODE_POINTS.EOF: {
        this._emitEOFToken();
        break;
      }
      default: {
        this._emitCodePoint(cp);
      }
    }
  }
  //  RCDATA state
  //------------------------------------------------------------------
  _stateRcdata(cp) {
    switch (cp) {
      case CODE_POINTS.AMPERSAND: {
        this._startCharacterReference();
        break;
      }
      case CODE_POINTS.LESS_THAN_SIGN: {
        this.state = State.RCDATA_LESS_THAN_SIGN;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this._emitChars(REPLACEMENT_CHARACTER);
        break;
      }
      case CODE_POINTS.EOF: {
        this._emitEOFToken();
        break;
      }
      default: {
        this._emitCodePoint(cp);
      }
    }
  }
  // RAWTEXT state
  //------------------------------------------------------------------
  _stateRawtext(cp) {
    switch (cp) {
      case CODE_POINTS.LESS_THAN_SIGN: {
        this.state = State.RAWTEXT_LESS_THAN_SIGN;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this._emitChars(REPLACEMENT_CHARACTER);
        break;
      }
      case CODE_POINTS.EOF: {
        this._emitEOFToken();
        break;
      }
      default: {
        this._emitCodePoint(cp);
      }
    }
  }
  // Script data state
  //------------------------------------------------------------------
  _stateScriptData(cp) {
    switch (cp) {
      case CODE_POINTS.LESS_THAN_SIGN: {
        this.state = State.SCRIPT_DATA_LESS_THAN_SIGN;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this._emitChars(REPLACEMENT_CHARACTER);
        break;
      }
      case CODE_POINTS.EOF: {
        this._emitEOFToken();
        break;
      }
      default: {
        this._emitCodePoint(cp);
      }
    }
  }
  // PLAINTEXT state
  //------------------------------------------------------------------
  _statePlaintext(cp) {
    switch (cp) {
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this._emitChars(REPLACEMENT_CHARACTER);
        break;
      }
      case CODE_POINTS.EOF: {
        this._emitEOFToken();
        break;
      }
      default: {
        this._emitCodePoint(cp);
      }
    }
  }
  // Tag open state
  //------------------------------------------------------------------
  _stateTagOpen(cp) {
    if (isAsciiLetter(cp)) {
      this._createStartTagToken();
      this.state = State.TAG_NAME;
      this._stateTagName(cp);
    } else
      switch (cp) {
        case CODE_POINTS.EXCLAMATION_MARK: {
          this.state = State.MARKUP_DECLARATION_OPEN;
          break;
        }
        case CODE_POINTS.SOLIDUS: {
          this.state = State.END_TAG_OPEN;
          break;
        }
        case CODE_POINTS.QUESTION_MARK: {
          this._err(ERR.unexpectedQuestionMarkInsteadOfTagName);
          this._createCommentToken(1);
          this.state = State.BOGUS_COMMENT;
          this._stateBogusComment(cp);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofBeforeTagName);
          this._emitChars("<");
          this._emitEOFToken();
          break;
        }
        default: {
          this._err(ERR.invalidFirstCharacterOfTagName);
          this._emitChars("<");
          this.state = State.DATA;
          this._stateData(cp);
        }
      }
  }
  // End tag open state
  //------------------------------------------------------------------
  _stateEndTagOpen(cp) {
    if (isAsciiLetter(cp)) {
      this._createEndTagToken();
      this.state = State.TAG_NAME;
      this._stateTagName(cp);
    } else
      switch (cp) {
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._err(ERR.missingEndTagName);
          this.state = State.DATA;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofBeforeTagName);
          this._emitChars("</");
          this._emitEOFToken();
          break;
        }
        default: {
          this._err(ERR.invalidFirstCharacterOfTagName);
          this._createCommentToken(2);
          this.state = State.BOGUS_COMMENT;
          this._stateBogusComment(cp);
        }
      }
  }
  // Tag name state
  //------------------------------------------------------------------
  _stateTagName(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        this.state = State.BEFORE_ATTRIBUTE_NAME;
        break;
      }
      case CODE_POINTS.SOLIDUS: {
        this.state = State.SELF_CLOSING_START_TAG;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State.DATA;
        this.emitCurrentTagToken();
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        token.tagName += REPLACEMENT_CHARACTER;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInTag);
        this._emitEOFToken();
        break;
      }
      default: {
        token.tagName += String.fromCodePoint(isAsciiUpper(cp) ? toAsciiLower(cp) : cp);
      }
    }
  }
  // RCDATA less-than sign state
  //------------------------------------------------------------------
  _stateRcdataLessThanSign(cp) {
    if (cp === CODE_POINTS.SOLIDUS) {
      this.state = State.RCDATA_END_TAG_OPEN;
    } else {
      this._emitChars("<");
      this.state = State.RCDATA;
      this._stateRcdata(cp);
    }
  }
  // RCDATA end tag open state
  //------------------------------------------------------------------
  _stateRcdataEndTagOpen(cp) {
    if (isAsciiLetter(cp)) {
      this.state = State.RCDATA_END_TAG_NAME;
      this._stateRcdataEndTagName(cp);
    } else {
      this._emitChars("</");
      this.state = State.RCDATA;
      this._stateRcdata(cp);
    }
  }
  handleSpecialEndTag(_cp) {
    if (!this.preprocessor.startsWith(this.lastStartTagName, false)) {
      return !this._ensureHibernation();
    }
    this._createEndTagToken();
    const token = this.currentToken;
    token.tagName = this.lastStartTagName;
    const cp = this.preprocessor.peek(this.lastStartTagName.length);
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        this._advanceBy(this.lastStartTagName.length);
        this.state = State.BEFORE_ATTRIBUTE_NAME;
        return false;
      }
      case CODE_POINTS.SOLIDUS: {
        this._advanceBy(this.lastStartTagName.length);
        this.state = State.SELF_CLOSING_START_TAG;
        return false;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._advanceBy(this.lastStartTagName.length);
        this.emitCurrentTagToken();
        this.state = State.DATA;
        return false;
      }
      default: {
        return !this._ensureHibernation();
      }
    }
  }
  // RCDATA end tag name state
  //------------------------------------------------------------------
  _stateRcdataEndTagName(cp) {
    if (this.handleSpecialEndTag(cp)) {
      this._emitChars("</");
      this.state = State.RCDATA;
      this._stateRcdata(cp);
    }
  }
  // RAWTEXT less-than sign state
  //------------------------------------------------------------------
  _stateRawtextLessThanSign(cp) {
    if (cp === CODE_POINTS.SOLIDUS) {
      this.state = State.RAWTEXT_END_TAG_OPEN;
    } else {
      this._emitChars("<");
      this.state = State.RAWTEXT;
      this._stateRawtext(cp);
    }
  }
  // RAWTEXT end tag open state
  //------------------------------------------------------------------
  _stateRawtextEndTagOpen(cp) {
    if (isAsciiLetter(cp)) {
      this.state = State.RAWTEXT_END_TAG_NAME;
      this._stateRawtextEndTagName(cp);
    } else {
      this._emitChars("</");
      this.state = State.RAWTEXT;
      this._stateRawtext(cp);
    }
  }
  // RAWTEXT end tag name state
  //------------------------------------------------------------------
  _stateRawtextEndTagName(cp) {
    if (this.handleSpecialEndTag(cp)) {
      this._emitChars("</");
      this.state = State.RAWTEXT;
      this._stateRawtext(cp);
    }
  }
  // Script data less-than sign state
  //------------------------------------------------------------------
  _stateScriptDataLessThanSign(cp) {
    switch (cp) {
      case CODE_POINTS.SOLIDUS: {
        this.state = State.SCRIPT_DATA_END_TAG_OPEN;
        break;
      }
      case CODE_POINTS.EXCLAMATION_MARK: {
        this.state = State.SCRIPT_DATA_ESCAPE_START;
        this._emitChars("<!");
        break;
      }
      default: {
        this._emitChars("<");
        this.state = State.SCRIPT_DATA;
        this._stateScriptData(cp);
      }
    }
  }
  // Script data end tag open state
  //------------------------------------------------------------------
  _stateScriptDataEndTagOpen(cp) {
    if (isAsciiLetter(cp)) {
      this.state = State.SCRIPT_DATA_END_TAG_NAME;
      this._stateScriptDataEndTagName(cp);
    } else {
      this._emitChars("</");
      this.state = State.SCRIPT_DATA;
      this._stateScriptData(cp);
    }
  }
  // Script data end tag name state
  //------------------------------------------------------------------
  _stateScriptDataEndTagName(cp) {
    if (this.handleSpecialEndTag(cp)) {
      this._emitChars("</");
      this.state = State.SCRIPT_DATA;
      this._stateScriptData(cp);
    }
  }
  // Script data escape start state
  //------------------------------------------------------------------
  _stateScriptDataEscapeStart(cp) {
    if (cp === CODE_POINTS.HYPHEN_MINUS) {
      this.state = State.SCRIPT_DATA_ESCAPE_START_DASH;
      this._emitChars("-");
    } else {
      this.state = State.SCRIPT_DATA;
      this._stateScriptData(cp);
    }
  }
  // Script data escape start dash state
  //------------------------------------------------------------------
  _stateScriptDataEscapeStartDash(cp) {
    if (cp === CODE_POINTS.HYPHEN_MINUS) {
      this.state = State.SCRIPT_DATA_ESCAPED_DASH_DASH;
      this._emitChars("-");
    } else {
      this.state = State.SCRIPT_DATA;
      this._stateScriptData(cp);
    }
  }
  // Script data escaped state
  //------------------------------------------------------------------
  _stateScriptDataEscaped(cp) {
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this.state = State.SCRIPT_DATA_ESCAPED_DASH;
        this._emitChars("-");
        break;
      }
      case CODE_POINTS.LESS_THAN_SIGN: {
        this.state = State.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this._emitChars(REPLACEMENT_CHARACTER);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInScriptHtmlCommentLikeText);
        this._emitEOFToken();
        break;
      }
      default: {
        this._emitCodePoint(cp);
      }
    }
  }
  // Script data escaped dash state
  //------------------------------------------------------------------
  _stateScriptDataEscapedDash(cp) {
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this.state = State.SCRIPT_DATA_ESCAPED_DASH_DASH;
        this._emitChars("-");
        break;
      }
      case CODE_POINTS.LESS_THAN_SIGN: {
        this.state = State.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this.state = State.SCRIPT_DATA_ESCAPED;
        this._emitChars(REPLACEMENT_CHARACTER);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInScriptHtmlCommentLikeText);
        this._emitEOFToken();
        break;
      }
      default: {
        this.state = State.SCRIPT_DATA_ESCAPED;
        this._emitCodePoint(cp);
      }
    }
  }
  // Script data escaped dash dash state
  //------------------------------------------------------------------
  _stateScriptDataEscapedDashDash(cp) {
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this._emitChars("-");
        break;
      }
      case CODE_POINTS.LESS_THAN_SIGN: {
        this.state = State.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State.SCRIPT_DATA;
        this._emitChars(">");
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this.state = State.SCRIPT_DATA_ESCAPED;
        this._emitChars(REPLACEMENT_CHARACTER);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInScriptHtmlCommentLikeText);
        this._emitEOFToken();
        break;
      }
      default: {
        this.state = State.SCRIPT_DATA_ESCAPED;
        this._emitCodePoint(cp);
      }
    }
  }
  // Script data escaped less-than sign state
  //------------------------------------------------------------------
  _stateScriptDataEscapedLessThanSign(cp) {
    if (cp === CODE_POINTS.SOLIDUS) {
      this.state = State.SCRIPT_DATA_ESCAPED_END_TAG_OPEN;
    } else if (isAsciiLetter(cp)) {
      this._emitChars("<");
      this.state = State.SCRIPT_DATA_DOUBLE_ESCAPE_START;
      this._stateScriptDataDoubleEscapeStart(cp);
    } else {
      this._emitChars("<");
      this.state = State.SCRIPT_DATA_ESCAPED;
      this._stateScriptDataEscaped(cp);
    }
  }
  // Script data escaped end tag open state
  //------------------------------------------------------------------
  _stateScriptDataEscapedEndTagOpen(cp) {
    if (isAsciiLetter(cp)) {
      this.state = State.SCRIPT_DATA_ESCAPED_END_TAG_NAME;
      this._stateScriptDataEscapedEndTagName(cp);
    } else {
      this._emitChars("</");
      this.state = State.SCRIPT_DATA_ESCAPED;
      this._stateScriptDataEscaped(cp);
    }
  }
  // Script data escaped end tag name state
  //------------------------------------------------------------------
  _stateScriptDataEscapedEndTagName(cp) {
    if (this.handleSpecialEndTag(cp)) {
      this._emitChars("</");
      this.state = State.SCRIPT_DATA_ESCAPED;
      this._stateScriptDataEscaped(cp);
    }
  }
  // Script data double escape start state
  //------------------------------------------------------------------
  _stateScriptDataDoubleEscapeStart(cp) {
    if (this.preprocessor.startsWith(SEQUENCES.SCRIPT, false) && isScriptDataDoubleEscapeSequenceEnd(this.preprocessor.peek(SEQUENCES.SCRIPT.length))) {
      this._emitCodePoint(cp);
      for (let i = 0; i < SEQUENCES.SCRIPT.length; i++) {
        this._emitCodePoint(this._consume());
      }
      this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED;
    } else if (!this._ensureHibernation()) {
      this.state = State.SCRIPT_DATA_ESCAPED;
      this._stateScriptDataEscaped(cp);
    }
  }
  // Script data double escaped state
  //------------------------------------------------------------------
  _stateScriptDataDoubleEscaped(cp) {
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED_DASH;
        this._emitChars("-");
        break;
      }
      case CODE_POINTS.LESS_THAN_SIGN: {
        this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN;
        this._emitChars("<");
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this._emitChars(REPLACEMENT_CHARACTER);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInScriptHtmlCommentLikeText);
        this._emitEOFToken();
        break;
      }
      default: {
        this._emitCodePoint(cp);
      }
    }
  }
  // Script data double escaped dash state
  //------------------------------------------------------------------
  _stateScriptDataDoubleEscapedDash(cp) {
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH;
        this._emitChars("-");
        break;
      }
      case CODE_POINTS.LESS_THAN_SIGN: {
        this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN;
        this._emitChars("<");
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED;
        this._emitChars(REPLACEMENT_CHARACTER);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInScriptHtmlCommentLikeText);
        this._emitEOFToken();
        break;
      }
      default: {
        this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED;
        this._emitCodePoint(cp);
      }
    }
  }
  // Script data double escaped dash dash state
  //------------------------------------------------------------------
  _stateScriptDataDoubleEscapedDashDash(cp) {
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this._emitChars("-");
        break;
      }
      case CODE_POINTS.LESS_THAN_SIGN: {
        this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN;
        this._emitChars("<");
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State.SCRIPT_DATA;
        this._emitChars(">");
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED;
        this._emitChars(REPLACEMENT_CHARACTER);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInScriptHtmlCommentLikeText);
        this._emitEOFToken();
        break;
      }
      default: {
        this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED;
        this._emitCodePoint(cp);
      }
    }
  }
  // Script data double escaped less-than sign state
  //------------------------------------------------------------------
  _stateScriptDataDoubleEscapedLessThanSign(cp) {
    if (cp === CODE_POINTS.SOLIDUS) {
      this.state = State.SCRIPT_DATA_DOUBLE_ESCAPE_END;
      this._emitChars("/");
    } else {
      this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED;
      this._stateScriptDataDoubleEscaped(cp);
    }
  }
  // Script data double escape end state
  //------------------------------------------------------------------
  _stateScriptDataDoubleEscapeEnd(cp) {
    if (this.preprocessor.startsWith(SEQUENCES.SCRIPT, false) && isScriptDataDoubleEscapeSequenceEnd(this.preprocessor.peek(SEQUENCES.SCRIPT.length))) {
      this._emitCodePoint(cp);
      for (let i = 0; i < SEQUENCES.SCRIPT.length; i++) {
        this._emitCodePoint(this._consume());
      }
      this.state = State.SCRIPT_DATA_ESCAPED;
    } else if (!this._ensureHibernation()) {
      this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED;
      this._stateScriptDataDoubleEscaped(cp);
    }
  }
  // Before attribute name state
  //------------------------------------------------------------------
  _stateBeforeAttributeName(cp) {
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        break;
      }
      case CODE_POINTS.SOLIDUS:
      case CODE_POINTS.GREATER_THAN_SIGN:
      case CODE_POINTS.EOF: {
        this.state = State.AFTER_ATTRIBUTE_NAME;
        this._stateAfterAttributeName(cp);
        break;
      }
      case CODE_POINTS.EQUALS_SIGN: {
        this._err(ERR.unexpectedEqualsSignBeforeAttributeName);
        this._createAttr("=");
        this.state = State.ATTRIBUTE_NAME;
        break;
      }
      default: {
        this._createAttr("");
        this.state = State.ATTRIBUTE_NAME;
        this._stateAttributeName(cp);
      }
    }
  }
  // Attribute name state
  //------------------------------------------------------------------
  _stateAttributeName(cp) {
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED:
      case CODE_POINTS.SOLIDUS:
      case CODE_POINTS.GREATER_THAN_SIGN:
      case CODE_POINTS.EOF: {
        this._leaveAttrName();
        this.state = State.AFTER_ATTRIBUTE_NAME;
        this._stateAfterAttributeName(cp);
        break;
      }
      case CODE_POINTS.EQUALS_SIGN: {
        this._leaveAttrName();
        this.state = State.BEFORE_ATTRIBUTE_VALUE;
        break;
      }
      case CODE_POINTS.QUOTATION_MARK:
      case CODE_POINTS.APOSTROPHE:
      case CODE_POINTS.LESS_THAN_SIGN: {
        this._err(ERR.unexpectedCharacterInAttributeName);
        this.currentAttr.name += String.fromCodePoint(cp);
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this.currentAttr.name += REPLACEMENT_CHARACTER;
        break;
      }
      default: {
        this.currentAttr.name += String.fromCodePoint(isAsciiUpper(cp) ? toAsciiLower(cp) : cp);
      }
    }
  }
  // After attribute name state
  //------------------------------------------------------------------
  _stateAfterAttributeName(cp) {
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        break;
      }
      case CODE_POINTS.SOLIDUS: {
        this.state = State.SELF_CLOSING_START_TAG;
        break;
      }
      case CODE_POINTS.EQUALS_SIGN: {
        this.state = State.BEFORE_ATTRIBUTE_VALUE;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State.DATA;
        this.emitCurrentTagToken();
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInTag);
        this._emitEOFToken();
        break;
      }
      default: {
        this._createAttr("");
        this.state = State.ATTRIBUTE_NAME;
        this._stateAttributeName(cp);
      }
    }
  }
  // Before attribute value state
  //------------------------------------------------------------------
  _stateBeforeAttributeValue(cp) {
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        break;
      }
      case CODE_POINTS.QUOTATION_MARK: {
        this.state = State.ATTRIBUTE_VALUE_DOUBLE_QUOTED;
        break;
      }
      case CODE_POINTS.APOSTROPHE: {
        this.state = State.ATTRIBUTE_VALUE_SINGLE_QUOTED;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.missingAttributeValue);
        this.state = State.DATA;
        this.emitCurrentTagToken();
        break;
      }
      default: {
        this.state = State.ATTRIBUTE_VALUE_UNQUOTED;
        this._stateAttributeValueUnquoted(cp);
      }
    }
  }
  // Attribute value (double-quoted) state
  //------------------------------------------------------------------
  _stateAttributeValueDoubleQuoted(cp) {
    switch (cp) {
      case CODE_POINTS.QUOTATION_MARK: {
        this.state = State.AFTER_ATTRIBUTE_VALUE_QUOTED;
        break;
      }
      case CODE_POINTS.AMPERSAND: {
        this._startCharacterReference();
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this.currentAttr.value += REPLACEMENT_CHARACTER;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInTag);
        this._emitEOFToken();
        break;
      }
      default: {
        this.currentAttr.value += String.fromCodePoint(cp);
      }
    }
  }
  // Attribute value (single-quoted) state
  //------------------------------------------------------------------
  _stateAttributeValueSingleQuoted(cp) {
    switch (cp) {
      case CODE_POINTS.APOSTROPHE: {
        this.state = State.AFTER_ATTRIBUTE_VALUE_QUOTED;
        break;
      }
      case CODE_POINTS.AMPERSAND: {
        this._startCharacterReference();
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this.currentAttr.value += REPLACEMENT_CHARACTER;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInTag);
        this._emitEOFToken();
        break;
      }
      default: {
        this.currentAttr.value += String.fromCodePoint(cp);
      }
    }
  }
  // Attribute value (unquoted) state
  //------------------------------------------------------------------
  _stateAttributeValueUnquoted(cp) {
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        this._leaveAttrValue();
        this.state = State.BEFORE_ATTRIBUTE_NAME;
        break;
      }
      case CODE_POINTS.AMPERSAND: {
        this._startCharacterReference();
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._leaveAttrValue();
        this.state = State.DATA;
        this.emitCurrentTagToken();
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this.currentAttr.value += REPLACEMENT_CHARACTER;
        break;
      }
      case CODE_POINTS.QUOTATION_MARK:
      case CODE_POINTS.APOSTROPHE:
      case CODE_POINTS.LESS_THAN_SIGN:
      case CODE_POINTS.EQUALS_SIGN:
      case CODE_POINTS.GRAVE_ACCENT: {
        this._err(ERR.unexpectedCharacterInUnquotedAttributeValue);
        this.currentAttr.value += String.fromCodePoint(cp);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInTag);
        this._emitEOFToken();
        break;
      }
      default: {
        this.currentAttr.value += String.fromCodePoint(cp);
      }
    }
  }
  // After attribute value (quoted) state
  //------------------------------------------------------------------
  _stateAfterAttributeValueQuoted(cp) {
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        this._leaveAttrValue();
        this.state = State.BEFORE_ATTRIBUTE_NAME;
        break;
      }
      case CODE_POINTS.SOLIDUS: {
        this._leaveAttrValue();
        this.state = State.SELF_CLOSING_START_TAG;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._leaveAttrValue();
        this.state = State.DATA;
        this.emitCurrentTagToken();
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInTag);
        this._emitEOFToken();
        break;
      }
      default: {
        this._err(ERR.missingWhitespaceBetweenAttributes);
        this.state = State.BEFORE_ATTRIBUTE_NAME;
        this._stateBeforeAttributeName(cp);
      }
    }
  }
  // Self-closing start tag state
  //------------------------------------------------------------------
  _stateSelfClosingStartTag(cp) {
    switch (cp) {
      case CODE_POINTS.GREATER_THAN_SIGN: {
        const token = this.currentToken;
        token.selfClosing = true;
        this.state = State.DATA;
        this.emitCurrentTagToken();
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInTag);
        this._emitEOFToken();
        break;
      }
      default: {
        this._err(ERR.unexpectedSolidusInTag);
        this.state = State.BEFORE_ATTRIBUTE_NAME;
        this._stateBeforeAttributeName(cp);
      }
    }
  }
  // Bogus comment state
  //------------------------------------------------------------------
  _stateBogusComment(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State.DATA;
        this.emitCurrentComment(token);
        break;
      }
      case CODE_POINTS.EOF: {
        this.emitCurrentComment(token);
        this._emitEOFToken();
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        token.data += REPLACEMENT_CHARACTER;
        break;
      }
      default: {
        token.data += String.fromCodePoint(cp);
      }
    }
  }
  // Markup declaration open state
  //------------------------------------------------------------------
  _stateMarkupDeclarationOpen(cp) {
    if (this._consumeSequenceIfMatch(SEQUENCES.DASH_DASH, true)) {
      this._createCommentToken(SEQUENCES.DASH_DASH.length + 1);
      this.state = State.COMMENT_START;
    } else if (this._consumeSequenceIfMatch(SEQUENCES.DOCTYPE, false)) {
      this.currentLocation = this.getCurrentLocation(SEQUENCES.DOCTYPE.length + 1);
      this.state = State.DOCTYPE;
    } else if (this._consumeSequenceIfMatch(SEQUENCES.CDATA_START, true)) {
      if (this.inForeignNode) {
        this.state = State.CDATA_SECTION;
      } else {
        this._err(ERR.cdataInHtmlContent);
        this._createCommentToken(SEQUENCES.CDATA_START.length + 1);
        this.currentToken.data = "[CDATA[";
        this.state = State.BOGUS_COMMENT;
      }
    } else if (!this._ensureHibernation()) {
      this._err(ERR.incorrectlyOpenedComment);
      this._createCommentToken(2);
      this.state = State.BOGUS_COMMENT;
      this._stateBogusComment(cp);
    }
  }
  // Comment start state
  //------------------------------------------------------------------
  _stateCommentStart(cp) {
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this.state = State.COMMENT_START_DASH;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.abruptClosingOfEmptyComment);
        this.state = State.DATA;
        const token = this.currentToken;
        this.emitCurrentComment(token);
        break;
      }
      default: {
        this.state = State.COMMENT;
        this._stateComment(cp);
      }
    }
  }
  // Comment start dash state
  //------------------------------------------------------------------
  _stateCommentStartDash(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this.state = State.COMMENT_END;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.abruptClosingOfEmptyComment);
        this.state = State.DATA;
        this.emitCurrentComment(token);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInComment);
        this.emitCurrentComment(token);
        this._emitEOFToken();
        break;
      }
      default: {
        token.data += "-";
        this.state = State.COMMENT;
        this._stateComment(cp);
      }
    }
  }
  // Comment state
  //------------------------------------------------------------------
  _stateComment(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this.state = State.COMMENT_END_DASH;
        break;
      }
      case CODE_POINTS.LESS_THAN_SIGN: {
        token.data += "<";
        this.state = State.COMMENT_LESS_THAN_SIGN;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        token.data += REPLACEMENT_CHARACTER;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInComment);
        this.emitCurrentComment(token);
        this._emitEOFToken();
        break;
      }
      default: {
        token.data += String.fromCodePoint(cp);
      }
    }
  }
  // Comment less-than sign state
  //------------------------------------------------------------------
  _stateCommentLessThanSign(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.EXCLAMATION_MARK: {
        token.data += "!";
        this.state = State.COMMENT_LESS_THAN_SIGN_BANG;
        break;
      }
      case CODE_POINTS.LESS_THAN_SIGN: {
        token.data += "<";
        break;
      }
      default: {
        this.state = State.COMMENT;
        this._stateComment(cp);
      }
    }
  }
  // Comment less-than sign bang state
  //------------------------------------------------------------------
  _stateCommentLessThanSignBang(cp) {
    if (cp === CODE_POINTS.HYPHEN_MINUS) {
      this.state = State.COMMENT_LESS_THAN_SIGN_BANG_DASH;
    } else {
      this.state = State.COMMENT;
      this._stateComment(cp);
    }
  }
  // Comment less-than sign bang dash state
  //------------------------------------------------------------------
  _stateCommentLessThanSignBangDash(cp) {
    if (cp === CODE_POINTS.HYPHEN_MINUS) {
      this.state = State.COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH;
    } else {
      this.state = State.COMMENT_END_DASH;
      this._stateCommentEndDash(cp);
    }
  }
  // Comment less-than sign bang dash dash state
  //------------------------------------------------------------------
  _stateCommentLessThanSignBangDashDash(cp) {
    if (cp !== CODE_POINTS.GREATER_THAN_SIGN && cp !== CODE_POINTS.EOF) {
      this._err(ERR.nestedComment);
    }
    this.state = State.COMMENT_END;
    this._stateCommentEnd(cp);
  }
  // Comment end dash state
  //------------------------------------------------------------------
  _stateCommentEndDash(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this.state = State.COMMENT_END;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInComment);
        this.emitCurrentComment(token);
        this._emitEOFToken();
        break;
      }
      default: {
        token.data += "-";
        this.state = State.COMMENT;
        this._stateComment(cp);
      }
    }
  }
  // Comment end state
  //------------------------------------------------------------------
  _stateCommentEnd(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State.DATA;
        this.emitCurrentComment(token);
        break;
      }
      case CODE_POINTS.EXCLAMATION_MARK: {
        this.state = State.COMMENT_END_BANG;
        break;
      }
      case CODE_POINTS.HYPHEN_MINUS: {
        token.data += "-";
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInComment);
        this.emitCurrentComment(token);
        this._emitEOFToken();
        break;
      }
      default: {
        token.data += "--";
        this.state = State.COMMENT;
        this._stateComment(cp);
      }
    }
  }
  // Comment end bang state
  //------------------------------------------------------------------
  _stateCommentEndBang(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        token.data += "--!";
        this.state = State.COMMENT_END_DASH;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.incorrectlyClosedComment);
        this.state = State.DATA;
        this.emitCurrentComment(token);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInComment);
        this.emitCurrentComment(token);
        this._emitEOFToken();
        break;
      }
      default: {
        token.data += "--!";
        this.state = State.COMMENT;
        this._stateComment(cp);
      }
    }
  }
  // DOCTYPE state
  //------------------------------------------------------------------
  _stateDoctype(cp) {
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        this.state = State.BEFORE_DOCTYPE_NAME;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State.BEFORE_DOCTYPE_NAME;
        this._stateBeforeDoctypeName(cp);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        this._createDoctypeToken(null);
        const token = this.currentToken;
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        this._err(ERR.missingWhitespaceBeforeDoctypeName);
        this.state = State.BEFORE_DOCTYPE_NAME;
        this._stateBeforeDoctypeName(cp);
      }
    }
  }
  // Before DOCTYPE name state
  //------------------------------------------------------------------
  _stateBeforeDoctypeName(cp) {
    if (isAsciiUpper(cp)) {
      this._createDoctypeToken(String.fromCharCode(toAsciiLower(cp)));
      this.state = State.DOCTYPE_NAME;
    } else
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this._createDoctypeToken(REPLACEMENT_CHARACTER);
          this.state = State.DOCTYPE_NAME;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._err(ERR.missingDoctypeName);
          this._createDoctypeToken(null);
          const token = this.currentToken;
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this.state = State.DATA;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          this._createDoctypeToken(null);
          const token = this.currentToken;
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          this._createDoctypeToken(String.fromCodePoint(cp));
          this.state = State.DOCTYPE_NAME;
        }
      }
  }
  // DOCTYPE name state
  //------------------------------------------------------------------
  _stateDoctypeName(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        this.state = State.AFTER_DOCTYPE_NAME;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State.DATA;
        this.emitCurrentDoctype(token);
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        token.name += REPLACEMENT_CHARACTER;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        token.name += String.fromCodePoint(isAsciiUpper(cp) ? toAsciiLower(cp) : cp);
      }
    }
  }
  // After DOCTYPE name state
  //------------------------------------------------------------------
  _stateAfterDoctypeName(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State.DATA;
        this.emitCurrentDoctype(token);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        if (this._consumeSequenceIfMatch(SEQUENCES.PUBLIC, false)) {
          this.state = State.AFTER_DOCTYPE_PUBLIC_KEYWORD;
        } else if (this._consumeSequenceIfMatch(SEQUENCES.SYSTEM, false)) {
          this.state = State.AFTER_DOCTYPE_SYSTEM_KEYWORD;
        } else if (!this._ensureHibernation()) {
          this._err(ERR.invalidCharacterSequenceAfterDoctypeName);
          token.forceQuirks = true;
          this.state = State.BOGUS_DOCTYPE;
          this._stateBogusDoctype(cp);
        }
      }
    }
  }
  // After DOCTYPE public keyword state
  //------------------------------------------------------------------
  _stateAfterDoctypePublicKeyword(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        this.state = State.BEFORE_DOCTYPE_PUBLIC_IDENTIFIER;
        break;
      }
      case CODE_POINTS.QUOTATION_MARK: {
        this._err(ERR.missingWhitespaceAfterDoctypePublicKeyword);
        token.publicId = "";
        this.state = State.DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED;
        break;
      }
      case CODE_POINTS.APOSTROPHE: {
        this._err(ERR.missingWhitespaceAfterDoctypePublicKeyword);
        token.publicId = "";
        this.state = State.DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.missingDoctypePublicIdentifier);
        token.forceQuirks = true;
        this.state = State.DATA;
        this.emitCurrentDoctype(token);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        this._err(ERR.missingQuoteBeforeDoctypePublicIdentifier);
        token.forceQuirks = true;
        this.state = State.BOGUS_DOCTYPE;
        this._stateBogusDoctype(cp);
      }
    }
  }
  // Before DOCTYPE public identifier state
  //------------------------------------------------------------------
  _stateBeforeDoctypePublicIdentifier(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        break;
      }
      case CODE_POINTS.QUOTATION_MARK: {
        token.publicId = "";
        this.state = State.DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED;
        break;
      }
      case CODE_POINTS.APOSTROPHE: {
        token.publicId = "";
        this.state = State.DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.missingDoctypePublicIdentifier);
        token.forceQuirks = true;
        this.state = State.DATA;
        this.emitCurrentDoctype(token);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        this._err(ERR.missingQuoteBeforeDoctypePublicIdentifier);
        token.forceQuirks = true;
        this.state = State.BOGUS_DOCTYPE;
        this._stateBogusDoctype(cp);
      }
    }
  }
  // DOCTYPE public identifier (double-quoted) state
  //------------------------------------------------------------------
  _stateDoctypePublicIdentifierDoubleQuoted(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.QUOTATION_MARK: {
        this.state = State.AFTER_DOCTYPE_PUBLIC_IDENTIFIER;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        token.publicId += REPLACEMENT_CHARACTER;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.abruptDoctypePublicIdentifier);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this.state = State.DATA;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        token.publicId += String.fromCodePoint(cp);
      }
    }
  }
  // DOCTYPE public identifier (single-quoted) state
  //------------------------------------------------------------------
  _stateDoctypePublicIdentifierSingleQuoted(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.APOSTROPHE: {
        this.state = State.AFTER_DOCTYPE_PUBLIC_IDENTIFIER;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        token.publicId += REPLACEMENT_CHARACTER;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.abruptDoctypePublicIdentifier);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this.state = State.DATA;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        token.publicId += String.fromCodePoint(cp);
      }
    }
  }
  // After DOCTYPE public identifier state
  //------------------------------------------------------------------
  _stateAfterDoctypePublicIdentifier(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        this.state = State.BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State.DATA;
        this.emitCurrentDoctype(token);
        break;
      }
      case CODE_POINTS.QUOTATION_MARK: {
        this._err(ERR.missingWhitespaceBetweenDoctypePublicAndSystemIdentifiers);
        token.systemId = "";
        this.state = State.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
        break;
      }
      case CODE_POINTS.APOSTROPHE: {
        this._err(ERR.missingWhitespaceBetweenDoctypePublicAndSystemIdentifiers);
        token.systemId = "";
        this.state = State.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        this._err(ERR.missingQuoteBeforeDoctypeSystemIdentifier);
        token.forceQuirks = true;
        this.state = State.BOGUS_DOCTYPE;
        this._stateBogusDoctype(cp);
      }
    }
  }
  // Between DOCTYPE public and system identifiers state
  //------------------------------------------------------------------
  _stateBetweenDoctypePublicAndSystemIdentifiers(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.emitCurrentDoctype(token);
        this.state = State.DATA;
        break;
      }
      case CODE_POINTS.QUOTATION_MARK: {
        token.systemId = "";
        this.state = State.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
        break;
      }
      case CODE_POINTS.APOSTROPHE: {
        token.systemId = "";
        this.state = State.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        this._err(ERR.missingQuoteBeforeDoctypeSystemIdentifier);
        token.forceQuirks = true;
        this.state = State.BOGUS_DOCTYPE;
        this._stateBogusDoctype(cp);
      }
    }
  }
  // After DOCTYPE system keyword state
  //------------------------------------------------------------------
  _stateAfterDoctypeSystemKeyword(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        this.state = State.BEFORE_DOCTYPE_SYSTEM_IDENTIFIER;
        break;
      }
      case CODE_POINTS.QUOTATION_MARK: {
        this._err(ERR.missingWhitespaceAfterDoctypeSystemKeyword);
        token.systemId = "";
        this.state = State.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
        break;
      }
      case CODE_POINTS.APOSTROPHE: {
        this._err(ERR.missingWhitespaceAfterDoctypeSystemKeyword);
        token.systemId = "";
        this.state = State.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.missingDoctypeSystemIdentifier);
        token.forceQuirks = true;
        this.state = State.DATA;
        this.emitCurrentDoctype(token);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        this._err(ERR.missingQuoteBeforeDoctypeSystemIdentifier);
        token.forceQuirks = true;
        this.state = State.BOGUS_DOCTYPE;
        this._stateBogusDoctype(cp);
      }
    }
  }
  // Before DOCTYPE system identifier state
  //------------------------------------------------------------------
  _stateBeforeDoctypeSystemIdentifier(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        break;
      }
      case CODE_POINTS.QUOTATION_MARK: {
        token.systemId = "";
        this.state = State.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
        break;
      }
      case CODE_POINTS.APOSTROPHE: {
        token.systemId = "";
        this.state = State.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.missingDoctypeSystemIdentifier);
        token.forceQuirks = true;
        this.state = State.DATA;
        this.emitCurrentDoctype(token);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        this._err(ERR.missingQuoteBeforeDoctypeSystemIdentifier);
        token.forceQuirks = true;
        this.state = State.BOGUS_DOCTYPE;
        this._stateBogusDoctype(cp);
      }
    }
  }
  // DOCTYPE system identifier (double-quoted) state
  //------------------------------------------------------------------
  _stateDoctypeSystemIdentifierDoubleQuoted(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.QUOTATION_MARK: {
        this.state = State.AFTER_DOCTYPE_SYSTEM_IDENTIFIER;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        token.systemId += REPLACEMENT_CHARACTER;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.abruptDoctypeSystemIdentifier);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this.state = State.DATA;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        token.systemId += String.fromCodePoint(cp);
      }
    }
  }
  // DOCTYPE system identifier (single-quoted) state
  //------------------------------------------------------------------
  _stateDoctypeSystemIdentifierSingleQuoted(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.APOSTROPHE: {
        this.state = State.AFTER_DOCTYPE_SYSTEM_IDENTIFIER;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        token.systemId += REPLACEMENT_CHARACTER;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.abruptDoctypeSystemIdentifier);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this.state = State.DATA;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        token.systemId += String.fromCodePoint(cp);
      }
    }
  }
  // After DOCTYPE system identifier state
  //------------------------------------------------------------------
  _stateAfterDoctypeSystemIdentifier(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.emitCurrentDoctype(token);
        this.state = State.DATA;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        this._err(ERR.unexpectedCharacterAfterDoctypeSystemIdentifier);
        this.state = State.BOGUS_DOCTYPE;
        this._stateBogusDoctype(cp);
      }
    }
  }
  // Bogus DOCTYPE state
  //------------------------------------------------------------------
  _stateBogusDoctype(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.emitCurrentDoctype(token);
        this.state = State.DATA;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        break;
      }
      case CODE_POINTS.EOF: {
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default:
    }
  }
  // CDATA section state
  //------------------------------------------------------------------
  _stateCdataSection(cp) {
    switch (cp) {
      case CODE_POINTS.RIGHT_SQUARE_BRACKET: {
        this.state = State.CDATA_SECTION_BRACKET;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInCdata);
        this._emitEOFToken();
        break;
      }
      default: {
        this._emitCodePoint(cp);
      }
    }
  }
  // CDATA section bracket state
  //------------------------------------------------------------------
  _stateCdataSectionBracket(cp) {
    if (cp === CODE_POINTS.RIGHT_SQUARE_BRACKET) {
      this.state = State.CDATA_SECTION_END;
    } else {
      this._emitChars("]");
      this.state = State.CDATA_SECTION;
      this._stateCdataSection(cp);
    }
  }
  // CDATA section end state
  //------------------------------------------------------------------
  _stateCdataSectionEnd(cp) {
    switch (cp) {
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State.DATA;
        break;
      }
      case CODE_POINTS.RIGHT_SQUARE_BRACKET: {
        this._emitChars("]");
        break;
      }
      default: {
        this._emitChars("]]");
        this.state = State.CDATA_SECTION;
        this._stateCdataSection(cp);
      }
    }
  }
  // Character reference state
  //------------------------------------------------------------------
  _stateCharacterReference() {
    let length = this.entityDecoder.write(this.preprocessor.html, this.preprocessor.pos);
    if (length < 0) {
      if (this.preprocessor.lastChunkWritten) {
        length = this.entityDecoder.end();
      } else {
        this.active = false;
        this.preprocessor.pos = this.preprocessor.html.length - 1;
        this.consumedAfterSnapshot = 0;
        this.preprocessor.endOfChunkHit = true;
        return;
      }
    }
    if (length === 0) {
      this.preprocessor.pos = this.entityStartPos;
      this._flushCodePointConsumedAsCharacterReference(CODE_POINTS.AMPERSAND);
      this.state = !this._isCharacterReferenceInAttribute() && isAsciiAlphaNumeric(this.preprocessor.peek(1)) ? State.AMBIGUOUS_AMPERSAND : this.returnState;
    } else {
      this.state = this.returnState;
    }
  }
  // Ambiguos ampersand state
  //------------------------------------------------------------------
  _stateAmbiguousAmpersand(cp) {
    if (isAsciiAlphaNumeric(cp)) {
      this._flushCodePointConsumedAsCharacterReference(cp);
    } else {
      if (cp === CODE_POINTS.SEMICOLON) {
        this._err(ERR.unknownNamedCharacterReference);
      }
      this.state = this.returnState;
      this._callState(cp);
    }
  }
};

// node_modules/parse5/dist/parser/open-element-stack.js
var IMPLICIT_END_TAG_REQUIRED = /* @__PURE__ */ new Set([TAG_ID.DD, TAG_ID.DT, TAG_ID.LI, TAG_ID.OPTGROUP, TAG_ID.OPTION, TAG_ID.P, TAG_ID.RB, TAG_ID.RP, TAG_ID.RT, TAG_ID.RTC]);
var IMPLICIT_END_TAG_REQUIRED_THOROUGHLY = /* @__PURE__ */ new Set([
  ...IMPLICIT_END_TAG_REQUIRED,
  TAG_ID.CAPTION,
  TAG_ID.COLGROUP,
  TAG_ID.TBODY,
  TAG_ID.TD,
  TAG_ID.TFOOT,
  TAG_ID.TH,
  TAG_ID.THEAD,
  TAG_ID.TR
]);
var SCOPING_ELEMENTS_HTML = /* @__PURE__ */ new Set([
  TAG_ID.APPLET,
  TAG_ID.CAPTION,
  TAG_ID.HTML,
  TAG_ID.MARQUEE,
  TAG_ID.OBJECT,
  TAG_ID.TABLE,
  TAG_ID.TD,
  TAG_ID.TEMPLATE,
  TAG_ID.TH
]);
var SCOPING_ELEMENTS_HTML_LIST = /* @__PURE__ */ new Set([...SCOPING_ELEMENTS_HTML, TAG_ID.OL, TAG_ID.UL]);
var SCOPING_ELEMENTS_HTML_BUTTON = /* @__PURE__ */ new Set([...SCOPING_ELEMENTS_HTML, TAG_ID.BUTTON]);
var SCOPING_ELEMENTS_MATHML = /* @__PURE__ */ new Set([TAG_ID.ANNOTATION_XML, TAG_ID.MI, TAG_ID.MN, TAG_ID.MO, TAG_ID.MS, TAG_ID.MTEXT]);
var SCOPING_ELEMENTS_SVG = /* @__PURE__ */ new Set([TAG_ID.DESC, TAG_ID.FOREIGN_OBJECT, TAG_ID.TITLE]);
var TABLE_ROW_CONTEXT = /* @__PURE__ */ new Set([TAG_ID.TR, TAG_ID.TEMPLATE, TAG_ID.HTML]);
var TABLE_BODY_CONTEXT = /* @__PURE__ */ new Set([TAG_ID.TBODY, TAG_ID.TFOOT, TAG_ID.THEAD, TAG_ID.TEMPLATE, TAG_ID.HTML]);
var TABLE_CONTEXT = /* @__PURE__ */ new Set([TAG_ID.TABLE, TAG_ID.TEMPLATE, TAG_ID.HTML]);
var TABLE_CELLS = /* @__PURE__ */ new Set([TAG_ID.TD, TAG_ID.TH]);
var OpenElementStack = class {
  get currentTmplContentOrNode() {
    return this._isInTemplate() ? this.treeAdapter.getTemplateContent(this.current) : this.current;
  }
  constructor(document, treeAdapter, handler) {
    this.treeAdapter = treeAdapter;
    this.handler = handler;
    this.items = [];
    this.tagIDs = [];
    this.stackTop = -1;
    this.tmplCount = 0;
    this.currentTagId = TAG_ID.UNKNOWN;
    this.current = document;
  }
  //Index of element
  _indexOf(element) {
    return this.items.lastIndexOf(element, this.stackTop);
  }
  //Update current element
  _isInTemplate() {
    return this.currentTagId === TAG_ID.TEMPLATE && this.treeAdapter.getNamespaceURI(this.current) === NS.HTML;
  }
  _updateCurrentElement() {
    this.current = this.items[this.stackTop];
    this.currentTagId = this.tagIDs[this.stackTop];
  }
  //Mutations
  push(element, tagID) {
    this.stackTop++;
    this.items[this.stackTop] = element;
    this.current = element;
    this.tagIDs[this.stackTop] = tagID;
    this.currentTagId = tagID;
    if (this._isInTemplate()) {
      this.tmplCount++;
    }
    this.handler.onItemPush(element, tagID, true);
  }
  pop() {
    const popped = this.current;
    if (this.tmplCount > 0 && this._isInTemplate()) {
      this.tmplCount--;
    }
    this.stackTop--;
    this._updateCurrentElement();
    this.handler.onItemPop(popped, true);
  }
  replace(oldElement, newElement) {
    const idx = this._indexOf(oldElement);
    this.items[idx] = newElement;
    if (idx === this.stackTop) {
      this.current = newElement;
    }
  }
  insertAfter(referenceElement, newElement, newElementID) {
    const insertionIdx = this._indexOf(referenceElement) + 1;
    this.items.splice(insertionIdx, 0, newElement);
    this.tagIDs.splice(insertionIdx, 0, newElementID);
    this.stackTop++;
    if (insertionIdx === this.stackTop) {
      this._updateCurrentElement();
    }
    if (this.current && this.currentTagId !== void 0) {
      this.handler.onItemPush(this.current, this.currentTagId, insertionIdx === this.stackTop);
    }
  }
  popUntilTagNamePopped(tagName) {
    let targetIdx = this.stackTop + 1;
    do {
      targetIdx = this.tagIDs.lastIndexOf(tagName, targetIdx - 1);
    } while (targetIdx > 0 && this.treeAdapter.getNamespaceURI(this.items[targetIdx]) !== NS.HTML);
    this.shortenToLength(Math.max(targetIdx, 0));
  }
  shortenToLength(idx) {
    while (this.stackTop >= idx) {
      const popped = this.current;
      if (this.tmplCount > 0 && this._isInTemplate()) {
        this.tmplCount -= 1;
      }
      this.stackTop--;
      this._updateCurrentElement();
      this.handler.onItemPop(popped, this.stackTop < idx);
    }
  }
  popUntilElementPopped(element) {
    const idx = this._indexOf(element);
    this.shortenToLength(Math.max(idx, 0));
  }
  popUntilPopped(tagNames, targetNS) {
    const idx = this._indexOfTagNames(tagNames, targetNS);
    this.shortenToLength(Math.max(idx, 0));
  }
  popUntilNumberedHeaderPopped() {
    this.popUntilPopped(NUMBERED_HEADERS, NS.HTML);
  }
  popUntilTableCellPopped() {
    this.popUntilPopped(TABLE_CELLS, NS.HTML);
  }
  popAllUpToHtmlElement() {
    this.tmplCount = 0;
    this.shortenToLength(1);
  }
  _indexOfTagNames(tagNames, namespace) {
    for (let i = this.stackTop; i >= 0; i--) {
      if (tagNames.has(this.tagIDs[i]) && this.treeAdapter.getNamespaceURI(this.items[i]) === namespace) {
        return i;
      }
    }
    return -1;
  }
  clearBackTo(tagNames, targetNS) {
    const idx = this._indexOfTagNames(tagNames, targetNS);
    this.shortenToLength(idx + 1);
  }
  clearBackToTableContext() {
    this.clearBackTo(TABLE_CONTEXT, NS.HTML);
  }
  clearBackToTableBodyContext() {
    this.clearBackTo(TABLE_BODY_CONTEXT, NS.HTML);
  }
  clearBackToTableRowContext() {
    this.clearBackTo(TABLE_ROW_CONTEXT, NS.HTML);
  }
  remove(element) {
    const idx = this._indexOf(element);
    if (idx >= 0) {
      if (idx === this.stackTop) {
        this.pop();
      } else {
        this.items.splice(idx, 1);
        this.tagIDs.splice(idx, 1);
        this.stackTop--;
        this._updateCurrentElement();
        this.handler.onItemPop(element, false);
      }
    }
  }
  //Search
  tryPeekProperlyNestedBodyElement() {
    return this.stackTop >= 1 && this.tagIDs[1] === TAG_ID.BODY ? this.items[1] : null;
  }
  contains(element) {
    return this._indexOf(element) > -1;
  }
  getCommonAncestor(element) {
    const elementIdx = this._indexOf(element) - 1;
    return elementIdx >= 0 ? this.items[elementIdx] : null;
  }
  isRootHtmlElementCurrent() {
    return this.stackTop === 0 && this.tagIDs[0] === TAG_ID.HTML;
  }
  //Element in scope
  hasInDynamicScope(tagName, htmlScope) {
    for (let i = this.stackTop; i >= 0; i--) {
      const tn = this.tagIDs[i];
      switch (this.treeAdapter.getNamespaceURI(this.items[i])) {
        case NS.HTML: {
          if (tn === tagName)
            return true;
          if (htmlScope.has(tn))
            return false;
          break;
        }
        case NS.SVG: {
          if (SCOPING_ELEMENTS_SVG.has(tn))
            return false;
          break;
        }
        case NS.MATHML: {
          if (SCOPING_ELEMENTS_MATHML.has(tn))
            return false;
          break;
        }
      }
    }
    return true;
  }
  hasInScope(tagName) {
    return this.hasInDynamicScope(tagName, SCOPING_ELEMENTS_HTML);
  }
  hasInListItemScope(tagName) {
    return this.hasInDynamicScope(tagName, SCOPING_ELEMENTS_HTML_LIST);
  }
  hasInButtonScope(tagName) {
    return this.hasInDynamicScope(tagName, SCOPING_ELEMENTS_HTML_BUTTON);
  }
  hasNumberedHeaderInScope() {
    for (let i = this.stackTop; i >= 0; i--) {
      const tn = this.tagIDs[i];
      switch (this.treeAdapter.getNamespaceURI(this.items[i])) {
        case NS.HTML: {
          if (NUMBERED_HEADERS.has(tn))
            return true;
          if (SCOPING_ELEMENTS_HTML.has(tn))
            return false;
          break;
        }
        case NS.SVG: {
          if (SCOPING_ELEMENTS_SVG.has(tn))
            return false;
          break;
        }
        case NS.MATHML: {
          if (SCOPING_ELEMENTS_MATHML.has(tn))
            return false;
          break;
        }
      }
    }
    return true;
  }
  hasInTableScope(tagName) {
    for (let i = this.stackTop; i >= 0; i--) {
      if (this.treeAdapter.getNamespaceURI(this.items[i]) !== NS.HTML) {
        continue;
      }
      switch (this.tagIDs[i]) {
        case tagName: {
          return true;
        }
        case TAG_ID.TABLE:
        case TAG_ID.HTML: {
          return false;
        }
      }
    }
    return true;
  }
  hasTableBodyContextInTableScope() {
    for (let i = this.stackTop; i >= 0; i--) {
      if (this.treeAdapter.getNamespaceURI(this.items[i]) !== NS.HTML) {
        continue;
      }
      switch (this.tagIDs[i]) {
        case TAG_ID.TBODY:
        case TAG_ID.THEAD:
        case TAG_ID.TFOOT: {
          return true;
        }
        case TAG_ID.TABLE:
        case TAG_ID.HTML: {
          return false;
        }
      }
    }
    return true;
  }
  hasInSelectScope(tagName) {
    for (let i = this.stackTop; i >= 0; i--) {
      if (this.treeAdapter.getNamespaceURI(this.items[i]) !== NS.HTML) {
        continue;
      }
      switch (this.tagIDs[i]) {
        case tagName: {
          return true;
        }
        case TAG_ID.OPTION:
        case TAG_ID.OPTGROUP: {
          break;
        }
        default: {
          return false;
        }
      }
    }
    return true;
  }
  //Implied end tags
  generateImpliedEndTags() {
    while (this.currentTagId !== void 0 && IMPLICIT_END_TAG_REQUIRED.has(this.currentTagId)) {
      this.pop();
    }
  }
  generateImpliedEndTagsThoroughly() {
    while (this.currentTagId !== void 0 && IMPLICIT_END_TAG_REQUIRED_THOROUGHLY.has(this.currentTagId)) {
      this.pop();
    }
  }
  generateImpliedEndTagsWithExclusion(exclusionId) {
    while (this.currentTagId !== void 0 && this.currentTagId !== exclusionId && IMPLICIT_END_TAG_REQUIRED_THOROUGHLY.has(this.currentTagId)) {
      this.pop();
    }
  }
};

// node_modules/parse5/dist/parser/formatting-element-list.js
var NOAH_ARK_CAPACITY = 3;
var EntryType;
(function(EntryType2) {
  EntryType2[EntryType2["Marker"] = 0] = "Marker";
  EntryType2[EntryType2["Element"] = 1] = "Element";
})(EntryType || (EntryType = {}));
var MARKER = { type: EntryType.Marker };
var FormattingElementList = class {
  constructor(treeAdapter) {
    this.treeAdapter = treeAdapter;
    this.entries = [];
    this.bookmark = null;
  }
  //Noah Ark's condition
  //OPTIMIZATION: at first we try to find possible candidates for exclusion using
  //lightweight heuristics without thorough attributes check.
  _getNoahArkConditionCandidates(newElement, neAttrs) {
    const candidates = [];
    const neAttrsLength = neAttrs.length;
    const neTagName = this.treeAdapter.getTagName(newElement);
    const neNamespaceURI = this.treeAdapter.getNamespaceURI(newElement);
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      if (entry.type === EntryType.Marker) {
        break;
      }
      const { element } = entry;
      if (this.treeAdapter.getTagName(element) === neTagName && this.treeAdapter.getNamespaceURI(element) === neNamespaceURI) {
        const elementAttrs = this.treeAdapter.getAttrList(element);
        if (elementAttrs.length === neAttrsLength) {
          candidates.push({ idx: i, attrs: elementAttrs });
        }
      }
    }
    return candidates;
  }
  _ensureNoahArkCondition(newElement) {
    if (this.entries.length < NOAH_ARK_CAPACITY)
      return;
    const neAttrs = this.treeAdapter.getAttrList(newElement);
    const candidates = this._getNoahArkConditionCandidates(newElement, neAttrs);
    if (candidates.length < NOAH_ARK_CAPACITY)
      return;
    const neAttrsMap = new Map(neAttrs.map((neAttr) => [neAttr.name, neAttr.value]));
    let validCandidates = 0;
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      if (candidate.attrs.every((cAttr) => neAttrsMap.get(cAttr.name) === cAttr.value)) {
        validCandidates += 1;
        if (validCandidates >= NOAH_ARK_CAPACITY) {
          this.entries.splice(candidate.idx, 1);
        }
      }
    }
  }
  //Mutations
  insertMarker() {
    this.entries.unshift(MARKER);
  }
  pushElement(element, token) {
    this._ensureNoahArkCondition(element);
    this.entries.unshift({
      type: EntryType.Element,
      element,
      token
    });
  }
  insertElementAfterBookmark(element, token) {
    const bookmarkIdx = this.entries.indexOf(this.bookmark);
    this.entries.splice(bookmarkIdx, 0, {
      type: EntryType.Element,
      element,
      token
    });
  }
  removeEntry(entry) {
    const entryIndex = this.entries.indexOf(entry);
    if (entryIndex !== -1) {
      this.entries.splice(entryIndex, 1);
    }
  }
  /**
   * Clears the list of formatting elements up to the last marker.
   *
   * @see https://html.spec.whatwg.org/multipage/parsing.html#clear-the-list-of-active-formatting-elements-up-to-the-last-marker
   */
  clearToLastMarker() {
    const markerIdx = this.entries.indexOf(MARKER);
    if (markerIdx === -1) {
      this.entries.length = 0;
    } else {
      this.entries.splice(0, markerIdx + 1);
    }
  }
  //Search
  getElementEntryInScopeWithTagName(tagName) {
    const entry = this.entries.find((entry2) => entry2.type === EntryType.Marker || this.treeAdapter.getTagName(entry2.element) === tagName);
    return entry && entry.type === EntryType.Element ? entry : null;
  }
  getElementEntry(element) {
    return this.entries.find((entry) => entry.type === EntryType.Element && entry.element === element);
  }
};

// node_modules/parse5/dist/tree-adapters/default.js
var defaultTreeAdapter = {
  //Node construction
  createDocument() {
    return {
      nodeName: "#document",
      mode: DOCUMENT_MODE.NO_QUIRKS,
      childNodes: []
    };
  },
  createDocumentFragment() {
    return {
      nodeName: "#document-fragment",
      childNodes: []
    };
  },
  createElement(tagName, namespaceURI, attrs) {
    return {
      nodeName: tagName,
      tagName,
      attrs,
      namespaceURI,
      childNodes: [],
      parentNode: null
    };
  },
  createCommentNode(data) {
    return {
      nodeName: "#comment",
      data,
      parentNode: null
    };
  },
  createTextNode(value) {
    return {
      nodeName: "#text",
      value,
      parentNode: null
    };
  },
  //Tree mutation
  appendChild(parentNode, newNode) {
    parentNode.childNodes.push(newNode);
    newNode.parentNode = parentNode;
  },
  insertBefore(parentNode, newNode, referenceNode) {
    const insertionIdx = parentNode.childNodes.indexOf(referenceNode);
    parentNode.childNodes.splice(insertionIdx, 0, newNode);
    newNode.parentNode = parentNode;
  },
  setTemplateContent(templateElement, contentElement) {
    templateElement.content = contentElement;
  },
  getTemplateContent(templateElement) {
    return templateElement.content;
  },
  setDocumentType(document, name50, publicId, systemId) {
    const doctypeNode = document.childNodes.find((node) => node.nodeName === "#documentType");
    if (doctypeNode) {
      doctypeNode.name = name50;
      doctypeNode.publicId = publicId;
      doctypeNode.systemId = systemId;
    } else {
      const node = {
        nodeName: "#documentType",
        name: name50,
        publicId,
        systemId,
        parentNode: null
      };
      defaultTreeAdapter.appendChild(document, node);
    }
  },
  setDocumentMode(document, mode) {
    document.mode = mode;
  },
  getDocumentMode(document) {
    return document.mode;
  },
  detachNode(node) {
    if (node.parentNode) {
      const idx = node.parentNode.childNodes.indexOf(node);
      node.parentNode.childNodes.splice(idx, 1);
      node.parentNode = null;
    }
  },
  insertText(parentNode, text) {
    if (parentNode.childNodes.length > 0) {
      const prevNode = parentNode.childNodes[parentNode.childNodes.length - 1];
      if (defaultTreeAdapter.isTextNode(prevNode)) {
        prevNode.value += text;
        return;
      }
    }
    defaultTreeAdapter.appendChild(parentNode, defaultTreeAdapter.createTextNode(text));
  },
  insertTextBefore(parentNode, text, referenceNode) {
    const prevNode = parentNode.childNodes[parentNode.childNodes.indexOf(referenceNode) - 1];
    if (prevNode && defaultTreeAdapter.isTextNode(prevNode)) {
      prevNode.value += text;
    } else {
      defaultTreeAdapter.insertBefore(parentNode, defaultTreeAdapter.createTextNode(text), referenceNode);
    }
  },
  adoptAttributes(recipient, attrs) {
    const recipientAttrsMap = new Set(recipient.attrs.map((attr) => attr.name));
    for (let j = 0; j < attrs.length; j++) {
      if (!recipientAttrsMap.has(attrs[j].name)) {
        recipient.attrs.push(attrs[j]);
      }
    }
  },
  //Tree traversing
  getFirstChild(node) {
    return node.childNodes[0];
  },
  getChildNodes(node) {
    return node.childNodes;
  },
  getParentNode(node) {
    return node.parentNode;
  },
  getAttrList(element) {
    return element.attrs;
  },
  //Node data
  getTagName(element) {
    return element.tagName;
  },
  getNamespaceURI(element) {
    return element.namespaceURI;
  },
  getTextNodeContent(textNode) {
    return textNode.value;
  },
  getCommentNodeContent(commentNode) {
    return commentNode.data;
  },
  getDocumentTypeNodeName(doctypeNode) {
    return doctypeNode.name;
  },
  getDocumentTypeNodePublicId(doctypeNode) {
    return doctypeNode.publicId;
  },
  getDocumentTypeNodeSystemId(doctypeNode) {
    return doctypeNode.systemId;
  },
  //Node types
  isTextNode(node) {
    return node.nodeName === "#text";
  },
  isCommentNode(node) {
    return node.nodeName === "#comment";
  },
  isDocumentTypeNode(node) {
    return node.nodeName === "#documentType";
  },
  isElementNode(node) {
    return Object.prototype.hasOwnProperty.call(node, "tagName");
  },
  // Source code location
  setNodeSourceCodeLocation(node, location) {
    node.sourceCodeLocation = location;
  },
  getNodeSourceCodeLocation(node) {
    return node.sourceCodeLocation;
  },
  updateNodeSourceCodeLocation(node, endLocation) {
    node.sourceCodeLocation = { ...node.sourceCodeLocation, ...endLocation };
  }
};

// node_modules/parse5/dist/common/doctype.js
var VALID_DOCTYPE_NAME = "html";
var VALID_SYSTEM_ID = "about:legacy-compat";
var QUIRKS_MODE_SYSTEM_ID = "http://www.ibm.com/data/dtd/v11/ibmxhtml1-transitional.dtd";
var QUIRKS_MODE_PUBLIC_ID_PREFIXES = [
  "+//silmaril//dtd html pro v0r11 19970101//",
  "-//as//dtd html 3.0 aswedit + extensions//",
  "-//advasoft ltd//dtd html 3.0 aswedit + extensions//",
  "-//ietf//dtd html 2.0 level 1//",
  "-//ietf//dtd html 2.0 level 2//",
  "-//ietf//dtd html 2.0 strict level 1//",
  "-//ietf//dtd html 2.0 strict level 2//",
  "-//ietf//dtd html 2.0 strict//",
  "-//ietf//dtd html 2.0//",
  "-//ietf//dtd html 2.1e//",
  "-//ietf//dtd html 3.0//",
  "-//ietf//dtd html 3.2 final//",
  "-//ietf//dtd html 3.2//",
  "-//ietf//dtd html 3//",
  "-//ietf//dtd html level 0//",
  "-//ietf//dtd html level 1//",
  "-//ietf//dtd html level 2//",
  "-//ietf//dtd html level 3//",
  "-//ietf//dtd html strict level 0//",
  "-//ietf//dtd html strict level 1//",
  "-//ietf//dtd html strict level 2//",
  "-//ietf//dtd html strict level 3//",
  "-//ietf//dtd html strict//",
  "-//ietf//dtd html//",
  "-//metrius//dtd metrius presentational//",
  "-//microsoft//dtd internet explorer 2.0 html strict//",
  "-//microsoft//dtd internet explorer 2.0 html//",
  "-//microsoft//dtd internet explorer 2.0 tables//",
  "-//microsoft//dtd internet explorer 3.0 html strict//",
  "-//microsoft//dtd internet explorer 3.0 html//",
  "-//microsoft//dtd internet explorer 3.0 tables//",
  "-//netscape comm. corp.//dtd html//",
  "-//netscape comm. corp.//dtd strict html//",
  "-//o'reilly and associates//dtd html 2.0//",
  "-//o'reilly and associates//dtd html extended 1.0//",
  "-//o'reilly and associates//dtd html extended relaxed 1.0//",
  "-//sq//dtd html 2.0 hotmetal + extensions//",
  "-//softquad software//dtd hotmetal pro 6.0::19990601::extensions to html 4.0//",
  "-//softquad//dtd hotmetal pro 4.0::19971010::extensions to html 4.0//",
  "-//spyglass//dtd html 2.0 extended//",
  "-//sun microsystems corp.//dtd hotjava html//",
  "-//sun microsystems corp.//dtd hotjava strict html//",
  "-//w3c//dtd html 3 1995-03-24//",
  "-//w3c//dtd html 3.2 draft//",
  "-//w3c//dtd html 3.2 final//",
  "-//w3c//dtd html 3.2//",
  "-//w3c//dtd html 3.2s draft//",
  "-//w3c//dtd html 4.0 frameset//",
  "-//w3c//dtd html 4.0 transitional//",
  "-//w3c//dtd html experimental 19960712//",
  "-//w3c//dtd html experimental 970421//",
  "-//w3c//dtd w3 html//",
  "-//w3o//dtd w3 html 3.0//",
  "-//webtechs//dtd mozilla html 2.0//",
  "-//webtechs//dtd mozilla html//"
];
var QUIRKS_MODE_NO_SYSTEM_ID_PUBLIC_ID_PREFIXES = [
  ...QUIRKS_MODE_PUBLIC_ID_PREFIXES,
  "-//w3c//dtd html 4.01 frameset//",
  "-//w3c//dtd html 4.01 transitional//"
];
var QUIRKS_MODE_PUBLIC_IDS = /* @__PURE__ */ new Set([
  "-//w3o//dtd w3 html strict 3.0//en//",
  "-/w3c/dtd html 4.0 transitional/en",
  "html"
]);
var LIMITED_QUIRKS_PUBLIC_ID_PREFIXES = ["-//w3c//dtd xhtml 1.0 frameset//", "-//w3c//dtd xhtml 1.0 transitional//"];
var LIMITED_QUIRKS_WITH_SYSTEM_ID_PUBLIC_ID_PREFIXES = [
  ...LIMITED_QUIRKS_PUBLIC_ID_PREFIXES,
  "-//w3c//dtd html 4.01 frameset//",
  "-//w3c//dtd html 4.01 transitional//"
];
function hasPrefix(publicId, prefixes) {
  return prefixes.some((prefix) => publicId.startsWith(prefix));
}
function isConforming(token) {
  return token.name === VALID_DOCTYPE_NAME && token.publicId === null && (token.systemId === null || token.systemId === VALID_SYSTEM_ID);
}
function getDocumentMode(token) {
  if (token.name !== VALID_DOCTYPE_NAME) {
    return DOCUMENT_MODE.QUIRKS;
  }
  const { systemId } = token;
  if (systemId && systemId.toLowerCase() === QUIRKS_MODE_SYSTEM_ID) {
    return DOCUMENT_MODE.QUIRKS;
  }
  let { publicId } = token;
  if (publicId !== null) {
    publicId = publicId.toLowerCase();
    if (QUIRKS_MODE_PUBLIC_IDS.has(publicId)) {
      return DOCUMENT_MODE.QUIRKS;
    }
    let prefixes = systemId === null ? QUIRKS_MODE_NO_SYSTEM_ID_PUBLIC_ID_PREFIXES : QUIRKS_MODE_PUBLIC_ID_PREFIXES;
    if (hasPrefix(publicId, prefixes)) {
      return DOCUMENT_MODE.QUIRKS;
    }
    prefixes = systemId === null ? LIMITED_QUIRKS_PUBLIC_ID_PREFIXES : LIMITED_QUIRKS_WITH_SYSTEM_ID_PUBLIC_ID_PREFIXES;
    if (hasPrefix(publicId, prefixes)) {
      return DOCUMENT_MODE.LIMITED_QUIRKS;
    }
  }
  return DOCUMENT_MODE.NO_QUIRKS;
}

// node_modules/parse5/dist/common/foreign-content.js
var MIME_TYPES = {
  TEXT_HTML: "text/html",
  APPLICATION_XML: "application/xhtml+xml"
};
var DEFINITION_URL_ATTR = "definitionurl";
var ADJUSTED_DEFINITION_URL_ATTR = "definitionURL";
var SVG_ATTRS_ADJUSTMENT_MAP = new Map([
  "attributeName",
  "attributeType",
  "baseFrequency",
  "baseProfile",
  "calcMode",
  "clipPathUnits",
  "diffuseConstant",
  "edgeMode",
  "filterUnits",
  "glyphRef",
  "gradientTransform",
  "gradientUnits",
  "kernelMatrix",
  "kernelUnitLength",
  "keyPoints",
  "keySplines",
  "keyTimes",
  "lengthAdjust",
  "limitingConeAngle",
  "markerHeight",
  "markerUnits",
  "markerWidth",
  "maskContentUnits",
  "maskUnits",
  "numOctaves",
  "pathLength",
  "patternContentUnits",
  "patternTransform",
  "patternUnits",
  "pointsAtX",
  "pointsAtY",
  "pointsAtZ",
  "preserveAlpha",
  "preserveAspectRatio",
  "primitiveUnits",
  "refX",
  "refY",
  "repeatCount",
  "repeatDur",
  "requiredExtensions",
  "requiredFeatures",
  "specularConstant",
  "specularExponent",
  "spreadMethod",
  "startOffset",
  "stdDeviation",
  "stitchTiles",
  "surfaceScale",
  "systemLanguage",
  "tableValues",
  "targetX",
  "targetY",
  "textLength",
  "viewBox",
  "viewTarget",
  "xChannelSelector",
  "yChannelSelector",
  "zoomAndPan"
].map((attr) => [attr.toLowerCase(), attr]));
var XML_ATTRS_ADJUSTMENT_MAP = /* @__PURE__ */ new Map([
  ["xlink:actuate", { prefix: "xlink", name: "actuate", namespace: NS.XLINK }],
  ["xlink:arcrole", { prefix: "xlink", name: "arcrole", namespace: NS.XLINK }],
  ["xlink:href", { prefix: "xlink", name: "href", namespace: NS.XLINK }],
  ["xlink:role", { prefix: "xlink", name: "role", namespace: NS.XLINK }],
  ["xlink:show", { prefix: "xlink", name: "show", namespace: NS.XLINK }],
  ["xlink:title", { prefix: "xlink", name: "title", namespace: NS.XLINK }],
  ["xlink:type", { prefix: "xlink", name: "type", namespace: NS.XLINK }],
  ["xml:lang", { prefix: "xml", name: "lang", namespace: NS.XML }],
  ["xml:space", { prefix: "xml", name: "space", namespace: NS.XML }],
  ["xmlns", { prefix: "", name: "xmlns", namespace: NS.XMLNS }],
  ["xmlns:xlink", { prefix: "xmlns", name: "xlink", namespace: NS.XMLNS }]
]);
var SVG_TAG_NAMES_ADJUSTMENT_MAP = new Map([
  "altGlyph",
  "altGlyphDef",
  "altGlyphItem",
  "animateColor",
  "animateMotion",
  "animateTransform",
  "clipPath",
  "feBlend",
  "feColorMatrix",
  "feComponentTransfer",
  "feComposite",
  "feConvolveMatrix",
  "feDiffuseLighting",
  "feDisplacementMap",
  "feDistantLight",
  "feFlood",
  "feFuncA",
  "feFuncB",
  "feFuncG",
  "feFuncR",
  "feGaussianBlur",
  "feImage",
  "feMerge",
  "feMergeNode",
  "feMorphology",
  "feOffset",
  "fePointLight",
  "feSpecularLighting",
  "feSpotLight",
  "feTile",
  "feTurbulence",
  "foreignObject",
  "glyphRef",
  "linearGradient",
  "radialGradient",
  "textPath"
].map((tn) => [tn.toLowerCase(), tn]));
var EXITS_FOREIGN_CONTENT = /* @__PURE__ */ new Set([
  TAG_ID.B,
  TAG_ID.BIG,
  TAG_ID.BLOCKQUOTE,
  TAG_ID.BODY,
  TAG_ID.BR,
  TAG_ID.CENTER,
  TAG_ID.CODE,
  TAG_ID.DD,
  TAG_ID.DIV,
  TAG_ID.DL,
  TAG_ID.DT,
  TAG_ID.EM,
  TAG_ID.EMBED,
  TAG_ID.H1,
  TAG_ID.H2,
  TAG_ID.H3,
  TAG_ID.H4,
  TAG_ID.H5,
  TAG_ID.H6,
  TAG_ID.HEAD,
  TAG_ID.HR,
  TAG_ID.I,
  TAG_ID.IMG,
  TAG_ID.LI,
  TAG_ID.LISTING,
  TAG_ID.MENU,
  TAG_ID.META,
  TAG_ID.NOBR,
  TAG_ID.OL,
  TAG_ID.P,
  TAG_ID.PRE,
  TAG_ID.RUBY,
  TAG_ID.S,
  TAG_ID.SMALL,
  TAG_ID.SPAN,
  TAG_ID.STRONG,
  TAG_ID.STRIKE,
  TAG_ID.SUB,
  TAG_ID.SUP,
  TAG_ID.TABLE,
  TAG_ID.TT,
  TAG_ID.U,
  TAG_ID.UL,
  TAG_ID.VAR
]);
function causesExit(startTagToken) {
  const tn = startTagToken.tagID;
  const isFontWithAttrs = tn === TAG_ID.FONT && startTagToken.attrs.some(({ name: name50 }) => name50 === ATTRS.COLOR || name50 === ATTRS.SIZE || name50 === ATTRS.FACE);
  return isFontWithAttrs || EXITS_FOREIGN_CONTENT.has(tn);
}
function adjustTokenMathMLAttrs(token) {
  for (let i = 0; i < token.attrs.length; i++) {
    if (token.attrs[i].name === DEFINITION_URL_ATTR) {
      token.attrs[i].name = ADJUSTED_DEFINITION_URL_ATTR;
      break;
    }
  }
}
function adjustTokenSVGAttrs(token) {
  for (let i = 0; i < token.attrs.length; i++) {
    const adjustedAttrName = SVG_ATTRS_ADJUSTMENT_MAP.get(token.attrs[i].name);
    if (adjustedAttrName != null) {
      token.attrs[i].name = adjustedAttrName;
    }
  }
}
function adjustTokenXMLAttrs(token) {
  for (let i = 0; i < token.attrs.length; i++) {
    const adjustedAttrEntry = XML_ATTRS_ADJUSTMENT_MAP.get(token.attrs[i].name);
    if (adjustedAttrEntry) {
      token.attrs[i].prefix = adjustedAttrEntry.prefix;
      token.attrs[i].name = adjustedAttrEntry.name;
      token.attrs[i].namespace = adjustedAttrEntry.namespace;
    }
  }
}
function adjustTokenSVGTagName(token) {
  const adjustedTagName = SVG_TAG_NAMES_ADJUSTMENT_MAP.get(token.tagName);
  if (adjustedTagName != null) {
    token.tagName = adjustedTagName;
    token.tagID = getTagID(token.tagName);
  }
}
function isMathMLTextIntegrationPoint(tn, ns) {
  return ns === NS.MATHML && (tn === TAG_ID.MI || tn === TAG_ID.MO || tn === TAG_ID.MN || tn === TAG_ID.MS || tn === TAG_ID.MTEXT);
}
function isHtmlIntegrationPoint(tn, ns, attrs) {
  if (ns === NS.MATHML && tn === TAG_ID.ANNOTATION_XML) {
    for (let i = 0; i < attrs.length; i++) {
      if (attrs[i].name === ATTRS.ENCODING) {
        const value = attrs[i].value.toLowerCase();
        return value === MIME_TYPES.TEXT_HTML || value === MIME_TYPES.APPLICATION_XML;
      }
    }
  }
  return ns === NS.SVG && (tn === TAG_ID.FOREIGN_OBJECT || tn === TAG_ID.DESC || tn === TAG_ID.TITLE);
}
function isIntegrationPoint(tn, ns, attrs, foreignNS) {
  return (!foreignNS || foreignNS === NS.HTML) && isHtmlIntegrationPoint(tn, ns, attrs) || (!foreignNS || foreignNS === NS.MATHML) && isMathMLTextIntegrationPoint(tn, ns);
}

// node_modules/parse5/dist/parser/index.js
var HIDDEN_INPUT_TYPE = "hidden";
var AA_OUTER_LOOP_ITER = 8;
var AA_INNER_LOOP_ITER = 3;
var InsertionMode;
(function(InsertionMode2) {
  InsertionMode2[InsertionMode2["INITIAL"] = 0] = "INITIAL";
  InsertionMode2[InsertionMode2["BEFORE_HTML"] = 1] = "BEFORE_HTML";
  InsertionMode2[InsertionMode2["BEFORE_HEAD"] = 2] = "BEFORE_HEAD";
  InsertionMode2[InsertionMode2["IN_HEAD"] = 3] = "IN_HEAD";
  InsertionMode2[InsertionMode2["IN_HEAD_NO_SCRIPT"] = 4] = "IN_HEAD_NO_SCRIPT";
  InsertionMode2[InsertionMode2["AFTER_HEAD"] = 5] = "AFTER_HEAD";
  InsertionMode2[InsertionMode2["IN_BODY"] = 6] = "IN_BODY";
  InsertionMode2[InsertionMode2["TEXT"] = 7] = "TEXT";
  InsertionMode2[InsertionMode2["IN_TABLE"] = 8] = "IN_TABLE";
  InsertionMode2[InsertionMode2["IN_TABLE_TEXT"] = 9] = "IN_TABLE_TEXT";
  InsertionMode2[InsertionMode2["IN_CAPTION"] = 10] = "IN_CAPTION";
  InsertionMode2[InsertionMode2["IN_COLUMN_GROUP"] = 11] = "IN_COLUMN_GROUP";
  InsertionMode2[InsertionMode2["IN_TABLE_BODY"] = 12] = "IN_TABLE_BODY";
  InsertionMode2[InsertionMode2["IN_ROW"] = 13] = "IN_ROW";
  InsertionMode2[InsertionMode2["IN_CELL"] = 14] = "IN_CELL";
  InsertionMode2[InsertionMode2["IN_SELECT"] = 15] = "IN_SELECT";
  InsertionMode2[InsertionMode2["IN_SELECT_IN_TABLE"] = 16] = "IN_SELECT_IN_TABLE";
  InsertionMode2[InsertionMode2["IN_TEMPLATE"] = 17] = "IN_TEMPLATE";
  InsertionMode2[InsertionMode2["AFTER_BODY"] = 18] = "AFTER_BODY";
  InsertionMode2[InsertionMode2["IN_FRAMESET"] = 19] = "IN_FRAMESET";
  InsertionMode2[InsertionMode2["AFTER_FRAMESET"] = 20] = "AFTER_FRAMESET";
  InsertionMode2[InsertionMode2["AFTER_AFTER_BODY"] = 21] = "AFTER_AFTER_BODY";
  InsertionMode2[InsertionMode2["AFTER_AFTER_FRAMESET"] = 22] = "AFTER_AFTER_FRAMESET";
})(InsertionMode || (InsertionMode = {}));
var BASE_LOC = {
  startLine: -1,
  startCol: -1,
  startOffset: -1,
  endLine: -1,
  endCol: -1,
  endOffset: -1
};
var TABLE_STRUCTURE_TAGS = /* @__PURE__ */ new Set([TAG_ID.TABLE, TAG_ID.TBODY, TAG_ID.TFOOT, TAG_ID.THEAD, TAG_ID.TR]);
var defaultParserOptions = {
  scriptingEnabled: true,
  sourceCodeLocationInfo: false,
  treeAdapter: defaultTreeAdapter,
  onParseError: null
};
var Parser = class {
  constructor(options, document, fragmentContext = null, scriptHandler = null) {
    this.fragmentContext = fragmentContext;
    this.scriptHandler = scriptHandler;
    this.currentToken = null;
    this.stopped = false;
    this.insertionMode = InsertionMode.INITIAL;
    this.originalInsertionMode = InsertionMode.INITIAL;
    this.headElement = null;
    this.formElement = null;
    this.currentNotInHTML = false;
    this.tmplInsertionModeStack = [];
    this.pendingCharacterTokens = [];
    this.hasNonWhitespacePendingCharacterToken = false;
    this.framesetOk = true;
    this.skipNextNewLine = false;
    this.fosterParentingEnabled = false;
    this.options = {
      ...defaultParserOptions,
      ...options
    };
    this.treeAdapter = this.options.treeAdapter;
    this.onParseError = this.options.onParseError;
    if (this.onParseError) {
      this.options.sourceCodeLocationInfo = true;
    }
    this.document = document !== null && document !== void 0 ? document : this.treeAdapter.createDocument();
    this.tokenizer = new Tokenizer(this.options, this);
    this.activeFormattingElements = new FormattingElementList(this.treeAdapter);
    this.fragmentContextID = fragmentContext ? getTagID(this.treeAdapter.getTagName(fragmentContext)) : TAG_ID.UNKNOWN;
    this._setContextModes(fragmentContext !== null && fragmentContext !== void 0 ? fragmentContext : this.document, this.fragmentContextID);
    this.openElements = new OpenElementStack(this.document, this.treeAdapter, this);
  }
  // API
  static parse(html, options) {
    const parser = new this(options);
    parser.tokenizer.write(html, true);
    return parser.document;
  }
  static getFragmentParser(fragmentContext, options) {
    const opts = {
      ...defaultParserOptions,
      ...options
    };
    fragmentContext !== null && fragmentContext !== void 0 ? fragmentContext : fragmentContext = opts.treeAdapter.createElement(TAG_NAMES.TEMPLATE, NS.HTML, []);
    const documentMock = opts.treeAdapter.createElement("documentmock", NS.HTML, []);
    const parser = new this(opts, documentMock, fragmentContext);
    if (parser.fragmentContextID === TAG_ID.TEMPLATE) {
      parser.tmplInsertionModeStack.unshift(InsertionMode.IN_TEMPLATE);
    }
    parser._initTokenizerForFragmentParsing();
    parser._insertFakeRootElement();
    parser._resetInsertionMode();
    parser._findFormInFragmentContext();
    return parser;
  }
  getFragment() {
    const rootElement = this.treeAdapter.getFirstChild(this.document);
    const fragment = this.treeAdapter.createDocumentFragment();
    this._adoptNodes(rootElement, fragment);
    return fragment;
  }
  //Errors
  /** @internal */
  _err(token, code, beforeToken) {
    var _a;
    if (!this.onParseError)
      return;
    const loc = (_a = token.location) !== null && _a !== void 0 ? _a : BASE_LOC;
    const err = {
      code,
      startLine: loc.startLine,
      startCol: loc.startCol,
      startOffset: loc.startOffset,
      endLine: beforeToken ? loc.startLine : loc.endLine,
      endCol: beforeToken ? loc.startCol : loc.endCol,
      endOffset: beforeToken ? loc.startOffset : loc.endOffset
    };
    this.onParseError(err);
  }
  //Stack events
  /** @internal */
  onItemPush(node, tid, isTop) {
    var _a, _b;
    (_b = (_a = this.treeAdapter).onItemPush) === null || _b === void 0 ? void 0 : _b.call(_a, node);
    if (isTop && this.openElements.stackTop > 0)
      this._setContextModes(node, tid);
  }
  /** @internal */
  onItemPop(node, isTop) {
    var _a, _b;
    if (this.options.sourceCodeLocationInfo) {
      this._setEndLocation(node, this.currentToken);
    }
    (_b = (_a = this.treeAdapter).onItemPop) === null || _b === void 0 ? void 0 : _b.call(_a, node, this.openElements.current);
    if (isTop) {
      let current;
      let currentTagId;
      if (this.openElements.stackTop === 0 && this.fragmentContext) {
        current = this.fragmentContext;
        currentTagId = this.fragmentContextID;
      } else {
        ({ current, currentTagId } = this.openElements);
      }
      this._setContextModes(current, currentTagId);
    }
  }
  _setContextModes(current, tid) {
    const isHTML = current === this.document || current && this.treeAdapter.getNamespaceURI(current) === NS.HTML;
    this.currentNotInHTML = !isHTML;
    this.tokenizer.inForeignNode = !isHTML && current !== void 0 && tid !== void 0 && !this._isIntegrationPoint(tid, current);
  }
  /** @protected */
  _switchToTextParsing(currentToken, nextTokenizerState) {
    this._insertElement(currentToken, NS.HTML);
    this.tokenizer.state = nextTokenizerState;
    this.originalInsertionMode = this.insertionMode;
    this.insertionMode = InsertionMode.TEXT;
  }
  switchToPlaintextParsing() {
    this.insertionMode = InsertionMode.TEXT;
    this.originalInsertionMode = InsertionMode.IN_BODY;
    this.tokenizer.state = TokenizerMode.PLAINTEXT;
  }
  //Fragment parsing
  /** @protected */
  _getAdjustedCurrentElement() {
    return this.openElements.stackTop === 0 && this.fragmentContext ? this.fragmentContext : this.openElements.current;
  }
  /** @protected */
  _findFormInFragmentContext() {
    let node = this.fragmentContext;
    while (node) {
      if (this.treeAdapter.getTagName(node) === TAG_NAMES.FORM) {
        this.formElement = node;
        break;
      }
      node = this.treeAdapter.getParentNode(node);
    }
  }
  _initTokenizerForFragmentParsing() {
    if (!this.fragmentContext || this.treeAdapter.getNamespaceURI(this.fragmentContext) !== NS.HTML) {
      return;
    }
    switch (this.fragmentContextID) {
      case TAG_ID.TITLE:
      case TAG_ID.TEXTAREA: {
        this.tokenizer.state = TokenizerMode.RCDATA;
        break;
      }
      case TAG_ID.STYLE:
      case TAG_ID.XMP:
      case TAG_ID.IFRAME:
      case TAG_ID.NOEMBED:
      case TAG_ID.NOFRAMES:
      case TAG_ID.NOSCRIPT: {
        this.tokenizer.state = TokenizerMode.RAWTEXT;
        break;
      }
      case TAG_ID.SCRIPT: {
        this.tokenizer.state = TokenizerMode.SCRIPT_DATA;
        break;
      }
      case TAG_ID.PLAINTEXT: {
        this.tokenizer.state = TokenizerMode.PLAINTEXT;
        break;
      }
      default:
    }
  }
  //Tree mutation
  /** @protected */
  _setDocumentType(token) {
    const name50 = token.name || "";
    const publicId = token.publicId || "";
    const systemId = token.systemId || "";
    this.treeAdapter.setDocumentType(this.document, name50, publicId, systemId);
    if (token.location) {
      const documentChildren = this.treeAdapter.getChildNodes(this.document);
      const docTypeNode = documentChildren.find((node) => this.treeAdapter.isDocumentTypeNode(node));
      if (docTypeNode) {
        this.treeAdapter.setNodeSourceCodeLocation(docTypeNode, token.location);
      }
    }
  }
  /** @protected */
  _attachElementToTree(element, location) {
    if (this.options.sourceCodeLocationInfo) {
      const loc = location && {
        ...location,
        startTag: location
      };
      this.treeAdapter.setNodeSourceCodeLocation(element, loc);
    }
    if (this._shouldFosterParentOnInsertion()) {
      this._fosterParentElement(element);
    } else {
      const parent = this.openElements.currentTmplContentOrNode;
      this.treeAdapter.appendChild(parent !== null && parent !== void 0 ? parent : this.document, element);
    }
  }
  /**
   * For self-closing tags. Add an element to the tree, but skip adding it
   * to the stack.
   */
  /** @protected */
  _appendElement(token, namespaceURI) {
    const element = this.treeAdapter.createElement(token.tagName, namespaceURI, token.attrs);
    this._attachElementToTree(element, token.location);
  }
  /** @protected */
  _insertElement(token, namespaceURI) {
    const element = this.treeAdapter.createElement(token.tagName, namespaceURI, token.attrs);
    this._attachElementToTree(element, token.location);
    this.openElements.push(element, token.tagID);
  }
  /** @protected */
  _insertFakeElement(tagName, tagID) {
    const element = this.treeAdapter.createElement(tagName, NS.HTML, []);
    this._attachElementToTree(element, null);
    this.openElements.push(element, tagID);
  }
  /** @protected */
  _insertTemplate(token) {
    const tmpl = this.treeAdapter.createElement(token.tagName, NS.HTML, token.attrs);
    const content = this.treeAdapter.createDocumentFragment();
    this.treeAdapter.setTemplateContent(tmpl, content);
    this._attachElementToTree(tmpl, token.location);
    this.openElements.push(tmpl, token.tagID);
    if (this.options.sourceCodeLocationInfo)
      this.treeAdapter.setNodeSourceCodeLocation(content, null);
  }
  /** @protected */
  _insertFakeRootElement() {
    const element = this.treeAdapter.createElement(TAG_NAMES.HTML, NS.HTML, []);
    if (this.options.sourceCodeLocationInfo)
      this.treeAdapter.setNodeSourceCodeLocation(element, null);
    this.treeAdapter.appendChild(this.openElements.current, element);
    this.openElements.push(element, TAG_ID.HTML);
  }
  /** @protected */
  _appendCommentNode(token, parent) {
    const commentNode = this.treeAdapter.createCommentNode(token.data);
    this.treeAdapter.appendChild(parent, commentNode);
    if (this.options.sourceCodeLocationInfo) {
      this.treeAdapter.setNodeSourceCodeLocation(commentNode, token.location);
    }
  }
  /** @protected */
  _insertCharacters(token) {
    let parent;
    let beforeElement;
    if (this._shouldFosterParentOnInsertion()) {
      ({ parent, beforeElement } = this._findFosterParentingLocation());
      if (beforeElement) {
        this.treeAdapter.insertTextBefore(parent, token.chars, beforeElement);
      } else {
        this.treeAdapter.insertText(parent, token.chars);
      }
    } else {
      parent = this.openElements.currentTmplContentOrNode;
      this.treeAdapter.insertText(parent, token.chars);
    }
    if (!token.location)
      return;
    const siblings = this.treeAdapter.getChildNodes(parent);
    const textNodeIdx = beforeElement ? siblings.lastIndexOf(beforeElement) : siblings.length;
    const textNode = siblings[textNodeIdx - 1];
    const tnLoc = this.treeAdapter.getNodeSourceCodeLocation(textNode);
    if (tnLoc) {
      const { endLine, endCol, endOffset } = token.location;
      this.treeAdapter.updateNodeSourceCodeLocation(textNode, { endLine, endCol, endOffset });
    } else if (this.options.sourceCodeLocationInfo) {
      this.treeAdapter.setNodeSourceCodeLocation(textNode, token.location);
    }
  }
  /** @protected */
  _adoptNodes(donor, recipient) {
    for (let child = this.treeAdapter.getFirstChild(donor); child; child = this.treeAdapter.getFirstChild(donor)) {
      this.treeAdapter.detachNode(child);
      this.treeAdapter.appendChild(recipient, child);
    }
  }
  /** @protected */
  _setEndLocation(element, closingToken) {
    if (this.treeAdapter.getNodeSourceCodeLocation(element) && closingToken.location) {
      const ctLoc = closingToken.location;
      const tn = this.treeAdapter.getTagName(element);
      const endLoc = (
        // NOTE: For cases like <p> <p> </p> - First 'p' closes without a closing
        // tag and for cases like <td> <p> </td> - 'p' closes without a closing tag.
        closingToken.type === TokenType.END_TAG && tn === closingToken.tagName ? {
          endTag: { ...ctLoc },
          endLine: ctLoc.endLine,
          endCol: ctLoc.endCol,
          endOffset: ctLoc.endOffset
        } : {
          endLine: ctLoc.startLine,
          endCol: ctLoc.startCol,
          endOffset: ctLoc.startOffset
        }
      );
      this.treeAdapter.updateNodeSourceCodeLocation(element, endLoc);
    }
  }
  //Token processing
  shouldProcessStartTagTokenInForeignContent(token) {
    if (!this.currentNotInHTML)
      return false;
    let current;
    let currentTagId;
    if (this.openElements.stackTop === 0 && this.fragmentContext) {
      current = this.fragmentContext;
      currentTagId = this.fragmentContextID;
    } else {
      ({ current, currentTagId } = this.openElements);
    }
    if (token.tagID === TAG_ID.SVG && this.treeAdapter.getTagName(current) === TAG_NAMES.ANNOTATION_XML && this.treeAdapter.getNamespaceURI(current) === NS.MATHML) {
      return false;
    }
    return (
      // Check that `current` is not an integration point for HTML or MathML elements.
      this.tokenizer.inForeignNode || // If it _is_ an integration point, then we might have to check that it is not an HTML
      // integration point.
      (token.tagID === TAG_ID.MGLYPH || token.tagID === TAG_ID.MALIGNMARK) && currentTagId !== void 0 && !this._isIntegrationPoint(currentTagId, current, NS.HTML)
    );
  }
  /** @protected */
  _processToken(token) {
    switch (token.type) {
      case TokenType.CHARACTER: {
        this.onCharacter(token);
        break;
      }
      case TokenType.NULL_CHARACTER: {
        this.onNullCharacter(token);
        break;
      }
      case TokenType.COMMENT: {
        this.onComment(token);
        break;
      }
      case TokenType.DOCTYPE: {
        this.onDoctype(token);
        break;
      }
      case TokenType.START_TAG: {
        this._processStartTag(token);
        break;
      }
      case TokenType.END_TAG: {
        this.onEndTag(token);
        break;
      }
      case TokenType.EOF: {
        this.onEof(token);
        break;
      }
      case TokenType.WHITESPACE_CHARACTER: {
        this.onWhitespaceCharacter(token);
        break;
      }
    }
  }
  //Integration points
  /** @protected */
  _isIntegrationPoint(tid, element, foreignNS) {
    const ns = this.treeAdapter.getNamespaceURI(element);
    const attrs = this.treeAdapter.getAttrList(element);
    return isIntegrationPoint(tid, ns, attrs, foreignNS);
  }
  //Active formatting elements reconstruction
  /** @protected */
  _reconstructActiveFormattingElements() {
    const listLength = this.activeFormattingElements.entries.length;
    if (listLength) {
      const endIndex = this.activeFormattingElements.entries.findIndex((entry) => entry.type === EntryType.Marker || this.openElements.contains(entry.element));
      const unopenIdx = endIndex === -1 ? listLength - 1 : endIndex - 1;
      for (let i = unopenIdx; i >= 0; i--) {
        const entry = this.activeFormattingElements.entries[i];
        this._insertElement(entry.token, this.treeAdapter.getNamespaceURI(entry.element));
        entry.element = this.openElements.current;
      }
    }
  }
  //Close elements
  /** @protected */
  _closeTableCell() {
    this.openElements.generateImpliedEndTags();
    this.openElements.popUntilTableCellPopped();
    this.activeFormattingElements.clearToLastMarker();
    this.insertionMode = InsertionMode.IN_ROW;
  }
  /** @protected */
  _closePElement() {
    this.openElements.generateImpliedEndTagsWithExclusion(TAG_ID.P);
    this.openElements.popUntilTagNamePopped(TAG_ID.P);
  }
  //Insertion modes
  /** @protected */
  _resetInsertionMode() {
    for (let i = this.openElements.stackTop; i >= 0; i--) {
      switch (i === 0 && this.fragmentContext ? this.fragmentContextID : this.openElements.tagIDs[i]) {
        case TAG_ID.TR: {
          this.insertionMode = InsertionMode.IN_ROW;
          return;
        }
        case TAG_ID.TBODY:
        case TAG_ID.THEAD:
        case TAG_ID.TFOOT: {
          this.insertionMode = InsertionMode.IN_TABLE_BODY;
          return;
        }
        case TAG_ID.CAPTION: {
          this.insertionMode = InsertionMode.IN_CAPTION;
          return;
        }
        case TAG_ID.COLGROUP: {
          this.insertionMode = InsertionMode.IN_COLUMN_GROUP;
          return;
        }
        case TAG_ID.TABLE: {
          this.insertionMode = InsertionMode.IN_TABLE;
          return;
        }
        case TAG_ID.BODY: {
          this.insertionMode = InsertionMode.IN_BODY;
          return;
        }
        case TAG_ID.FRAMESET: {
          this.insertionMode = InsertionMode.IN_FRAMESET;
          return;
        }
        case TAG_ID.SELECT: {
          this._resetInsertionModeForSelect(i);
          return;
        }
        case TAG_ID.TEMPLATE: {
          this.insertionMode = this.tmplInsertionModeStack[0];
          return;
        }
        case TAG_ID.HTML: {
          this.insertionMode = this.headElement ? InsertionMode.AFTER_HEAD : InsertionMode.BEFORE_HEAD;
          return;
        }
        case TAG_ID.TD:
        case TAG_ID.TH: {
          if (i > 0) {
            this.insertionMode = InsertionMode.IN_CELL;
            return;
          }
          break;
        }
        case TAG_ID.HEAD: {
          if (i > 0) {
            this.insertionMode = InsertionMode.IN_HEAD;
            return;
          }
          break;
        }
      }
    }
    this.insertionMode = InsertionMode.IN_BODY;
  }
  /** @protected */
  _resetInsertionModeForSelect(selectIdx) {
    if (selectIdx > 0) {
      for (let i = selectIdx - 1; i > 0; i--) {
        const tn = this.openElements.tagIDs[i];
        if (tn === TAG_ID.TEMPLATE) {
          break;
        } else if (tn === TAG_ID.TABLE) {
          this.insertionMode = InsertionMode.IN_SELECT_IN_TABLE;
          return;
        }
      }
    }
    this.insertionMode = InsertionMode.IN_SELECT;
  }
  //Foster parenting
  /** @protected */
  _isElementCausesFosterParenting(tn) {
    return TABLE_STRUCTURE_TAGS.has(tn);
  }
  /** @protected */
  _shouldFosterParentOnInsertion() {
    return this.fosterParentingEnabled && this.openElements.currentTagId !== void 0 && this._isElementCausesFosterParenting(this.openElements.currentTagId);
  }
  /** @protected */
  _findFosterParentingLocation() {
    for (let i = this.openElements.stackTop; i >= 0; i--) {
      const openElement = this.openElements.items[i];
      switch (this.openElements.tagIDs[i]) {
        case TAG_ID.TEMPLATE: {
          if (this.treeAdapter.getNamespaceURI(openElement) === NS.HTML) {
            return { parent: this.treeAdapter.getTemplateContent(openElement), beforeElement: null };
          }
          break;
        }
        case TAG_ID.TABLE: {
          const parent = this.treeAdapter.getParentNode(openElement);
          if (parent) {
            return { parent, beforeElement: openElement };
          }
          return { parent: this.openElements.items[i - 1], beforeElement: null };
        }
        default:
      }
    }
    return { parent: this.openElements.items[0], beforeElement: null };
  }
  /** @protected */
  _fosterParentElement(element) {
    const location = this._findFosterParentingLocation();
    if (location.beforeElement) {
      this.treeAdapter.insertBefore(location.parent, element, location.beforeElement);
    } else {
      this.treeAdapter.appendChild(location.parent, element);
    }
  }
  //Special elements
  /** @protected */
  _isSpecialElement(element, id) {
    const ns = this.treeAdapter.getNamespaceURI(element);
    return SPECIAL_ELEMENTS[ns].has(id);
  }
  /** @internal */
  onCharacter(token) {
    this.skipNextNewLine = false;
    if (this.tokenizer.inForeignNode) {
      characterInForeignContent(this, token);
      return;
    }
    switch (this.insertionMode) {
      case InsertionMode.INITIAL: {
        tokenInInitialMode(this, token);
        break;
      }
      case InsertionMode.BEFORE_HTML: {
        tokenBeforeHtml(this, token);
        break;
      }
      case InsertionMode.BEFORE_HEAD: {
        tokenBeforeHead(this, token);
        break;
      }
      case InsertionMode.IN_HEAD: {
        tokenInHead(this, token);
        break;
      }
      case InsertionMode.IN_HEAD_NO_SCRIPT: {
        tokenInHeadNoScript(this, token);
        break;
      }
      case InsertionMode.AFTER_HEAD: {
        tokenAfterHead(this, token);
        break;
      }
      case InsertionMode.IN_BODY:
      case InsertionMode.IN_CAPTION:
      case InsertionMode.IN_CELL:
      case InsertionMode.IN_TEMPLATE: {
        characterInBody(this, token);
        break;
      }
      case InsertionMode.TEXT:
      case InsertionMode.IN_SELECT:
      case InsertionMode.IN_SELECT_IN_TABLE: {
        this._insertCharacters(token);
        break;
      }
      case InsertionMode.IN_TABLE:
      case InsertionMode.IN_TABLE_BODY:
      case InsertionMode.IN_ROW: {
        characterInTable(this, token);
        break;
      }
      case InsertionMode.IN_TABLE_TEXT: {
        characterInTableText(this, token);
        break;
      }
      case InsertionMode.IN_COLUMN_GROUP: {
        tokenInColumnGroup(this, token);
        break;
      }
      case InsertionMode.AFTER_BODY: {
        tokenAfterBody(this, token);
        break;
      }
      case InsertionMode.AFTER_AFTER_BODY: {
        tokenAfterAfterBody(this, token);
        break;
      }
      default:
    }
  }
  /** @internal */
  onNullCharacter(token) {
    this.skipNextNewLine = false;
    if (this.tokenizer.inForeignNode) {
      nullCharacterInForeignContent(this, token);
      return;
    }
    switch (this.insertionMode) {
      case InsertionMode.INITIAL: {
        tokenInInitialMode(this, token);
        break;
      }
      case InsertionMode.BEFORE_HTML: {
        tokenBeforeHtml(this, token);
        break;
      }
      case InsertionMode.BEFORE_HEAD: {
        tokenBeforeHead(this, token);
        break;
      }
      case InsertionMode.IN_HEAD: {
        tokenInHead(this, token);
        break;
      }
      case InsertionMode.IN_HEAD_NO_SCRIPT: {
        tokenInHeadNoScript(this, token);
        break;
      }
      case InsertionMode.AFTER_HEAD: {
        tokenAfterHead(this, token);
        break;
      }
      case InsertionMode.TEXT: {
        this._insertCharacters(token);
        break;
      }
      case InsertionMode.IN_TABLE:
      case InsertionMode.IN_TABLE_BODY:
      case InsertionMode.IN_ROW: {
        characterInTable(this, token);
        break;
      }
      case InsertionMode.IN_COLUMN_GROUP: {
        tokenInColumnGroup(this, token);
        break;
      }
      case InsertionMode.AFTER_BODY: {
        tokenAfterBody(this, token);
        break;
      }
      case InsertionMode.AFTER_AFTER_BODY: {
        tokenAfterAfterBody(this, token);
        break;
      }
      default:
    }
  }
  /** @internal */
  onComment(token) {
    this.skipNextNewLine = false;
    if (this.currentNotInHTML) {
      appendComment(this, token);
      return;
    }
    switch (this.insertionMode) {
      case InsertionMode.INITIAL:
      case InsertionMode.BEFORE_HTML:
      case InsertionMode.BEFORE_HEAD:
      case InsertionMode.IN_HEAD:
      case InsertionMode.IN_HEAD_NO_SCRIPT:
      case InsertionMode.AFTER_HEAD:
      case InsertionMode.IN_BODY:
      case InsertionMode.IN_TABLE:
      case InsertionMode.IN_CAPTION:
      case InsertionMode.IN_COLUMN_GROUP:
      case InsertionMode.IN_TABLE_BODY:
      case InsertionMode.IN_ROW:
      case InsertionMode.IN_CELL:
      case InsertionMode.IN_SELECT:
      case InsertionMode.IN_SELECT_IN_TABLE:
      case InsertionMode.IN_TEMPLATE:
      case InsertionMode.IN_FRAMESET:
      case InsertionMode.AFTER_FRAMESET: {
        appendComment(this, token);
        break;
      }
      case InsertionMode.IN_TABLE_TEXT: {
        tokenInTableText(this, token);
        break;
      }
      case InsertionMode.AFTER_BODY: {
        appendCommentToRootHtmlElement(this, token);
        break;
      }
      case InsertionMode.AFTER_AFTER_BODY:
      case InsertionMode.AFTER_AFTER_FRAMESET: {
        appendCommentToDocument(this, token);
        break;
      }
      default:
    }
  }
  /** @internal */
  onDoctype(token) {
    this.skipNextNewLine = false;
    switch (this.insertionMode) {
      case InsertionMode.INITIAL: {
        doctypeInInitialMode(this, token);
        break;
      }
      case InsertionMode.BEFORE_HEAD:
      case InsertionMode.IN_HEAD:
      case InsertionMode.IN_HEAD_NO_SCRIPT:
      case InsertionMode.AFTER_HEAD: {
        this._err(token, ERR.misplacedDoctype);
        break;
      }
      case InsertionMode.IN_TABLE_TEXT: {
        tokenInTableText(this, token);
        break;
      }
      default:
    }
  }
  /** @internal */
  onStartTag(token) {
    this.skipNextNewLine = false;
    this.currentToken = token;
    this._processStartTag(token);
    if (token.selfClosing && !token.ackSelfClosing) {
      this._err(token, ERR.nonVoidHtmlElementStartTagWithTrailingSolidus);
    }
  }
  /**
   * Processes a given start tag.
   *
   * `onStartTag` checks if a self-closing tag was recognized. When a token
   * is moved inbetween multiple insertion modes, this check for self-closing
   * could lead to false positives. To avoid this, `_processStartTag` is used
   * for nested calls.
   *
   * @param token The token to process.
   * @protected
   */
  _processStartTag(token) {
    if (this.shouldProcessStartTagTokenInForeignContent(token)) {
      startTagInForeignContent(this, token);
    } else {
      this._startTagOutsideForeignContent(token);
    }
  }
  /** @protected */
  _startTagOutsideForeignContent(token) {
    switch (this.insertionMode) {
      case InsertionMode.INITIAL: {
        tokenInInitialMode(this, token);
        break;
      }
      case InsertionMode.BEFORE_HTML: {
        startTagBeforeHtml(this, token);
        break;
      }
      case InsertionMode.BEFORE_HEAD: {
        startTagBeforeHead(this, token);
        break;
      }
      case InsertionMode.IN_HEAD: {
        startTagInHead(this, token);
        break;
      }
      case InsertionMode.IN_HEAD_NO_SCRIPT: {
        startTagInHeadNoScript(this, token);
        break;
      }
      case InsertionMode.AFTER_HEAD: {
        startTagAfterHead(this, token);
        break;
      }
      case InsertionMode.IN_BODY: {
        startTagInBody(this, token);
        break;
      }
      case InsertionMode.IN_TABLE: {
        startTagInTable(this, token);
        break;
      }
      case InsertionMode.IN_TABLE_TEXT: {
        tokenInTableText(this, token);
        break;
      }
      case InsertionMode.IN_CAPTION: {
        startTagInCaption(this, token);
        break;
      }
      case InsertionMode.IN_COLUMN_GROUP: {
        startTagInColumnGroup(this, token);
        break;
      }
      case InsertionMode.IN_TABLE_BODY: {
        startTagInTableBody(this, token);
        break;
      }
      case InsertionMode.IN_ROW: {
        startTagInRow(this, token);
        break;
      }
      case InsertionMode.IN_CELL: {
        startTagInCell(this, token);
        break;
      }
      case InsertionMode.IN_SELECT: {
        startTagInSelect(this, token);
        break;
      }
      case InsertionMode.IN_SELECT_IN_TABLE: {
        startTagInSelectInTable(this, token);
        break;
      }
      case InsertionMode.IN_TEMPLATE: {
        startTagInTemplate(this, token);
        break;
      }
      case InsertionMode.AFTER_BODY: {
        startTagAfterBody(this, token);
        break;
      }
      case InsertionMode.IN_FRAMESET: {
        startTagInFrameset(this, token);
        break;
      }
      case InsertionMode.AFTER_FRAMESET: {
        startTagAfterFrameset(this, token);
        break;
      }
      case InsertionMode.AFTER_AFTER_BODY: {
        startTagAfterAfterBody(this, token);
        break;
      }
      case InsertionMode.AFTER_AFTER_FRAMESET: {
        startTagAfterAfterFrameset(this, token);
        break;
      }
      default:
    }
  }
  /** @internal */
  onEndTag(token) {
    this.skipNextNewLine = false;
    this.currentToken = token;
    if (this.currentNotInHTML) {
      endTagInForeignContent(this, token);
    } else {
      this._endTagOutsideForeignContent(token);
    }
  }
  /** @protected */
  _endTagOutsideForeignContent(token) {
    switch (this.insertionMode) {
      case InsertionMode.INITIAL: {
        tokenInInitialMode(this, token);
        break;
      }
      case InsertionMode.BEFORE_HTML: {
        endTagBeforeHtml(this, token);
        break;
      }
      case InsertionMode.BEFORE_HEAD: {
        endTagBeforeHead(this, token);
        break;
      }
      case InsertionMode.IN_HEAD: {
        endTagInHead(this, token);
        break;
      }
      case InsertionMode.IN_HEAD_NO_SCRIPT: {
        endTagInHeadNoScript(this, token);
        break;
      }
      case InsertionMode.AFTER_HEAD: {
        endTagAfterHead(this, token);
        break;
      }
      case InsertionMode.IN_BODY: {
        endTagInBody(this, token);
        break;
      }
      case InsertionMode.TEXT: {
        endTagInText(this, token);
        break;
      }
      case InsertionMode.IN_TABLE: {
        endTagInTable(this, token);
        break;
      }
      case InsertionMode.IN_TABLE_TEXT: {
        tokenInTableText(this, token);
        break;
      }
      case InsertionMode.IN_CAPTION: {
        endTagInCaption(this, token);
        break;
      }
      case InsertionMode.IN_COLUMN_GROUP: {
        endTagInColumnGroup(this, token);
        break;
      }
      case InsertionMode.IN_TABLE_BODY: {
        endTagInTableBody(this, token);
        break;
      }
      case InsertionMode.IN_ROW: {
        endTagInRow(this, token);
        break;
      }
      case InsertionMode.IN_CELL: {
        endTagInCell(this, token);
        break;
      }
      case InsertionMode.IN_SELECT: {
        endTagInSelect(this, token);
        break;
      }
      case InsertionMode.IN_SELECT_IN_TABLE: {
        endTagInSelectInTable(this, token);
        break;
      }
      case InsertionMode.IN_TEMPLATE: {
        endTagInTemplate(this, token);
        break;
      }
      case InsertionMode.AFTER_BODY: {
        endTagAfterBody(this, token);
        break;
      }
      case InsertionMode.IN_FRAMESET: {
        endTagInFrameset(this, token);
        break;
      }
      case InsertionMode.AFTER_FRAMESET: {
        endTagAfterFrameset(this, token);
        break;
      }
      case InsertionMode.AFTER_AFTER_BODY: {
        tokenAfterAfterBody(this, token);
        break;
      }
      default:
    }
  }
  /** @internal */
  onEof(token) {
    switch (this.insertionMode) {
      case InsertionMode.INITIAL: {
        tokenInInitialMode(this, token);
        break;
      }
      case InsertionMode.BEFORE_HTML: {
        tokenBeforeHtml(this, token);
        break;
      }
      case InsertionMode.BEFORE_HEAD: {
        tokenBeforeHead(this, token);
        break;
      }
      case InsertionMode.IN_HEAD: {
        tokenInHead(this, token);
        break;
      }
      case InsertionMode.IN_HEAD_NO_SCRIPT: {
        tokenInHeadNoScript(this, token);
        break;
      }
      case InsertionMode.AFTER_HEAD: {
        tokenAfterHead(this, token);
        break;
      }
      case InsertionMode.IN_BODY:
      case InsertionMode.IN_TABLE:
      case InsertionMode.IN_CAPTION:
      case InsertionMode.IN_COLUMN_GROUP:
      case InsertionMode.IN_TABLE_BODY:
      case InsertionMode.IN_ROW:
      case InsertionMode.IN_CELL:
      case InsertionMode.IN_SELECT:
      case InsertionMode.IN_SELECT_IN_TABLE: {
        eofInBody(this, token);
        break;
      }
      case InsertionMode.TEXT: {
        eofInText(this, token);
        break;
      }
      case InsertionMode.IN_TABLE_TEXT: {
        tokenInTableText(this, token);
        break;
      }
      case InsertionMode.IN_TEMPLATE: {
        eofInTemplate(this, token);
        break;
      }
      case InsertionMode.AFTER_BODY:
      case InsertionMode.IN_FRAMESET:
      case InsertionMode.AFTER_FRAMESET:
      case InsertionMode.AFTER_AFTER_BODY:
      case InsertionMode.AFTER_AFTER_FRAMESET: {
        stopParsing(this, token);
        break;
      }
      default:
    }
  }
  /** @internal */
  onWhitespaceCharacter(token) {
    if (this.skipNextNewLine) {
      this.skipNextNewLine = false;
      if (token.chars.charCodeAt(0) === CODE_POINTS.LINE_FEED) {
        if (token.chars.length === 1) {
          return;
        }
        token.chars = token.chars.substr(1);
      }
    }
    if (this.tokenizer.inForeignNode) {
      this._insertCharacters(token);
      return;
    }
    switch (this.insertionMode) {
      case InsertionMode.IN_HEAD:
      case InsertionMode.IN_HEAD_NO_SCRIPT:
      case InsertionMode.AFTER_HEAD:
      case InsertionMode.TEXT:
      case InsertionMode.IN_COLUMN_GROUP:
      case InsertionMode.IN_SELECT:
      case InsertionMode.IN_SELECT_IN_TABLE:
      case InsertionMode.IN_FRAMESET:
      case InsertionMode.AFTER_FRAMESET: {
        this._insertCharacters(token);
        break;
      }
      case InsertionMode.IN_BODY:
      case InsertionMode.IN_CAPTION:
      case InsertionMode.IN_CELL:
      case InsertionMode.IN_TEMPLATE:
      case InsertionMode.AFTER_BODY:
      case InsertionMode.AFTER_AFTER_BODY:
      case InsertionMode.AFTER_AFTER_FRAMESET: {
        whitespaceCharacterInBody(this, token);
        break;
      }
      case InsertionMode.IN_TABLE:
      case InsertionMode.IN_TABLE_BODY:
      case InsertionMode.IN_ROW: {
        characterInTable(this, token);
        break;
      }
      case InsertionMode.IN_TABLE_TEXT: {
        whitespaceCharacterInTableText(this, token);
        break;
      }
      default:
    }
  }
};
function aaObtainFormattingElementEntry(p, token) {
  let formattingElementEntry = p.activeFormattingElements.getElementEntryInScopeWithTagName(token.tagName);
  if (formattingElementEntry) {
    if (!p.openElements.contains(formattingElementEntry.element)) {
      p.activeFormattingElements.removeEntry(formattingElementEntry);
      formattingElementEntry = null;
    } else if (!p.openElements.hasInScope(token.tagID)) {
      formattingElementEntry = null;
    }
  } else {
    genericEndTagInBody(p, token);
  }
  return formattingElementEntry;
}
function aaObtainFurthestBlock(p, formattingElementEntry) {
  let furthestBlock = null;
  let idx = p.openElements.stackTop;
  for (; idx >= 0; idx--) {
    const element = p.openElements.items[idx];
    if (element === formattingElementEntry.element) {
      break;
    }
    if (p._isSpecialElement(element, p.openElements.tagIDs[idx])) {
      furthestBlock = element;
    }
  }
  if (!furthestBlock) {
    p.openElements.shortenToLength(Math.max(idx, 0));
    p.activeFormattingElements.removeEntry(formattingElementEntry);
  }
  return furthestBlock;
}
function aaInnerLoop(p, furthestBlock, formattingElement) {
  let lastElement = furthestBlock;
  let nextElement = p.openElements.getCommonAncestor(furthestBlock);
  for (let i = 0, element = nextElement; element !== formattingElement; i++, element = nextElement) {
    nextElement = p.openElements.getCommonAncestor(element);
    const elementEntry = p.activeFormattingElements.getElementEntry(element);
    const counterOverflow = elementEntry && i >= AA_INNER_LOOP_ITER;
    const shouldRemoveFromOpenElements = !elementEntry || counterOverflow;
    if (shouldRemoveFromOpenElements) {
      if (counterOverflow) {
        p.activeFormattingElements.removeEntry(elementEntry);
      }
      p.openElements.remove(element);
    } else {
      element = aaRecreateElementFromEntry(p, elementEntry);
      if (lastElement === furthestBlock) {
        p.activeFormattingElements.bookmark = elementEntry;
      }
      p.treeAdapter.detachNode(lastElement);
      p.treeAdapter.appendChild(element, lastElement);
      lastElement = element;
    }
  }
  return lastElement;
}
function aaRecreateElementFromEntry(p, elementEntry) {
  const ns = p.treeAdapter.getNamespaceURI(elementEntry.element);
  const newElement = p.treeAdapter.createElement(elementEntry.token.tagName, ns, elementEntry.token.attrs);
  p.openElements.replace(elementEntry.element, newElement);
  elementEntry.element = newElement;
  return newElement;
}
function aaInsertLastNodeInCommonAncestor(p, commonAncestor, lastElement) {
  const tn = p.treeAdapter.getTagName(commonAncestor);
  const tid = getTagID(tn);
  if (p._isElementCausesFosterParenting(tid)) {
    p._fosterParentElement(lastElement);
  } else {
    const ns = p.treeAdapter.getNamespaceURI(commonAncestor);
    if (tid === TAG_ID.TEMPLATE && ns === NS.HTML) {
      commonAncestor = p.treeAdapter.getTemplateContent(commonAncestor);
    }
    p.treeAdapter.appendChild(commonAncestor, lastElement);
  }
}
function aaReplaceFormattingElement(p, furthestBlock, formattingElementEntry) {
  const ns = p.treeAdapter.getNamespaceURI(formattingElementEntry.element);
  const { token } = formattingElementEntry;
  const newElement = p.treeAdapter.createElement(token.tagName, ns, token.attrs);
  p._adoptNodes(furthestBlock, newElement);
  p.treeAdapter.appendChild(furthestBlock, newElement);
  p.activeFormattingElements.insertElementAfterBookmark(newElement, token);
  p.activeFormattingElements.removeEntry(formattingElementEntry);
  p.openElements.remove(formattingElementEntry.element);
  p.openElements.insertAfter(furthestBlock, newElement, token.tagID);
}
function callAdoptionAgency(p, token) {
  for (let i = 0; i < AA_OUTER_LOOP_ITER; i++) {
    const formattingElementEntry = aaObtainFormattingElementEntry(p, token);
    if (!formattingElementEntry) {
      break;
    }
    const furthestBlock = aaObtainFurthestBlock(p, formattingElementEntry);
    if (!furthestBlock) {
      break;
    }
    p.activeFormattingElements.bookmark = formattingElementEntry;
    const lastElement = aaInnerLoop(p, furthestBlock, formattingElementEntry.element);
    const commonAncestor = p.openElements.getCommonAncestor(formattingElementEntry.element);
    p.treeAdapter.detachNode(lastElement);
    if (commonAncestor)
      aaInsertLastNodeInCommonAncestor(p, commonAncestor, lastElement);
    aaReplaceFormattingElement(p, furthestBlock, formattingElementEntry);
  }
}
function appendComment(p, token) {
  p._appendCommentNode(token, p.openElements.currentTmplContentOrNode);
}
function appendCommentToRootHtmlElement(p, token) {
  p._appendCommentNode(token, p.openElements.items[0]);
}
function appendCommentToDocument(p, token) {
  p._appendCommentNode(token, p.document);
}
function stopParsing(p, token) {
  p.stopped = true;
  if (token.location) {
    const target = p.fragmentContext ? 0 : 2;
    for (let i = p.openElements.stackTop; i >= target; i--) {
      p._setEndLocation(p.openElements.items[i], token);
    }
    if (!p.fragmentContext && p.openElements.stackTop >= 0) {
      const htmlElement = p.openElements.items[0];
      const htmlLocation = p.treeAdapter.getNodeSourceCodeLocation(htmlElement);
      if (htmlLocation && !htmlLocation.endTag) {
        p._setEndLocation(htmlElement, token);
        if (p.openElements.stackTop >= 1) {
          const bodyElement = p.openElements.items[1];
          const bodyLocation = p.treeAdapter.getNodeSourceCodeLocation(bodyElement);
          if (bodyLocation && !bodyLocation.endTag) {
            p._setEndLocation(bodyElement, token);
          }
        }
      }
    }
  }
}
function doctypeInInitialMode(p, token) {
  p._setDocumentType(token);
  const mode = token.forceQuirks ? DOCUMENT_MODE.QUIRKS : getDocumentMode(token);
  if (!isConforming(token)) {
    p._err(token, ERR.nonConformingDoctype);
  }
  p.treeAdapter.setDocumentMode(p.document, mode);
  p.insertionMode = InsertionMode.BEFORE_HTML;
}
function tokenInInitialMode(p, token) {
  p._err(token, ERR.missingDoctype, true);
  p.treeAdapter.setDocumentMode(p.document, DOCUMENT_MODE.QUIRKS);
  p.insertionMode = InsertionMode.BEFORE_HTML;
  p._processToken(token);
}
function startTagBeforeHtml(p, token) {
  if (token.tagID === TAG_ID.HTML) {
    p._insertElement(token, NS.HTML);
    p.insertionMode = InsertionMode.BEFORE_HEAD;
  } else {
    tokenBeforeHtml(p, token);
  }
}
function endTagBeforeHtml(p, token) {
  const tn = token.tagID;
  if (tn === TAG_ID.HTML || tn === TAG_ID.HEAD || tn === TAG_ID.BODY || tn === TAG_ID.BR) {
    tokenBeforeHtml(p, token);
  }
}
function tokenBeforeHtml(p, token) {
  p._insertFakeRootElement();
  p.insertionMode = InsertionMode.BEFORE_HEAD;
  p._processToken(token);
}
function startTagBeforeHead(p, token) {
  switch (token.tagID) {
    case TAG_ID.HTML: {
      startTagInBody(p, token);
      break;
    }
    case TAG_ID.HEAD: {
      p._insertElement(token, NS.HTML);
      p.headElement = p.openElements.current;
      p.insertionMode = InsertionMode.IN_HEAD;
      break;
    }
    default: {
      tokenBeforeHead(p, token);
    }
  }
}
function endTagBeforeHead(p, token) {
  const tn = token.tagID;
  if (tn === TAG_ID.HEAD || tn === TAG_ID.BODY || tn === TAG_ID.HTML || tn === TAG_ID.BR) {
    tokenBeforeHead(p, token);
  } else {
    p._err(token, ERR.endTagWithoutMatchingOpenElement);
  }
}
function tokenBeforeHead(p, token) {
  p._insertFakeElement(TAG_NAMES.HEAD, TAG_ID.HEAD);
  p.headElement = p.openElements.current;
  p.insertionMode = InsertionMode.IN_HEAD;
  p._processToken(token);
}
function startTagInHead(p, token) {
  switch (token.tagID) {
    case TAG_ID.HTML: {
      startTagInBody(p, token);
      break;
    }
    case TAG_ID.BASE:
    case TAG_ID.BASEFONT:
    case TAG_ID.BGSOUND:
    case TAG_ID.LINK:
    case TAG_ID.META: {
      p._appendElement(token, NS.HTML);
      token.ackSelfClosing = true;
      break;
    }
    case TAG_ID.TITLE: {
      p._switchToTextParsing(token, TokenizerMode.RCDATA);
      break;
    }
    case TAG_ID.NOSCRIPT: {
      if (p.options.scriptingEnabled) {
        p._switchToTextParsing(token, TokenizerMode.RAWTEXT);
      } else {
        p._insertElement(token, NS.HTML);
        p.insertionMode = InsertionMode.IN_HEAD_NO_SCRIPT;
      }
      break;
    }
    case TAG_ID.NOFRAMES:
    case TAG_ID.STYLE: {
      p._switchToTextParsing(token, TokenizerMode.RAWTEXT);
      break;
    }
    case TAG_ID.SCRIPT: {
      p._switchToTextParsing(token, TokenizerMode.SCRIPT_DATA);
      break;
    }
    case TAG_ID.TEMPLATE: {
      p._insertTemplate(token);
      p.activeFormattingElements.insertMarker();
      p.framesetOk = false;
      p.insertionMode = InsertionMode.IN_TEMPLATE;
      p.tmplInsertionModeStack.unshift(InsertionMode.IN_TEMPLATE);
      break;
    }
    case TAG_ID.HEAD: {
      p._err(token, ERR.misplacedStartTagForHeadElement);
      break;
    }
    default: {
      tokenInHead(p, token);
    }
  }
}
function endTagInHead(p, token) {
  switch (token.tagID) {
    case TAG_ID.HEAD: {
      p.openElements.pop();
      p.insertionMode = InsertionMode.AFTER_HEAD;
      break;
    }
    case TAG_ID.BODY:
    case TAG_ID.BR:
    case TAG_ID.HTML: {
      tokenInHead(p, token);
      break;
    }
    case TAG_ID.TEMPLATE: {
      templateEndTagInHead(p, token);
      break;
    }
    default: {
      p._err(token, ERR.endTagWithoutMatchingOpenElement);
    }
  }
}
function templateEndTagInHead(p, token) {
  if (p.openElements.tmplCount > 0) {
    p.openElements.generateImpliedEndTagsThoroughly();
    if (p.openElements.currentTagId !== TAG_ID.TEMPLATE) {
      p._err(token, ERR.closingOfElementWithOpenChildElements);
    }
    p.openElements.popUntilTagNamePopped(TAG_ID.TEMPLATE);
    p.activeFormattingElements.clearToLastMarker();
    p.tmplInsertionModeStack.shift();
    p._resetInsertionMode();
  } else {
    p._err(token, ERR.endTagWithoutMatchingOpenElement);
  }
}
function tokenInHead(p, token) {
  p.openElements.pop();
  p.insertionMode = InsertionMode.AFTER_HEAD;
  p._processToken(token);
}
function startTagInHeadNoScript(p, token) {
  switch (token.tagID) {
    case TAG_ID.HTML: {
      startTagInBody(p, token);
      break;
    }
    case TAG_ID.BASEFONT:
    case TAG_ID.BGSOUND:
    case TAG_ID.HEAD:
    case TAG_ID.LINK:
    case TAG_ID.META:
    case TAG_ID.NOFRAMES:
    case TAG_ID.STYLE: {
      startTagInHead(p, token);
      break;
    }
    case TAG_ID.NOSCRIPT: {
      p._err(token, ERR.nestedNoscriptInHead);
      break;
    }
    default: {
      tokenInHeadNoScript(p, token);
    }
  }
}
function endTagInHeadNoScript(p, token) {
  switch (token.tagID) {
    case TAG_ID.NOSCRIPT: {
      p.openElements.pop();
      p.insertionMode = InsertionMode.IN_HEAD;
      break;
    }
    case TAG_ID.BR: {
      tokenInHeadNoScript(p, token);
      break;
    }
    default: {
      p._err(token, ERR.endTagWithoutMatchingOpenElement);
    }
  }
}
function tokenInHeadNoScript(p, token) {
  const errCode = token.type === TokenType.EOF ? ERR.openElementsLeftAfterEof : ERR.disallowedContentInNoscriptInHead;
  p._err(token, errCode);
  p.openElements.pop();
  p.insertionMode = InsertionMode.IN_HEAD;
  p._processToken(token);
}
function startTagAfterHead(p, token) {
  switch (token.tagID) {
    case TAG_ID.HTML: {
      startTagInBody(p, token);
      break;
    }
    case TAG_ID.BODY: {
      p._insertElement(token, NS.HTML);
      p.framesetOk = false;
      p.insertionMode = InsertionMode.IN_BODY;
      break;
    }
    case TAG_ID.FRAMESET: {
      p._insertElement(token, NS.HTML);
      p.insertionMode = InsertionMode.IN_FRAMESET;
      break;
    }
    case TAG_ID.BASE:
    case TAG_ID.BASEFONT:
    case TAG_ID.BGSOUND:
    case TAG_ID.LINK:
    case TAG_ID.META:
    case TAG_ID.NOFRAMES:
    case TAG_ID.SCRIPT:
    case TAG_ID.STYLE:
    case TAG_ID.TEMPLATE:
    case TAG_ID.TITLE: {
      p._err(token, ERR.abandonedHeadElementChild);
      p.openElements.push(p.headElement, TAG_ID.HEAD);
      startTagInHead(p, token);
      p.openElements.remove(p.headElement);
      break;
    }
    case TAG_ID.HEAD: {
      p._err(token, ERR.misplacedStartTagForHeadElement);
      break;
    }
    default: {
      tokenAfterHead(p, token);
    }
  }
}
function endTagAfterHead(p, token) {
  switch (token.tagID) {
    case TAG_ID.BODY:
    case TAG_ID.HTML:
    case TAG_ID.BR: {
      tokenAfterHead(p, token);
      break;
    }
    case TAG_ID.TEMPLATE: {
      templateEndTagInHead(p, token);
      break;
    }
    default: {
      p._err(token, ERR.endTagWithoutMatchingOpenElement);
    }
  }
}
function tokenAfterHead(p, token) {
  p._insertFakeElement(TAG_NAMES.BODY, TAG_ID.BODY);
  p.insertionMode = InsertionMode.IN_BODY;
  modeInBody(p, token);
}
function modeInBody(p, token) {
  switch (token.type) {
    case TokenType.CHARACTER: {
      characterInBody(p, token);
      break;
    }
    case TokenType.WHITESPACE_CHARACTER: {
      whitespaceCharacterInBody(p, token);
      break;
    }
    case TokenType.COMMENT: {
      appendComment(p, token);
      break;
    }
    case TokenType.START_TAG: {
      startTagInBody(p, token);
      break;
    }
    case TokenType.END_TAG: {
      endTagInBody(p, token);
      break;
    }
    case TokenType.EOF: {
      eofInBody(p, token);
      break;
    }
    default:
  }
}
function whitespaceCharacterInBody(p, token) {
  p._reconstructActiveFormattingElements();
  p._insertCharacters(token);
}
function characterInBody(p, token) {
  p._reconstructActiveFormattingElements();
  p._insertCharacters(token);
  p.framesetOk = false;
}
function htmlStartTagInBody(p, token) {
  if (p.openElements.tmplCount === 0) {
    p.treeAdapter.adoptAttributes(p.openElements.items[0], token.attrs);
  }
}
function bodyStartTagInBody(p, token) {
  const bodyElement = p.openElements.tryPeekProperlyNestedBodyElement();
  if (bodyElement && p.openElements.tmplCount === 0) {
    p.framesetOk = false;
    p.treeAdapter.adoptAttributes(bodyElement, token.attrs);
  }
}
function framesetStartTagInBody(p, token) {
  const bodyElement = p.openElements.tryPeekProperlyNestedBodyElement();
  if (p.framesetOk && bodyElement) {
    p.treeAdapter.detachNode(bodyElement);
    p.openElements.popAllUpToHtmlElement();
    p._insertElement(token, NS.HTML);
    p.insertionMode = InsertionMode.IN_FRAMESET;
  }
}
function addressStartTagInBody(p, token) {
  if (p.openElements.hasInButtonScope(TAG_ID.P)) {
    p._closePElement();
  }
  p._insertElement(token, NS.HTML);
}
function numberedHeaderStartTagInBody(p, token) {
  if (p.openElements.hasInButtonScope(TAG_ID.P)) {
    p._closePElement();
  }
  if (p.openElements.currentTagId !== void 0 && NUMBERED_HEADERS.has(p.openElements.currentTagId)) {
    p.openElements.pop();
  }
  p._insertElement(token, NS.HTML);
}
function preStartTagInBody(p, token) {
  if (p.openElements.hasInButtonScope(TAG_ID.P)) {
    p._closePElement();
  }
  p._insertElement(token, NS.HTML);
  p.skipNextNewLine = true;
  p.framesetOk = false;
}
function formStartTagInBody(p, token) {
  const inTemplate = p.openElements.tmplCount > 0;
  if (!p.formElement || inTemplate) {
    if (p.openElements.hasInButtonScope(TAG_ID.P)) {
      p._closePElement();
    }
    p._insertElement(token, NS.HTML);
    if (!inTemplate) {
      p.formElement = p.openElements.current;
    }
  }
}
function listItemStartTagInBody(p, token) {
  p.framesetOk = false;
  const tn = token.tagID;
  for (let i = p.openElements.stackTop; i >= 0; i--) {
    const elementId = p.openElements.tagIDs[i];
    if (tn === TAG_ID.LI && elementId === TAG_ID.LI || (tn === TAG_ID.DD || tn === TAG_ID.DT) && (elementId === TAG_ID.DD || elementId === TAG_ID.DT)) {
      p.openElements.generateImpliedEndTagsWithExclusion(elementId);
      p.openElements.popUntilTagNamePopped(elementId);
      break;
    }
    if (elementId !== TAG_ID.ADDRESS && elementId !== TAG_ID.DIV && elementId !== TAG_ID.P && p._isSpecialElement(p.openElements.items[i], elementId)) {
      break;
    }
  }
  if (p.openElements.hasInButtonScope(TAG_ID.P)) {
    p._closePElement();
  }
  p._insertElement(token, NS.HTML);
}
function plaintextStartTagInBody(p, token) {
  if (p.openElements.hasInButtonScope(TAG_ID.P)) {
    p._closePElement();
  }
  p._insertElement(token, NS.HTML);
  p.tokenizer.state = TokenizerMode.PLAINTEXT;
}
function buttonStartTagInBody(p, token) {
  if (p.openElements.hasInScope(TAG_ID.BUTTON)) {
    p.openElements.generateImpliedEndTags();
    p.openElements.popUntilTagNamePopped(TAG_ID.BUTTON);
  }
  p._reconstructActiveFormattingElements();
  p._insertElement(token, NS.HTML);
  p.framesetOk = false;
}
function aStartTagInBody(p, token) {
  const activeElementEntry = p.activeFormattingElements.getElementEntryInScopeWithTagName(TAG_NAMES.A);
  if (activeElementEntry) {
    callAdoptionAgency(p, token);
    p.openElements.remove(activeElementEntry.element);
    p.activeFormattingElements.removeEntry(activeElementEntry);
  }
  p._reconstructActiveFormattingElements();
  p._insertElement(token, NS.HTML);
  p.activeFormattingElements.pushElement(p.openElements.current, token);
}
function bStartTagInBody(p, token) {
  p._reconstructActiveFormattingElements();
  p._insertElement(token, NS.HTML);
  p.activeFormattingElements.pushElement(p.openElements.current, token);
}
function nobrStartTagInBody(p, token) {
  p._reconstructActiveFormattingElements();
  if (p.openElements.hasInScope(TAG_ID.NOBR)) {
    callAdoptionAgency(p, token);
    p._reconstructActiveFormattingElements();
  }
  p._insertElement(token, NS.HTML);
  p.activeFormattingElements.pushElement(p.openElements.current, token);
}
function appletStartTagInBody(p, token) {
  p._reconstructActiveFormattingElements();
  p._insertElement(token, NS.HTML);
  p.activeFormattingElements.insertMarker();
  p.framesetOk = false;
}
function tableStartTagInBody(p, token) {
  if (p.treeAdapter.getDocumentMode(p.document) !== DOCUMENT_MODE.QUIRKS && p.openElements.hasInButtonScope(TAG_ID.P)) {
    p._closePElement();
  }
  p._insertElement(token, NS.HTML);
  p.framesetOk = false;
  p.insertionMode = InsertionMode.IN_TABLE;
}
function areaStartTagInBody(p, token) {
  p._reconstructActiveFormattingElements();
  p._appendElement(token, NS.HTML);
  p.framesetOk = false;
  token.ackSelfClosing = true;
}
function isHiddenInput(token) {
  const inputType = getTokenAttr(token, ATTRS.TYPE);
  return inputType != null && inputType.toLowerCase() === HIDDEN_INPUT_TYPE;
}
function inputStartTagInBody(p, token) {
  p._reconstructActiveFormattingElements();
  p._appendElement(token, NS.HTML);
  if (!isHiddenInput(token)) {
    p.framesetOk = false;
  }
  token.ackSelfClosing = true;
}
function paramStartTagInBody(p, token) {
  p._appendElement(token, NS.HTML);
  token.ackSelfClosing = true;
}
function hrStartTagInBody(p, token) {
  if (p.openElements.hasInButtonScope(TAG_ID.P)) {
    p._closePElement();
  }
  p._appendElement(token, NS.HTML);
  p.framesetOk = false;
  token.ackSelfClosing = true;
}
function imageStartTagInBody(p, token) {
  token.tagName = TAG_NAMES.IMG;
  token.tagID = TAG_ID.IMG;
  areaStartTagInBody(p, token);
}
function textareaStartTagInBody(p, token) {
  p._insertElement(token, NS.HTML);
  p.skipNextNewLine = true;
  p.tokenizer.state = TokenizerMode.RCDATA;
  p.originalInsertionMode = p.insertionMode;
  p.framesetOk = false;
  p.insertionMode = InsertionMode.TEXT;
}
function xmpStartTagInBody(p, token) {
  if (p.openElements.hasInButtonScope(TAG_ID.P)) {
    p._closePElement();
  }
  p._reconstructActiveFormattingElements();
  p.framesetOk = false;
  p._switchToTextParsing(token, TokenizerMode.RAWTEXT);
}
function iframeStartTagInBody(p, token) {
  p.framesetOk = false;
  p._switchToTextParsing(token, TokenizerMode.RAWTEXT);
}
function rawTextStartTagInBody(p, token) {
  p._switchToTextParsing(token, TokenizerMode.RAWTEXT);
}
function selectStartTagInBody(p, token) {
  p._reconstructActiveFormattingElements();
  p._insertElement(token, NS.HTML);
  p.framesetOk = false;
  p.insertionMode = p.insertionMode === InsertionMode.IN_TABLE || p.insertionMode === InsertionMode.IN_CAPTION || p.insertionMode === InsertionMode.IN_TABLE_BODY || p.insertionMode === InsertionMode.IN_ROW || p.insertionMode === InsertionMode.IN_CELL ? InsertionMode.IN_SELECT_IN_TABLE : InsertionMode.IN_SELECT;
}
function optgroupStartTagInBody(p, token) {
  if (p.openElements.currentTagId === TAG_ID.OPTION) {
    p.openElements.pop();
  }
  p._reconstructActiveFormattingElements();
  p._insertElement(token, NS.HTML);
}
function rbStartTagInBody(p, token) {
  if (p.openElements.hasInScope(TAG_ID.RUBY)) {
    p.openElements.generateImpliedEndTags();
  }
  p._insertElement(token, NS.HTML);
}
function rtStartTagInBody(p, token) {
  if (p.openElements.hasInScope(TAG_ID.RUBY)) {
    p.openElements.generateImpliedEndTagsWithExclusion(TAG_ID.RTC);
  }
  p._insertElement(token, NS.HTML);
}
function mathStartTagInBody(p, token) {
  p._reconstructActiveFormattingElements();
  adjustTokenMathMLAttrs(token);
  adjustTokenXMLAttrs(token);
  if (token.selfClosing) {
    p._appendElement(token, NS.MATHML);
  } else {
    p._insertElement(token, NS.MATHML);
  }
  token.ackSelfClosing = true;
}
function svgStartTagInBody(p, token) {
  p._reconstructActiveFormattingElements();
  adjustTokenSVGAttrs(token);
  adjustTokenXMLAttrs(token);
  if (token.selfClosing) {
    p._appendElement(token, NS.SVG);
  } else {
    p._insertElement(token, NS.SVG);
  }
  token.ackSelfClosing = true;
}
function genericStartTagInBody(p, token) {
  p._reconstructActiveFormattingElements();
  p._insertElement(token, NS.HTML);
}
function startTagInBody(p, token) {
  switch (token.tagID) {
    case TAG_ID.I:
    case TAG_ID.S:
    case TAG_ID.B:
    case TAG_ID.U:
    case TAG_ID.EM:
    case TAG_ID.TT:
    case TAG_ID.BIG:
    case TAG_ID.CODE:
    case TAG_ID.FONT:
    case TAG_ID.SMALL:
    case TAG_ID.STRIKE:
    case TAG_ID.STRONG: {
      bStartTagInBody(p, token);
      break;
    }
    case TAG_ID.A: {
      aStartTagInBody(p, token);
      break;
    }
    case TAG_ID.H1:
    case TAG_ID.H2:
    case TAG_ID.H3:
    case TAG_ID.H4:
    case TAG_ID.H5:
    case TAG_ID.H6: {
      numberedHeaderStartTagInBody(p, token);
      break;
    }
    case TAG_ID.P:
    case TAG_ID.DL:
    case TAG_ID.OL:
    case TAG_ID.UL:
    case TAG_ID.DIV:
    case TAG_ID.DIR:
    case TAG_ID.NAV:
    case TAG_ID.MAIN:
    case TAG_ID.MENU:
    case TAG_ID.ASIDE:
    case TAG_ID.CENTER:
    case TAG_ID.FIGURE:
    case TAG_ID.FOOTER:
    case TAG_ID.HEADER:
    case TAG_ID.HGROUP:
    case TAG_ID.DIALOG:
    case TAG_ID.DETAILS:
    case TAG_ID.ADDRESS:
    case TAG_ID.ARTICLE:
    case TAG_ID.SEARCH:
    case TAG_ID.SECTION:
    case TAG_ID.SUMMARY:
    case TAG_ID.FIELDSET:
    case TAG_ID.BLOCKQUOTE:
    case TAG_ID.FIGCAPTION: {
      addressStartTagInBody(p, token);
      break;
    }
    case TAG_ID.LI:
    case TAG_ID.DD:
    case TAG_ID.DT: {
      listItemStartTagInBody(p, token);
      break;
    }
    case TAG_ID.BR:
    case TAG_ID.IMG:
    case TAG_ID.WBR:
    case TAG_ID.AREA:
    case TAG_ID.EMBED:
    case TAG_ID.KEYGEN: {
      areaStartTagInBody(p, token);
      break;
    }
    case TAG_ID.HR: {
      hrStartTagInBody(p, token);
      break;
    }
    case TAG_ID.RB:
    case TAG_ID.RTC: {
      rbStartTagInBody(p, token);
      break;
    }
    case TAG_ID.RT:
    case TAG_ID.RP: {
      rtStartTagInBody(p, token);
      break;
    }
    case TAG_ID.PRE:
    case TAG_ID.LISTING: {
      preStartTagInBody(p, token);
      break;
    }
    case TAG_ID.XMP: {
      xmpStartTagInBody(p, token);
      break;
    }
    case TAG_ID.SVG: {
      svgStartTagInBody(p, token);
      break;
    }
    case TAG_ID.HTML: {
      htmlStartTagInBody(p, token);
      break;
    }
    case TAG_ID.BASE:
    case TAG_ID.LINK:
    case TAG_ID.META:
    case TAG_ID.STYLE:
    case TAG_ID.TITLE:
    case TAG_ID.SCRIPT:
    case TAG_ID.BGSOUND:
    case TAG_ID.BASEFONT:
    case TAG_ID.TEMPLATE: {
      startTagInHead(p, token);
      break;
    }
    case TAG_ID.BODY: {
      bodyStartTagInBody(p, token);
      break;
    }
    case TAG_ID.FORM: {
      formStartTagInBody(p, token);
      break;
    }
    case TAG_ID.NOBR: {
      nobrStartTagInBody(p, token);
      break;
    }
    case TAG_ID.MATH: {
      mathStartTagInBody(p, token);
      break;
    }
    case TAG_ID.TABLE: {
      tableStartTagInBody(p, token);
      break;
    }
    case TAG_ID.INPUT: {
      inputStartTagInBody(p, token);
      break;
    }
    case TAG_ID.PARAM:
    case TAG_ID.TRACK:
    case TAG_ID.SOURCE: {
      paramStartTagInBody(p, token);
      break;
    }
    case TAG_ID.IMAGE: {
      imageStartTagInBody(p, token);
      break;
    }
    case TAG_ID.BUTTON: {
      buttonStartTagInBody(p, token);
      break;
    }
    case TAG_ID.APPLET:
    case TAG_ID.OBJECT:
    case TAG_ID.MARQUEE: {
      appletStartTagInBody(p, token);
      break;
    }
    case TAG_ID.IFRAME: {
      iframeStartTagInBody(p, token);
      break;
    }
    case TAG_ID.SELECT: {
      selectStartTagInBody(p, token);
      break;
    }
    case TAG_ID.OPTION:
    case TAG_ID.OPTGROUP: {
      optgroupStartTagInBody(p, token);
      break;
    }
    case TAG_ID.NOEMBED:
    case TAG_ID.NOFRAMES: {
      rawTextStartTagInBody(p, token);
      break;
    }
    case TAG_ID.FRAMESET: {
      framesetStartTagInBody(p, token);
      break;
    }
    case TAG_ID.TEXTAREA: {
      textareaStartTagInBody(p, token);
      break;
    }
    case TAG_ID.NOSCRIPT: {
      if (p.options.scriptingEnabled) {
        rawTextStartTagInBody(p, token);
      } else {
        genericStartTagInBody(p, token);
      }
      break;
    }
    case TAG_ID.PLAINTEXT: {
      plaintextStartTagInBody(p, token);
      break;
    }
    case TAG_ID.COL:
    case TAG_ID.TH:
    case TAG_ID.TD:
    case TAG_ID.TR:
    case TAG_ID.HEAD:
    case TAG_ID.FRAME:
    case TAG_ID.TBODY:
    case TAG_ID.TFOOT:
    case TAG_ID.THEAD:
    case TAG_ID.CAPTION:
    case TAG_ID.COLGROUP: {
      break;
    }
    default: {
      genericStartTagInBody(p, token);
    }
  }
}
function bodyEndTagInBody(p, token) {
  if (p.openElements.hasInScope(TAG_ID.BODY)) {
    p.insertionMode = InsertionMode.AFTER_BODY;
    if (p.options.sourceCodeLocationInfo) {
      const bodyElement = p.openElements.tryPeekProperlyNestedBodyElement();
      if (bodyElement) {
        p._setEndLocation(bodyElement, token);
      }
    }
  }
}
function htmlEndTagInBody(p, token) {
  if (p.openElements.hasInScope(TAG_ID.BODY)) {
    p.insertionMode = InsertionMode.AFTER_BODY;
    endTagAfterBody(p, token);
  }
}
function addressEndTagInBody(p, token) {
  const tn = token.tagID;
  if (p.openElements.hasInScope(tn)) {
    p.openElements.generateImpliedEndTags();
    p.openElements.popUntilTagNamePopped(tn);
  }
}
function formEndTagInBody(p) {
  const inTemplate = p.openElements.tmplCount > 0;
  const { formElement } = p;
  if (!inTemplate) {
    p.formElement = null;
  }
  if ((formElement || inTemplate) && p.openElements.hasInScope(TAG_ID.FORM)) {
    p.openElements.generateImpliedEndTags();
    if (inTemplate) {
      p.openElements.popUntilTagNamePopped(TAG_ID.FORM);
    } else if (formElement) {
      p.openElements.remove(formElement);
    }
  }
}
function pEndTagInBody(p) {
  if (!p.openElements.hasInButtonScope(TAG_ID.P)) {
    p._insertFakeElement(TAG_NAMES.P, TAG_ID.P);
  }
  p._closePElement();
}
function liEndTagInBody(p) {
  if (p.openElements.hasInListItemScope(TAG_ID.LI)) {
    p.openElements.generateImpliedEndTagsWithExclusion(TAG_ID.LI);
    p.openElements.popUntilTagNamePopped(TAG_ID.LI);
  }
}
function ddEndTagInBody(p, token) {
  const tn = token.tagID;
  if (p.openElements.hasInScope(tn)) {
    p.openElements.generateImpliedEndTagsWithExclusion(tn);
    p.openElements.popUntilTagNamePopped(tn);
  }
}
function numberedHeaderEndTagInBody(p) {
  if (p.openElements.hasNumberedHeaderInScope()) {
    p.openElements.generateImpliedEndTags();
    p.openElements.popUntilNumberedHeaderPopped();
  }
}
function appletEndTagInBody(p, token) {
  const tn = token.tagID;
  if (p.openElements.hasInScope(tn)) {
    p.openElements.generateImpliedEndTags();
    p.openElements.popUntilTagNamePopped(tn);
    p.activeFormattingElements.clearToLastMarker();
  }
}
function brEndTagInBody(p) {
  p._reconstructActiveFormattingElements();
  p._insertFakeElement(TAG_NAMES.BR, TAG_ID.BR);
  p.openElements.pop();
  p.framesetOk = false;
}
function genericEndTagInBody(p, token) {
  const tn = token.tagName;
  const tid = token.tagID;
  for (let i = p.openElements.stackTop; i > 0; i--) {
    const element = p.openElements.items[i];
    const elementId = p.openElements.tagIDs[i];
    if (tid === elementId && (tid !== TAG_ID.UNKNOWN || p.treeAdapter.getTagName(element) === tn)) {
      p.openElements.generateImpliedEndTagsWithExclusion(tid);
      if (p.openElements.stackTop >= i)
        p.openElements.shortenToLength(i);
      break;
    }
    if (p._isSpecialElement(element, elementId)) {
      break;
    }
  }
}
function endTagInBody(p, token) {
  switch (token.tagID) {
    case TAG_ID.A:
    case TAG_ID.B:
    case TAG_ID.I:
    case TAG_ID.S:
    case TAG_ID.U:
    case TAG_ID.EM:
    case TAG_ID.TT:
    case TAG_ID.BIG:
    case TAG_ID.CODE:
    case TAG_ID.FONT:
    case TAG_ID.NOBR:
    case TAG_ID.SMALL:
    case TAG_ID.STRIKE:
    case TAG_ID.STRONG: {
      callAdoptionAgency(p, token);
      break;
    }
    case TAG_ID.P: {
      pEndTagInBody(p);
      break;
    }
    case TAG_ID.DL:
    case TAG_ID.UL:
    case TAG_ID.OL:
    case TAG_ID.DIR:
    case TAG_ID.DIV:
    case TAG_ID.NAV:
    case TAG_ID.PRE:
    case TAG_ID.MAIN:
    case TAG_ID.MENU:
    case TAG_ID.ASIDE:
    case TAG_ID.BUTTON:
    case TAG_ID.CENTER:
    case TAG_ID.FIGURE:
    case TAG_ID.FOOTER:
    case TAG_ID.HEADER:
    case TAG_ID.HGROUP:
    case TAG_ID.DIALOG:
    case TAG_ID.ADDRESS:
    case TAG_ID.ARTICLE:
    case TAG_ID.DETAILS:
    case TAG_ID.SEARCH:
    case TAG_ID.SECTION:
    case TAG_ID.SUMMARY:
    case TAG_ID.LISTING:
    case TAG_ID.FIELDSET:
    case TAG_ID.BLOCKQUOTE:
    case TAG_ID.FIGCAPTION: {
      addressEndTagInBody(p, token);
      break;
    }
    case TAG_ID.LI: {
      liEndTagInBody(p);
      break;
    }
    case TAG_ID.DD:
    case TAG_ID.DT: {
      ddEndTagInBody(p, token);
      break;
    }
    case TAG_ID.H1:
    case TAG_ID.H2:
    case TAG_ID.H3:
    case TAG_ID.H4:
    case TAG_ID.H5:
    case TAG_ID.H6: {
      numberedHeaderEndTagInBody(p);
      break;
    }
    case TAG_ID.BR: {
      brEndTagInBody(p);
      break;
    }
    case TAG_ID.BODY: {
      bodyEndTagInBody(p, token);
      break;
    }
    case TAG_ID.HTML: {
      htmlEndTagInBody(p, token);
      break;
    }
    case TAG_ID.FORM: {
      formEndTagInBody(p);
      break;
    }
    case TAG_ID.APPLET:
    case TAG_ID.OBJECT:
    case TAG_ID.MARQUEE: {
      appletEndTagInBody(p, token);
      break;
    }
    case TAG_ID.TEMPLATE: {
      templateEndTagInHead(p, token);
      break;
    }
    default: {
      genericEndTagInBody(p, token);
    }
  }
}
function eofInBody(p, token) {
  if (p.tmplInsertionModeStack.length > 0) {
    eofInTemplate(p, token);
  } else {
    stopParsing(p, token);
  }
}
function endTagInText(p, token) {
  var _a;
  if (token.tagID === TAG_ID.SCRIPT) {
    (_a = p.scriptHandler) === null || _a === void 0 ? void 0 : _a.call(p, p.openElements.current);
  }
  p.openElements.pop();
  p.insertionMode = p.originalInsertionMode;
}
function eofInText(p, token) {
  p._err(token, ERR.eofInElementThatCanContainOnlyText);
  p.openElements.pop();
  p.insertionMode = p.originalInsertionMode;
  p.onEof(token);
}
function characterInTable(p, token) {
  if (p.openElements.currentTagId !== void 0 && TABLE_STRUCTURE_TAGS.has(p.openElements.currentTagId)) {
    p.pendingCharacterTokens.length = 0;
    p.hasNonWhitespacePendingCharacterToken = false;
    p.originalInsertionMode = p.insertionMode;
    p.insertionMode = InsertionMode.IN_TABLE_TEXT;
    switch (token.type) {
      case TokenType.CHARACTER: {
        characterInTableText(p, token);
        break;
      }
      case TokenType.WHITESPACE_CHARACTER: {
        whitespaceCharacterInTableText(p, token);
        break;
      }
    }
  } else {
    tokenInTable(p, token);
  }
}
function captionStartTagInTable(p, token) {
  p.openElements.clearBackToTableContext();
  p.activeFormattingElements.insertMarker();
  p._insertElement(token, NS.HTML);
  p.insertionMode = InsertionMode.IN_CAPTION;
}
function colgroupStartTagInTable(p, token) {
  p.openElements.clearBackToTableContext();
  p._insertElement(token, NS.HTML);
  p.insertionMode = InsertionMode.IN_COLUMN_GROUP;
}
function colStartTagInTable(p, token) {
  p.openElements.clearBackToTableContext();
  p._insertFakeElement(TAG_NAMES.COLGROUP, TAG_ID.COLGROUP);
  p.insertionMode = InsertionMode.IN_COLUMN_GROUP;
  startTagInColumnGroup(p, token);
}
function tbodyStartTagInTable(p, token) {
  p.openElements.clearBackToTableContext();
  p._insertElement(token, NS.HTML);
  p.insertionMode = InsertionMode.IN_TABLE_BODY;
}
function tdStartTagInTable(p, token) {
  p.openElements.clearBackToTableContext();
  p._insertFakeElement(TAG_NAMES.TBODY, TAG_ID.TBODY);
  p.insertionMode = InsertionMode.IN_TABLE_BODY;
  startTagInTableBody(p, token);
}
function tableStartTagInTable(p, token) {
  if (p.openElements.hasInTableScope(TAG_ID.TABLE)) {
    p.openElements.popUntilTagNamePopped(TAG_ID.TABLE);
    p._resetInsertionMode();
    p._processStartTag(token);
  }
}
function inputStartTagInTable(p, token) {
  if (isHiddenInput(token)) {
    p._appendElement(token, NS.HTML);
  } else {
    tokenInTable(p, token);
  }
  token.ackSelfClosing = true;
}
function formStartTagInTable(p, token) {
  if (!p.formElement && p.openElements.tmplCount === 0) {
    p._insertElement(token, NS.HTML);
    p.formElement = p.openElements.current;
    p.openElements.pop();
  }
}
function startTagInTable(p, token) {
  switch (token.tagID) {
    case TAG_ID.TD:
    case TAG_ID.TH:
    case TAG_ID.TR: {
      tdStartTagInTable(p, token);
      break;
    }
    case TAG_ID.STYLE:
    case TAG_ID.SCRIPT:
    case TAG_ID.TEMPLATE: {
      startTagInHead(p, token);
      break;
    }
    case TAG_ID.COL: {
      colStartTagInTable(p, token);
      break;
    }
    case TAG_ID.FORM: {
      formStartTagInTable(p, token);
      break;
    }
    case TAG_ID.TABLE: {
      tableStartTagInTable(p, token);
      break;
    }
    case TAG_ID.TBODY:
    case TAG_ID.TFOOT:
    case TAG_ID.THEAD: {
      tbodyStartTagInTable(p, token);
      break;
    }
    case TAG_ID.INPUT: {
      inputStartTagInTable(p, token);
      break;
    }
    case TAG_ID.CAPTION: {
      captionStartTagInTable(p, token);
      break;
    }
    case TAG_ID.COLGROUP: {
      colgroupStartTagInTable(p, token);
      break;
    }
    default: {
      tokenInTable(p, token);
    }
  }
}
function endTagInTable(p, token) {
  switch (token.tagID) {
    case TAG_ID.TABLE: {
      if (p.openElements.hasInTableScope(TAG_ID.TABLE)) {
        p.openElements.popUntilTagNamePopped(TAG_ID.TABLE);
        p._resetInsertionMode();
      }
      break;
    }
    case TAG_ID.TEMPLATE: {
      templateEndTagInHead(p, token);
      break;
    }
    case TAG_ID.BODY:
    case TAG_ID.CAPTION:
    case TAG_ID.COL:
    case TAG_ID.COLGROUP:
    case TAG_ID.HTML:
    case TAG_ID.TBODY:
    case TAG_ID.TD:
    case TAG_ID.TFOOT:
    case TAG_ID.TH:
    case TAG_ID.THEAD:
    case TAG_ID.TR: {
      break;
    }
    default: {
      tokenInTable(p, token);
    }
  }
}
function tokenInTable(p, token) {
  const savedFosterParentingState = p.fosterParentingEnabled;
  p.fosterParentingEnabled = true;
  modeInBody(p, token);
  p.fosterParentingEnabled = savedFosterParentingState;
}
function whitespaceCharacterInTableText(p, token) {
  p.pendingCharacterTokens.push(token);
}
function characterInTableText(p, token) {
  p.pendingCharacterTokens.push(token);
  p.hasNonWhitespacePendingCharacterToken = true;
}
function tokenInTableText(p, token) {
  let i = 0;
  if (p.hasNonWhitespacePendingCharacterToken) {
    for (; i < p.pendingCharacterTokens.length; i++) {
      tokenInTable(p, p.pendingCharacterTokens[i]);
    }
  } else {
    for (; i < p.pendingCharacterTokens.length; i++) {
      p._insertCharacters(p.pendingCharacterTokens[i]);
    }
  }
  p.insertionMode = p.originalInsertionMode;
  p._processToken(token);
}
var TABLE_VOID_ELEMENTS = /* @__PURE__ */ new Set([TAG_ID.CAPTION, TAG_ID.COL, TAG_ID.COLGROUP, TAG_ID.TBODY, TAG_ID.TD, TAG_ID.TFOOT, TAG_ID.TH, TAG_ID.THEAD, TAG_ID.TR]);
function startTagInCaption(p, token) {
  const tn = token.tagID;
  if (TABLE_VOID_ELEMENTS.has(tn)) {
    if (p.openElements.hasInTableScope(TAG_ID.CAPTION)) {
      p.openElements.generateImpliedEndTags();
      p.openElements.popUntilTagNamePopped(TAG_ID.CAPTION);
      p.activeFormattingElements.clearToLastMarker();
      p.insertionMode = InsertionMode.IN_TABLE;
      startTagInTable(p, token);
    }
  } else {
    startTagInBody(p, token);
  }
}
function endTagInCaption(p, token) {
  const tn = token.tagID;
  switch (tn) {
    case TAG_ID.CAPTION:
    case TAG_ID.TABLE: {
      if (p.openElements.hasInTableScope(TAG_ID.CAPTION)) {
        p.openElements.generateImpliedEndTags();
        p.openElements.popUntilTagNamePopped(TAG_ID.CAPTION);
        p.activeFormattingElements.clearToLastMarker();
        p.insertionMode = InsertionMode.IN_TABLE;
        if (tn === TAG_ID.TABLE) {
          endTagInTable(p, token);
        }
      }
      break;
    }
    case TAG_ID.BODY:
    case TAG_ID.COL:
    case TAG_ID.COLGROUP:
    case TAG_ID.HTML:
    case TAG_ID.TBODY:
    case TAG_ID.TD:
    case TAG_ID.TFOOT:
    case TAG_ID.TH:
    case TAG_ID.THEAD:
    case TAG_ID.TR: {
      break;
    }
    default: {
      endTagInBody(p, token);
    }
  }
}
function startTagInColumnGroup(p, token) {
  switch (token.tagID) {
    case TAG_ID.HTML: {
      startTagInBody(p, token);
      break;
    }
    case TAG_ID.COL: {
      p._appendElement(token, NS.HTML);
      token.ackSelfClosing = true;
      break;
    }
    case TAG_ID.TEMPLATE: {
      startTagInHead(p, token);
      break;
    }
    default: {
      tokenInColumnGroup(p, token);
    }
  }
}
function endTagInColumnGroup(p, token) {
  switch (token.tagID) {
    case TAG_ID.COLGROUP: {
      if (p.openElements.currentTagId === TAG_ID.COLGROUP) {
        p.openElements.pop();
        p.insertionMode = InsertionMode.IN_TABLE;
      }
      break;
    }
    case TAG_ID.TEMPLATE: {
      templateEndTagInHead(p, token);
      break;
    }
    case TAG_ID.COL: {
      break;
    }
    default: {
      tokenInColumnGroup(p, token);
    }
  }
}
function tokenInColumnGroup(p, token) {
  if (p.openElements.currentTagId === TAG_ID.COLGROUP) {
    p.openElements.pop();
    p.insertionMode = InsertionMode.IN_TABLE;
    p._processToken(token);
  }
}
function startTagInTableBody(p, token) {
  switch (token.tagID) {
    case TAG_ID.TR: {
      p.openElements.clearBackToTableBodyContext();
      p._insertElement(token, NS.HTML);
      p.insertionMode = InsertionMode.IN_ROW;
      break;
    }
    case TAG_ID.TH:
    case TAG_ID.TD: {
      p.openElements.clearBackToTableBodyContext();
      p._insertFakeElement(TAG_NAMES.TR, TAG_ID.TR);
      p.insertionMode = InsertionMode.IN_ROW;
      startTagInRow(p, token);
      break;
    }
    case TAG_ID.CAPTION:
    case TAG_ID.COL:
    case TAG_ID.COLGROUP:
    case TAG_ID.TBODY:
    case TAG_ID.TFOOT:
    case TAG_ID.THEAD: {
      if (p.openElements.hasTableBodyContextInTableScope()) {
        p.openElements.clearBackToTableBodyContext();
        p.openElements.pop();
        p.insertionMode = InsertionMode.IN_TABLE;
        startTagInTable(p, token);
      }
      break;
    }
    default: {
      startTagInTable(p, token);
    }
  }
}
function endTagInTableBody(p, token) {
  const tn = token.tagID;
  switch (token.tagID) {
    case TAG_ID.TBODY:
    case TAG_ID.TFOOT:
    case TAG_ID.THEAD: {
      if (p.openElements.hasInTableScope(tn)) {
        p.openElements.clearBackToTableBodyContext();
        p.openElements.pop();
        p.insertionMode = InsertionMode.IN_TABLE;
      }
      break;
    }
    case TAG_ID.TABLE: {
      if (p.openElements.hasTableBodyContextInTableScope()) {
        p.openElements.clearBackToTableBodyContext();
        p.openElements.pop();
        p.insertionMode = InsertionMode.IN_TABLE;
        endTagInTable(p, token);
      }
      break;
    }
    case TAG_ID.BODY:
    case TAG_ID.CAPTION:
    case TAG_ID.COL:
    case TAG_ID.COLGROUP:
    case TAG_ID.HTML:
    case TAG_ID.TD:
    case TAG_ID.TH:
    case TAG_ID.TR: {
      break;
    }
    default: {
      endTagInTable(p, token);
    }
  }
}
function startTagInRow(p, token) {
  switch (token.tagID) {
    case TAG_ID.TH:
    case TAG_ID.TD: {
      p.openElements.clearBackToTableRowContext();
      p._insertElement(token, NS.HTML);
      p.insertionMode = InsertionMode.IN_CELL;
      p.activeFormattingElements.insertMarker();
      break;
    }
    case TAG_ID.CAPTION:
    case TAG_ID.COL:
    case TAG_ID.COLGROUP:
    case TAG_ID.TBODY:
    case TAG_ID.TFOOT:
    case TAG_ID.THEAD:
    case TAG_ID.TR: {
      if (p.openElements.hasInTableScope(TAG_ID.TR)) {
        p.openElements.clearBackToTableRowContext();
        p.openElements.pop();
        p.insertionMode = InsertionMode.IN_TABLE_BODY;
        startTagInTableBody(p, token);
      }
      break;
    }
    default: {
      startTagInTable(p, token);
    }
  }
}
function endTagInRow(p, token) {
  switch (token.tagID) {
    case TAG_ID.TR: {
      if (p.openElements.hasInTableScope(TAG_ID.TR)) {
        p.openElements.clearBackToTableRowContext();
        p.openElements.pop();
        p.insertionMode = InsertionMode.IN_TABLE_BODY;
      }
      break;
    }
    case TAG_ID.TABLE: {
      if (p.openElements.hasInTableScope(TAG_ID.TR)) {
        p.openElements.clearBackToTableRowContext();
        p.openElements.pop();
        p.insertionMode = InsertionMode.IN_TABLE_BODY;
        endTagInTableBody(p, token);
      }
      break;
    }
    case TAG_ID.TBODY:
    case TAG_ID.TFOOT:
    case TAG_ID.THEAD: {
      if (p.openElements.hasInTableScope(token.tagID) || p.openElements.hasInTableScope(TAG_ID.TR)) {
        p.openElements.clearBackToTableRowContext();
        p.openElements.pop();
        p.insertionMode = InsertionMode.IN_TABLE_BODY;
        endTagInTableBody(p, token);
      }
      break;
    }
    case TAG_ID.BODY:
    case TAG_ID.CAPTION:
    case TAG_ID.COL:
    case TAG_ID.COLGROUP:
    case TAG_ID.HTML:
    case TAG_ID.TD:
    case TAG_ID.TH: {
      break;
    }
    default: {
      endTagInTable(p, token);
    }
  }
}
function startTagInCell(p, token) {
  const tn = token.tagID;
  if (TABLE_VOID_ELEMENTS.has(tn)) {
    if (p.openElements.hasInTableScope(TAG_ID.TD) || p.openElements.hasInTableScope(TAG_ID.TH)) {
      p._closeTableCell();
      startTagInRow(p, token);
    }
  } else {
    startTagInBody(p, token);
  }
}
function endTagInCell(p, token) {
  const tn = token.tagID;
  switch (tn) {
    case TAG_ID.TD:
    case TAG_ID.TH: {
      if (p.openElements.hasInTableScope(tn)) {
        p.openElements.generateImpliedEndTags();
        p.openElements.popUntilTagNamePopped(tn);
        p.activeFormattingElements.clearToLastMarker();
        p.insertionMode = InsertionMode.IN_ROW;
      }
      break;
    }
    case TAG_ID.TABLE:
    case TAG_ID.TBODY:
    case TAG_ID.TFOOT:
    case TAG_ID.THEAD:
    case TAG_ID.TR: {
      if (p.openElements.hasInTableScope(tn)) {
        p._closeTableCell();
        endTagInRow(p, token);
      }
      break;
    }
    case TAG_ID.BODY:
    case TAG_ID.CAPTION:
    case TAG_ID.COL:
    case TAG_ID.COLGROUP:
    case TAG_ID.HTML: {
      break;
    }
    default: {
      endTagInBody(p, token);
    }
  }
}
function startTagInSelect(p, token) {
  switch (token.tagID) {
    case TAG_ID.HTML: {
      startTagInBody(p, token);
      break;
    }
    case TAG_ID.OPTION: {
      if (p.openElements.currentTagId === TAG_ID.OPTION) {
        p.openElements.pop();
      }
      p._insertElement(token, NS.HTML);
      break;
    }
    case TAG_ID.OPTGROUP: {
      if (p.openElements.currentTagId === TAG_ID.OPTION) {
        p.openElements.pop();
      }
      if (p.openElements.currentTagId === TAG_ID.OPTGROUP) {
        p.openElements.pop();
      }
      p._insertElement(token, NS.HTML);
      break;
    }
    case TAG_ID.HR: {
      if (p.openElements.currentTagId === TAG_ID.OPTION) {
        p.openElements.pop();
      }
      if (p.openElements.currentTagId === TAG_ID.OPTGROUP) {
        p.openElements.pop();
      }
      p._appendElement(token, NS.HTML);
      token.ackSelfClosing = true;
      break;
    }
    case TAG_ID.INPUT:
    case TAG_ID.KEYGEN:
    case TAG_ID.TEXTAREA:
    case TAG_ID.SELECT: {
      if (p.openElements.hasInSelectScope(TAG_ID.SELECT)) {
        p.openElements.popUntilTagNamePopped(TAG_ID.SELECT);
        p._resetInsertionMode();
        if (token.tagID !== TAG_ID.SELECT) {
          p._processStartTag(token);
        }
      }
      break;
    }
    case TAG_ID.SCRIPT:
    case TAG_ID.TEMPLATE: {
      startTagInHead(p, token);
      break;
    }
    default:
  }
}
function endTagInSelect(p, token) {
  switch (token.tagID) {
    case TAG_ID.OPTGROUP: {
      if (p.openElements.stackTop > 0 && p.openElements.currentTagId === TAG_ID.OPTION && p.openElements.tagIDs[p.openElements.stackTop - 1] === TAG_ID.OPTGROUP) {
        p.openElements.pop();
      }
      if (p.openElements.currentTagId === TAG_ID.OPTGROUP) {
        p.openElements.pop();
      }
      break;
    }
    case TAG_ID.OPTION: {
      if (p.openElements.currentTagId === TAG_ID.OPTION) {
        p.openElements.pop();
      }
      break;
    }
    case TAG_ID.SELECT: {
      if (p.openElements.hasInSelectScope(TAG_ID.SELECT)) {
        p.openElements.popUntilTagNamePopped(TAG_ID.SELECT);
        p._resetInsertionMode();
      }
      break;
    }
    case TAG_ID.TEMPLATE: {
      templateEndTagInHead(p, token);
      break;
    }
    default:
  }
}
function startTagInSelectInTable(p, token) {
  const tn = token.tagID;
  if (tn === TAG_ID.CAPTION || tn === TAG_ID.TABLE || tn === TAG_ID.TBODY || tn === TAG_ID.TFOOT || tn === TAG_ID.THEAD || tn === TAG_ID.TR || tn === TAG_ID.TD || tn === TAG_ID.TH) {
    p.openElements.popUntilTagNamePopped(TAG_ID.SELECT);
    p._resetInsertionMode();
    p._processStartTag(token);
  } else {
    startTagInSelect(p, token);
  }
}
function endTagInSelectInTable(p, token) {
  const tn = token.tagID;
  if (tn === TAG_ID.CAPTION || tn === TAG_ID.TABLE || tn === TAG_ID.TBODY || tn === TAG_ID.TFOOT || tn === TAG_ID.THEAD || tn === TAG_ID.TR || tn === TAG_ID.TD || tn === TAG_ID.TH) {
    if (p.openElements.hasInTableScope(tn)) {
      p.openElements.popUntilTagNamePopped(TAG_ID.SELECT);
      p._resetInsertionMode();
      p.onEndTag(token);
    }
  } else {
    endTagInSelect(p, token);
  }
}
function startTagInTemplate(p, token) {
  switch (token.tagID) {
    // First, handle tags that can start without a mode change
    case TAG_ID.BASE:
    case TAG_ID.BASEFONT:
    case TAG_ID.BGSOUND:
    case TAG_ID.LINK:
    case TAG_ID.META:
    case TAG_ID.NOFRAMES:
    case TAG_ID.SCRIPT:
    case TAG_ID.STYLE:
    case TAG_ID.TEMPLATE:
    case TAG_ID.TITLE: {
      startTagInHead(p, token);
      break;
    }
    // Re-process the token in the appropriate mode
    case TAG_ID.CAPTION:
    case TAG_ID.COLGROUP:
    case TAG_ID.TBODY:
    case TAG_ID.TFOOT:
    case TAG_ID.THEAD: {
      p.tmplInsertionModeStack[0] = InsertionMode.IN_TABLE;
      p.insertionMode = InsertionMode.IN_TABLE;
      startTagInTable(p, token);
      break;
    }
    case TAG_ID.COL: {
      p.tmplInsertionModeStack[0] = InsertionMode.IN_COLUMN_GROUP;
      p.insertionMode = InsertionMode.IN_COLUMN_GROUP;
      startTagInColumnGroup(p, token);
      break;
    }
    case TAG_ID.TR: {
      p.tmplInsertionModeStack[0] = InsertionMode.IN_TABLE_BODY;
      p.insertionMode = InsertionMode.IN_TABLE_BODY;
      startTagInTableBody(p, token);
      break;
    }
    case TAG_ID.TD:
    case TAG_ID.TH: {
      p.tmplInsertionModeStack[0] = InsertionMode.IN_ROW;
      p.insertionMode = InsertionMode.IN_ROW;
      startTagInRow(p, token);
      break;
    }
    default: {
      p.tmplInsertionModeStack[0] = InsertionMode.IN_BODY;
      p.insertionMode = InsertionMode.IN_BODY;
      startTagInBody(p, token);
    }
  }
}
function endTagInTemplate(p, token) {
  if (token.tagID === TAG_ID.TEMPLATE) {
    templateEndTagInHead(p, token);
  }
}
function eofInTemplate(p, token) {
  if (p.openElements.tmplCount > 0) {
    p.openElements.popUntilTagNamePopped(TAG_ID.TEMPLATE);
    p.activeFormattingElements.clearToLastMarker();
    p.tmplInsertionModeStack.shift();
    p._resetInsertionMode();
    p.onEof(token);
  } else {
    stopParsing(p, token);
  }
}
function startTagAfterBody(p, token) {
  if (token.tagID === TAG_ID.HTML) {
    startTagInBody(p, token);
  } else {
    tokenAfterBody(p, token);
  }
}
function endTagAfterBody(p, token) {
  var _a;
  if (token.tagID === TAG_ID.HTML) {
    if (!p.fragmentContext) {
      p.insertionMode = InsertionMode.AFTER_AFTER_BODY;
    }
    if (p.options.sourceCodeLocationInfo && p.openElements.tagIDs[0] === TAG_ID.HTML) {
      p._setEndLocation(p.openElements.items[0], token);
      const bodyElement = p.openElements.items[1];
      if (bodyElement && !((_a = p.treeAdapter.getNodeSourceCodeLocation(bodyElement)) === null || _a === void 0 ? void 0 : _a.endTag)) {
        p._setEndLocation(bodyElement, token);
      }
    }
  } else {
    tokenAfterBody(p, token);
  }
}
function tokenAfterBody(p, token) {
  p.insertionMode = InsertionMode.IN_BODY;
  modeInBody(p, token);
}
function startTagInFrameset(p, token) {
  switch (token.tagID) {
    case TAG_ID.HTML: {
      startTagInBody(p, token);
      break;
    }
    case TAG_ID.FRAMESET: {
      p._insertElement(token, NS.HTML);
      break;
    }
    case TAG_ID.FRAME: {
      p._appendElement(token, NS.HTML);
      token.ackSelfClosing = true;
      break;
    }
    case TAG_ID.NOFRAMES: {
      startTagInHead(p, token);
      break;
    }
    default:
  }
}
function endTagInFrameset(p, token) {
  if (token.tagID === TAG_ID.FRAMESET && !p.openElements.isRootHtmlElementCurrent()) {
    p.openElements.pop();
    if (!p.fragmentContext && p.openElements.currentTagId !== TAG_ID.FRAMESET) {
      p.insertionMode = InsertionMode.AFTER_FRAMESET;
    }
  }
}
function startTagAfterFrameset(p, token) {
  switch (token.tagID) {
    case TAG_ID.HTML: {
      startTagInBody(p, token);
      break;
    }
    case TAG_ID.NOFRAMES: {
      startTagInHead(p, token);
      break;
    }
    default:
  }
}
function endTagAfterFrameset(p, token) {
  if (token.tagID === TAG_ID.HTML) {
    p.insertionMode = InsertionMode.AFTER_AFTER_FRAMESET;
  }
}
function startTagAfterAfterBody(p, token) {
  if (token.tagID === TAG_ID.HTML) {
    startTagInBody(p, token);
  } else {
    tokenAfterAfterBody(p, token);
  }
}
function tokenAfterAfterBody(p, token) {
  p.insertionMode = InsertionMode.IN_BODY;
  modeInBody(p, token);
}
function startTagAfterAfterFrameset(p, token) {
  switch (token.tagID) {
    case TAG_ID.HTML: {
      startTagInBody(p, token);
      break;
    }
    case TAG_ID.NOFRAMES: {
      startTagInHead(p, token);
      break;
    }
    default:
  }
}
function nullCharacterInForeignContent(p, token) {
  token.chars = REPLACEMENT_CHARACTER;
  p._insertCharacters(token);
}
function characterInForeignContent(p, token) {
  p._insertCharacters(token);
  p.framesetOk = false;
}
function popUntilHtmlOrIntegrationPoint(p) {
  while (p.treeAdapter.getNamespaceURI(p.openElements.current) !== NS.HTML && p.openElements.currentTagId !== void 0 && !p._isIntegrationPoint(p.openElements.currentTagId, p.openElements.current)) {
    p.openElements.pop();
  }
}
function startTagInForeignContent(p, token) {
  if (causesExit(token)) {
    popUntilHtmlOrIntegrationPoint(p);
    p._startTagOutsideForeignContent(token);
  } else {
    const current = p._getAdjustedCurrentElement();
    const currentNs = p.treeAdapter.getNamespaceURI(current);
    if (currentNs === NS.MATHML) {
      adjustTokenMathMLAttrs(token);
    } else if (currentNs === NS.SVG) {
      adjustTokenSVGTagName(token);
      adjustTokenSVGAttrs(token);
    }
    adjustTokenXMLAttrs(token);
    if (token.selfClosing) {
      p._appendElement(token, currentNs);
    } else {
      p._insertElement(token, currentNs);
    }
    token.ackSelfClosing = true;
  }
}
function endTagInForeignContent(p, token) {
  if (token.tagID === TAG_ID.P || token.tagID === TAG_ID.BR) {
    popUntilHtmlOrIntegrationPoint(p);
    p._endTagOutsideForeignContent(token);
    return;
  }
  for (let i = p.openElements.stackTop; i > 0; i--) {
    const element = p.openElements.items[i];
    if (p.treeAdapter.getNamespaceURI(element) === NS.HTML) {
      p._endTagOutsideForeignContent(token);
      break;
    }
    const tagName = p.treeAdapter.getTagName(element);
    if (tagName.toLowerCase() === token.tagName) {
      token.tagName = tagName;
      p.openElements.shortenToLength(i);
      break;
    }
  }
}

// node_modules/parse5/dist/serializer/index.js
var VOID_ELEMENTS = /* @__PURE__ */ new Set([
  TAG_NAMES.AREA,
  TAG_NAMES.BASE,
  TAG_NAMES.BASEFONT,
  TAG_NAMES.BGSOUND,
  TAG_NAMES.BR,
  TAG_NAMES.COL,
  TAG_NAMES.EMBED,
  TAG_NAMES.FRAME,
  TAG_NAMES.HR,
  TAG_NAMES.IMG,
  TAG_NAMES.INPUT,
  TAG_NAMES.KEYGEN,
  TAG_NAMES.LINK,
  TAG_NAMES.META,
  TAG_NAMES.PARAM,
  TAG_NAMES.SOURCE,
  TAG_NAMES.TRACK,
  TAG_NAMES.WBR
]);

// node_modules/parse5/dist/index.js
function parse(html, options) {
  return Parser.parse(html, options);
}
function parseFragment(fragmentContext, html, options) {
  if (typeof fragmentContext === "string") {
    options = html;
    html = fragmentContext;
    fragmentContext = null;
  }
  const parser = Parser.getFragmentParser(fragmentContext, options);
  parser.tokenizer.write(html, true);
  return parser.getFragment();
}

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
var Number2 = 10;
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
    type = Number2;
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
  const children3 = this.createList();
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
        recognizer.onWhiteSpace.call(this, child, children3, context);
      }
      space = false;
    }
    children3.push(child);
  }
  if (space && recognizer.onWhiteSpace) {
    recognizer.onWhiteSpace.call(this, null, children3, context);
  }
  return children3;
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
            if (this.tokenType === Number2) {
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
  const parse51 = function(source_, options) {
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
  return Object.assign(parse51, {
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
    case Number2:
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
function onWhiteSpace(next, children3) {
  if (children3.last !== null && children3.last.type !== "Combinator" && next !== null && next.type !== "Combinator") {
    children3.push({
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
    case Number2:
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
  const children3 = this.createList();
  this.skipSC();
  children3.push(this.Identifier());
  this.skipSC();
  if (this.tokenType === Comma) {
    children3.push(this.Operator());
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
    children3.push(value);
  }
  return children3;
}

// node_modules/css-tree/lib/syntax/scope/value.js
function isPlusMinusOperator(node) {
  return node !== null && node.type === "Operator" && (node.value[node.value.length - 1] === "-" || node.value[node.value.length - 1] === "+");
}
var value_default = {
  getNode: defaultRecognizer,
  onWhiteSpace(next, children3) {
    if (isPlusMinusOperator(next)) {
      next.value = " " + next.value;
    }
    if (isPlusMinusOperator(children3.last)) {
      children3.last.value += " ";
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
      const children3 = this.createList();
      if (this.tokenType === Ident) {
        const name50 = this.substring(this.tokenStart, this.tokenEnd);
        if (!nonContainerNameKeywords.has(name50.toLowerCase())) {
          children3.push(this.Identifier());
        }
      }
      children3.push(this.Condition("container"));
      return children3;
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
function parseWithFallback(parse51, fallback) {
  return this.parseWithFallback(
    () => {
      try {
        return parse51.call(this);
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
    const children3 = this.createList();
    const node = parseWithFallback.call(this, this.Layer);
    if (node.type !== "Raw" || node.value !== "") {
      children3.push(node);
    }
    return children3;
  },
  supports() {
    this.skipSC();
    const children3 = this.createList();
    const node = parseWithFallback.call(
      this,
      this.Declaration,
      () => parseWithFallback.call(this, () => this.Condition("supports"))
    );
    if (node.type !== "Raw" || node.value !== "") {
      children3.push(node);
    }
    return children3;
  }
};
var import_default6 = {
  parse: {
    prelude() {
      const children3 = this.createList();
      switch (this.tokenType) {
        case String2:
          children3.push(this.String());
          break;
        case Url:
        case Function:
          children3.push(this.Url());
          break;
        default:
          this.error("String or url() is expected");
      }
      this.skipSC();
      if (this.tokenType === Ident && this.cmpStr(this.tokenStart, this.tokenEnd, "layer")) {
        children3.push(this.Identifier());
      } else if (this.tokenType === Function && this.cmpStr(this.tokenStart, this.tokenEnd, "layer(")) {
        children3.push(this.Function(null, parseFunctions));
      }
      this.skipSC();
      if (this.tokenType === Function && this.cmpStr(this.tokenStart, this.tokenEnd, "supports(")) {
        children3.push(this.Function(null, parseFunctions));
      }
      if (this.lookupNonWSType(0) === Ident || this.lookupNonWSType(0) === LeftParenthesis) {
        children3.push(this.MediaQueryList());
      }
      return children3;
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
  import: import_default6,
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
  const children3 = this.createList();
  this.skipSC();
  loop: while (!this.eof) {
    switch (this.tokenType) {
      case Ident:
        children3.push(this.Identifier());
        break;
      case String2:
        children3.push(this.String());
        break;
      case Comma:
        children3.push(this.Operator());
        break;
      case RightParenthesis:
        break loop;
      default:
        this.error("Identifier, string or comma is expected");
    }
    this.skipSC();
  }
  return children3;
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
  AnPlusB: () => parse2,
  Atrule: () => parse3,
  AtrulePrelude: () => parse4,
  AttributeSelector: () => parse5,
  Block: () => parse6,
  Brackets: () => parse7,
  CDC: () => parse8,
  CDO: () => parse9,
  ClassSelector: () => parse10,
  Combinator: () => parse11,
  Comment: () => parse12,
  Condition: () => parse13,
  Declaration: () => parse14,
  DeclarationList: () => parse15,
  Dimension: () => parse16,
  Feature: () => parse17,
  FeatureFunction: () => parse18,
  FeatureRange: () => parse19,
  Function: () => parse20,
  GeneralEnclosed: () => parse21,
  Hash: () => parse22,
  IdSelector: () => parse24,
  Identifier: () => parse23,
  Layer: () => parse25,
  LayerList: () => parse26,
  MediaQuery: () => parse27,
  MediaQueryList: () => parse28,
  NestingSelector: () => parse29,
  Nth: () => parse30,
  Number: () => parse31,
  Operator: () => parse32,
  Parentheses: () => parse33,
  Percentage: () => parse34,
  PseudoClassSelector: () => parse35,
  PseudoElementSelector: () => parse36,
  Ratio: () => parse37,
  Raw: () => parse38,
  Rule: () => parse39,
  Scope: () => parse40,
  Selector: () => parse41,
  SelectorList: () => parse42,
  String: () => parse43,
  StyleSheet: () => parse44,
  SupportsDeclaration: () => parse45,
  TypeSelector: () => parse46,
  UnicodeRange: () => parse47,
  Url: () => parse48,
  Value: () => parse49,
  WhiteSpace: () => parse50
});

// node_modules/css-tree/lib/syntax/node/AnPlusB.js
var AnPlusB_exports = {};
__export(AnPlusB_exports, {
  generate: () => generate,
  name: () => name,
  parse: () => parse2,
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
  if (type !== Number2) {
    if (this.isDelim(PLUSSIGN3, offset) || this.isDelim(HYPHENMINUS2, offset)) {
      sign = this.isDelim(PLUSSIGN3, offset) ? PLUSSIGN3 : HYPHENMINUS2;
      do {
        type = this.lookupType(++offset);
      } while (type === WhiteSpace || type === Comment);
      if (type !== Number2) {
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
  return sign === HYPHENMINUS2 ? "-" + this.consume(Number2) : this.consume(Number2);
}
var name = "AnPlusB";
var structure = {
  a: [String, null],
  b: [String, null]
};
function parse2() {
  const start = this.tokenStart;
  let a = null;
  let b = null;
  if (this.tokenType === Number2) {
    checkTokenIsInteger.call(this, ALLOW_SIGN);
    b = this.consume(Number2);
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
        b = "-" + this.consume(Number2);
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
        b = "-" + this.consume(Number2);
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
        b = "-" + this.consume(Number2);
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
  parse: () => parse3,
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
function parse3(isDeclaration = false) {
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
  parse: () => parse4,
  structure: () => structure3,
  walkContext: () => walkContext2
});
var name3 = "AtrulePrelude";
var walkContext2 = "atrulePrelude";
var structure3 = {
  children: [[]]
};
function parse4(name50) {
  let children3 = null;
  if (name50 !== null) {
    name50 = name50.toLowerCase();
  }
  this.skipSC();
  if (hasOwnProperty.call(this.atrule, name50) && typeof this.atrule[name50].prelude === "function") {
    children3 = this.atrule[name50].prelude.call(this);
  } else {
    children3 = this.readSequence(this.scope.AtrulePrelude);
  }
  this.skipSC();
  if (this.eof !== true && this.tokenType !== LeftCurlyBracket && this.tokenType !== Semicolon) {
    this.error("Semicolon or block is expected");
  }
  return {
    type: "AtrulePrelude",
    loc: this.getLocationFromList(children3),
    children: children3
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
  parse: () => parse5,
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
function parse5() {
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
  parse: () => parse6,
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
function parse6(isStyleBlock) {
  const consumer = isStyleBlock ? consumeDeclaration : consumeRule;
  const start = this.tokenStart;
  let children3 = this.createList();
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
          children3.push(this.parseWithFallback(this.Atrule.bind(this, isStyleBlock), consumeRaw2));
          break;
        default:
          if (isStyleBlock && this.isDelim(AMPERSAND2)) {
            children3.push(consumeRule.call(this));
          } else {
            children3.push(consumer.call(this));
          }
      }
    }
  if (!this.eof) {
    this.eat(RightCurlyBracket);
  }
  return {
    type: "Block",
    loc: this.getLocation(start, this.tokenStart),
    children: children3
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
  parse: () => parse7,
  structure: () => structure6
});
var name6 = "Brackets";
var structure6 = {
  children: [[]]
};
function parse7(readSequence2, recognizer) {
  const start = this.tokenStart;
  let children3 = null;
  this.eat(LeftSquareBracket);
  children3 = readSequence2.call(this, recognizer);
  if (!this.eof) {
    this.eat(RightSquareBracket);
  }
  return {
    type: "Brackets",
    loc: this.getLocation(start, this.tokenStart),
    children: children3
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
  parse: () => parse8,
  structure: () => structure7
});
var name7 = "CDC";
var structure7 = [];
function parse8() {
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
  parse: () => parse9,
  structure: () => structure8
});
var name8 = "CDO";
var structure8 = [];
function parse9() {
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
  parse: () => parse10,
  structure: () => structure9
});
var FULLSTOP2 = 46;
var name9 = "ClassSelector";
var structure9 = {
  name: String
};
function parse10() {
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
  parse: () => parse11,
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
function parse11() {
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
  parse: () => parse12,
  structure: () => structure11
});
var ASTERISK4 = 42;
var SOLIDUS4 = 47;
var name11 = "Comment";
var structure11 = {
  value: String
};
function parse12() {
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
  parse: () => parse13,
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
function parse13(kind = "media") {
  const children3 = this.createList();
  scan: while (!this.eof) {
    switch (this.tokenType) {
      case Comment:
      case WhiteSpace:
        this.next();
        continue;
      case Ident:
        children3.push(this.Identifier());
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
        children3.push(term);
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
        children3.push(term);
        break;
      }
      default:
        break scan;
    }
  }
  if (children3.isEmpty) {
    this.error("Condition is expected");
  }
  return {
    type: "Condition",
    loc: this.getLocationFromList(children3),
    kind,
    children: children3
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
  parse: () => parse14,
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
function parse14() {
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
  parse: () => parse15,
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
function parse15() {
  const children3 = this.createList();
  scan:
    while (!this.eof) {
      switch (this.tokenType) {
        case WhiteSpace:
        case Comment:
        case Semicolon:
          this.next();
          break;
        case AtKeyword:
          children3.push(this.parseWithFallback(this.Atrule.bind(this, true), consumeRaw3));
          break;
        default:
          if (this.isDelim(AMPERSAND4)) {
            children3.push(this.parseWithFallback(this.Rule, consumeRaw3));
          } else {
            children3.push(this.parseWithFallback(this.Declaration, consumeRaw3));
          }
      }
    }
  return {
    type: "DeclarationList",
    loc: this.getLocationFromList(children3),
    children: children3
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
  parse: () => parse16,
  structure: () => structure15
});
var name15 = "Dimension";
var structure15 = {
  value: String,
  unit: String
};
function parse16() {
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
  parse: () => parse17,
  structure: () => structure16
});
var SOLIDUS6 = 47;
var name16 = "Feature";
var structure16 = {
  kind: String,
  name: String,
  value: ["Identifier", "Number", "Dimension", "Ratio", "Function", null]
};
function parse17(kind) {
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
      case Number2:
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
  parse: () => parse18,
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
function parse18(kind = "unknown") {
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
  parse: () => parse19,
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
    case Number2:
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
function parse19(kind = "unknown") {
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
  parse: () => parse20,
  structure: () => structure19,
  walkContext: () => walkContext5
});
var name19 = "Function";
var walkContext5 = "function";
var structure19 = {
  name: String,
  children: [[]]
};
function parse20(readSequence2, recognizer) {
  const start = this.tokenStart;
  const name50 = this.consumeFunctionName();
  const nameLowerCase = name50.toLowerCase();
  let children3;
  children3 = recognizer.hasOwnProperty(nameLowerCase) ? recognizer[nameLowerCase].call(this, recognizer) : readSequence2.call(this, recognizer);
  if (!this.eof) {
    this.eat(RightParenthesis);
  }
  return {
    type: "Function",
    loc: this.getLocation(start, this.tokenStart),
    name: name50,
    children: children3
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
  parse: () => parse21,
  structure: () => structure20
});
var name20 = "GeneralEnclosed";
var structure20 = {
  kind: String,
  function: [String, null],
  children: [[]]
};
function parse21(kind) {
  const start = this.tokenStart;
  let functionName = null;
  if (this.tokenType === Function) {
    functionName = this.consumeFunctionName();
  } else {
    this.eat(LeftParenthesis);
  }
  const children3 = this.parseWithFallback(
    () => {
      const startValueToken = this.tokenIndex;
      const children4 = this.readSequence(this.scope.Value);
      if (this.eof === false && this.isBalanceEdge(startValueToken) === false) {
        this.error();
      }
      return children4;
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
    children: children3
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
  parse: () => parse22,
  structure: () => structure21,
  xxx: () => xxx
});
var xxx = "XXX";
var name21 = "Hash";
var structure21 = {
  value: String
};
function parse22() {
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
  parse: () => parse23,
  structure: () => structure22
});
var name22 = "Identifier";
var structure22 = {
  name: String
};
function parse23() {
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
  parse: () => parse24,
  structure: () => structure23
});
var name23 = "IdSelector";
var structure23 = {
  name: String
};
function parse24() {
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
  parse: () => parse25,
  structure: () => structure24
});
var FULLSTOP3 = 46;
var name24 = "Layer";
var structure24 = {
  name: String
};
function parse25() {
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
  parse: () => parse26,
  structure: () => structure25
});
var name25 = "LayerList";
var structure25 = {
  children: [[
    "Layer"
  ]]
};
function parse26() {
  const children3 = this.createList();
  this.skipSC();
  while (!this.eof) {
    children3.push(this.Layer());
    if (this.lookupTypeNonSC(0) !== Comma) {
      break;
    }
    this.skipSC();
    this.next();
    this.skipSC();
  }
  return {
    type: "LayerList",
    loc: this.getLocationFromList(children3),
    children: children3
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
  parse: () => parse27,
  structure: () => structure26
});
var name26 = "MediaQuery";
var structure26 = {
  modifier: [String, null],
  mediaType: [String, null],
  condition: ["Condition", null]
};
function parse27() {
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
  parse: () => parse28,
  structure: () => structure27
});
var name27 = "MediaQueryList";
var structure27 = {
  children: [[
    "MediaQuery"
  ]]
};
function parse28() {
  const children3 = this.createList();
  this.skipSC();
  while (!this.eof) {
    children3.push(this.MediaQuery());
    if (this.tokenType !== Comma) {
      break;
    }
    this.next();
  }
  return {
    type: "MediaQueryList",
    loc: this.getLocationFromList(children3),
    children: children3
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
  parse: () => parse29,
  structure: () => structure28
});
var AMPERSAND5 = 38;
var name28 = "NestingSelector";
var structure28 = {};
function parse29() {
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
  parse: () => parse30,
  structure: () => structure29
});
var name29 = "Nth";
var structure29 = {
  nth: ["AnPlusB", "Identifier"],
  selector: ["SelectorList", null]
};
function parse30() {
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
  parse: () => parse31,
  structure: () => structure30
});
var name30 = "Number";
var structure30 = {
  value: String
};
function parse31() {
  return {
    type: "Number",
    loc: this.getLocation(this.tokenStart, this.tokenEnd),
    value: this.consume(Number2)
  };
}
function generate30(node) {
  this.token(Number2, node.value);
}

// node_modules/css-tree/lib/syntax/node/Operator.js
var Operator_exports = {};
__export(Operator_exports, {
  generate: () => generate31,
  name: () => name31,
  parse: () => parse32,
  structure: () => structure31
});
var name31 = "Operator";
var structure31 = {
  value: String
};
function parse32() {
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
  parse: () => parse33,
  structure: () => structure32
});
var name32 = "Parentheses";
var structure32 = {
  children: [[]]
};
function parse33(readSequence2, recognizer) {
  const start = this.tokenStart;
  let children3 = null;
  this.eat(LeftParenthesis);
  children3 = readSequence2.call(this, recognizer);
  if (!this.eof) {
    this.eat(RightParenthesis);
  }
  return {
    type: "Parentheses",
    loc: this.getLocation(start, this.tokenStart),
    children: children3
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
  parse: () => parse34,
  structure: () => structure33
});
var name33 = "Percentage";
var structure33 = {
  value: String
};
function parse34() {
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
  parse: () => parse35,
  structure: () => structure34,
  walkContext: () => walkContext6
});
var name34 = "PseudoClassSelector";
var walkContext6 = "function";
var structure34 = {
  name: String,
  children: [["Raw"], null]
};
function parse35() {
  const start = this.tokenStart;
  let children3 = null;
  let name50;
  let nameLowerCase;
  this.eat(Colon);
  if (this.tokenType === Function) {
    name50 = this.consumeFunctionName();
    nameLowerCase = name50.toLowerCase();
    if (this.lookupNonWSType(0) == RightParenthesis) {
      children3 = this.createList();
    } else if (hasOwnProperty.call(this.pseudo, nameLowerCase)) {
      this.skipSC();
      children3 = this.pseudo[nameLowerCase].call(this);
      this.skipSC();
    } else {
      children3 = this.createList();
      children3.push(
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
    children: children3
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
  parse: () => parse36,
  structure: () => structure35,
  walkContext: () => walkContext7
});
var name35 = "PseudoElementSelector";
var walkContext7 = "function";
var structure35 = {
  name: String,
  children: [["Raw"], null]
};
function parse36() {
  const start = this.tokenStart;
  let children3 = null;
  let name50;
  let nameLowerCase;
  this.eat(Colon);
  this.eat(Colon);
  if (this.tokenType === Function) {
    name50 = this.consumeFunctionName();
    nameLowerCase = name50.toLowerCase();
    if (this.lookupNonWSType(0) == RightParenthesis) {
      children3 = this.createList();
    } else if (hasOwnProperty.call(this.pseudo, nameLowerCase)) {
      this.skipSC();
      children3 = this.pseudo[nameLowerCase].call(this);
      this.skipSC();
    } else {
      children3 = this.createList();
      children3.push(
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
    children: children3
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
  parse: () => parse37,
  structure: () => structure36
});
var SOLIDUS8 = 47;
function consumeTerm() {
  this.skipSC();
  switch (this.tokenType) {
    case Number2:
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
function parse37() {
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
    this.node(Number2, 1);
  }
}

// node_modules/css-tree/lib/syntax/node/Raw.js
var Raw_exports = {};
__export(Raw_exports, {
  generate: () => generate37,
  name: () => name37,
  parse: () => parse38,
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
function parse38(consumeUntil, excludeWhiteSpace) {
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
  parse: () => parse39,
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
function parse39() {
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
  parse: () => parse40,
  structure: () => structure39
});
var name39 = "Scope";
var structure39 = {
  root: ["SelectorList", "Raw", null],
  limit: ["SelectorList", "Raw", null]
};
function parse40() {
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
  parse: () => parse41,
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
function parse41() {
  const children3 = this.readSequence(this.scope.Selector);
  if (this.getFirstListNode(children3) === null) {
    this.error("Selector is expected");
  }
  return {
    type: "Selector",
    loc: this.getLocationFromList(children3),
    children: children3
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
  parse: () => parse42,
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
function parse42() {
  const children3 = this.createList();
  while (!this.eof) {
    children3.push(this.Selector());
    if (this.tokenType === Comma) {
      this.next();
      continue;
    }
    break;
  }
  return {
    type: "SelectorList",
    loc: this.getLocationFromList(children3),
    children: children3
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
  parse: () => parse43,
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
function parse43() {
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
  parse: () => parse44,
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
function parse44() {
  const start = this.tokenStart;
  const children3 = this.createList();
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
      children3.push(child);
    }
  return {
    type: "StyleSheet",
    loc: this.getLocation(start, this.tokenStart),
    children: children3
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
  parse: () => parse45,
  structure: () => structure44
});
var name44 = "SupportsDeclaration";
var structure44 = {
  declaration: "Declaration"
};
function parse45() {
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
  parse: () => parse46,
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
function parse46() {
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
  parse: () => parse47,
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
    case Number2:
      hexLength = eatHexSequence.call(this, 1, true);
      if (this.isDelim(QUESTIONMARK)) {
        eatQuestionMarkSequence.call(this, 6 - hexLength);
        break;
      }
      if (this.tokenType === Dimension || this.tokenType === Number2) {
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
function parse47() {
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
  parse: () => parse48,
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
function parse48() {
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
  parse: () => parse49,
  structure: () => structure48
});
var name48 = "Value";
var structure48 = {
  children: [[]]
};
function parse49() {
  const start = this.tokenStart;
  const children3 = this.readSequence(this.scope.Value);
  return {
    type: "Value",
    loc: this.getLocation(start, this.tokenStart),
    children: children3
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
  parse: () => parse50,
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
function parse50() {
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

// node_modules/css-tree/lib/walker/create.js
var { hasOwnProperty: hasOwnProperty2 } = Object.prototype;
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
function getWalkersFromStructure(name50, nodeType) {
  const structure50 = nodeType.structure;
  const walkers = [];
  for (const key in structure50) {
    if (hasOwnProperty2.call(structure50, key) === false) {
      continue;
    }
    let fieldTypes = structure50[key];
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
  for (const name50 in config.node) {
    if (hasOwnProperty2.call(config.node, name50)) {
      const nodeType = config.node[name50];
      if (!nodeType.structure) {
        throw new Error("Missed `structure` field in `" + name50 + "` node type definition");
      }
      types[name50] = getWalkersFromStructure(name50, nodeType);
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
  for (const name50 in types) {
    if (hasOwnProperty2.call(types, name50) && types[name50] !== null) {
      iteratorsNatural[name50] = createTypeIterator(types[name50], false);
      iteratorsReverse[name50] = createTypeIterator(types[name50], true);
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
function matchContractSelector(selector2, element) {
  if (selector2.type === "SelectorList") {
    let specificity2 = -1;
    for (const one of children(selector2)) {
      const result = matchContractSelector(one, element);
      if (!result) return null;
      if (result.matches) specificity2 = Math.max(specificity2, result.specificity);
    }
    return { matches: specificity2 >= 0, specificity: Math.max(0, specificity2) };
  }
  if (selector2.type !== "Selector") return null;
  let matches = true, specificity = 0;
  const attribute = (name50) => element.attrs.find((one) => one.name === name50)?.value;
  for (const part of children(selector2)) {
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
    return new Map(contractLonghands(property).map((name50, index) => [name50, [quad(clean)[index]]]));
  }
  if (property === "border-radius") {
    const x = slash === -1 ? clean : clean.slice(0, slash), y = slash === -1 ? x : clean.slice(slash + 1);
    if (x.length < 1 || x.length > 4 || y.length < 1 || y.length > 4 || y.some((value) => spelling2(value) === "/")) return null;
    const horizontal = quad(x), vertical = quad(y);
    return new Map(contractLonghands(property).map((name50, index) => [name50, [horizontal[index], vertical[index]]]));
  }
  if (/^border-(?:top|bottom)-(?:left|right)-radius$/.test(property)) {
    if (clean.length < 1 || clean.length > 2 || slash !== -1) return null;
    return /* @__PURE__ */ new Map([[property, [clean[0], clean[1] ?? clean[0]]]]);
  }
  return clean.length === 1 ? /* @__PURE__ */ new Map([[property, clean]]) : null;
}

// packages/core/src/designaudit.ts
var parseCss = parser_default2;
var walk = walker_default2;
var DESIGN_AUDIT_VERSION = "1.1.0";
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
          const name50 = node.prelude ? spelling({ node: node.prelude, part }).trim() : "";
          if (name50.startsWith("--")) registered.add(name50);
          return;
        }
        if (["import", "namespace"].includes(node.name.toLowerCase())) uncovered("external-style", location({ node, part }), "External stylesheet or namespace was not fetched.");
        if (node.block) collect(node.block, true);
        return;
      }
      const list = children2(node);
      const declarations2 = list.filter((one) => one.type === "Declaration");
      if (node.type === "Rule") {
        const selector2 = node.prelude.loc ? part.text.slice(node.prelude.loc.start.offset, node.prelude.loc.end.offset).trim() : "";
        blocks.push({ part, declarations: children2(node.block).filter((one) => one.type === "Declaration"), root: selector2 === ":root" && !conditional2, conditional: conditional2, selector: node.prelude });
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
  function attribute(el, name50) {
    const loc = el.sourceCodeLocation?.attrs?.[name50];
    const attr = el.attrs.find((a) => a.name === name50);
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
  const category = (name50) => name50.startsWith("--color-") ? "colour" : name50.startsWith("--space-") ? "spacing" : name50.startsWith("--radius-") ? "radius" : name50.startsWith("--size-") ? "type size" : void 0;
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
    for (const name50 of registered) env.set(name50, null);
    for (const [name50, defs] of roots) env.set(name50, defs.length === 1 ? defs[0] : null);
    for (const [name50, defining] of locals) {
      const own = block?.declarations.filter((d) => d.property === name50) ?? [];
      env.set(name50, block && own.length === 1 && defining.length === 1 && !block.conditional ? { node: own[0].value, part: block.part } : null);
    }
    return env;
  };
  const cycles = (env) => {
    const cyclic = /* @__PURE__ */ new Set(), done = /* @__PURE__ */ new Set();
    const scan = (name50, stack) => {
      if (stack.length > 128) return;
      const at = stack.indexOf(name50);
      if (at >= 0) {
        for (const key of stack.slice(at)) cyclic.add(key);
        return;
      }
      if (done.has(name50)) return;
      const binding = env.get(name50);
      if (!binding) return;
      walk(binding.node, (n) => {
        if (n.type === "Function" && n.name.toLowerCase() === "var") {
          const ref = children2(n)[0];
          if (ref?.type === "Identifier") scan(ref.name, [...stack, name50]);
        }
      });
      done.add(name50);
    };
    for (const name50 of env.keys()) scan(name50, []);
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
    const name50 = identifier.name, binding = env.get(name50);
    if (binding === null) {
      if (report) uncovered("ambiguous-cascade", location(where), `${name50} has selector-dependent or competing declarations; its computed value is unexamined.`);
      return null;
    }
    if (binding && !cyclic.has(name50)) {
      const inherited = binding.part.generated || roots.get(name50)?.some((one) => one.node === binding.node);
      let dependentLocal = false;
      if (inherited) walk(binding.node, (n) => {
        if (n.type !== "Function" || n.name.toLowerCase() !== "var") return;
        const ref = children2(n)[0];
        if (ref?.type === "Identifier" && locals.has(ref.name) && env.get(ref.name)?.node !== exported.get(ref.name)?.node) dependentLocal = true;
      });
      if (dependentLocal) {
        if (report) uncovered("ambiguous-cascade", location(where), `${name50} is inherited and refers to a locally overridden property; its declaration-time value is unexamined.`);
        return null;
      }
      const result = resolve(binding, env, cyclic, property, report, depth + 1, binding.part.generated ? origin ?? value : void 0);
      if (result !== invalidValue) return result?.map((one) => ({ ...one, via: [...one.via ?? [], name50], use: origin ?? value })) ?? null;
    }
    const fallback = args[1]?.type === "Operator" && args[1].value === "," ? args.slice(2) : [];
    if (report) diagnostics.push({
      code: cyclic.has(name50) ? "design/cyclic-variable" : binding ? "design/invalid-variable" : exported.has(name50) ? "design/missing-token-declaration" : "design/missing-variable",
      severity: "warning",
      range: location(where),
      actual: name50,
      property,
      explanation: `${name50} ${cyclic.has(name50) ? "belongs to a custom-property cycle" : binding ? "has an invalid referenced value" : exported.has(name50) ? "is named by DESIGN.md but has no declaration in this artifact; include the governing CSS export (isocan design --css)" : "has no declaration in this artifact\u2019s static scope"}.${fallback.length ? " Its fallback is checked separately." : " No value can be checked."}`,
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
  for (const [name50, binding] of exported) {
    const kind = category(name50);
    if (!kind) continue;
    const resolved = resolve(binding, exportEnv, exportCycles, "", false);
    if (Array.isArray(resolved) && resolved.length === 1) {
      const located = resolved[0], node = located.node;
      palette.get(kind).push({ token: name50, value: normalize(spelling(located), kind) });
      if (kind !== "colour" && !(node.type === "Dimension" && LENGTH_UNITS.test(node.unit) || node.type === "Percentage" || node.type === "Number" && Number(node.value) === 0)) unknownCategories.add(kind);
    } else unknownCategories.add(kind);
  }
  const marker = (el, name50) => el.attrs.find((attr) => attr.name === `data-isocan-${name50}`)?.value;
  const elementRange = (el) => range(el.sourceCodeLocation?.startTag?.startOffset ?? el.sourceCodeLocation?.startOffset ?? 0, el.sourceCodeLocation?.startTag?.endOffset ?? el.sourceCodeLocation?.endOffset ?? 0);
  const markerFinding = (el, name50, explanation) => {
    const loc = el.sourceCodeLocation?.attrs?.[`data-isocan-${name50}`];
    diagnostics.push({ code: `design/unknown-${name50}`, severity: "warning", range: loc ? range(loc.startOffset, loc.endOffset) : elementRange(el), actual: marker(el, name50) ?? "", explanation, candidates: [] });
  };
  const exceptions = /* @__PURE__ */ new Map();
  const marked = elements.filter((el) => ["recipe", "treatment", "exception"].some((name50) => marker(el, name50) !== void 0));
  for (const problem of policy.problems) uncovered("unsupported-policy", range(0, 0), `${problem.path}: ${problem.message}`);
  for (const el of marked) {
    if (!policy.effective) {
      uncovered("unsupported-contract", elementRange(el), "The governing contract version is unsupported; these marker meanings are unexamined.");
      continue;
    }
    const name50 = marker(el, "recipe"), recipe = name50 && Object.prototype.hasOwnProperty.call(policy.effective.recipes, name50) ? policy.effective.recipes[name50] : void 0;
    if (!recipe) {
      markerFinding(el, "recipe", "This element does not name a supported recipe in its governing design.");
      continue;
    }
    const treatment = marker(el, "treatment"), exception = marker(el, "exception");
    if (treatment !== void 0) {
      if (!Object.prototype.hasOwnProperty.call(recipe.treatments, treatment)) markerFinding(el, "treatment", `Unknown treatment ${treatment} for ${name50}.`);
      else policy.appliedTreatments.push({ recipe: name50, name: treatment, range: elementRange(el) });
    }
    if (exception !== void 0) {
      const rule = Object.prototype.hasOwnProperty.call(policy.effective.exceptions, exception) ? policy.effective.exceptions[exception] : void 0;
      if (!rule || rule.recipe !== name50) markerFinding(el, "exception", `Exception ${exception} is not an approved, reasoned exception for ${name50}.`);
      else {
        exceptions.set(el, new Set(rule.properties.flatMap(contractLonghands)));
        policy.appliedExceptions.push({ recipe: name50, name: exception, properties: rule.properties, reason: rule.reason, range: elementRange(el) });
      }
    }
  }
  const exempt = (el, property) => contractLonghands(property).every((name50) => exceptions.get(el)?.has(name50));
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
  const values = (list, kind, property, env, colorShorthand = false) => {
    for (const located of list) {
      const n = located.node, actual = spelling(located);
      if (n.type === "Operator" || n.type === "WhiteSpace" || n.type === "Comment" || n.type === "Url" || n.type === "String") continue;
      if (NEUTRAL.test(actual)) continue;
      if (kind === "colour") {
        if (n.type === "Hash" || n.type === "Identifier" && NAMED_COLOURS.has(n.name.toLowerCase())) {
          note(located, kind, property, env);
          continue;
        }
        if (n.type === "Function") {
          if (COLOUR_FUNCTIONS.test(n.name) && !/[a-z-]+\(/i.test(actual.slice(actual.indexOf("(") + 1))) note(located, kind, property, env);
          else if (/^(?:repeating-)?(?:linear|radial|conic)-gradient$/i.test(n.name)) values(children2(n).map((node) => ({ node, part: located.part })), kind, property, env, true);
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
      if (!expanded || [...expanded].some(([name50, values2]) => values2.some((value) => atom(value, name50) === null))) {
        contractProblem(path, "The owned value or exported variable cannot be statically compared.");
        continue;
      }
      for (const [name50, values2] of expanded) {
        if (expected.has(name50) && expected.get(name50).values.map((one) => atom(one, name50)).join(" ") !== values2.map((one) => atom(one, name50)).join(" ")) contractProblem(path, `Overlapping ownership gives ${name50} competing expected values.`);
        expected.set(name50, { values: values2, rule: property });
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
        const owned = related.some((name50) => expected.has(name50));
        const allowed = (name50) => recipe.allow.some((control) => contractLonghands(control).includes(name50) || control === "margin" && /^margin-(?:top|right|bottom|left)$/.test(name50));
        if (!related.every((name50) => expected.has(name50) || allowed(name50))) diagnostics.push({ code: "design/unapproved-property", severity: "warning", range: location({ node: declaration, part: block.part }), actual: property, property, explanation: `${recipeName} does not declare ${property} as owned styling or an approved caller control.`, candidates: [] });
        if (property === "font" || property === "all" || /^(?:padding|border)-(?:inline|block|start|end)/.test(property)) {
          for (const name50 of expected.keys()) if (property === "all" || property === "font" && name50.startsWith("font-") || property.startsWith("padding") && name50.startsWith("padding") || property.startsWith("border") && name50.includes("radius")) uncertain.add(name50);
          uncovered("unsupported-contract-property", location({ node: declaration, part: block.part }), `The effect of ${property} on owned physical values is unexamined.`);
          continue;
        }
        if (!owned) continue;
        const resolved = resolve({ node: declaration.value, part: block.part }, env, cyclic, property, false);
        const expanded = Array.isArray(resolved) ? expandContractValues(property, resolved, spelling) : null;
        const priority = [declaration.important ? 1 : 0, block.element ? 1 : 0, match.specificity, order, index];
        for (const name50 of related) {
          if (!expected.has(name50)) continue;
          const existing = winning.get(name50);
          if (existing && !higher(priority, existing.priority)) continue;
          const values2 = expanded?.get(name50);
          if (!values2 || values2.some((value) => atom(value, name50) === null)) {
            uncertain.add(name50);
            uncovered("unsupported-contract-value", location({ node: declaration.value, part: block.part }), `The effective ${name50} cannot be compared within the static contract boundary.`);
          } else {
            uncertain.delete(name50);
            winning.set(name50, { values: values2, declaration, block, priority });
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
        const known = [...exported].filter(([name50]) => name50.startsWith("--weight-")).flatMap(([name50, binding]) => {
          const values2 = resolve(binding, exportEnv, exportCycles, property, false);
          return Array.isArray(values2) && values2.length === 1 && atom(values2[0], property) !== null ? [{ name: name50, value: atom(values2[0], property) }] : [];
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
