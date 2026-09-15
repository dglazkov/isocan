import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_COMMAND_CATALOGUE, mergeCommands, type CommandMetadata } from "@isocan/core";

const dispatch = vi.hoisted(() => ({ setHelpOpen: vi.fn(), openModuleDialog: vi.fn(), moduleDialog: vi.fn() }));
vi.mock("../src/stores/uiStore.ts", () => ({ useUiStore: { getState: () => dispatch } }));
vi.mock("../src/modules.ts", () => ({ moduleDialog: dispatch.moduleDialog }));
import { runLocalCommand } from "../src/lib/localcommands.ts";

beforeEach(() => { vi.clearAllMocks(); dispatch.moduleDialog.mockReturnValue(null); });

describe("local dispatch needs metadata, never agent instruction bodies", () => {
  it("opens built-in help with the synchronous offline catalogue", () => {
    expect(runLocalCommand("/help keyboard", [...DEFAULT_COMMAND_CATALOGUE])).toBe(true);
    expect(dispatch.setHelpOpen).toHaveBeenCalledWith(true);
    expect(runLocalCommand("/format grid", [...DEFAULT_COMMAND_CATALOGUE])).toBe(false);
  });

  it("does not run a home's shadowing help locally even if it claims local or opens", () => {
    const home: CommandMetadata = { name: "help", description: "Acme help", usage: "", source: "home", local: true, opens: "acme-dialog" };
    dispatch.moduleDialog.mockReturnValue({});
    expect(runLocalCommand("/help", mergeCommands<CommandMetadata>(DEFAULT_COMMAND_CATALOGUE, [home]))).toBe(false);
    expect(dispatch.setHelpOpen).not.toHaveBeenCalled();
    expect(dispatch.openModuleDialog).not.toHaveBeenCalled();
  });

  it("dispatches a registered module's alias and arguments only when its dialog exists", () => {
    const module: CommandMetadata = { name: "acme-panel", aka: ["acme-old"], description: "Acme panel", usage: "[topic]", source: "module", opens: "acme-dialog" };
    expect(runLocalCommand("/acme-old receiving", [module])).toBe(false);
    dispatch.moduleDialog.mockReturnValue({});
    expect(runLocalCommand("/acme-old receiving", [module])).toBe(true);
    expect(dispatch.moduleDialog).toHaveBeenLastCalledWith("acme-dialog");
    expect(dispatch.openModuleDialog).toHaveBeenCalledWith("acme-dialog", "receiving");
  });
});
