import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);

// packages/core/src/copy-fit.ts
var ROLE_BUDGET = {
  button: { lines: 1, chars: 40, oneLine: true },
  nav: { lines: 1, chars: 32, oneLine: true },
  label: { lines: 1, chars: 60, oneLine: true },
  placeholder: { lines: 1, chars: 80, oneLine: true },
  link: { lines: 2, chars: 80, oneLine: true },
  heading: { lines: 2, chars: 140, oneLine: true },
  alt: { lines: null, chars: 240, oneLine: true },
  error: { lines: 3, chars: 240, oneLine: false },
  empty: { lines: 4, chars: 400, oneLine: false },
  body: { lines: null, chars: 1200, oneLine: false }
};
function copyBudget(role) {
  return ROLE_BUDGET[role] ?? ROLE_BUDGET.body;
}
function copyFitByCount(role, text) {
  const budget = copyBudget(role);
  const n = text.trim().replace(/\s+/g, " ").length;
  if (n > budget.chars) return { fits: false, why: `${n} characters \u2014 a ${role}'s budget is ${budget.chars} (by character count; Compare the copy\u2026 measures the real box)` };
  return { fits: true };
}

export {
  copyBudget,
  copyFitByCount
};
