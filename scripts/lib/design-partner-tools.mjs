/** The study's only agent tools: real pinned CLI, contained files, owned browser and human-routed questions. */
import { promises as fs } from "node:fs";
import path from "node:path";
import { studyHash, studyJson, studyPath, studyProcess } from "./design-partner-runtime.mjs";
import { startStudyProxy, studyNetworkRequest } from "./design-partner-proxy.mjs";

export const STUDY_TOOLS = Object.freeze([
  { name: "cli", description: "Run the actual isocan CLI for this canvas. Read --agent-help and ordinary command resources on demand. No shell, provider launch or other home is available.", inputSchema: { type: "object", additionalProperties: false, required: ["args"], properties: { args: { type: "array", minItems: 1, items: { type: "string" } } } } },
  { name: "read_file", description: "Read a task workspace file, including CONTEXT.json and the ordinary collaboration doorway.", inputSchema: { type: "object", additionalProperties: false, required: ["path"], properties: { path: { type: "string" } } } },
  { name: "write_file", description: "Write an owned task file. Canvas changes still use ordinary isocan operations; proposed local files do not update the canvas.", inputSchema: { type: "object", additionalProperties: false, required: ["path", "content"], properties: { path: { type: "string" }, content: { type: "string" } } } },
  { name: "list_files", description: "List contained task files. No evaluator answer bank, scoring or condition key is available.", inputSchema: { type: "object", additionalProperties: false, properties: { path: { type: "string" } } } },
  { name: "review_phase", description: "Mark any final review or finding-driven repair you elect to perform. One initial review and at most two repair rounds are available in this run. finish may explicitly report that no review occurred. These markers do not attest quality or replace real isocan review records.", inputSchema: { type: "object", additionalProperties: false, required: ["phase", "reason"], properties: { phase: { enum: ["review", "repair", "finish"] }, reason: { type: "string" } } } },
  { name: "browser", description: "Inspect the actual owned Chrome page. Use navigate, snapshot, click, fill, key, resize or screenshot. Only task files and the fixed connected fixture runtime are available. Read and change canvas state through cli; the interactive canvas UI is unavailable in this isolated browser. Screenshots do not establish task success.", inputSchema: { type: "object", additionalProperties: false, required: ["action"], properties: { action: { enum: ["navigate", "snapshot", "click", "fill", "key", "resize", "screenshot"] }, url: { type: "string" }, selector: { type: "string" }, text: { type: "string" }, key: { type: "string" }, width: { type: "integer" }, height: { type: "integer" } } } },
  { name: "question", description: "Ask the person a real question. An evaluator explicitly maps it to a frozen fact or records another disposition. When a typed canvas question was published, include its exact source: the evaluator must answer it as the person. The same agent session waits; no answering model or semantic matching is used.", inputSchema: { type: "object", additionalProperties: false, required: ["text"], properties: { text: { type: "string" }, canvasQuestion: { type: "object", additionalProperties: false, required: ["threadId", "commentId", "questionId"], properties: { threadId: { type: "string" }, commentId: { type: "string" }, questionId: { type: "string" } } } } } },
]);
const closed = (value, keys) => { if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw new Error("Unsupported tool arguments"); };
const forbidden = /^(?:--(?:home|direct|port|canvas|agent|identity|harness|root|token|pass|url|endpoint|config|model|provider|budget|hosted|cloud|watch|wait|loop)(?:=|$)|-c$)/;
const roots = new Set(["--help", "--agent-help", "whoami", "ls", "show", "cat", "add", "edit", "text", "set", "mv", "delete", "rm", "undo", "redo", "versions", "context", "comment", "notify", "design", "area", "canvas", "command", "commands", "align", "size", "rename", "activity"]);
const designs = new Set(["--help", "--css", "--tokens", "show", "css", "tokens", "set", "import", "check", "audit", "repair", "workflow", "start", "brief", "receipt", "ask", "questions", "answer", "reference", "recipes", "recipe", "direction", "project", "reconcile", "compare", "respond", "decide", "review", "craft"]);
const fileOptions = new Set(["--out", "--file", "--visual", "--from-audit", "--design", "--html", "--from", "--input", "--directory", "--check", "--package", "--update", "--resume", "--cancel", "--complete", "--publish", "--reference", "--references", "--application", "--context", "--start", "--record", "--offer-verifier"]);

/** Preflight the file references consumed by the shipped CLI asset inliner.
 * This never rewrites authored bytes or fetches a URL. Markdown uses the same
 * remark syntax tree as the real inliner; HTML/CSS follows its source forms.
 * Every transitive local file is checked before the ordinary CLI may read it.
 */
async function containedInlineInputs(filename, workspace, seen = new Set(), documentBase = path.dirname(filename)) {
  if (seen.has(filename)) return; seen.add(filename);
  let bytes; try { if (!(await fs.stat(filename)).isFile()) return; bytes = await fs.readFile(filename); } catch (error) { if (error.code === "ENOENT") return; throw error; }
  if (bytes.length > 2_097_152 || seen.size > 200) throw new Error("Authored asset graph exceeds the bounded task input");
  const extension = path.extname(filename).toLowerCase();
  const body = bytes.toString("utf8"), refs = [];
  if ([".md", ".markdown"].includes(extension)) {
    const [{ unified }, { default: remarkParse }] = await Promise.all([import("unified"), import("remark-parse")]);
    const tree = unified().use(remarkParse).parse(body), images = [], definitions = new Map();
    const visit = node => { if (node.type === "definition" && !definitions.has(node.identifier)) definitions.set(node.identifier, node); if (["image", "imageReference"].includes(node.type)) images.push(node); node.children?.forEach(visit); }; visit(tree);
    for (const node of images) { const target = node.type === "imageReference" ? definitions.get(node.identifier) : node; if (target?.url) refs.push(target.url); }
  } else {
    // The actual inliner consumes quoted src/poster, linked stylesheets,
    // CSS url(), and image paths in JavaScript string literals.
    for (const match of body.matchAll(/\b(?:src|poster|href)\s*=\s*(["'])(.*?)\1/gi)) refs.push(match[2]);
    for (const match of body.matchAll(/\burl\(\s*(["']?)(.*?)\1\s*\)/gi)) refs.push(match[2]);
    for (const match of body.matchAll(/(["'`])([^"'`\n\r]+\.(?:png|jpg|jpeg|webp|svg|gif|avif))(?:\?[^"'`\n\r]*)?\1/gi)) refs.push(match[2]);
  }
  for (const raw of refs) {
    const ref = raw.trim(); if (!ref || /^(?:https?:|data:|blob:|\/\/|#)/i.test(ref)) continue;
    const literal = ref.split(/[?#]/)[0]; let decoded = literal; try { decoded = decodeURIComponent(literal); } catch { /* Match the inliner's literal fallback. */ }
    // Stylesheet/script tags use literal filenames; image resolution also
    // tries decoded URI paths. Check both without reading either outside.
    for (const relative of new Set([literal, decoded])) {
      if (!relative) continue;
      if (path.isAbsolute(relative) || relative.split(/[\\/]/).some(part => part === "..")) throw new Error("Inline asset leaves the contained task files");
      // Injected CSS/scripts are examined again at the original HTML base.
      for (const base of new Set([path.dirname(filename), documentBase])) {
        const candidate = await studyPath(workspace, path.relative(workspace, path.resolve(base, relative)), { missing: true });
        await containedInlineInputs(candidate, workspace, seen, documentBase);
      }
    }
  }
}

/** Argument validation binds real CLI IO to this workspace and rejects alternate homes or provider launch. */
export async function studyCliArguments(args, config) {
  if (!Array.isArray(args) || !args.length || args.length > 80 || args.some(arg => typeof arg !== "string" || arg.includes("\0") || arg.length > 262144)) throw new Error("Invalid CLI argument vector");
  if (!roots.has(args[0]) || args.some(arg => forbidden.test(arg))) throw new Error("CLI call leaves the owned canvas/tool boundary");
  if (["command", "commands"].includes(args[0]) && args[1] && !["list", "show", "--help", "--json"].includes(args[1])) throw new Error("Command resources are read-only; installation and remote fetching are unavailable");
  if (args.some(arg => path.isAbsolute(arg) || arg.split(/[\\/]/).includes(".."))) throw new Error("CLI arguments cannot name outside paths");
  if (args[0] === "canvas" && !["group", "--help"].includes(args[1])) throw new Error("Only scoped canvas group commands are available; canvas screenshot browsers are outside this profile");
  if (args[0] === "design" && args[1] && args[1] !== "--json" && !designs.has(args[1])) throw new Error("Unknown or provider-running design command");
  if (args.some(arg => /^--(?:session|run)(?:=|$)/.test(arg)) && !(args[0] === "design" && args[1] === "review")) throw new Error("Only the real review command accepts its run/session fields");
  if (config.condition === "B" && args[0] === "design" && args[1] === "craft") throw new Error("This run does not include the optional guidance condition");
  const result = [...args], positions = new Set();
  if (args[0] === "add") positions.add(1);
  if (args[0] === "edit") positions.add(2);
  if (args[0] === "design" && ["start", "set", "import", "ask", "direction", "decide", "respond", "project", "reconcile"].includes(args[1]) && args[2] && !args[2].startsWith("-")) positions.add(2);
  if (args[0] === "design" && args[1] === "repair") positions.add(3);
  for (let index = 1; index < args.length; index++) {
    if (fileOptions.has(args[index]) && !(args[0] === "design" && args[1] === "recipe" && args[index] === "--design")) { if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error("Missing contained CLI file path"); positions.add(index + 1); }
    if (args[index].startsWith("--") && args[index].includes("=") && fileOptions.has(args[index].split("=")[0])) throw new Error("Use a separate contained path argument");
    if (!args[index].startsWith("-") && /^[\w./-]+$/.test(args[index])) {
      try { await fs.lstat(path.join(config.workspace, args[index])); await studyPath(config.workspace, args[index]); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
    }
  }
  for (const index of positions) {
    if (!args[index] || args[index] === "-") throw new Error("CLI file IO requires a named task file");
    if (/(^|\/)(?:\.agents|\.claude|\.isocan|node_modules|\.git)(?:\/|$)/.test(args[index]) || ["repo/server.mjs", "repo/package.json"].includes(args[index])) throw new Error("CLI file options cannot replace owned configuration or the fixed backend");
    result[index] = await studyPath(config.workspace, args[index], { missing: true });
    await containedInlineInputs(result[index], await fs.realpath(config.workspace));
    // These JSON files are public workflow intents, not an alternate network
    // capability. Exact artifacts must still belong to the one owned home/canvas.
    if (args[index].endsWith(".json")) {
      let value;
      try { value = JSON.parse(await fs.readFile(result[index], "utf8")); } catch (error) { if (error.code === "ENOENT" || error instanceof SyntaxError) continue; throw error; }
      const visit = node => {
        if (!node || typeof node !== "object") return;
        for (const [key, value] of Object.entries(node)) {
          if (key === "canvasId" && value !== config.canvasId) throw new Error("Workflow file names another canvas");
          const unavailableCitation = key === "url" && node.state === "inaccessible" && typeof node.reason === "string" && node.reason.trim() && config.mapping?.unavailableReferences?.some(ref => ref.url === value && ref.state === "inaccessible");
          if (["home", "url", "runtimeUrl", "baseUrl"].includes(key) && typeof value === "string" && /^https?:/.test(value) && new URL(value).origin !== config.base && new URL(value).origin !== config.repositoryUrl && !unavailableCitation) throw new Error("Workflow file names an outside source/runtime");
          visit(value);
        }
      };
      visit(value);
    }
  }
  return result;
}

/** Browser requests are restricted independently from navigation, including subresources and redirects. */
export async function studyBrowserUrl(raw, config) {
  if (raw.startsWith("task:")) { await studyPath(config.workspace, raw.slice(5)); return raw; }
  const url = new URL(raw);
  studyNetworkRequest(url.href, "GET", config, null);
  return url.href;
}

/** Real tools are pluggable only at the owned browser/process capability; canned tests cannot become quality evidence. */
export async function createStudyTools(config, { openBrowser = null } = {}) {
  let browser = null, proxy = null, sequence = 0; const eventFile = path.join(config.evidence, "tools.jsonl");
  await fs.mkdir(config.evidence, { recursive: true }); await fs.mkdir(config.questions, { recursive: true });
  let previous = [];
  try { previous = (await fs.readFile(eventFile, "utf8")).trim().split("\n").filter(Boolean).map(line => JSON.parse(line)); } catch (error) { if (error.code !== "ENOENT") throw error; }
  sequence = previous.at(-1)?.sequence ?? 0;
  let reviewed = previous.some(row => row.kind === "review-phase" && row.phase === "review"), repairs = previous.filter(row => row.kind === "review-phase" && row.phase === "repair").length, finished = previous.some(row => row.kind === "review-phase" && row.phase === "finish");
  const record = async value => { const row = { ...value, at: new Date().toISOString(), sequence: ++sequence }; await fs.appendFile(eventFile, JSON.stringify(row) + "\n"); return row; };
  const remaining = () => { const time = Date.parse(config.deadline) - Date.now(); if (!(time > 0)) throw new Error("Global run deadline reached"); return time; };
  async function getBrowser() {
    remaining(); if (browser) return browser;
    proxy = await startStudyProxy(config, denial => record({ kind: "browser-request-refused", ...denial }));
    const factory = openBrowser ?? (await import("./browser.mjs")).browser; browser = await factory({ proxyServer: proxy.origin });
    const version = await browser.send("Browser.getVersion");
    if (config.expectedBrowserVersion && version.product.split("/").at(-1) !== config.expectedBrowserVersion) throw new Error("Actual browser version differs from frozen native profile");
    await record({ kind: "browser-initialized", version }); return browser;
  }
  async function perform(name, input) {
    remaining(); const spec = STUDY_TOOLS.find(tool => tool.name === name); if (!spec) throw new Error("Unknown study tool");
    closed(input, Object.keys(spec.inputSchema.properties));
    if ((spec.inputSchema.required ?? []).some(key => input[key] === undefined)) throw new Error("Missing required tool argument");
    const started = await record({ kind: "tool-start", name, input });
    try {
      let result;
      if (name === "review_phase") {
        if (!["review", "repair", "finish"].includes(input.phase) || typeof input.reason !== "string" || !input.reason.trim() || input.reason.length > 4000) throw new Error("A review phase needs an explicit bounded reason");
        if (finished || input.phase === "review" && reviewed || input.phase === "repair" && (!reviewed || repairs >= 2)) throw new Error("This run's review/repair budget is unavailable");
        if (input.phase === "review") reviewed = true;
        if (input.phase === "repair") repairs++;
        if (input.phase === "finish") finished = true;
        await record({ kind: "review-phase", ...input, reviewed, repairRounds: repairs });
        result = { reviewed, repairRounds: repairs, remainingRepairs: 2 - repairs, finished, attestation: false };
      } else if (name === "read_file") {
        const filename = await studyPath(config.workspace, input.path), stat = await fs.stat(filename);
        if (!stat.isFile() || stat.size > 2_097_152) throw new Error("Task file is unavailable or too large");
        const bytes = await fs.readFile(filename), mimeType = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? "image/png" : bytes[0] === 255 && bytes[1] === 216 ? "image/jpeg" : bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP" ? "image/webp" : bytes.subarray(0, 3).toString() === "GIF" ? "image/gif" : null;
        result = { path: input.path, sha256: studyHash(bytes), ...(mimeType ? { image: { mimeType, data: bytes.toString("base64") } } : { content: bytes.toString("utf8") }) };
      } else if (name === "write_file") {
        if (typeof input.content !== "string" || Buffer.byteLength(input.content) > 2_097_152 || /(^|\/)(?:\.agents|\.claude|\.isocan|node_modules|\.git)(?:\/|$)/.test(input.path) || ["repo/server.mjs", "repo/package.json"].includes(input.path)) throw new Error("Unsupported task write; owned configuration and the supplied backend remain fixed");
        const filename = await studyPath(config.workspace, input.path, { missing: true }); await fs.mkdir(path.dirname(filename), { recursive: true });
        await fs.writeFile(filename, input.content); result = { path: input.path, sha256: studyHash(input.content) };
      } else if (name === "list_files") {
        const directory = input.path ? await studyPath(config.workspace, input.path) : config.workspace;
        result = (await fs.readdir(directory, { withFileTypes: true })).filter(entry => !entry.isSymbolicLink()).map(entry => ({ name: entry.name, kind: entry.isDirectory() ? "directory" : "file" }));
      } else if (name === "cli") {
        const args = await studyCliArguments(input.args, config);
        const env = { PATH: process.env.PATH, HOME: process.env.HOME, ISOCAN_HOME: config.home, ISOCAN_DIRECT: config.base, ISOCAN_DEFAULT_HOME_URL: "", ISOCAN_HARNESS: "claude", ISOCAN_SESSION_ID: config.sessionId };
        result = await studyProcess(process.execPath, [path.join(config.source, "packages/cli/bin/isocan.js"), "--canvas", config.canvasId, ...args], { cwd: config.workspace, env, milliseconds: Math.min(30_000, remaining()) });
      } else if (name === "question") {
        if (typeof input.text !== "string" || !input.text.trim() || input.text.length > 16000) throw new Error("Question must contain the actual bounded text");
        const questionId = studyHash(`${config.runId}/${started.sequence}/${input.text}`), filename = path.join(config.questions, `${questionId}.json`);
        if (input.canvasQuestion !== undefined) { closed(input.canvasQuestion, ["threadId", "commentId", "questionId"]); if (!["threadId", "commentId", "questionId"].every(key => typeof input.canvasQuestion[key] === "string" && input.canvasQuestion[key])) throw new Error("Incomplete canvas question source"); }
        const question = { schemaVersion: 1, kind: "design-partner-question", runId: config.runId, fixtureId: config.fixtureId, questionId, text: input.text, canvasQuestion: input.canvasQuestion ?? null, askedAt: started.at, state: "awaiting-evaluator" };
        await fs.writeFile(filename, studyJson(question), { flag: "wx" });
        while (true) {
          remaining();
          try { const answer = JSON.parse(await fs.readFile(filename + ".answer", "utf8")); if (answer.questionId !== questionId || answer.runId !== config.runId || typeof answer.answer !== "string") throw new Error("Mismatched evaluator answer"); result = { questionId, answer: answer.answer, disposition: answer.disposition, answeredAt: answer.answeredAt }; break; }
          catch (error) { if (error.code !== "ENOENT") throw error; }
          await new Promise(resolve => setTimeout(resolve, Math.min(250, remaining())));
        }
      } else if (name === "browser") {
        const b = await getBrowser();
        if (input.action === "navigate") { const url = await studyBrowserUrl(input.url, config); const destination = url.startsWith("task:") ? proxy.fileUrl(url.slice(5)) : url; await b.send("Page.navigate", { url: destination }); const { until } = await import("./browser.mjs"); await until(b, `location.href === ${JSON.stringify(destination)} && document.readyState === "complete"`, "owned task navigation", Math.min(5000, remaining())); result = { navigated: input.url }; }
        else if (input.action === "resize") { if (![input.width, input.height].every(n => Number.isInteger(n) && n >= 200 && n <= 3000)) throw new Error("Unsupported viewport"); await b.send("Emulation.setDeviceMetricsOverride", { width: input.width, height: input.height, deviceScaleFactor: 1, mobile: false }); result = { viewport: { width: input.width, height: input.height } }; }
        else if (input.action === "snapshot") result = await b.ev('({url:location.href,title:document.title,text:document.body?.innerText,viewport:{width:innerWidth,height:innerHeight},scrollWidth:document.documentElement.scrollWidth,activeId:document.activeElement?.id,controls:Array.from(document.querySelectorAll("button,input,select,textarea,a")).map(e=>({tag:e.tagName,id:e.id,name:e.getAttribute("name"),label:e.getAttribute("aria-label")||e.textContent,value:e.value,disabled:e.disabled,checked:e.checked}))})');
        else if (input.action === "screenshot") { const bytes = Buffer.from((await b.send("Page.captureScreenshot", { format: "png" })).data, "base64"), filename = `browser-${started.sequence}.png`; await fs.writeFile(path.join(config.evidence, filename), bytes, { flag: "wx" }); result = { path: filename, sha256: studyHash(bytes), image: { mimeType: "image/png", data: bytes.toString("base64") }, page: await b.ev('({url:location.href,viewport:{width:innerWidth,height:innerHeight}})'), screenshotOnly: true }; }
        else if (["click", "fill"].includes(input.action)) {
          if (typeof input.selector !== "string" || input.selector.length > 1000) throw new Error("Expected a bounded observed selector");
          const point = await b.ev(`(()=>{const e=document.querySelector(${JSON.stringify(input.selector)});if(!e)throw Error('Control missing');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;if(!r.width||!r.height||!e.contains(document.elementFromPoint(x,y)))throw Error('Control covered');return{x,y}})()`);
          for (const type of ["mousePressed", "mouseReleased"]) await b.send("Input.dispatchMouseEvent", { type, ...point, button: "left", clickCount: 1 });
          if (input.action === "fill") { if (typeof input.text !== "string") throw new Error("Expected text"); await b.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: process.platform === "darwin" ? 4 : 2, commands: ["selectAll"] }); await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA" }); await b.send("Input.insertText", { text: input.text }); }
          result = { action: input.action, selector: input.selector };
        } else if (input.action === "key") {
          // Native key metadata is necessary for Chrome's default actions such
          // as form submission, focus traversal, selection and character edits.
          const definitions = { Enter: ["Enter", 13, "\r"], Tab: ["Tab", 9, null], Escape: ["Escape", 27, null], ArrowUp: ["ArrowUp", 38, null], ArrowDown: ["ArrowDown", 40, null], ArrowLeft: ["ArrowLeft", 37, null], ArrowRight: ["ArrowRight", 39, null], Backspace: ["Backspace", 8, null], " ": ["Space", 32, " "] };
          const definition = definitions[input.key]; if (!definition) throw new Error("Unsupported interaction key");
          const [code, windowsVirtualKeyCode, text] = definition, key = { key: input.key, code, windowsVirtualKeyCode };
          await b.send("Input.dispatchKeyEvent", { type: text === null ? "rawKeyDown" : "keyDown", ...key, ...(text === null ? {} : { text, unmodifiedText: text }) });
          await b.send("Input.dispatchKeyEvent", { type: "keyUp", ...key }); result = { key: input.key };
        }
        else throw new Error("Unknown browser action");
      }
      const logged = result?.image ? { ...result, image: { mimeType: result.image.mimeType, sha256: studyHash(Buffer.from(result.image.data, "base64")), bytes: Buffer.from(result.image.data, "base64").length, deliveredAs: "MCP image content" } } : result;
      await record({ kind: "tool-result", name, startSequence: started.sequence, result: logged }); return result;
    } catch (error) { await record({ kind: "tool-error", name, startSequence: started.sequence, error: error.message }); throw error; }
  }
  // One native MCP instance owns the workspace. Keep validation and actual
  // CLI consumption in the same ordered interval so a parallel write cannot
  // replace a checked file. Questions never hold this IO queue; the separate
  // evaluator's real human CLI can answer while the native session waits.
  let pendingIO = Promise.resolve();
  const invoke = (name, input) => {
    const captured = structuredClone(input);
    if (!["cli", "read_file", "write_file", "list_files", "browser"].includes(name)) return perform(name, captured);
    const operation = pendingIO.then(() => perform(name, captured));
    pendingIO = operation.then(() => undefined, () => undefined);
    return operation;
  };
  return { invoke, async close() { await browser?.close(); await proxy?.close(); } };
}

/** Preserve actual image bytes as native MCP image content while keeping their exact identity in text. */
export function studyToolContent(result) {
  const { image, ...metadata } = result && typeof result === "object" && !Array.isArray(result) ? result : { value: result };
  return [{ type: "text", text: JSON.stringify(metadata) }, ...(image ? [{ type: "image", mimeType: image.mimeType, data: image.data }] : [])];
}

/** Only an explicit evaluator fact ID can produce a bank answer; repeats and unmapped questions remain recorded.
 * @param {{corpus: any, questionFile: string, evaluatorId: string, factId?: string|null, disposition?: string, reason?: string|null, responseFile?: string|null, runtimeConfigFile?: string|null}} input
 */
export async function answerStudyQuestion({ corpus, questionFile, factId = null, evaluatorId, disposition = "mapped", reason = null, responseFile = null, runtimeConfigFile = null }) {
  const question = JSON.parse(await fs.readFile(questionFile, "utf8"));
  if (question.kind !== "design-partner-question" || !evaluatorId?.trim() || !["mapped", "repeated", "unmapped", "declined"].includes(disposition)) throw new Error("Explicit evaluator disposition is required");
  const task = corpus.tasks.find(task => task.id === question.fixtureId), fact = task?.answerBank.find(fact => fact.id === factId);
  if (["mapped", "repeated"].includes(disposition) && !fact) throw new Error("Evaluator mapping names no frozen fact");
  if (["unmapped", "declined"].includes(disposition) && (!reason?.trim() || factId !== null)) throw new Error("Unmapped/declined questions require an explicit reason, not a guessed answer");
  let canvasResponse = null;
  if (question.canvasQuestion) {
    if (!responseFile || !runtimeConfigFile) throw new Error("This typed question needs the evaluator's explicit response file through the actual person's CLI");
    const bytes = await fs.readFile(responseFile), supplied = JSON.parse(bytes), response = supplied.response ?? supplied;
    const source = question.canvasQuestion;
    if (response.question?.threadId !== source.threadId || response.question?.commentId !== source.commentId || !response.resolutions?.some(row => row.questionId === source.questionId)) throw new Error("Explicit human response does not answer this exact published source");
    const runtime = JSON.parse(await fs.readFile(runtimeConfigFile, "utf8"));
    if (runtime.runId !== question.runId) throw new Error("Question and actual runtime belong to different attempts");
    const result = await studyProcess(process.execPath, [path.join(runtime.source, "packages/cli/bin/isocan.js"), "--canvas", runtime.canvasId, "design", "answer", "--file", path.resolve(responseFile), "--json"], { cwd: runtime.workspace, env: { PATH: process.env.PATH, HOME: process.env.HOME, ISOCAN_HOME: runtime.home, ISOCAN_DIRECT: runtime.base, ISOCAN_DEFAULT_HOME_URL: "", ISOCAN_HARNESS: "cli", ISOCAN_SESSION_ID: "study-person" }, milliseconds: 30_000 });
    const receipt = JSON.parse(result.stdout);
    if (result.code !== 0 || receipt.status !== "accepted") throw new Error("Actual human questionnaire response is not confirmed; leave the question waiting");
    canvasResponse = { source, response, responseSha256: studyHash(bytes), receipt };
  }
  const answer = { schemaVersion: 1, runId: question.runId, questionId: question.questionId, askedAt: question.askedAt, answeredAt: new Date().toISOString(), evaluatorId, factId, disposition, answer: fact?.answer ?? `No additional fact supplied: ${reason}`, reason, canvasResponse };
  await fs.writeFile(questionFile + ".answer", studyJson(answer), { flag: "wx" }); return answer;
}
