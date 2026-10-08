import guideText from "../agent-guide.md";
import type { CoreModule } from "@isocan/core";
import type { CliHost, CliModule } from "@isocan/cli/modulehost";
import { KEEP_EMOJI, wireframeModule } from "./record.ts";
import { WIRE_COMMAND, WIRE_PROPERTY_KEYS } from "./wire-command.ts";

/**
 * **Wireframes from the terminal** — the agent's hands on the same catalog
 * and the same renderer the web app would use.
 *
 * `wire "<request>"` is phase 1's: a flow composed in three rounds by an
 * answerer (Jev, the stub, or an agent through `wire questions|answer`),
 * skeleton first and filled in place — `compose-cli.ts`.
 *
 * `wire render` is the phase-0 act: a spec in, a screen out, as ONE
 * `item.add` of an ordinary HTML file with the spec inside it. Nothing new
 * reaches the wire, so undo, versions, comments and presence already work on
 * a screen; take this module away and every screen still renders — only
 * these verbs are gone. `wire spec` and `wire catalog` exist so an agent can
 * write a valid spec without reading this module's source.
 *
 * All action implementations live behind a single `await import("./cli-runtime.ts")`
 * so `isocan --version` and non-wireframe commands never pay to load the
 * wireframe catalog, 24 content packs, or renderer at startup.
 */

function dispatch(host: CliHost, subcommand: string) {
  return host.run(async (...args: unknown[]) => {
    const { executeWire } = await import("./cli-runtime.ts");
    await executeWire(host, subcommand, args);
  });
}

function register(host: CliHost): void {
  const wire = host.program
    .command("wire")
    .description("Wireframes: `wire \"<request>\"` composes a flow of screens from a catalog of blocks — a blue blueprint where a slot is undecided, grey where it is chosen")
    .argument("[request...]", "what the screens are for, in words — composes a flow")
    .option("--answerer <name>", "jev (needs TYPESAFE_API_KEY), home (Jev through the canvas's home, with its key), stub (random, seeded) or agent (you answer: `wire questions` / `wire answer`) — default jev when the key is set, else the home, else the stub")
    .option("--seed <n>", "the stub's seed", "1")
    .option("--save <dir>", "write each round's requests and responses there as JSON")
    .option("--canvas <canvas>")
    .option("--at <x,y>", "start the row at world coordinates (default: under everything on the canvas)")
    .option("--in <group>", "compose the flow inside this group — and in its design system, if it has one")
    .option("--basic", "plain grey wires: no sample content and no prototype (the default fleshes the screens and puts the answerer's first choices in a prototype)")
    .option("--flesh", "arrive fleshed — the default now; kept so older scripts still run")
    .option("--pack <id>", "the content pack to flesh with, instead of asking (`wire flesh --packs` lists them)")
    .option("--pin <key=value...>", "pin root flow decisions up front (for example: --pin platform=web --pin density=compact)")
    .option("--no-ask", "suppress high-entropy root /ask prompts and pick top-1 silently")
    .action(dispatch(host, ""));

  wire
    .command("vary <screen>")
    .description("Add a screen's variations under it — each flips the least certain remaining decision to its runner-up, from the distribution the answerer already gave")
    .option("--canvas <canvas>")
    .option("--count <n>", "how many variations the screen should have in all (default 2)")
    .action(dispatch(host, "vary"));

  wire
    .command("keep <items...>")
    .description(`Use screens in the prototype (${KEEP_EMOJI}) — a property on the item, as a slide is, so anyone can take it off. \`wire use\` says the same`)
    .option("--canvas <canvas>")
    .action(dispatch(host, "keep"));

  wire
    .command("unkeep <items...>")
    .description(`Take screens out of the prototype (${KEEP_EMOJI}) — anyone's mark, not only your own. \`wire unuse\` says the same`)
    .option("--canvas <canvas>")
    .action(dispatch(host, "unkeep"));

  wire
    .command("kept")
    .description(`List the screens in the prototype (${KEEP_EMOJI}) in reading order — rows top to bottom, each left to right`)
    .option("--canvas <canvas>")
    .option("--prototype <item>", "only the screens this prototype plays, in its order — its flow's screens in the prototype and any guest from another flow (what selecting it lights on the canvas)")
    .action(dispatch(host, "kept"));

  wire
    .command("links [screen]")
    .description("Print where every hotspot on the screens in the prototype goes — inferred from intents, archetypes and reading order, and any override set with `wire link`")
    .option("--canvas <canvas>")
    .option("--flow <flow>", "which flow's prototype (default: the only one)")
    .action(dispatch(host, "links"));

  wire
    .command("link <screen> <element> [target]")
    .description("Override where one hotspot goes: to a screen, or --none to switch it off; --clear gives it back to the rules. A property on the source screen")
    .option("--canvas <canvas>")
    .option("--none", "the hotspot goes nowhere")
    .option("--back", "the hotspot goes back, whatever the rules say")
    .option("--clear", "forget the override — the rules decide again")
    .action(dispatch(host, "link"));

  wire
    .command("prototype")
    .description("Assemble the screens in the prototype (📐) as one clickable HTML item above them — rebuilt, it gains a version rather than being replaced")
    .option("--canvas <canvas>")
    .option("--flow <flow>", "which flow's prototype (default: the only one)")
    .action(dispatch(host, "prototype"));

  wire
    .command("style")
    .description("Restyle every wire in the design system that governs it — Jev maps the system's tokens onto the wire's roles, once per system version; one op group, a version per changed wire. --preset <name> chooses a named wire style for the flows (material, shadcn, glass, ios, fluent, carbon, brutalist, a design-competition pack, or house for the greys); --list names them; --default restores the greys; --check lists wires behind their system")
    .argument("[screens...]", "only these screens' flows (ids, titles or #refs) — every wire when none")
    .option("--canvas <canvas>")
    .option("--preset <name>", "a wire style: its DESIGN.md placed beside the flow and made its group's (or the canvas's) design system, and the flow restyled — one op group; house returns to the greys and lets the style's file go")
    .option("--list", "write nothing: name the wire styles --preset takes, and say which cannot be read here")
    .option("--default", "back to the default wire look (the greys)")
    .option("--check", "write nothing: list the wires that are behind the system that governs them")
    .option("--flow <flow>", "only this flow's screens and their variations")
    .action(dispatch(host, "style"));

  wire
    .command("ds [request...]")
    .description("Synthesize a WCAG AA contrast-repaired DESIGN.md with Jev, make it govern the flow's scope, and restyle all screens and prototype in one op group")
    .option("--canvas <canvas>")
    .option("--flow <flow>", "only this flow's screens")
    .option("--name <name>", "explicit name for the synthesized design system")
    .option("--surface <surface>", "override surface mode: flat | raised | glass | bold")
    .action(dispatch(host, "ds"));

  wire
    .command("polish [screens...]")
    .description("Apply Jev-budgeted visual refinement patches (0 | 4 | 8 | 12) guarded by verifyWireContract in one op group")
    .option("--canvas <canvas>")
    .option("--flow <flow>", "only this flow's screens")
    .option("--intensity <n>", "override polish_intensity (0–1)")
    .option("--clear", "remove polish patches from target screens")
    .action(dispatch(host, "polish"));

  wire
    .command("layer [directive] [screens...]")
    .description("Check or uncheck non-destructive fidelity layers (`+system`, `-system`, `+copy`, `-copy`, `+lofi`, `-lofi`, `+hifi`, `-hifi`) or jump between the 4 fidelity tiers (`wire`, `system`, `lofi`, `hifi`) in one op group; with no directive or --list, prints each screen's active layers")
    .option("--canvas <canvas>")
    .option("--flow <flow>", "only this flow's screens")
    .option("--list", "write nothing: print each wireframe screen's active fidelity layers and tier")
    .action(dispatch(host, "layer"));

  wire
    .command("flesh [screens...]")
    .description("Fill wires with sample content instead of grey bars — Jev picks one content pack per flow from its request (p recorded; --pack <id> overrides); one op group, a version per changed wire. --bars goes back to bars")
    .option("--canvas <canvas>")
    .option("--flow <flow>", "only this flow's screens and their variations")
    .option("--bars", "back to bars: take the content off")
    .option("--packs", "write nothing: list the content packs")
    .action(dispatch(host, "flesh"));

  wire
    .command("copy [screens...]")
    .description("Print a fleshed screen's words and JSON schema by slot and path; --apply <file> writes exact words back (source \"copy\") as one version; --ai fills schema-validated copy across one screen or flow")
    .option("--canvas <canvas>")
    .option("--flow <flow>", "with --ai: only this flow's screens")
    .option("--apply <file>", "a JSON file: { \"title\"?: string, \"slots\": { \"<slot>\": { \"<path>\": \"words\" } | [\"words\", …] } }")
    .option("--ai", "generate schema-validated copy across target screen(s) in one op group")
    .option("--brief <words>", "extra domain or tone brief for --ai")
    .option("--by <name>", "who wrote the words — recorded on the screen", "agent")
    .action(dispatch(host, "copy"));

  wire
    .command("name [screens...]")
    .description("Name a flow's brand, per-screen titles, and shared navigation bar labels coherently in one op group")
    .option("--canvas <canvas>")
    .option("--flow <flow>", "only this flow's screens")
    .option("--request <words>", "override the flow request when naming")
    .action(dispatch(host, "name"));

  wire
    .command("voice [screens...]")
    .description("N voices for a whole flow's words, previewed on its first two screens and saved to a file; --from <file> --pick <k> applies one voice to every screen as one op group, prototype rebuilt. Words only; intents untouched")
    .option("--canvas <canvas>")
    .option("--flow <flow>", "this flow's screens (default: the flow the named screen is in, or the canvas's only flow)")
    .option("--n <n>", "how many voices (default 3)")
    .option("--brief <text>", "what the voices are for — \"warmer, for first-time buyers\"")
    .option("--from <file>", "voices already written — this command's own file, or an agent's: { \"variants\": [{ \"stance\", \"why\", \"edits\": [{ \"address\": \"<screen>::<string>\", \"to\" }] }] }")
    .option("--pick <k>", "apply this voice — its number (1-based) or its stance — to every screen of the flow")
    .option("--save <file>", "where to write the voices (default: a file under the temp directory, named in the receipt)")
    .option("--by <name>", "who wrote the words, with --from (recorded on each screen's spec; default agent)")
    .action(dispatch(host, "voice"));

  wire
    .command("play <screen> [element]")
    .description("Print the address that opens the flow's prototype full screen AT this screen of it — with [element], its hotspot pointed out. What an arrow's Play from here opens")
    .option("--canvas <canvas>")
    .action(dispatch(host, "play"));

  wire
    .command("edit [words...]")
    .description("Surgically edit a single slot or layout setting on an existing wireframe screen (`content`, `add`, `remove`, `variant`, `restyle`) in one op group, rebuilding its prototype automatically")
    .option("--canvas <canvas>")
    .option("--screen <item>", "target wireframe screen item id or title (default: Jev picks from the instruction)")
    .option("--kind <kind>", "explicit edit kind (content, add, remove, variant, restyle)")
    .option("--slot <slot>", "explicit target slot id (for example: main.1, main.2, header, nav)")
    .option("--block <block>", "replacement or added block id")
    .option("--density <density>", "spacing density override (compact, default, spacious)")
    .option("--template <template>", "multi-region layout template override")
    .option("--answerer <name>", "jev, home, or stub")
    .option("--seed <n>", "the stub's seed", "1")
    .action(dispatch(host, "edit"));

  wire
    .command("why [words...]")
    .description("Explain why a wireframe screen's archetype, template, density, and slot blocks were chosen, citing recorded Jev probabilities and runner-up alternatives")
    .option("--canvas <canvas>")
    .option("--screen <item>", "wireframe screen item id or title (default: newest wireframe screen)")
    .action(dispatch(host, "why"));

  // The keep mark in the words the web says it in (24 Sep 2026): `use` is `keep`, `unuse` is `unkeep`.
  wire
    .command("use <screens...>")
    .description("Use screens in the prototype (📐) — the same act as `wire keep`, in the words the item menu says")
    .option("--canvas <canvas>")
    .action(dispatch(host, "use"));

  wire
    .command("unuse <screens...>")
    .description("Remove screens from the prototype (📐) — the same act as `wire unkeep`")
    .option("--canvas <canvas>")
    .action(dispatch(host, "unuse"));

  wire
    .command("questions")
    .description("Print the pending round of a wireframe flow as a question file, in Jev's request shape — for an agent to answer in Jev's place")
    .option("--canvas <canvas>")
    .option("--flow <flow>", "which flow (default: the newest one waiting on answers)")
    .action(dispatch(host, "questions"));

  wire
    .command("answer <file>")
    .description("Apply a question file whose calls each carry a `response` in Jev's response shape — the screens fill in place, in the flow's op group")
    .option("--canvas <canvas>")
    .action(dispatch(host, "answer"));

  wire
    .command("render [spec]")
    .description("Draw a wireframe spec (a JSON file) and add it to the canvas as an HTML screen with the spec inside it — or, with --all, draw every wire on the canvas again from the spec it carries (one op group; a version only where the bytes change)")
    .option("--canvas <canvas>")
    .option("--all", "re-render every wire already on the canvas from its own spec — how a renderer change reaches screens drawn before it")
    .option("--flow <flow>", "with --all: only this flow's screens and their variations")
    .option("--title <title>", "the item's title (default: the spec's title)")
    .option("--at <x,y>", "place at world coordinates")
    .option("--anchor <item>", "place to the left of this item")
    .option("--in <group>", "insert into this group")
    .option("--cell <row,col>", "with --in: one cell of the sheet's grid")
    .action(dispatch(host, "render"));

  wire
    .command("spec <archetype>")
    .description("Print a spec for an archetype — a blueprint (every slot undecided), or with --resolved each slot's first block at its defaults")
    .option("--platform <platform>", "one of mobile, tablet, web (default: the archetype's first)")
    .option("--template <id>", "layout template id (single, split, master_detail, grid, bento, hero_then_grid, dashboard)")
    .option("--resolved", "choose each slot's first option, with default props and intents")
    .option("--title <title>")
    .option("--request <words>", "the words that asked for it")
    .action(dispatch(host, "spec"));

  wire
    .command("catalog")
    .description("List the archetypes (with each slot's options), and count the blocks, primitives and intents")
    .action(dispatch(host, "catalog"));
}

const wireframeCliCore: CoreModule = {
  ...wireframeModule,
  propertyKeys: [...WIRE_PROPERTY_KEYS],
  commands: [WIRE_COMMAND],
};

export const wireframeCli: CliModule = {
  core: wireframeCliCore,
  register,
  guide: guideText,
  // `isocan words <screen> --apply` on a wireframe: its words are the spec's,
  // so this module writes them — loaded only when somebody applies a deck.
  copy: {
    kind: "wire",
    apply: async (...args) => (await import("./flesh-cli.ts")).wireCopyWriter.apply(...args),
    // `isocan words vary <screen>`: each voice's file is the spec with its words, rendered (`copy-variant.ts`).
    variant: async (...args) => (await import("./copy-variant.ts")).wireCopyVariant(...args),
  },
};

export default wireframeCli;
