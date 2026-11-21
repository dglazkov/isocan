// Shared, pure priority scoring for audits, reviews, and other findings.
export const WEIGHTS = Object.freeze({ severity: { high: 3, medium: 2, low: 1 }, effort: { S: 1, M: 2, L: 4 }, confidence: { HIGH: 1, MED: .6, LOW: .3 }, risk: { LOW: 1, MED: .8, HIGH: .6 } });
const FORMULA = 'severity / effort × confidence × risk discount';

/** Unknown inputs remain unknown, never zero or guessed. The legacy audit
 * leverage formula is retained, not presented as a measured financial return. */
export function priorityScore(input = {}) {
  const missing = Object.keys(WEIGHTS).filter(k => !Object.hasOwn(WEIGHTS[k], input[k]));
  return { score: missing.length ? null : WEIGHTS.severity[input.severity] / WEIGHTS.effort[input.effort] * WEIGHTS.confidence[input.confidence] * WEIGHTS.risk[input.risk], missing, formula: FORMULA };
}
export const auditLeverage = finding => priorityScore(finding).score;

