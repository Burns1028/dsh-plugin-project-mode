import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

try {
  const [directory, ...options] = process.argv.slice(2);
  if (!directory || directory.startsWith('--')) {
    throw new Error('Usage: node note-bundle.mjs <directory> [--output <file>]');
  }

  let output;
  for (let i = 0; i < options.length; i += 1) {
    if (options[i] !== '--output') {
      throw new Error(`Unknown option: ${options[i]}`);
    }
    output = options[++i];
    if (!output || output.startsWith('--')) {
      throw new Error('--output requires a file path');
    }
  }

  const files = readdirSync(directory)
    .filter((name) => name.endsWith('.md'))
    .sort();
  const bundle = files
    .map((name) => readFileSync(join(directory, name), 'utf8').trim())
    .join('\n\n---\n\n') + '\n';

  if (output) {
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, bundle);
    process.stdout.write(`Wrote ${files.length} notes to ${output}\n`);
  } else {
    process.stdout.write(bundle);
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
