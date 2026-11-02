# Note Bundle demo

A tiny Node.js CLI that joins Markdown notes into one document. This is a public,
synthetic task fixture, not the Project Mode plugin or a benchmark.

Requires Node 22 or newer. There are no package dependencies or install steps.

```sh
node note-bundle.mjs notes
node note-bundle.mjs notes --output dist/notes.md
npm test
```

The starting CLI supports filename ordering and file output. The requested
extension is described in [TASK.md](TASK.md). `docs/usage.md` is deliberately
missing. One feature test is deliberately failing before the task begins.

All note contents are invented for this demonstration. No network access,
credentials, Git history, or external services are needed.
