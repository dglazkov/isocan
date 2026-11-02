import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  OPERATOR_END_ROUTE,
  OPERATOR_LOG_ROUTE,
  OPERATOR_LOOK_ROUTE,
  OPERATOR_PURGE_ROUTE,
  OPERATOR_REFUSE_ROUTE,
  OPERATOR_REVOKE_ROUTE,
  OPERATOR_SHOW_ROUTE,
  OPERATOR_TAKEDOWN_ROUTE,
  PASS_REDEEM_ROUTE,
  TAKEDOWNS_ROUTE,
} from "@isocan/core";
import { registerOperatorRoutes, type OperatorRouteScope } from "../src/operator-routes.ts";
import { registerPassRoutes, type PassRouteScope } from "../src/pass-routes.ts";

/**
 * **`registerRoutes` does not grow back** (cleanup TS-8, 27 Sep 2026).
 *
 * The audit measured it at 5,948 lines on `2d3ad79b`. It was 6,009 on the day
 * it was split, one function holding 115 routes and every closure they share.
 * The operator's routes and the pass routes shared almost nothing with the
 * rest of it, so they moved into `operator-routes.ts` and `pass-routes.ts`.
 * `registerRoutes` calls each at the point where its section used to begin,
 * so the registration order did not change. The whole server suite passing
 * unchanged is the proof that no route's behaviour did.
 *
 * Two guards. The length is a ratchet: a new route family goes in a file of
 * its own, and the next split lowers the number. The routes that moved are
 * pinned to the files they moved to, so a later edit cannot quietly register
 * one inline again. That would pass the length check until the file filled
 * up.
 */

/** Lines in `registerRoutes`, from `export function` to its closing brace.
 * 4,690 after TS-8. Lower it when you split another section out. */
const CEILING = 4_690;

const httpTs = fileURLToPath(new URL("../src/http.ts", import.meta.url));

/** `registerRoutes` as parsed, with its length and the first argument of
 * every `app.<method>(...)` inside it. */
function registerRoutesShape(): { lines: number; routes: string[] } {
  const sf = ts.createSourceFile(httpTs, readFileSync(httpTs, "utf8"), ts.ScriptTarget.Latest, true);
  const fn = sf.statements.find(
    (st): st is ts.FunctionDeclaration => ts.isFunctionDeclaration(st) && st.name?.text === "registerRoutes",
  );
  if (!fn) throw new Error("registerRoutes is not a top-level function in http.ts any more");
  const line = (pos: number) => sf.getLineAndCharacterOfPosition(pos).line;
  const routes: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(sf) === "app" &&
      /^(get|post|put|delete|patch|head|route)$/.test(node.expression.name.text) &&
      node.arguments[0]
    ) {
      routes.push(node.arguments[0].getText(sf));
    }
    ts.forEachChild(node, visit);
  };
  visit(fn);
  return { lines: line(fn.getEnd()) - line(fn.getStart()) + 1, routes };
}

/** The URLs a registrar adds to a bare Fastify instance. Registering reads
 * nothing from the scope; only a handler would, and none runs here. */
async function urlsOf(register: (app: ReturnType<typeof Fastify>) => void): Promise<string[]> {
  const app = Fastify();
  const urls: string[] = [];
  app.addHook("onRoute", (route) => {
    if (route.method !== "HEAD") urls.push(route.url);
  });
  register(app);
  await app.ready();
  await app.close();
  return urls.sort();
}

const OPERATOR_ROUTES = [
  OPERATOR_SHOW_ROUTE,
  OPERATOR_LOG_ROUTE,
  OPERATOR_LOOK_ROUTE,
  OPERATOR_TAKEDOWN_ROUTE,
  OPERATOR_PURGE_ROUTE,
  OPERATOR_END_ROUTE,
  OPERATOR_REVOKE_ROUTE,
  OPERATOR_REFUSE_ROUTE,
  TAKEDOWNS_ROUTE,
];
const PASS_ROUTES = ["/api/projects/:id/passes", "/api/projects/:id/passes/:passId", PASS_REDEEM_ROUTE];

describe("registerRoutes stays split", () => {
  it("is no longer than the last agreed length", () => {
    const { lines } = registerRoutesShape();
    expect(
      lines,
      `registerRoutes in packages/server/src/http.ts is ${lines} lines, past the agreed ${CEILING}.\n` +
        "  A section that shares little with the rest belongs in a file of its own, registered\n" +
        "  from here with the closures it reads (see operator-routes.ts, pass-routes.ts).",
    ).toBeLessThanOrEqual(CEILING);
  });

  it("registers the operator's routes from operator-routes.ts, and only those", async () => {
    const urls = await urlsOf((app) => registerOperatorRoutes(app, {} as OperatorRouteScope));
    expect(urls).toEqual([...OPERATOR_ROUTES].sort());
  });

  it("registers the pass routes from pass-routes.ts, and only those", async () => {
    const urls = await urlsOf((app) => registerPassRoutes(app, {} as PassRouteScope));
    expect(urls).toEqual([...PASS_ROUTES].sort());
  });

  it("registers none of them inline in registerRoutes", () => {
    const moved = new Set([
      "OPERATOR_SHOW_ROUTE", "OPERATOR_LOG_ROUTE", "OPERATOR_LOOK_ROUTE", "OPERATOR_TAKEDOWN_ROUTE",
      "OPERATOR_PURGE_ROUTE", "OPERATOR_END_ROUTE", "OPERATOR_REVOKE_ROUTE", "OPERATOR_REFUSE_ROUTE",
      "TAKEDOWNS_ROUTE", "PASS_REDEEM_ROUTE",
      ...[...OPERATOR_ROUTES, ...PASS_ROUTES].map((url) => JSON.stringify(url)),
    ]);
    const inline = registerRoutesShape().routes.filter((first) => moved.has(first) || first.startsWith('"/api/operator/'));
    expect(inline, "a moved route is registered inline in registerRoutes again").toEqual([]);
  });
});
