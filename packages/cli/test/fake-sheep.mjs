// A scripted `sheep` for the sheep harness's integration tests: the verbs
// the rc runs, answered from a JSON state file, with every call recorded —
// argv, working directory, stdin, and exit code — so a test can assert what
// the rc asked, where it asked it, and what never appeared in an argument.
//
// FAKE_SHEEP_STATE names the state file; calls go to `<state>.calls`, one
// JSON line each, appended, because the rc reads the transcript while a turn
// runs and two processes must not rewrite one file. Only the verbs that
// change state write it, and by rename, so a reader never sees half of it.
// A turn appends a tool call and a reply to the sheep's transcript, the way
// pi's entries look in `sheep log --json`, so the rc's tool beats have
// something to read.
//
// `new --secret NAME` (repeatable) reads one line of stdin per name, as
// sheep does since sheep#5, keeps the values in `sheepSecrets` by sheep id
// (never printed, and dropped by `rm`), and lists the names in `ls --json`'s
// `secrets`. `new --detach` with no prompt only mints: no transcript entries.
// A row carries `setup`, as sheep does since sheep#4: `null` until the
// sheep's first turn, then `ok`. `attach --json` writes each of the turn's
// entries as a line as it lands, as sheep does since sheep#7, the last
// assistant entry last; without `--json` only the reply's text is written.
//
// Four switches live in the state file itself, so a test sets them before
// anything runs: `attachMs` makes a turn take that long, with the sheep
// "busy" meanwhile; a turn under a sheep that is ended exits 1, and one
// stopped by `abort` exits 0, which is what a real attach did when a
// station's `sheep abort` stopped it (walked 11 Sep 2026); `newMs` makes a
// birth take that long, with `minting` set in the state meanwhile; `oldHome`
// answers `rm` the way a station deployed before sheep's end verb does ("not
// found" for a sheep it has). The current home's answer to an id it does not
// have is its own sentence, and both are exit 2. `noSheepSecrets` answers
// `new --secret` the way a `sheep` or a home from before sheep#5 does: the
// sheep is minted, exit 0, stdin is never read, and its row has no
// `secrets` field.
import { appendFileSync, readFileSync, renameSync, writeFileSync } from "node:fs";

const file = process.env.FAKE_SHEEP_STATE;
const load = () => {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return { sessions: [], pastures: {}, entries: {}, next: 1 };
  }
};
let state = load();
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
/** Every value of a repeatable flag, in order, before any `--`. */
const flags = (name) => {
  const end = argv.indexOf("--") === -1 ? argv.length : argv.indexOf("--");
  return argv.slice(0, end).flatMap((a, i) => (a === name ? [argv[i + 1]] : []));
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
// Recorded, then out — after stdout and stderr have drained, because a pipe
// is asynchronous on macOS and an exit can cut a write short.
const finish = async (code, message) => {
  if (message) await new Promise((resolve) => process.stderr.write(`${message}\n`, resolve));
  await new Promise((resolve) => process.stdout.write("", resolve));
  call.exit = code;
  appendFileSync(`${file}.calls`, `${JSON.stringify(call)}\n`);
  process.exit(code);
};
const [verb, sub] = argv;
/** The one positional after the verb, for `rm` and `abort`. */
const target = () => argv.slice(1).find((a) => !a.startsWith("--"));
const find = (id) => state.sessions.find((s) => s.id === id);

if (verb === "ls") {
  const pasture = flag("--pasture");
  const rows = state.sessions.filter((s) => pasture === undefined || s.pasture === pasture);
  if (argv.includes("--json")) process.stdout.write(`${JSON.stringify(rows)}\n`);
  else for (const s of rows) process.stdout.write(`${s.id}\t${s.name ?? ""}\t\t${s.state}\t${s.pasture ?? ""}\t${(s.secrets ?? []).join(",")}\n`);
} else if (verb === "pasture" && sub === "ls") {
  for (const name of Object.keys(state.pastures)) process.stdout.write(`${name}\t2026-09-10T00:00:00.000Z\n`);
} else if (verb === "pasture" && sub === "new") {
  state.pastures[argv[2]] = { tree: {}, secrets: {} };
  save();
} else if (verb === "pasture" && sub === "put") {
  call.stdin = await stdin();
  state.pastures[argv[2]].tree[argv[3]] = call.stdin;
  save();
} else if (verb === "pasture" && sub === "secret" && argv[2] === "set") {
  call.stdin = await stdin();
  state.pastures[argv[3]].secrets[argv[4]] = call.stdin.trim();
  save();
} else if (verb === "new") {
  const names = state.noSheepSecrets ? [] : flags("--secret");
  let values = [];
  if (names.length > 0) {
    if (!argv.includes("--detach") && after() === undefined) {
      await finish(2, "sheep: pi's terminal needs stdin, and a secret is read from it: with --secret, pass --detach or a prompt after --");
    }
    call.stdin = await stdin();
    values = call.stdin.split("\n");
    if (call.stdin.endsWith("\n")) values.pop();
    if (values.length !== names.length) {
      await finish(2, `sheep: one line of stdin per --secret name, in order: ${names.length} names, ${values.length} lines`);
    }
  }
  if (state.newMs) {
    state.minting = true;
    save();
    await new Promise((resolve) => setTimeout(resolve, state.newMs));
    state = load();
    delete state.minting;
  }
  const id = `s_${state.next++}`;
  const row = { id, name: flag("--name") ?? null, pasture: flag("--pasture") ?? null, createdAt: Date.now(), state: "idle", task: null, setup: null };
  if (!state.noSheepSecrets) row.secrets = [...names].sort();
  state.sessions.unshift(row);
  if (names.length > 0) {
    state.sheepSecrets ??= {};
    state.sheepSecrets[id] = Object.fromEntries(names.map((name, i) => [name, values[i]]));
  }
  // With a prompt, the turn it starts; `--detach` with none only mints.
  if (after() !== undefined) {
    entry(id, "user", after());
    entry(id, "assistant", [{ type: "text", text: "ready" }]);
  }
  save();
  process.stdout.write(`${id}\n`);
} else if (verb === "attach") {
  const id = argv[argv.indexOf("--") - 1];
  if (!find(id)) await finish(2, `sheep: no session ${id}`);
  if (state.attachMs) {
    // A turn that takes a while: busy while it runs, and stopped with no
    // reply when `rm` (exit 1) or `abort` (exit 0) lands under it.
    find(id).state = "busy";
    save();
    const until = Date.now() + state.attachMs;
    while (Date.now() < until) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      state = load();
      if (!find(id)) await finish(1, "sheep: the session ended");
      if (find(id).state !== "busy") await finish(0, "");
    }
    state = load();
    find(id).state = "idle";
  }
  const json = argv.includes("--json");
  const land = (e) => {
    if (json) process.stdout.write(`${JSON.stringify(e)}\n`);
  };
  // The first turn in a fresh sheep is where its pasture's setup runs.
  if (find(id).setup === null) find(id).setup = { state: "ok", at: Date.now(), ms: 1 };
  land(entry(id, "user", after() ?? ""));
  land(entry(id, "assistant", [{ type: "toolCall", id: "t1", name: "bash", arguments: { command: 'isocan comment reply th_1 "on it"' } }]));
  land(entry(id, "assistant", [{ type: "text", text: "on it" }]));
  save();
  if (!json) process.stdout.write("on it\n");
} else if (verb === "rm") {
  const id = target();
  const sheep = find(id);
  if (state.oldHome) await finish(2, sheep ? "sheep: not found" : "sheep: unknown session");
  if (!sheep) await finish(2, `sheep: no session ${id} at this home; \`sheep ls\` lists the ones there are`);
  const aborted = sheep.state === "busy";
  state.sessions = state.sessions.filter((s) => s.id !== id);
  delete state.entries[id];
  if (state.sheepSecrets) delete state.sheepSecrets[id];
  save();
  process.stdout.write(argv.includes("--json") ? `${JSON.stringify({ id, ended: true, aborted })}\n` : `${id}\tended\n`);
} else if (verb === "abort") {
  const id = target();
  const sheep = find(id);
  if (!sheep) await finish(2, "sheep: unknown session");
  if (sheep.state === "busy") {
    sheep.state = "idle";
    save();
    process.stdout.write(`${id}\taborted op_1\n`);
  } else {
    process.stdout.write(`${id}\tidle\n`);
  }
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
  await finish(2, `fake sheep: unknown ${argv.join(" ")}`);
}
await finish(0);
