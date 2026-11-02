import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const USAGE = 'Usage: node note-bundle.mjs <directory> [--sort title] [--output <file>]';

function firstHeading(content) {
  for (const line of content.replace(/\r\n?/g, '\n').split('\n')) {
    const match = /^#[ \t]+(.+?)[ \t]*$/.exec(line);
    if (match) {
      return match[1];
    }
  }
  return undefined;
}

const compareNames = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

try {
  const [directory, ...options] = process.argv.slice(2);
  if (!directory || directory.startsWith('--')) {
    throw new Error(USAGE);
  }

  let sort;
  let output;
  for (let i = 0; i < options.length; i += 1) {
    const option = options[i];
    if (option === '--sort') {
      const value = options[++i];
      if (!value || value.startsWith('--')) {
        throw new Error('--sort requires a value');
      }
      if (value !== 'title') {
        throw new Error(`Invalid --sort value: ${value} (only "title" is supported)`);
      }
      sort = value;
    } else if (option === '--output') {
      const value = options[++i];
      if (!value || value.startsWith('--')) {
        throw new Error('--output requires a file path');
      }
      output = value;
    } else {
      throw new Error(`Unknown option: ${option}`);
    }
  }

  const notes = readdirSync(directory)
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const content = readFileSync(join(directory, name), 'utf8');
      return { name, content: content.trim(), title: firstHeading(content) };
    });

  if (sort === 'title') {
    notes.sort((a, b) => {
      const aTitle = a.title === undefined ? undefined : a.title.toLowerCase();
      const bTitle = b.title === undefined ? undefined : b.title.toLowerCase();
      if (aTitle === undefined && bTitle === undefined) {
        return compareNames(a, b);
      }
      if (aTitle === undefined) {
        return 1;
      }
      if (bTitle === undefined) {
        return -1;
      }
      if (aTitle > bTitle) {
        return -1;
      }
      if (aTitle < bTitle) {
        return 1;
      }
      return compareNames(a, b);
    });
  } else {
    notes.sort(compareNames);
  }

  const bundle = notes.map((note) => note.content).join('\n\n---\n\n') + '\n';

  if (output) {
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, bundle);
    process.stdout.write(`Wrote ${notes.length} notes to ${output}\n`);
  } else {
    process.stdout.write(bundle);
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
