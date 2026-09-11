import { describe, expect, it } from "vitest";
import { findKennel, homeAddressForCell, toolCalls, toolTitle } from "../src/sheep.ts";

/**
 * **The sheep harness's pure pieces** (sheep-harness phase 1). The kennel
 * walk is sheep's own rule, re-read here rather than asked of sheep, so it
 * gets the table sheep's would: which `.sheep/` a directory finds.
 */
describe("the kennel walk", () => {
  const dirs = (...present: string[]) => (p: string) => present.includes(p);
  const cases: Array<[string, string, string[], string]> = [
    ["a kennel in the directory itself", "/w/app", ["/w/app/.sheep"], "/w/app/.sheep"],
    ["a kennel above it, found the way git finds .git", "/w/app/src/deep", ["/w/.sheep"], "/w/.sheep"],
    ["the nearest of two", "/w/app/src", ["/w/.sheep", "/w/app/.sheep"], "/w/app/.sheep"],
    ["none at or above: the home directory's", "/tmp/x", [], "/home/u/.sheep"],
    ["none, and the fallback need not exist", "/", [], "/home/u/.sheep"],
    ["a file named .sheep is not a kennel", "/w/app", [], "/home/u/.sheep"],
  ];
  for (const [what, from, present, kennel] of cases) {
    it(what, () => {
      expect(findKennel(from, "/home/u", dirs(...present))).toBe(kennel);
    });
  }
});

describe("what a cell calls the canvas's home", () => {
  it("an address with a name is already one a cell can reach", () => {
    expect(homeAddressForCell("https://dev.isocan.io")).toBe("https://dev.isocan.io");
  });
  it("a loopback home is Docker's host, on the daemon's own port", () => {
    expect(homeAddressForCell("http://127.0.0.1:4441")).toBe("http://host.docker.internal:4441");
    expect(homeAddressForCell("http://localhost:4441")).toBe("http://host.docker.internal:4441");
  });
  it("config.json's loopbackFromCell says it otherwise", () => {
    expect(homeAddressForCell("http://127.0.0.1:4441", "http://192.168.65.254:9000")).toBe("http://192.168.65.254:9000");
  });
});

describe("tool beats from a pi transcript", () => {
  it("a tool call reads as the tool and its first string argument", () => {
    expect(toolTitle("bash", { command: "isocan comment reply th_1 \"ok\"\nmore" })).toBe('bash isocan comment reply th_1 "ok"');
    expect(toolTitle("read", { path: "/pasture/brief.md", offset: 3 })).toBe("read /pasture/brief.md");
    expect(toolTitle("look", {})).toBe("look");
  });
  it("only an assistant's tool calls are beats, oldest first", () => {
    const at = { timestamp: 0, type: "message" };
    expect(
      toolCalls([
        { ...at, id: "1", message: { role: "user", content: "hello" } },
        {
          ...at,
          id: "2",
          message: {
            role: "assistant",
            content: [
              { type: "text", text: "looking" },
              { type: "toolCall", name: "read", arguments: { path: "a.md" } },
              { type: "toolCall", name: "bash", arguments: { command: "isocan whoami" } },
            ],
          },
        },
        { ...at, id: "3", message: { role: "toolResult", content: [{ type: "text", text: "Percy" }] } },
        { ...at, id: "4", type: "compaction" },
      ]),
    ).toEqual(["read a.md", "bash isocan whoami"]);
  });
});
