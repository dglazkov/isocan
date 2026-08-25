import { afterEach, describe, expect, it } from "vitest";
import { clientAddress, MINT_BURST, MINT_PER_MINUTE, TokenBuckets } from "../src/meter.ts";

/**
 * The door's meter as pure logic (phase 13.7 — the innkeeper's obligations).
 *
 * Two things are tested here and driven at the seam in `door.test.ts`: the
 * bucket, whose clock is injected so a refill costs a line instead of a
 * minute; and `clientAddress`, which decides WHOSE bucket a request draws
 * from and is the half that can fail silently. A meter keyed on a load
 * balancer refuses the whole internet at 429 and looks exactly like a meter
 * that works — so the keying gets its own assertions rather than being
 * implied by a flood test that would pass either way.
 */

/**
 * SYNTHETIC addresses throughout: RFC 5737 documentation ranges, which exist
 * so nobody's real address ends up in a fixture.
 *
 * **The chain shape these fixtures are built on, stated once.** Google's
 * external ALB APPENDS two entries — the address it saw the connection come
 * from, then its own — to whatever the caller sent. So:
 *
 *   - a visitor who sent no header arrives as `<client-ip>, <lb-ip>`, and
 *     BOTH entries are the infrastructure's;
 *   - a caller that invented a value arrives as `<claim>, <client-ip>,
 *     <lb-ip>`, and the claim is a THIRD entry on the LEFT.
 *
 * Which is why every assertion below counts from the right: the caller owns
 * the head of the list and can neither remove nor reorder the tail.
 */
const CLIENT_A = "203.0.113.7";
const CLIENT_B = "198.51.100.9";
const BALANCER = "192.0.2.1";
const SOCKET = "10.128.0.4";

const hosted = { loopback: false, hops: 1 };

let clock = 0;
const buckets = (options: { burst?: number; perMinute?: number; cap?: number } = {}) => {
  clock = 1_000_000;
  return new TokenBuckets({ ...options, now: () => clock });
};

describe("the token bucket", () => {
  it("spends the burst and then refuses", () => {
    const meter = buckets();
    for (let i = 0; i < MINT_BURST; i += 1) expect(meter.take("a")).toBeNull();
    expect(meter.take("a")).not.toBeNull();
  });

  it("says how many whole seconds until the next token", () => {
    const meter = buckets();
    for (let i = 0; i < MINT_BURST; i += 1) meter.take("a");
    // 20 a minute is one every three seconds, so a caller refused at empty
    // waits three — a real number, which is what a fixed window cannot give.
    expect(meter.take("a")).toEqual({ retryAfter: 60 / MINT_PER_MINUTE });
  });

  it("refills steadily, so the same client mints again once time passes", () => {
    const meter = buckets();
    for (let i = 0; i < MINT_BURST; i += 1) meter.take("a");
    expect(meter.take("a")).not.toBeNull();

    clock += 3_000; // exactly one token
    expect(meter.take("a")).toBeNull();
    expect(meter.take("a")).not.toBeNull();

    clock += 60_000; // a full minute: the whole burst is back
    for (let i = 0; i < MINT_BURST; i += 1) expect(meter.take("a")).toBeNull();
    expect(meter.take("a")).not.toBeNull();
  });

  it("never refills past the burst, however long nobody knocks", () => {
    const meter = buckets();
    clock += 86_400_000;
    for (let i = 0; i < MINT_BURST; i += 1) expect(meter.take("a")).toBeNull();
    expect(meter.take("a")).not.toBeNull();
  });

  it("hammering during a refusal neither punishes nor resets", () => {
    const meter = buckets();
    for (let i = 0; i < MINT_BURST; i += 1) meter.take("a");
    for (let i = 0; i < 50; i += 1) expect(meter.take("a")).not.toBeNull();
    clock += 3_000;
    expect(meter.take("a")).toBeNull();
  });

  it("gives two keys two buckets", () => {
    const meter = buckets();
    for (let i = 0; i < MINT_BURST; i += 1) meter.take("a");
    expect(meter.take("a")).not.toBeNull();
    expect(meter.take("b")).toBeNull();
  });

  it("is bounded, so a flood from many keys cannot grow it until the home dies", () => {
    const meter = buckets({ cap: 8 });
    for (let i = 0; i < 500; i += 1) meter.take(`client-${i}`);
    expect(meter.size).toBeLessThanOrEqual(8);
  });
});

describe("whose bucket this is", () => {
  it("keys a loopback daemon on the socket and ignores X-Forwarded-For", () => {
    // Nothing is in front of a local daemon, so every entry in that header is
    // fabricated. One bucket for the machine is the true answer there.
    const key = clientAddress({ "x-forwarded-for": `${CLIENT_A}, ${BALANCER}` }, "127.0.0.1", {
      loopback: true,
    });
    expect(key).toBe("127.0.0.1");
  });

  it("keys a hosted home on the entry the infrastructure appended, not the socket", () => {
    // The failure this codebase would otherwise ship: behind a load balancer
    // every request arrives from the balancer, so a socket-keyed bucket puts
    // the entire internet in one and the first flood locks out every visitor.
    expect(clientAddress({ "x-forwarded-for": `${CLIENT_A}, ${BALANCER}` }, SOCKET, hosted)).toBe(
      CLIENT_A,
    );
  });

  it("counts two X-Forwarded-For values behind one socket as two clients", () => {
    const a = clientAddress({ "x-forwarded-for": `${CLIENT_A}, ${BALANCER}` }, SOCKET, hosted);
    const b = clientAddress({ "x-forwarded-for": `${CLIENT_B}, ${BALANCER}` }, SOCKET, hosted);
    expect(a).not.toBe(b);

    // And the consequence, asserted rather than assumed: A's flood does not
    // spend B's budget.
    const meter = buckets();
    for (let i = 0; i < MINT_BURST; i += 1) meter.take(a);
    expect(meter.take(a)).not.toBeNull();
    expect(meter.take(b)).toBeNull();
  });

  it("counts from the RIGHT, so a prepended claim cannot buy a private bucket", () => {
    // A three-entry chain, which is what a caller that DID send a header
    // produces: its invention at the head, then the two the infrastructure
    // appends. The invention moves between these two requests; the entry one
    // from the right — the address GCP actually saw — does not, so both
    // requests draw on the same bucket.
    const first = clientAddress(
      { "x-forwarded-for": `9.9.9.9, ${CLIENT_A}, ${BALANCER}` },
      SOCKET,
      hosted,
    );
    const second = clientAddress(
      { "x-forwarded-for": `7.7.7.7, ${CLIENT_A}, ${BALANCER}` },
      SOCKET,
      hosted,
    );
    expect(first).toBe(CLIENT_A);
    expect(second).toBe(CLIENT_A);
  });

  it("falls back to the socket when the chain is shorter than the infrastructure makes it", () => {
    // A caller that sends a one-entry chain did not arrive the way the
    // infrastructure sends requests. The conservative direction is the shared
    // bucket: it cannot claim a private one by sending less.
    expect(clientAddress({ "x-forwarded-for": CLIENT_A }, SOCKET, hosted)).toBe(SOCKET);
    expect(clientAddress({}, SOCKET, hosted)).toBe(SOCKET);
  });

  it("reads repeated headers as one chain, so the trustworthy end is not thrown away", () => {
    // Node hands a repeated header back as an array. Taking only the first —
    // which is right for `x-forwarded-proto` and wrong here — would drop
    // exactly the entries the infrastructure appended.
    expect(clientAddress({ "x-forwarded-for": [CLIENT_A, BALANCER] }, SOCKET, hosted)).toBe(
      CLIENT_A,
    );
  });

  it("takes the hop count from ISOCAN_PROXY_HOPS, so a measured chain needs no new code", () => {
    const before = process.env.ISOCAN_PROXY_HOPS;
    try {
      process.env.ISOCAN_PROXY_HOPS = "2";
      const chain = { "x-forwarded-for": `${CLIENT_A}, 172.16.0.1, ${BALANCER}` };
      expect(clientAddress(chain, SOCKET, { loopback: false })).toBe(CLIENT_A);
      // Junk is the default, not a crash: a home that refused to boot over a
      // typo in a tuning knob is a worse innkeeper than one that meters
      // slightly wrongly and says so in its log.
      process.env.ISOCAN_PROXY_HOPS = "banana";
      expect(clientAddress(chain, SOCKET, { loopback: false })).toBe("172.16.0.1");
    } finally {
      if (before === undefined) delete process.env.ISOCAN_PROXY_HOPS;
      else process.env.ISOCAN_PROXY_HOPS = before;
    }
  });
});

afterEach(() => {
  delete process.env.ISOCAN_PROXY_HOPS;
});
