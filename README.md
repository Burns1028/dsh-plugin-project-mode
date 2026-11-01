# Project Mode for DeepSeek Harness

A persistent Coordinator, continuable Workers, and shared project memory built on native DSH sessions.

[中文说明](README.zh.md) · [MOA architecture](docs/moa-architecture.md) · [Tool API](docs/tool-api.md) · [Compatibility](docs/compatibility.md)

**Developer preview, v0.1.21.** This release targets **DSH 0.2.1-rc.3 with the three explicit compatibility extensions in this repository**. Stock rc.3 cannot enable the plugin. There is no automatic application patching or npm publication.

## How it works

The Coordinator takes over the context management and coordination decisions a person would otherwise perform: choose an existing Worker or create one, supply context, guide current work, queue later work, review results and decide what happens next. Workers are persistent conversations that users can also operate directly.

```text
.dsh/project-mode/<project-id>/
├── notes.md                 Coordinator: todos, assignments, progress, blockers
├── archived.md              Coordinator: concluded work and results
└── context/
    ├── context.md           Shared index: file paths and short descriptions
    └── ...                  Reusable facts, decisions and project knowledge
```

Both roles read the context index first and load relevant files on demand. Workers contribute valuable reusable findings; the Coordinator primarily organizes, consolidates and prunes that knowledge. Routine progress belongs in the work records.

At a new user message, the Coordinator checks the Worker list, including direct user activity. It chooses reuse or spawn, dispatches a complete goal and updates notes. During work it distinguishes **steer** (guide current work), **queue** (after the current turn), **interrupt** and **delete**. Each ended Worker turn automatically returns its full last committed AI message. An empty AI result still reports completion, allowing the Coordinator to inspect history and recover.

## Native behavior and interface

- `control_workers` replaces native delegation/control tools in the Coordinator's Agent scope. Workers and ordinary sessions retain native tools.
- Normal Coordinator closure waits for relevant Worker results to be delivered and consumed in the same native turn. Native Stop remains abortable and does not automatically stop Workers.
- A capsule appears once at the bottom of each participating human-message segment: spawn, accepted update or received result creates participation. Old capsules stay in their original segment; a passive user reply does not move or copy them. Deleting a Worker hides its capsules and removes it from active Project queries.
- The original workspace sidebar renders expandable Worker rows, stable icons and native status indicators. Worker titles align with their Coordinator.
- Right-side native tabs open by default: **Workers**, with a newest-first work timeline, and **notes.md**. Input and final AI output render as original Markdown behind collapsed headings. Tabs remain closable.
- Project identity is permanent after its first turn starts. Worker composers show a transparent **Back** control and no independent permission picker; delegation permissions use DSH's native inheritance.
- Archiving a Project brings its managed Workers along; restoring preserves previously independent archives.

Delegation is a role judgment, not a task-keyword router or a command/time gate. Natural model behavior can still choose direct execution; this preview does not guarantee perfect delegation decisions.

## Development

Requires Node **24.9+**, npm and Git.

```sh
npm ci
node scripts/apply-native-compat.mjs --dry-run
node scripts/apply-native-compat.mjs --backup "$PWD/.superpowers/native-backup"
npm test -- --maxWorkers=4
npm run typecheck
npm run test:native-contract
node scripts/prepare-release.mjs
npm run verify:package
```

The helper verifies exact rc.3 versions and SHA-256 hashes before writing. It backs up the selected native files and rolls back failed patch application. No install or prepare hook changes another runtime. See [compatibility](docs/compatibility.md) before targeting a separate DSH installation.

## Installation

First prepare a compatible DSH runtime as described above. Then install the Git tag through that runtime's CLI:

```sh
dsh plugin --profile desktop add "git+https://github.com/Burns1028/dsh-plugin-project-mode.git#v0.1.21"
```

Alternatively, install the `dsh-plugin-project-mode-0.1.21-npm.tgz` asset from [Releases](https://github.com/Burns1028/dsh-plugin-project-mode/releases). The Git root forwards to the nested Cordis bundle and includes built artifacts; no build hook is required at installation. A packaged Desktop application needs a separately prepared compatible runtime; this project does not offer a one-click Desktop patch installer.

## Verification and limits

[Verification](docs/verification.md) distinguishes native integration tests, package consumer checks and a real Desktop model task. [Manual verification](docs/manual-verification.md) covers turn closure, delivery, capsule ownership, tools, recovery and UI checks.

This is a local-first DSH extension, not a second Agent loop. Permissions, approvals, persistence, queueing and execution remain DSH-owned. Private conversations, credentials, screenshots and private development history are excluded from this public snapshot.

MIT. See [third-party notices](THIRD_PARTY_NOTICES.md).
