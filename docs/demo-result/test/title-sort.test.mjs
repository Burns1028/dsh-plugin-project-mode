import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));

test('--sort title orders headings Z to A, ignoring case', () => {
  const notes = join(root, 'test', 'fixtures', 'notes');
  const result = spawnSync(process.execPath, ['note-bundle.mjs', notes, '--sort', 'title'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr.trim());
  assert.deepEqual(
    [...result.stdout.matchAll(/^# (.+)$/gm)].map((match) => match[1]),
    ['Pears', 'Bananas', 'apples'],
  );
});
