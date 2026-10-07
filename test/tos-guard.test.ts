import { describe, expect, it } from "vitest";
import { guardTypeOfService } from "./tos-guard.ts";

/** A socket whose `setTypeOfService` fails the way Darwin 27's does (or any other way). */
function socketThatThrows(code: string) {
  const calls: number[] = [];
  const socket = {
    setTypeOfService(tos: number) {
      calls.push(tos);
      const err = new Error(`setTypeOfService ${code}`) as Error & { code: string };
      err.code = code;
      throw err;
    },
  };
  return { socket: socket as never, calls };
}

describe("the type-of-service guard (test/setup.ts's fetch)", () => {
  it("lets setting the default fail with EINVAL, and still asks the socket", () => {
    const { socket, calls } = socketThatThrows("EINVAL");
    const guarded = guardTypeOfService(socket) as unknown as { setTypeOfService(t: number): unknown };
    expect(() => guarded.setTypeOfService(0)).not.toThrow();
    expect(calls).toEqual([0]);
  });

  it("still throws for a value somebody chose, or for any other error", () => {
    const einval = guardTypeOfService(socketThatThrows("EINVAL").socket) as unknown as { setTypeOfService(t: number): unknown };
    expect(() => einval.setTypeOfService(46)).toThrow(/EINVAL/);
    const other = guardTypeOfService(socketThatThrows("EBADF").socket) as unknown as { setTypeOfService(t: number): unknown };
    expect(() => other.setTypeOfService(0)).toThrow(/EBADF/);
  });

  it("leaves a socket without the method alone", () => {
    const bare = {} as never;
    expect(guardTypeOfService(bare)).toBe(bare);
  });
});
