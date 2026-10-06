// Loop's findings are files, and docs/LOOP.md is a view of them: the same
// arrangement as the roadmap, and the same guard, or the view is the first
// thing to fall behind. Managed by keel (practice `loop`). This file is how the
// project's gate runs `render --check`: keep it in what `npm test` runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { render, ROOT, LOOP_DOC_HEADER, settings } from '../scripts/loop.mjs';

test('docs/LOOP.md is current, and no finding is broken', () => {
  const r = render(ROOT, { check: true });
  assert.ok(!r.stale, `docs/LOOP.md is out of date — run: ${settings(ROOT).run} render`);
  assert.deepEqual(r.problems, [], 'each line is a finding to fix (a proposal or decision needs a read of the code, a since, a note)');
});

test('docs/LOOP.md says it is generated, and where to edit instead', () => {
  const page = join(ROOT, 'docs', 'LOOP.md');
  if (!existsSync(page)) return; // nothing pulled yet
  assert.ok(readFileSync(page, 'utf8').startsWith(LOOP_DOC_HEADER));
});
