// A scripted `sheep` for the sheep harness's integration tests: the verbs
// the rc runs, answered from a JSON state file, with every call recorded —
// argv, working directory, and stdin — so a test can assert what the rc
// asked, where it asked it, and what never appeared in an argument.
//
// FAKE_SHEEP_STATE names the state file; calls go to `<state>.calls`, one
// JSON line each, appended, because the rc reads the transcript while a turn
// runs and two processes must not rewrite one file. Only the verbs that
// change state write it, and by rename, so a reader never sees half of it.
// A turn appends a tool call and a reply to the sheep's transcript, the way
// pi's entries look in `sheep log --json`, so the rc's tool beats have
// something to read.
import { appendFileSync, readFileSync, renameSync, writeFileSync } from "node:fs";

const file = process.env.FAKE_SHEEP_STATE;
const load = () => {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return { sessions: [], pastures: {}, entries: {}, next: 1 };
  }
};
const state = load();
const save = () => {
  writeFileSync(`${file}.${process.pid}`, JSON.stringify(state, null, 2));
  renameSync(`${file}.${process.pid}`, file);
};
const argv = process.argv.slice(2);
const stdin = async () => {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  return text;
};
const flag = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
};
const after = () => {
  const i = argv.indexOf("--");
  return i === -1 ? undefined : argv.slice(i + 1).join(" ");
};
const entry = (sheep, role, content) => {
  const list = (state.entries[sheep] ??= []);
  const e = { type: "message", id: `e${list.length + 1}`, timestamp: Date.now(), message: { role, content } };
  list.push(e);
  return e;
};

const call = { argv, cwd: process.cwd() };
const [verb, sub] = argv;
const reads = verb === "ls" || verb === "log" || (verb === "pasture" && sub === "ls");

if (verb === "ls") {
  const pasture = flag("--pasture");
  const rows = state.sessions.filter((s) => pasture === undefined || s.pasture === pasture);
  if (argv.includes("--json")) process.stdout.write(`${JSON.stringify(rows)}\n`);
  else for (const s of rows) process.stdout.write(`${s.id}\t${s.name ?? ""}\t\tidle\t${s.pasture ?? ""}\n`);
} else if (verb === "pasture" && sub === "ls") {
  for (const name of Object.keys(state.pastures)) process.stdout.write(`${name}\t2026-09-10T00:00:00.000Z\n`);
} else if (verb === "pasture" && sub === "new") {
  state.pastures[argv[2]] = { tree: {}, secrets: {} };
} else if (verb === "pasture" && sub === "put") {
  call.stdin = await stdin();
  state.pastures[argv[2]].tree[argv[3]] = call.stdin;
} else if (verb === "pasture" && sub === "secret" && argv[2] === "set") {
  call.stdin = await stdin();
  state.pastures[argv[3]].secrets[argv[4]] = call.stdin.trim();
} else if (verb === "new") {
  const id = `s_${state.next++}`;
  state.sessions.unshift({ id, name: flag("--name") ?? null, pasture: flag("--pasture") ?? null, createdAt: Date.now(), state: "idle", task: null });
  entry(id, "user", after() ?? "");
  entry(id, "assistant", [{ type: "text", text: "ready" }]);
  process.stdout.write(`${id}\n`);
} else if (verb === "attach") {
  const id = argv[argv.indexOf("--") - 1];
  if (!state.sessions.some((s) => s.id === id)) {
    process.stderr.write(`sheep: no session ${id}\n`);
    appendFileSync(`${file}.calls`, `${JSON.stringify(call)}\n`);
    process.exit(2);
  }
  entry(id, "user", after() ?? "");
  entry(id, "assistant", [{ type: "toolCall", id: "t1", name: "bash", arguments: { command: 'isocan comment reply th_1 "on it"' } }]);
  entry(id, "assistant", [{ type: "text", text: "on it" }]);
  process.stdout.write("on it\n");
} else if (verb === "log") {
  const id = argv.at(-1);
  let list = state.entries[id] ?? [];
  const since = flag("--since");
  const last = flag("--last");
  if (since !== undefined) {
    const i = list.findIndex((e) => e.id === since);
    list = i === -1 ? list.filter((e) => e.timestamp >= Date.parse(since)) : list.slice(i + 1);
  }
  if (last !== undefined) list = list.slice(-Number(last));
  for (const e of list) process.stdout.write(`${JSON.stringify(e)}\n`);
} else {
  process.stderr.write(`fake sheep: unknown ${argv.join(" ")}\n`);
  appendFileSync(`${file}.calls`, `${JSON.stringify(call)}\n`);
  process.exit(2);
}
if (!reads) save();
appendFileSync(`${file}.calls`, `${JSON.stringify(call)}\n`);
