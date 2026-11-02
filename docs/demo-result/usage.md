# Note bundler usage

`note-bundle.mjs` joins the Markdown notes in one directory into a single document.

## Requirements

- Node.js 22 or newer.
- No dependencies and no install step.

## Usage

```sh
node note-bundle.mjs <directory> [--sort title] [--output <file>]
```

Only `.md` files directly inside `<directory>` are bundled.

## Default order

Without `--sort`, notes are bundled in ascending filename order. For the four notes in `notes/`, the headings appear as **Pears, apples, Bananas, Cherries**.

## Title order

`--sort title` sorts notes by the text of each note's first level-one heading (`# ...`), case-insensitive, Z to A. Notes with equal titles keep filename order. Notes without an H1 come after all titled notes, in filename order.

For `notes/`, the headings appear as **Pears, Cherries, Bananas, apples**. Only the order changes; the output format is unchanged.

## Output format

Each note is trimmed. Notes are joined with a blank line, a `---` separator line, and another blank line. The bundle ends with a trailing newline.

## Writing to a file

`--output <file>` writes the bundle to `<file>` instead of stdout and creates parent directories as needed. On success it prints a confirmation, for example:

```text
Wrote 4 notes to dist/notes.md
```

## Example

Using the real notes in `notes/`:

```sh
# Default bundle: filename order
node note-bundle.mjs notes

# Title-sorted bundle
node note-bundle.mjs notes --sort title

# Title-sorted bundle written to dist/notes.md
node note-bundle.mjs notes --sort title --output dist/notes.md
```

Expected heading order:

- Default: **Pears, apples, Bananas, Cherries**
- `--sort title`: **Pears, Cherries, Bananas, apples**

The default bundle starts like this:

```text
# Pears

Pick pears when the stem lifts cleanly.

---

# apples
```

The third command writes the title-sorted bundle and prints `Wrote 4 notes to dist/notes.md`.

## Errors

An unknown option, an invalid `--sort` value (only `title` is supported), or `--output` without a file path writes a message to stderr and exits with status 1.
