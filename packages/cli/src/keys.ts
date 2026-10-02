import type { Command } from "commander";
import type { KeyProvider } from "@isocan/core/keys";
import type { KeyFile } from "@isocan/core/keystore";
import { paths } from "@isocan/server";
import { printJson, printTable } from "./output.ts";

/**
 * **`isocan keys` — model keys in one place on this machine** (keys phase 1;
 * `docs/projects/keys/design.md`).
 *
 * `~/.isocan/keys.json` (0600) holds one key per provider; the daemon's judge
 * and text model, the CLI's own Jev and text generators and the voice harness
 * read it per call, with the environment winning. This verb is the file's
 * hands: `ls`, `set`, `rm`, `test`. It needs no daemon — the file is this
 * machine's, and a daemon that is running picks a change up on its next call.
 *
 * **Write-only.** Nothing here prints a key: `ls` shows the last four, `test`
 * scrubs the provider's answer, and `set` reads the value from stdin or a
 * hidden prompt — never argv, which is shell history.
 *
 * The store and the registry are imported when a verb RUNS, not when the CLI
 * starts: `isocan --version` loads under forty modules (`cli-bundle.test.ts`),
 * and two chunks for a verb most runs never touch would spend that.
 */

/** The providers, spelled for help text before the registry is loaded; `keys.test.ts` holds it to `KEY_PROVIDERS`. */
export const KEYS_HELP_PROVIDERS = "anthropic, openai, gemini, typesafe";
const providerList = KEYS_HELP_PROVIDERS;

const load = async () => ({ ...(await import("@isocan/core/keys")), ...(await import("@isocan/core/keystore")) });
type Loaded = Awaited<ReturnType<typeof load>>;

function providerOf(k: Loaded, raw: string): KeyProvider {
  const name = raw.trim().toLowerCase();
  if (!k.isKeyProvider(name)) throw new Error(`no provider called "${raw}" — the providers are ${k.KEY_PROVIDERS.join(", ")}`);
  return name;
}

/** The home keys.json lives in: the daemon's (`ISOCAN_HOME`, else `~/.isocan`), so a key set here is the one the daemon reads. */
function home(): string {
  return paths.isocanHome();
}

/** All of stdin, when it is piped. */
async function readPiped(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

/** A prompt that echoes nothing: the characters typed or pasted go to the key and nowhere else. */
function promptHidden(question: string): Promise<string> {
  const stdin = process.stdin;
  process.stderr.write(question);
  return new Promise((resolve, reject) => {
    let value = "";
    const done = (err?: Error) => {
      stdin.off("data", onData);
      stdin.setRawMode?.(false);
      stdin.pause();
      process.stderr.write("\n");
      if (err) reject(err);
      else resolve(value);
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n" || ch === "\u0004") return done();
        if (ch === "\u0003") return done(new Error("cancelled — nothing was stored"));
        if (ch === "\u007f" || ch === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        value += ch;
      }
    };
    stdin.setRawMode?.(true);
    stdin.setEncoding("utf8");
    stdin.resume();
    stdin.on("data", onData);
  });
}

/** One provider's row, as `ls` shows it and as `--json` returns it. Never a value. */
export interface KeyRow {
  provider: KeyProvider;
  label: string;
  stored: boolean;
  lastFour: string | null;
  addedAt: string | null;
  model: string | null;
  /** The environment variable that overrides the file, when one is set. */
  env: { variable: string; lastFour: string } | null;
  /** Which key a spender uses now: the environment's, the file's, or none. */
  inUse: "env" | "file" | null;
  usedFor: string[];
}

function keyRows(k: Loaded, stored: KeyFile, env: Record<string, string | undefined>): KeyRow[] {
  return k.KEY_PROVIDERS.map((provider) => {
    const entry = stored[provider];
    const fromEnv = k.envKeyFor(provider, env);
    return {
      provider,
      label: k.KEY_PROVIDER_INFO[provider].label,
      stored: !!entry,
      lastFour: entry ? k.lastFour(entry.key) : null,
      addedAt: entry?.addedAt || null,
      model: entry?.model ?? null,
      env: fromEnv ? { variable: fromEnv.variable, lastFour: k.lastFour(fromEnv.key) } : null,
      inUse: fromEnv ? "env" : entry ? "file" : null,
      usedFor: k.KEY_PROVIDER_INFO[provider].usedFor,
    };
  });
}

export function registerKeys(program: Command): void {
  const keys = program
    .command("keys")
    .description("Model keys on this machine (~/.isocan/keys.json): ls, set, rm, test — never shown, env wins")
    .addHelpText(
      "after",
      `
One key per provider — ${providerList} — in ~/.isocan/keys.json, mode 0600.
Everything on this machine that spends a key reads it per call: the daemon's
judge (typesafe) and text model (anthropic, else openai), the CLI's own
wireframe answers and copy, and the voice harness (gemini). No restart.

The environment wins: TYPESAFE_API_KEY, ISOCAN_TEXT_API_KEY (with
ISOCAN_TEXT_PROVIDER / ISOCAN_TEXT_MODEL) and GEMINI_API_KEY override the
file, so CI and hosted homes are unchanged. \`ls\` says when one does.

A key is never printed: \`ls\` shows the last four characters. \`set\` reads
the key from stdin when piped, or a hidden prompt — never from the command
line, which your shell keeps in its history.

  isocan keys                                  # the same as ls
  pbpaste | isocan keys set anthropic          # or: isocan keys set anthropic, then paste
  isocan keys test anthropic                   # one cheap call: accepted, or why not
  isocan keys rm gemini`,
    );

  keys
    .command("ls", { isDefault: true })
    .description("Each provider: set or not, its last four characters, when it was added, what uses it, and whether the environment overrides it")
    .action(async (_opts: unknown, cmd: Command) => {
      const k = await load();
      const file = k.keysFile(home());
      let stored: KeyFile = {};
      let refused: string | null = null;
      try {
        stored = k.readKeysSync(home());
      } catch (err) {
        refused = (err as Error).message;
      }
      const rows = keyRows(k, stored, process.env);
      if (cmd.optsWithGlobals().json) {
        printJson({ file, ...(refused ? { refused } : {}), keys: rows });
      } else {
        printTable(
          rows.map((r) => ({
            provider: r.provider,
            key: r.stored ? r.lastFour! : "not set",
            added: r.addedAt ? r.addedAt.slice(0, 10) : "",
            env: r.env ? `${r.env.variable} ${r.env.lastFour} overrides` : "",
            "used for": r.usedFor.join("; "),
          })),
        );
        console.log(`\n${file}`);
      }
      if (refused) {
        console.error(refused);
        process.exitCode = 1;
      }
    });

  keys
    .command("set <provider> [value...]")
    .description("Store a provider's key — from stdin when piped, else a hidden prompt; never from the command line")
    .option("--model <model>", "the model this provider's spenders ask (the text model's; ISOCAN_TEXT_MODEL still wins)")
    .action(async (raw: string, value: string[] | undefined, opts: { model?: string }, cmd: Command) => {
      const k = await load();
      const provider = providerOf(k, raw);
      if (value && value.length > 0) {
        throw new Error(
          `refusing a key on the command line — it is in your shell's history now, so rotate it, and nothing was stored. Pipe it in (\`pbpaste | isocan keys set ${provider}\`) or run \`isocan keys set ${provider}\` and paste it at the prompt`,
        );
      }
      const typed = process.stdin.isTTY ? await promptHidden(`${k.KEY_PROVIDER_INFO[provider].label} key (not shown): `) : await readPiped();
      const key = typed.trim();
      if (!key) throw new Error(`no key given for ${provider} — nothing was stored`);
      const file = await k.writeKey(home(), provider, key, opts.model);
      const overridden = k.envKeyFor(provider, process.env);
      if (cmd.optsWithGlobals().json) {
        printJson({ provider, stored: true, lastFour: k.lastFour(key), file, ...(overridden ? { overriddenBy: overridden.variable } : {}) });
        return;
      }
      console.log(`${provider}: stored ${k.lastFour(key)} in ${file}`);
      if (overridden) console.log(`note: ${overridden.variable} is set in this environment and wins over the stored key`);
    });

  keys
    .command("rm <provider>")
    .description("Remove a provider's stored key")
    .action(async (raw: string, _opts: unknown, cmd: Command) => {
      const k = await load();
      const provider = providerOf(k, raw);
      const removed = await k.removeKey(home(), provider);
      if (cmd.optsWithGlobals().json) return printJson({ provider, removed });
      console.log(removed ? `${provider}: removed` : `${provider}: no stored key — nothing to remove`);
      const env = k.envKeyFor(provider, process.env);
      if (env) console.log(`note: ${env.variable} is still set in this environment, so ${provider} still has a key here`);
    });

  keys
    .command("test <provider>")
    .description("One cheap call with the key spenders would use now (env, else stored): accepted, or the provider's reason")
    .action(async (raw: string, _opts: unknown, cmd: Command) => {
      const k = await load();
      const provider = providerOf(k, raw);
      const found = k.resolveKey(provider, { home: home() });
      if (!found) throw new Error(`no ${provider} key here — \`isocan keys set ${provider}\``);
      const which = found.source === "env" ? `${found.variable} ${k.lastFour(found.key)}` : `stored ${k.lastFour(found.key)}`;
      const result = await k.checkKey(provider, found.key);
      if (cmd.optsWithGlobals().json) printJson({ provider, key: which, ...result });
      else console.log(result.ok ? `${provider}: accepted (${which})` : `${provider}: refused (${which}) — ${result.answer}`);
      if (!result.ok) process.exitCode = 1;
    });
}
