import parser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * **One rule, and the reason it exists.**
 *
 * This repo went without a linter on purpose: its checks are tests, written
 * as guards that explain the bug they remember, and a wall of style warnings
 * is the opposite of that. What changed the calculation was a class of bug
 * that a test CANNOT see and that takes the whole app down.
 *
 * Picking up the Pen whited out the canvas. `OwnCursor` early-returns under
 * every tool but Select, and the colour for the cursor chip was read below
 * that return — correct while it was a plain function, fatal the moment a fix
 * turned it into `useActorColor(...)`. React counts hooks by call order, so a
 * hook behind a condition does not degrade, it THROWS out of render. Three
 * hooks under Select, two under Pen, error #300, blank page.
 *
 * `rules-of-hooks` catches that from the AST, everywhere, including the four
 * shapes a source scan cannot honestly recognise: a hook inside an `if`, in a
 * loop, inside a callback, after a return nested deeper than the top level.
 * That is the whole reason the dependency is here, and it is set to `error`.
 *
 * `exhaustive-deps` is also on, and also as an error, because it is not a
 * style rule either — it is the OTHER bug from the same week. ⌘C copied
 * nothing because a keydown effect listed `[canvasId, actor, itemId,
 * onWorkbench]` and closed over a stale `canvas`. Same shape as the Pen bug:
 * code that was right when written and quietly went wrong when something
 * around it changed. Both are now caught before they ship.
 *
 * SCOPE: the web app's source. The other packages have no components, the
 * rules would find nothing there, and a config that lints files it has
 * nothing to say about only invites rules that are opinions.
 */
export default [
  /**
   * **What eslint is not asked to look at**, which is the difference between a
   * three-second check and a fifty-second one.
   *
   * `files` above scopes the RULES; it does not scope the walk. `eslint .`
   * still opened every file in the tree, and this tree contains
   * `.claude/worktrees/` — up to twenty other checkouts of this same
   * repository, each with its own `packages/web/dist` full of minified
   * bundles. Fifty seconds, almost all of it parsing build output belonging to
   * work nobody asked about.
   *
   * Slow was the smaller half. **The lint gate was reading other sessions'
   * uncommitted work**: a hook bug in somebody's worktree counted toward
   * `measure.mjs lint-violations`, which is qa-tester's "eslint errors at most
   * 0" goal, so the board could go red for code that is not on this branch and
   * may never be. A check whose answer depends on what another agent happens
   * to have checked out is not a check. `dist` goes for the plainer reason:
   * nobody fixes a hook in a bundle.
   */
  {
    ignores: [".claude/**", "**/dist/**"],
  },
  {
    files: ["packages/web/src/**/*.ts", "packages/web/src/**/*.tsx", "packages/modules/*/src/**/*.tsx"],
    languageOptions: {
      parser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
];
