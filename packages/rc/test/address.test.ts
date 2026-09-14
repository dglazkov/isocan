import { describe, expect, it } from "vitest";
import * as core from "@isocan/core";
import * as api from "../../api/src/index.ts";
import { canvasUrlWithPass, isLoopbackBase, parseCanvasAddress, type CanvasAddress } from "../src/index.ts";

/**
 * **The address helpers, from `isocan/rc` and from `isocan`** (sheep's collie,
 * phase 2). The collie's Worker composes and parses pass addresses and its
 * command refuses a loopback canvas home before minting; with neither entry
 * exporting core's helpers it wrote each again. Both entries now hand over
 * core's own functions — the same function objects, not copies — so there is
 * still one spelling of an address. The boundary test holds that `isocan/rc`
 * reaches no Node for them; the two entry tests hold `rc.mjs` and `index.mjs`
 * to these names.
 */

describe("the address helpers a host needs", () => {
  it("are core's own functions, from both entries", () => {
    expect(canvasUrlWithPass).toBe(core.canvasUrlWithPass);
    expect(parseCanvasAddress).toBe(core.parseCanvasAddress);
    expect(isLoopbackBase).toBe(core.isLoopbackBase);
    expect(api.canvasUrlWithPass).toBe(core.canvasUrlWithPass);
    expect(api.parseCanvasAddress).toBe(core.parseCanvasAddress);
    expect(api.isLoopbackBase).toBe(core.isLoopbackBase);
  });

  it("compose a pass address a host can read back, and say which homes are this machine", () => {
    const address = canvasUrlWithPass("https://acme.example", "prj_acme", "pas_acme.s3cret");
    expect(address).toBe("https://acme.example/p/prj_acme#pas_acme.s3cret");
    const parsed: CanvasAddress | null = parseCanvasAddress(address);
    expect(parsed).toEqual({ origin: "https://acme.example", canvasId: "prj_acme", pass: "pas_acme.s3cret" });
    expect(parseCanvasAddress("https://acme.example/elsewhere")).toBeNull();
    expect(isLoopbackBase("http://127.0.0.1:4441")).toBe(true);
    expect(isLoopbackBase("http://localhost:4441")).toBe(true);
    expect(isLoopbackBase("https://acme.example")).toBe(false);
  });
});
