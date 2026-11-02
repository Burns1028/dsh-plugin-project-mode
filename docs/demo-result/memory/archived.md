# Archived tasks

## TASK.md note bundler — completed 2026-11-02

Goal: add `--sort title` to the existing note bundler, document it, and produce `dist/notes.md`. Accepted requirement after review: title order is **Z to A**, case-insensitive; default remains filename order; output format and `--output` behavior unchanged.

Delivered:
- `note-bundle.mjs`: `--sort title` via first level-one heading, case-insensitive Z→A; filename tie-break; untitled notes last by filename; default filename order; identical bundle format; `--output` and error behavior preserved.
- `test/title-sort.test.mjs`: revised to the accepted Z→A expectation (Pears, Bananas, apples).
- `test/edge-cases.test.mjs`: 5 dependency-free tests (case-insensitive ties, missing/`##`-only headings, option order, invalid `--sort`, missing values).
- `docs/usage.md`: requirements, usage, default order, Z→A title order, output format, `--output`, three-note example, errors.
- `dist/notes.md`: generated with `npm run demo` (= `node note-bundle.mjs notes --sort title --output dist/notes.md`).

Evidence (Node v24.19.0):
- `npm test` → 9 tests, 9 pass, 0 fail.
- Default heading order: Pears, apples, Bananas. Title order: Pears, Bananas, apples. `dist/notes.md` byte-identical to the expected Z→A bundle.
- No dependencies added; no commits (directory is not a git repository).

Reusable context: `context/cli-contract.md`, indexed in `context/context.md` — accepted contract, `npm test` command, verified 9/9 result, edge-case rules.

Remaining follow-up: none; code, tests, docs, and generated output agree with TASK.md.

## Cherries note and 4-note output — completed 2026-11-02

Requested: add `notes/40-cherries.md` (`# Cherries` + one short paragraph), regenerate `dist/notes.md` with the accepted Z→A ordering, verify tests, no dependencies or commits.

Delivered:
- `notes/40-cherries.md`: `# Cherries` + "Cherries are best eaten fresh and chilled."
- `dist/notes.md`: regenerated via `npm run demo`; 4 notes, 214 bytes, title order **Pears, Cherries, Bananas, apples**.
- `docs/usage.md`: updated from three to four notes, `Wrote 4 notes`, and both expected orders; verified against real output.
- Default filename order: **Pears, apples, Bananas, Cherries**.

Evidence (Node v24.19.0):
- `npm test` → 9 tests, 9 pass, 0 fail.
- Hygiene: no `node_modules`, no lockfile, no `.git`, no temp leftovers.

Remaining follow-up: none.
