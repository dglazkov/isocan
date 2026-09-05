---
status: built
since: 2026-09-04
see: harnesses, on-demand, standing-agents
note: built 4 Sep 2026 — pi, codex and antigravity (on a Gemini API key; the server fetched from Google on first use) join claude-code as a harness the rc can run without config; an agent that named no harness runs on the machine's default, which the rc finds by scanning what is installed and asks for once when there is a real choice; `isocan harness` prints the scan.
---
# Harnesses — the journey

**4 September 2026.** One journey, in the form
[on-demand's](../on-demand/journey.md) set: what you experience, with the
mechanism bending to it. Shaped in conversation the same day, and built.

**You** do your day in [pi](https://github.com/earendil-works/pi). Your
credentials are for OpenAI or Google, and Claude Code may not be installed
on this machine at all. Your project directory holds pi's own settings: a
default model, a couple of skills, an extension.

## Journey 1 — Your agent runs on your harness

*You never tell isocan which harness you use, and your agents run on it anyway.*

1. `isocan rc` in a terminal. One word, no flags. Nothing spawns. The rc
   says, in one line, which harness an agent that named none runs on
   here: *pi is the only harness here*.
2. Add Percy by whichever door is nearest: *Add an agent* in the web app,
   or `isocan rc add Percy` in the terminal. You name no harness.
3. Comment on an item: `@Percy the empty state reads wrong`. The rc
   narrates *starting pi for Percy in ~/work/app*. Percy answers on your
   model, with your directory's pi skills and extensions loaded, and
   replies on the thread as Percy.
4. A second comment a day later resumes the same pi conversation. Percy
   remembers the first one.
5. `isocan who` says Percy stands on pi. If pi is not installed where the
   rc runs, the rc says so on the summoning thread and in its own log,
   with the install line.

**Acceptance:** No flag names a harness at any step. Whatever door an
agent is enrolled through, it runs on the harness you run. pi's
per-directory settings apply without isocan knowing they exist. A summons
resumes the same conversation. A missing pi is refused where you are
looking, never as a silent start on Claude Code.

## Journey 2 — Two harnesses on one machine

*Asked once, where somebody can answer.*

1. You have both pi and Claude Code installed. `isocan rc`, with an agent
   enrolled and no harness named: the rc lists the two and asks which such
   agents run on. You answer once; the answer is kept in
   `~/.isocan/config.json` as `defaultHarness`.
2. The same start under launchd, with no terminal to ask: the rc refuses
   and names `isocan rc --default-harness <name>`, which answers and keeps
   the answer the same way.
3. Any agent may still name its own: `isocan rc add Sian --harness
   claude-code` beside Percy on pi, one rc answering for both.
4. `isocan harness` prints the same scan for you or for an agent: each
   harness isocan knows, whether it is installed, where the rc would get
   its bridge, whether it could run here, and which is the default.

**Acceptance:** A decision is asked for only when one is needed — an
enrolled agent with no harness named — and only where somebody can answer.
The scan is never kept, only the choice: the day a second harness is
installed, the rc notices. A kept choice whose harness has since gone is
set aside out loud.

## Decisions

- **Null means the machine's default, not Claude Code.** Two of the three
  enrolment doors (the web dialog, a plain terminal) cannot name a harness;
  the third (an agent enrolling an agent) inherits its own. The first
  build had null mean claude-code, which made a pi user's web-added agent a
  Claude Code agent, or a boot failure, with nothing saying why.
- **Discovered, not declared.** The machine scans for the harness's own
  executable (`pi`, `claude`, `codex`) rather than reading a setting; an
  adapter declared in config is believed as declared. One runnable harness
  is the default without a word.
- **pi's shells carry pi's own session variable** beside the rc's
  injection, unlike the Claude adapter's. Reads already chose the bound
  key; the claim path now prefers the deliberate `ISOCAN_SESSION_ID` over
  an ambient one, or the guide's first step (`identity --session`) minted
  a stranger on pi's key. This also means an agent launched from a shell
  where a person exported `ISOCAN_SESSION_ID` resumes that person's actor —
  what "deliberate beats ambient" already promised.
- **The rc-level flag is `--default-harness`, not `--harness`**, because
  Commander lets a parent's option swallow a subcommand's: `rc add Sian
  --harness fake` was enrolling Sian with none.
- **"No default" is never said.** The first walk (4 Sep, this machine)
  printed *2 harnesses here and no default — `--default-harness` picks…;
  nothing enrolled here needs one yet*, and the person reading it asked
  what "no default" meant. It names a config key. The lines now say what
  the choice is for — *an agent added without naming one can't run until
  … picks which* — and when nothing needs it, only the fact: *every agent
  enrolled here named its own*, with the flag kept for the refusal.
- **codex runs with its sandbox off.** Its default mode ran a shell and
  wrote a file without asking, but refused loopback network, so the CLI
  inside could not reach the daemon. The builtin bridge sets
  `INITIAL_AGENT_MODE=agent-full-access`: the trust the rc already extends
  by auto-allowing every permission, said in codex's words. Anyone who
  wants the sandbox declares the adapter in config.json without it, and
  accepts an agent that cannot speak to the canvas.
- **Antigravity, on a key.** Google's official ACP server exists as a
  per-platform zip, not on npm, and keeps a login of its own; its Google
  login refused this account as ineligible, and the first reading was "not
  worth it" ([research/2026-09-04-antigravity-acp.md](../../research/2026-09-04-antigravity-acp.md)).
  Revisited the same evening: the server's `gemini-api-key` method reads
  `GEMINI_API_KEY` from its environment and skips the eligibility gate,
  and the user's word was that a metered key is a valid way to use
  Antigravity. So: the one builtin fetched from Google rather than by
  `npx` (into `~/.isocan/adapters/antigravity/<version>/`, narrated, once),
  and the ACP client learned the `authenticate` step — a refusal for want
  of a login is answered with a method the environment can satisfy, or
  fails naming the variable. Installed means the server is in the home:
  neither `agy` on the PATH nor the IDE implies it.
- **Builtins are registry ids** (5 Sep). The first Antigravity build
  typed five dl.google.com URLs and a version into `harnesses.ts`, stale
  the day Google bumped the entry, and the Claude builtin was pinned to a
  package npm has since deprecated in favour of a renamed one. The ACP
  registry publishes a hosted index (refreshed hourly) that is the
  official path every client walks, so a builtin now names its registry
  id and nothing else: resolution reads the index cached in the home
  (refreshed at spawn when older than an hour), `npx -y <package@version>`
  for an npm entry, a binary fetched once into
  `~/.isocan/adapters/<id>/<version>/` for an archive one. A pin of the
  index as of that day serves only a machine that has never reached it.
- **Adapter stderr is filtered, not silenced** (4 Sep, from the Antigravity
  walk). Google's server logs at absl INFO/WARNING for every websocket
  message and cannot be told not to; the client drops those lines and
  passes errors and everything else, with `ISOCAN_ADAPTER_STDERR=all` for
  the day the chatter is the clue.
- **Not built:** choosing a model per agent.

## An open finding, not this project's to close

The first `isocan rc add` on a canvas homed at dev was refused as *this
badge does not speak for* the person running it. Nothing in harnesses: the
canvas had been born on this machine's daemon, a *Bring your own agent*
pass had handed the machine its person there, and the canvas was later
moved home to dev. The handoff was a claim on the old home's desk; a
replica vouches agents to its home and never the machine's own person;
teleport carries the canvas and not that standing; and `setup` refuses,
rightly, to overwrite a machine's existing person with a handed one, so
even a fresh pass leaves the CLI acting as the leftover id. The refusal
sends the person to `identity --session`, the agents' verb. Three fixes
were named, any of which closes it: teleport carrying the person to the
new home; the replica vouching the machine's person as it does agents;
`setup` offering to make a handed identity this machine's default. The
identity desk's call. That is pi's per-directory
  settings file in the agent's working directory, not an isocan flag.
