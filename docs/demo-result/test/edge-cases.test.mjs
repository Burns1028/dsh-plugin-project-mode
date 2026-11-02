import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const run = (...args) => spawnSync(process.execPath, ['note-bundle.mjs', ...args], {
  cwd: root,
  encoding: 'utf8',
});

function withNotes(files, callback) {
  const directory = mkdtempSync(join(root, '.test-'));
  try {
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(directory, name), content);
    }
    return callback(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('equal titles case-insensitively are tie-broken by filename ascending', () => {
  const contents = {
    'b.md': '# Alpha\n\nB note',
    'a.md': '# alpha\n\nA note',
    'c.md': '# ALPHA\n\nC note',
  };
  withNotes(contents, (directory) => {
    const result = run(directory, '--sort', 'title');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, [
      '# alpha\n\nA note',
      '# Alpha\n\nB note',
      '# ALPHA\n\nC note',
    ].join('\n\n---\n\n') + '\n');
    assert.deepEqual(
      [...result.stdout.matchAll(/^# (.+)$/gm)].map((match) => match[1]),
      ['alpha', 'Alpha', 'ALPHA'],
    );
  });
});

test('notes without a level-one heading sort last, by filename', () => {
  withNotes({
    'a.md': '# Zebra\n\nA note',
    'b.md': 'No heading here.\n\nB note',
    'c.md': '## Only a second-level heading\n\nC note',
    'd.md': '# apple\n\nD note',
  }, (directory) => {
    const result = run(directory, '--sort', 'title');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, [
      '# Zebra\n\nA note',
      '# apple\n\nD note',
      'No heading here.\n\nB note',
      '## Only a second-level heading\n\nC note',
    ].join('\n\n---\n\n') + '\n');
  });
});

test('--sort and --output work in either order and write the sorted bundle', () => {
  withNotes({
    '10-pears.md': '# Pears\n\nPears note',
    '20-apples.md': '# apples\n\nApples note',
    '30-bananas.md': '# Bananas\n\nBananas note',
  }, (directory) => {
    const first = join(directory, 'out', 'first.md');
    const second = join(directory, 'out', 'second.md');

    const sortFirst = run(directory, '--sort', 'title', '--output', first);
    assert.equal(sortFirst.status, 0, sortFirst.stderr);
    assert.equal(sortFirst.stdout, `Wrote 3 notes to ${first}\n`);

    const outputFirst = run(directory, '--output', second, '--sort', 'title');
    assert.equal(outputFirst.status, 0, outputFirst.stderr);
    assert.equal(outputFirst.stdout, `Wrote 3 notes to ${second}\n`);

    const expected = ['10-pears.md', '30-bananas.md', '20-apples.md']
      .map((name) => readFileSync(join(directory, name), 'utf8').trim())
      .join('\n\n---\n\n') + '\n';
    assert.equal(readFileSync(first, 'utf8'), expected);
    assert.equal(readFileSync(second, 'utf8'), expected);
  });
});

test('an invalid --sort value fails clearly without writing output', () => {
  withNotes({ 'a.md': '# A\n\nA note' }, (directory) => {
    const result = run(directory, '--sort', 'date');
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /^Invalid --sort value: date/);
    assert.match(result.stderr, /title/);
  });
});

test('missing --sort or --output values fail with one-line errors', () => {
  withNotes({ 'a.md': '# A\n\nA note' }, (directory) => {
    const missingSort = run(directory, '--sort');
    assert.equal(missingSort.status, 1);
    assert.match(missingSort.stderr, /^--sort requires a value\n$/);

    const missingOutput = run(directory, '--output');
    assert.equal(missingOutput.status, 1);
    assert.match(missingOutput.stderr, /^--output requires a file path\n$/);

    const missingDirectory = run();
    assert.equal(missingDirectory.status, 1);
    assert.match(missingDirectory.stderr, /^Usage: node note-bundle\.mjs/);
  });
});
