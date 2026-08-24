import { describe, expect, it } from "vitest";
import { defaultCloneDir, gitRemote } from "../src/gitrepo.ts";

/**
 * `isocan clone` reads a repo the way git does, plus one shorthand.
 *
 * The property under test is mostly a NEGATIVE one — that git's own syntax
 * comes out the other side untouched. Every form below is one git accepts and
 * has accepted for years; rewriting any of them would aim somebody at a host
 * they did not name, which is phase 7's cheerful-wrong-address failure wearing
 * a git hat.
 */

describe("what a person means by the repo", () => {
  it("expands owner/name to GitHub, because that is how people say it", () => {
    expect(gitRemote("dglazkov/isocan")).toBe("https://github.com/dglazkov/isocan.git");
    expect(gitRemote("acme-labs/widgets.js")).toBe("https://github.com/acme-labs/widgets.js.git");
  });

  it("leaves every shape git already understands alone", () => {
    const untouched = [
      "https://github.com/dglazkov/isocan.git",
      "http://example.com/x/y.git",
      "ssh://git@example.com:2222/acme/widgets.git",
      "git@github.com:dglazkov/isocan.git", // scp-style
      "git://example.com/acme/widgets.git",
      "file:///srv/git/widgets.git",
      "/srv/git/widgets",
      "./widgets",
      "../widgets",
      "~/src/widgets",
    ];
    for (const one of untouched) {
      expect(gitRemote(one), one).toBe(one);
    }
  });

  it("does not mistake a deeper path for owner/name", () => {
    // Three segments is not the shorthand; inventing a host for it would be
    // the failure this rule is narrow to avoid.
    expect(gitRemote("acme/widgets/extra")).toBe("acme/widgets/extra");
    expect(gitRemote("./acme/widgets")).toBe("./acme/widgets");
  });

  it("takes the shorthand only when it is unambiguous", () => {
    // A colon means scp-style, whatever else is in the string.
    expect(gitRemote("git@host:acme/widgets")).toBe("git@host:acme/widgets");
  });
});

describe("what to call the directory", () => {
  it("agrees with git's own answer", () => {
    for (const [remote, dir] of [
      ["https://github.com/dglazkov/isocan.git", "isocan"],
      ["https://github.com/dglazkov/isocan", "isocan"],
      ["git@github.com:acme/widgets.git", "widgets"],
      ["ssh://git@example.com:2222/acme/widgets.git", "widgets"],
      ["/srv/git/widgets", "widgets"],
      ["file:///srv/git/widgets.git", "widgets"],
    ] as const) {
      expect(defaultCloneDir(remote), remote).toBe(dir);
    }
  });

  it("survives the trailing slash people paste", () => {
    expect(defaultCloneDir("https://github.com/dglazkov/isocan/")).toBe("isocan");
    expect(defaultCloneDir("https://github.com/dglazkov/isocan.git/")).toBe("isocan");
  });

  it("only strips a .git SUFFIX, not the word wherever it appears", () => {
    expect(defaultCloneDir("https://example.com/acme/gitlab.git")).toBe("gitlab");
    expect(defaultCloneDir("https://example.com/acme/github")).toBe("github");
  });

  it("does not try to validate the URL — that is git's job and git is better at it", () => {
    // A host with no path is not a repo, but this function's only question is
    // "what would git call the directory". git refuses the clone a moment
    // later with a message about the actual network failure, which beats
    // anything guessed from the string.
    expect(defaultCloneDir("https://example.com/")).toBe("example.com");
  });

  it("refuses only when there is no name at all to take", () => {
    // The one case a caller cannot act on: nothing to name the directory.
    for (const nothing of ["/", "", "///"]) {
      expect(() => defaultCloneDir(nothing), JSON.stringify(nothing)).toThrow(/cannot tell/);
    }
  });
});
