import { describe, expect, it } from "vitest";
// @ts-expect-error plain Node script, used by the command too
import { ciTiming } from "../scripts/lib/ci-timings.mjs";

const at = (seconds: number) => new Date(Date.UTC(2026, 9, 2) + seconds * 1000).toISOString();
const job = (start: number, end: number) => ({ started_at: at(start), completed_at: at(end), steps: [] });

describe("CI elapsed time", () => {
  it("counts overlapping shards once, separates the queue, and follows dependent publication", () => {
    const publish = { ...job(135, 160), steps: [{ name: "Advance `green` — gate", conclusion: "success", completed_at: at(140) }] };
    expect(ciTiming({ createdAt: at(0) }, [job(30, 90), job(30, 130), job(31, 100), publish])).toEqual({
      queue: 30, execution: 130, elapsed: 160, green: 140,
    });
  });

  it("does not invent a green time or a zero reading for missing timestamps", () => {
    expect(ciTiming({ createdAt: at(0) }, [])).toBeNull();
    expect(ciTiming({}, [job(30, 90)])).toBeNull();
    expect(ciTiming({ createdAt: at(0) }, [{ started_at: null, completed_at: null }])).toBeNull();
    const failed = { ...job(30, 90), steps: [{ name: "Advance `green`", conclusion: "failure", completed_at: at(70) }] };
    expect(ciTiming({ createdAt: at(0) }, [failed]).green).toBeNull();
  });
});
