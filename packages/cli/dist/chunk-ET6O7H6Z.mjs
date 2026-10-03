import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  textProviderFor
} from "./chunk-KQ3WEYIK.mjs";

// packages/core/src/jev.ts
var JEV_URL = "https://api.typesafe.ai/v1/systemone";
var JEV_MODEL = "jev-latest";
var JEV_INPUT_PRICE = 0.042 / 1e6;
function responseProblems(request, body) {
  const res = body;
  if (!res || typeof res !== "object") return ["a response is a JSON object with `answers`"];
  if (res.detail !== void 0) return [`the answerer refused the request: ${detailText(res.detail)}`];
  if (!res.answers || typeof res.answers !== "object") return ["a response has `answers`, one per question"];
  const problems = [];
  const isP = (v) => typeof v === "number" && v >= 0 && v <= 1;
  for (const [id, q] of Object.entries(request.questions)) {
    const a = res.answers[id];
    const where = `answer "${id}"`;
    if (!a || typeof a !== "object") {
      problems.push(`${where} is missing`);
      continue;
    }
    if (a.type !== q.type) {
      problems.push(`${where} must be a ${q.type}, not ${String(a.type)}`);
      continue;
    }
    if (q.type === "noul") {
      if (!isP(a.noul)) problems.push(`${where}: noul must be a number 0\u20131`);
      continue;
    }
    const keys = q.type === "choice" ? Object.keys(q.criteria) : q.criteria.map((_, i) => String(i));
    const probs = a.probabilities;
    if (!probs || typeof probs !== "object") {
      problems.push(`${where}: probabilities are missing`);
      continue;
    }
    for (const [k, v] of Object.entries(probs)) {
      if (!keys.includes(k)) problems.push(`${where}: "${k}" is not one of its options (${keys.join(", ")})`);
      else if (!isP(v)) problems.push(`${where}: probability of "${k}" must be 0\u20131`);
    }
    if (q.type === "choice" && !keys.includes(String(a.choice))) problems.push(`${where}: choice "${String(a.choice)}" is not one of ${keys.join(", ")}`);
    if (q.type === "score" && typeof a.score !== "number") problems.push(`${where}: score must be a number`);
  }
  for (const id of Object.keys(res.answers)) if (!(id in request.questions)) problems.push(`answer "${id}" answers no question`);
  return problems;
}
function readResponse(request, body, from = "the answerer") {
  const problems = responseProblems(request, body);
  if (problems.length > 0) throw new Error(`${from} gave answers this cannot apply:
  ${problems.join("\n  ")}`);
  return body;
}
function detailText(detail) {
  if (Array.isArray(detail)) {
    return detail.map((d) => {
      const e = d;
      return `${(e.loc ?? []).join(".")}: ${e.msg ?? JSON.stringify(d)}`;
    }).join("; ");
  }
  if (detail && typeof detail === "object") {
    const e = detail;
    return e.message ?? e.error_type ?? JSON.stringify(detail);
  }
  return String(detail);
}
function chosenOption(q, a) {
  if (q.type === "noul" && a.type === "noul") {
    const yes = a.noul >= 0.5;
    return { value: yes ? "true" : "false", p: yes ? a.noul : 1 - a.noul, distribution: { true: a.noul, false: 1 - a.noul } };
  }
  if (q.type === "choice" && a.type === "choice") {
    const distribution = Object.fromEntries(Object.keys(q.criteria).map((k) => [k, a.probabilities[k] ?? 0]));
    return { value: a.choice, p: distribution[a.choice] ?? 0, distribution };
  }
  if (q.type === "score" && a.type === "score") {
    const levels = q.criteria.map((_, i) => a.probabilities[String(i)] ?? 0);
    const top = Math.max(...levels);
    let best = 0;
    levels.forEach((p, i) => {
      if (p === top && (levels[best] !== top || Math.abs(i - a.score) < Math.abs(best - a.score))) best = i;
    });
    return { value: q.criteria[best], p: top, distribution: Object.fromEntries(q.criteria.map((c, i) => [c, levels[i]])) };
  }
  throw new Error(`a ${q.type} question answered as ${a.type}`);
}
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 1831565813 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
function stubAnswerer(seed = 1) {
  return {
    name: "stub",
    async answer(request) {
      const answers = {};
      for (const [id, q] of Object.entries(request.questions)) {
        const draw = seeded(seed ^ hash(`${JSON.stringify(request.state)}|${id}`))();
        if (q.type === "noul") {
          answers[id] = { type: "noul", noul: Math.round(draw * 100) / 100 };
        } else if (q.type === "choice") {
          const keys = Object.keys(q.criteria);
          answers[id] = { type: "choice", choice: keys[Math.floor(draw * keys.length)], probabilities: Object.fromEntries(keys.map((k) => [k, 1 / keys.length])), confidence: 0 };
        } else {
          const pick = Math.floor(draw * q.criteria.length);
          answers[id] = { type: "score", score: pick, probabilities: Object.fromEntries(q.criteria.map((_, i) => [String(i), 1 / q.criteria.length])), confidence: 0 };
        }
      }
      return { response: { model: "stub", answers, usage: { input_tokens: 0, output_tokens: 0 } }, ms: 0, by: `stub (seed ${seed})` };
    }
  };
}
function jevAnswerer(opts) {
  const key = opts.key;
  if (!key) throw new Error("the Jev answerer needs TYPESAFE_API_KEY in the environment \u2014 or `--answerer stub` (random, seeded) or `--answerer agent` (answer the questions yourself)");
  const doFetch = opts.fetch ?? fetch;
  const backoff = opts.backoff ?? [500, 1e3, 2e3, 4e3];
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = opts.now ?? (() => Date.now());
  return {
    name: "jev",
    async answer(request) {
      for (let attempt = 0; ; attempt++) {
        const t0 = now();
        const res = await doFetch(JEV_URL, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
          body: JSON.stringify(request)
        });
        const ms = now() - t0;
        if ((res.status === 429 || res.status === 529) && attempt < backoff.length) {
          await sleep(backoff[attempt]);
          continue;
        }
        let body;
        try {
          body = await res.json();
        } catch {
          body = null;
        }
        if (!res.ok) {
          const detail = body?.detail;
          throw new Error(`Jev answered ${res.status}${detail !== void 0 ? `: ${detailText(detail)}` : ""}`);
        }
        const response = readResponse(request, body, "Jev");
        return { response, ms, by: response.model ?? JEV_MODEL };
      }
    }
  };
}
var HOME_HAS_NO_JUDGE = "judgment-unavailable";
function homeAnswerer(post, canvasId, now = () => Date.now()) {
  return {
    name: "home",
    async answer(request) {
      const t0 = now();
      const body = await post({ ...request, canvasId });
      const ms = now() - t0;
      const response = readResponse(request, body, "the home's judge");
      return { response, ms, by: `${response.model ?? JEV_MODEL} via the home` };
    }
  };
}
function isNoJudge(error) {
  return error?.code === HOME_HAS_NO_JUDGE;
}
function homeOrStub(home, stub, onFallback) {
  let fell = false;
  let current = home;
  return {
    get name() {
      return current.name;
    },
    async answer(request) {
      try {
        return await current.answer(request);
      } catch (error) {
        if (!isNoJudge(error)) throw error;
        current = stub;
        if (!fell) {
          fell = true;
          onFallback(error);
        }
        return stub.answer(request);
      }
    }
  };
}
var DEFAULT_ENTROPY_GATE = 1;
var DEFAULT_CONFIDENCE_FLOOR = 0.5;
function entropyBits(probabilities) {
  const raw = Array.isArray(probabilities) ? probabilities : Object.values(probabilities);
  const pos = raw.filter((v) => typeof v === "number" && Number.isFinite(v) && v > 0);
  if (pos.length <= 1) return 0;
  const total = pos.reduce((s, v) => s + v, 0);
  if (total <= 0) return 0;
  let h = 0;
  for (const v of pos) {
    const p = v / total;
    if (p > 0 && p < 1) h -= p * Math.log2(p);
  }
  return Math.round(h * 1e3) / 1e3;
}
function gatedChoice(q, a, opts = {}) {
  const { value, p, distribution } = chosenOption(q, a);
  const entropy = entropyBits(distribution);
  const maxEntropy = opts.maxEntropyBits ?? DEFAULT_ENTROPY_GATE;
  const minConf = opts.minConfidence ?? DEFAULT_CONFIDENCE_FLOOR;
  const topK = opts.topK ?? 3;
  const options = Object.entries(distribution).map(([k, prob]) => ({ value: k, p: Math.round(prob * 1e3) / 1e3 })).sort((x, y) => y.p - x.p || x.value.localeCompare(y.value)).slice(0, topK);
  const uncertain = entropy > maxEntropy || p < minConf;
  if (opts.pinned !== void 0 && Object.prototype.hasOwnProperty.call(distribution, opts.pinned)) {
    const pinnedP = Math.round((distribution[opts.pinned] ?? 0) * 1e3) / 1e3;
    return { status: "pinned", value: opts.pinned, p: pinnedP, entropy, options, uncertain };
  }
  if (uncertain && !opts.noAsk) {
    return { status: "ask", value, p: Math.round(p * 1e3) / 1e3, entropy, options, uncertain: true };
  }
  return { status: "confident", value, p: Math.round(p * 1e3) / 1e3, entropy, options, uncertain };
}
function isTransientJevError(error) {
  const status = error?.status;
  if (status === 429 || status === 529) return true;
  const msg = error instanceof Error ? error.message : String(error);
  return /\b(?:429|529)\b/.test(msg);
}
var PriorityGate = class {
  inner;
  concurrency;
  maxRetries;
  backoffMs;
  sleep;
  active = 0;
  highQueue = [];
  normalQueue = [];
  constructor(innerOrOpts, maybeOpts = {}) {
    const isAnswerer = innerOrOpts !== void 0 && typeof innerOrOpts.answer === "function";
    this.inner = isAnswerer ? innerOrOpts : void 0;
    const opts = isAnswerer ? maybeOpts : innerOrOpts ?? {};
    this.concurrency = Math.max(1, opts.concurrency ?? opts.maxConcurrent ?? 3);
    this.maxRetries = Math.max(0, opts.maxRetries ?? 3);
    const base = opts.baseDelayMs;
    this.backoffMs = opts.backoffMs ?? (base !== void 0 ? [base, base * 2, base * 4] : [200, 500, 1e3]);
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }
  /** Number of currently in-flight calls across both lanes. */
  get inFlight() {
    return this.active;
  }
  /** Number of queued calls waiting for a slot (`high` + `normal`). */
  get pending() {
    return this.highQueue.length + this.normalQueue.length;
  }
  acquire(priority) {
    if (this.active < this.concurrency) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const task = () => {
        this.active++;
        resolve();
      };
      if (priority === "high") this.highQueue.push(task);
      else this.normalQueue.push(task);
    });
  }
  release() {
    this.active--;
    const next = this.highQueue.shift() ?? this.normalQueue.shift();
    if (next) next();
  }
  /** Run an arbitrary async operation through the priority semaphore with transient retry. */
  async run(first, second = "high") {
    const priority = typeof first === "string" ? first : second;
    const fn = typeof first === "function" ? first : second;
    await this.acquire(priority);
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          return await fn();
        } catch (error) {
          if (isTransientJevError(error) && attempt < this.maxRetries) {
            const wait = this.backoffMs[Math.min(attempt, this.backoffMs.length - 1)] ?? 200;
            await this.sleep(wait);
            continue;
          }
          throw error;
        }
      }
    } finally {
      this.release();
    }
  }
  /** Answer a `JevRequest` at the given priority (`"high"` by default). */
  answer(request, priority = "high") {
    if (!this.inner) throw new Error("PriorityGate has no default inner Answerer \u2014 pass one to constructor or use asAnswerer(answerer)");
    return this.run(priority, () => this.inner.answer(request));
  }
  /** View this gate as a standard `Answerer` bound to the given priority lane. */
  asAnswerer(first = "high", second = "high") {
    const target = typeof first === "string" ? this.inner : first;
    const priority = typeof first === "string" ? first : second;
    if (!target) throw new Error("PriorityGate.asAnswerer requires an Answerer");
    const self = this;
    return {
      get name() {
        return target.name;
      },
      answer(request) {
        return self.run(priority, () => target.answer(request));
      }
    };
  }
};
var STOP_WORDS = /* @__PURE__ */ new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "your",
  "app",
  "flow",
  "screen",
  "screens",
  "wireframe",
  "design",
  "generate",
  "write",
  "copy",
  "json",
  "schema"
]);
function promptNouns(prompt) {
  const words = prompt.replace(/[^a-zA-Z0-9\s-]/g, " ").split(/\s+/).map((w) => w.trim()).filter((w) => w.length >= 3 && !STOP_WORDS.has(w.toLowerCase()));
  if (words.length === 0) return ["Acme", "Workspace", "Operations", "Status"];
  const unique = [];
  for (const w of words) {
    const cap = w[0].toUpperCase() + w.slice(1);
    if (!unique.includes(cap)) unique.push(cap);
  }
  return unique.length > 0 ? unique : ["Acme", "Workspace"];
}
function synthesizeFromSchema(schema, prompt, path, seed) {
  const h = hash(`${seed}:${prompt}:${path}:${schema.description ?? ""}`);
  if (schema.enum && schema.enum.length > 0) {
    return schema.enum[h % schema.enum.length];
  }
  switch (schema.type) {
    case "boolean":
      return (h & 1) === 0;
    case "number":
      return h % 90 + 10;
    case "array": {
      const len = schema.minItems ?? schema.maxItems ?? 3;
      const itemSchema = schema.items ?? { type: "string" };
      return Array.from({ length: len }, (_, i) => synthesizeFromSchema(itemSchema, prompt, `${path}.${i}`, seed));
    }
    case "object": {
      const out = {};
      for (const [k, propSchema] of Object.entries(schema.properties ?? {})) {
        out[k] = synthesizeFromSchema(propSchema, prompt, path ? `${path}.${k}` : k, seed);
      }
      return out;
    }
    case "string":
    default: {
      const nouns = promptNouns(prompt);
      const a = nouns[h % nouns.length];
      const b = nouns[(h >>> 3) % nouns.length];
      const leaf = path.split(".").pop() ?? path;
      if (leaf === "brand") return `${a} ${b === a ? "Studio" : b}`;
      if (leaf === "title" || leaf === "heading") return a === b ? `${a} Overview` : `${a} ${b}`;
      if (leaf === "bar") return a;
      if (leaf === "value") return `${h % 900 + 100}`;
      if (leaf === "delta") return `+${h % 18 + 2}%`;
      if (leaf === "status") return ["Active", "Scheduled", "Completed", "In review"][h % 4];
      if (leaf === "label") return a;
      return `${a} ${b.toLowerCase()} ${h % 90 + 10}`;
    }
  }
}
function stubTextGenerator(seed = 1) {
  return {
    name: `stub-text (seed ${seed})`,
    async generateJson(prompt, schema) {
      return synthesizeFromSchema(schema, prompt, "", seed);
    }
  };
}
function httpTextGenerator(opts = {}) {
  const apiKey = opts.apiKey ?? textEnv("ISOCAN_TEXT_API_KEY") ?? "";
  const model = opts.model ?? textEnv("ISOCAN_TEXT_MODEL") ?? "gpt-4o-mini";
  const endpoint = opts.endpoint ?? textEnv("ISOCAN_TEXT_ENDPOINT") ?? "https://api.openai.com/v1/chat/completions";
  const fetchFn = opts.fetch ?? globalThis.fetch;
  return {
    name: model,
    async generateJson(prompt, schema) {
      if (!apiKey) throw new Error("httpTextGenerator requires apiKey or ISOCAN_TEXT_API_KEY");
      const res = await fetchFn(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "Return only valid JSON conforming to the provided JSON schema." },
            { role: "user", content: prompt }
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: "wire_response", strict: true, schema }
          }
        })
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`TextGenerator HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }
      const body = await res.json();
      const text = body.choices?.[0]?.message?.content;
      if (!text) throw new Error("TextGenerator returned an empty response");
      return JSON.parse(text);
    }
  };
}
function textEnv(name) {
  const value = globalThis.process?.env?.[name];
  return value?.trim() || void 0;
}
var CLAUDE_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
var CLAUDE_TEXT_MODEL = "claude-opus-5-5";
var CLAUDE_TEXT_EFFORT = "low";
var CLAUDE_FALLBACK_BETA = "server-side-fallback-2026-07-01";
function claudeSchema(schema) {
  const out = { type: schema.type };
  if (schema.description !== void 0) out.description = schema.description;
  if (schema.enum !== void 0) out.enum = schema.enum;
  if (schema.type === "object") {
    const properties = {};
    for (const [key, value] of Object.entries(schema.properties ?? {})) properties[key] = claudeSchema(value);
    out.properties = properties;
    if (schema.required !== void 0) out.required = schema.required;
    out.additionalProperties = false;
  }
  if (schema.type === "array") {
    if (schema.items !== void 0) out.items = claudeSchema(schema.items);
    if (schema.minItems === 0 || schema.minItems === 1) out.minItems = schema.minItems;
  }
  return out;
}
function claudeTextGenerator(opts = {}) {
  const apiKey = opts.apiKey ?? textEnv("ISOCAN_TEXT_API_KEY") ?? "";
  const model = opts.model ?? textEnv("ISOCAN_TEXT_MODEL") ?? CLAUDE_TEXT_MODEL;
  const endpoint = opts.endpoint ?? textEnv("ISOCAN_TEXT_ENDPOINT") ?? CLAUDE_MESSAGES_URL;
  const fetchFn = opts.fetch ?? globalThis.fetch;
  const scrub = (text) => apiKey ? text.split(apiKey).join("[key]") : text;
  return {
    name: model,
    async generateJson(prompt, schema) {
      if (!apiKey) throw new Error("claudeTextGenerator requires apiKey or ISOCAN_TEXT_API_KEY");
      let res;
      try {
        res = await fetchFn(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-beta": CLAUDE_FALLBACK_BETA
          },
          body: JSON.stringify({
            model,
            max_tokens: 16e3,
            fallbacks: "default",
            system: "You write the words on an app's screens: labels, headings, buttons, sample content. Answer with the JSON the schema asks for and nothing else.",
            messages: [{ role: "user", content: prompt }],
            output_config: {
              effort: CLAUDE_TEXT_EFFORT,
              format: { type: "json_schema", schema: claudeSchema(schema) }
            }
          })
        });
      } catch (error) {
        throw new Error(scrub(`Claude could not be reached: ${error.message}`));
      }
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(scrub(`TextGenerator HTTP ${res.status}: ${errText.slice(0, 200)}`));
      }
      const body = await res.json();
      if (body.stop_reason === "refusal") {
        const why = body.stop_details?.category ? ` (${body.stop_details.category})` : "";
        throw new Error(`Claude declined to write these words${why}`);
      }
      if (body.stop_reason === "max_tokens") throw new Error("Claude ran out of room before the words were finished");
      const text = (body.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
      if (!text) throw new Error("TextGenerator returned an empty response");
      return JSON.parse(text);
    }
  };
}
function textProvider(apiKey = textEnv("ISOCAN_TEXT_API_KEY"), named = textEnv("ISOCAN_TEXT_PROVIDER")) {
  return textProviderFor(apiKey, named);
}
function envTextGenerator(opts = {}) {
  const apiKey = opts.apiKey ?? textEnv("ISOCAN_TEXT_API_KEY");
  const provider = opts.provider ?? textProvider(apiKey);
  const shared = { ...apiKey !== void 0 ? { apiKey } : {}, ...opts.model !== void 0 ? { model: opts.model } : {}, ...opts.fetch ? { fetch: opts.fetch } : {} };
  return provider === "anthropic" ? claudeTextGenerator(shared) : httpTextGenerator(shared);
}
function homeTextGenerator(post, canvasId) {
  let by = "the home's text model";
  return {
    get name() {
      return by;
    },
    async generateJson(prompt, schema) {
      const body = await post({ canvasId, prompt, schema });
      if (!body || typeof body !== "object" || !("value" in body)) throw new Error("the home's text model answered without a value");
      if (typeof body.model === "string" && body.model) by = `${body.model} via the home`;
      return body.value;
    }
  };
}
var TEXT_UNAVAILABLE = "text-unavailable";
function isNoTextModel(error) {
  return error?.code === TEXT_UNAVAILABLE;
}
function homeTextOrStub(home, stub, onFallback) {
  let fell = false;
  let current = home;
  return {
    get name() {
      return current.name;
    },
    async generateJson(prompt, schema) {
      try {
        return await current.generateJson(prompt, schema);
      } catch (error) {
        if (!isNoTextModel(error)) throw error;
        current = stub;
        if (!fell) {
          fell = true;
          onFallback(error);
        }
        return stub.generateJson(prompt, schema);
      }
    }
  };
}

export {
  JEV_URL,
  JEV_MODEL,
  JEV_INPUT_PRICE,
  responseProblems,
  readResponse,
  chosenOption,
  seeded,
  stubAnswerer,
  jevAnswerer,
  homeAnswerer,
  isNoJudge,
  homeOrStub,
  DEFAULT_ENTROPY_GATE,
  DEFAULT_CONFIDENCE_FLOOR,
  entropyBits,
  gatedChoice,
  PriorityGate,
  stubTextGenerator,
  httpTextGenerator,
  CLAUDE_MESSAGES_URL,
  CLAUDE_TEXT_MODEL,
  CLAUDE_TEXT_EFFORT,
  claudeSchema,
  claudeTextGenerator,
  textProvider,
  envTextGenerator,
  homeTextGenerator,
  TEXT_UNAVAILABLE,
  homeTextOrStub
};
