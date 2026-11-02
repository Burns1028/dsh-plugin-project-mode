# CLI contract — note bundler (`note-bundle.mjs`)

Accepted contract for the `--sort title` feature. Reusable by the next turn; do not
infer extra options beyond what is listed here.

**Decision (2026-11-02, accepted after review):** title order is **Z→A**,
case-insensitive. This supersedes the original A→Z wording. `TASK.md`, the feature
test, the implementation, and `docs/usage.md` all reflect Z→A.

## Usage

```sh
node note-bundle.mjs <directory> [--sort title] [--output <file>]
```

- `--sort <value>` and `--output <file>` are accepted in either order.
- `title` is the only valid `--sort` value.
- Default (no `--sort`): existing filename order — `.md` names from `readdirSync`,
  sorted ascending.

## Ordering with `--sort title`

- Key: text of the first level-one ATX heading (`# ...`) in each note.
- Case-insensitive Z→A via lowercased string comparison (`<` / `>` on
  `String.prototype.toLowerCase()`), not locale-dependent collation
  (`localeCompare` is deliberately not used).
- Tie-break for equal titles (case-insensitively): filename ascending.
- Notes without a level-one heading sort after all titled notes, themselves by
  filename ascending.
- A heading is a line matching `^#[ \t]+(.+?)[ \t]*$`; `##`-only notes and notes
  with no `#` heading are "untitled". CRLF input is normalized before scanning.

## Output / behavior

- Each file is trimmed, joined with `\n\n---\n\n`, and terminated with one `\n`.
- `--output`: parent directories are created recursively, the bundle is written,
  and stdout is exactly `Wrote N notes to <path>\n`.
- No `--output`: bundle goes to stdout.
- Errors: exit code 1, one-line message on stderr. Unknown options keep
  `Unknown option: <arg>`. Invalid `--sort` value fails with
  `Invalid --sort value: <value> (only "title" is supported)`. Missing `--sort`
  value fails with `--sort requires a value`; missing `--output` value fails with
  `--output requires a file path`; missing directory prints the Usage line.
- Exit 0 / file output behavior for the default and existing cases is unchanged.

## Verification (run 2026-11-02, Node v24.19.0)

```sh
npm test                       # package script: node --test test/*.test.mjs
node --test test/*.test.mjs    # underlying command
```

Real result after adding `notes/40-cherries.md`: **9 tests, 9 pass, 0 fail**
(baseline 3 + new edge cases 5 + title-sort 1). `npm run demo` regenerated
`dist/notes.md` with **4 notes, 214 bytes** and heading order:
`Pears`, `Cherries`, `Bananas`, `apples` (files `10-pears.md`, `40-cherries.md`,
`30-bananas.md`, `20-apples.md`). Default filename order is `Pears`, `apples`,
`Bananas`, `Cherries`. `--output` printed `Wrote 4 notes to dist/notes.md`.

## Edge cases covered by `test/edge-cases.test.mjs`

- case-insensitive equal titles (`Alpha` / `alpha` / `ALPHA`) → filename ascending.
- untitled notes (no heading, `##` only) → after titled notes, filename ascending.
- `--sort` before or after `--output` → identical sorted bundle and stdout.
- invalid `--sort` value → exit 1, empty stdout, clear stderr.
- missing `--sort` / `--output` values and missing directory → exit 1, one line.
