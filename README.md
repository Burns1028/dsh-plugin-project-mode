# Project Mode for DeepSeek Harness

Give a project a persistent Coordinator that manages Workers, maintains project knowledge and decides how to move the work forward.

English | [简体中文](README.zh.md)

[![Project Mode actual result: two Workers, a generated note bundle and nine passing tests](docs/media/workflow-result.png)](docs/media/project-workflow.mp4)

**One project, a persistent team.** Delegate work, open any Worker, and keep the next steps in view.

[Watch the 60-second workflow](docs/media/project-workflow.mp4) · [Explore the screenshots](#see-it-in-action) · [Install](#quick-start)

**Unofficial developer preview: v0.1.23.** Requires DSH **0.2.1-rc.3 with the three compatibility extensions documented in this repository**. The isolated setup below prepares these extensions for you; stock rc.3 cannot enable the plugin directly. See [Compatibility](docs/compatibility.md).

## Contents

- [Core capabilities](#core-capabilities)
- [See it in action](#see-it-in-action)
- [Quick start](#quick-start)
- [User guide](#user-guide)
- [Project memory](#project-memory)
- [Features in DSH](#features-in-dsh)
- [Project structure](#project-structure)
- [Development](#development)
- [API and documentation](#api-and-documentation)
- [Current limits](#current-limits)
- [License](#license)

## Core capabilities

Project Mode gives the coordination work of a multi-Agent project to a persistent Coordinator in the main conversation. You set the goal; it chooses Workers, follows their progress, reviews results and keeps project knowledge useful across tasks.

| Capability | What it gives you |
| --- | --- |
| Persistent coordination | One Coordinator conversation owns the project's work records and next steps. |
| Full Worker control | Create or reuse Workers, steer current work, queue later instructions, inspect status and history, interrupt or delete. |
| Shared project knowledge | Coordinator and Workers maintain an index and load relevant context progressively. |
| Automatic result return | Each ended Worker turn returns its full final AI message for Coordinator review. |
| Direct human participation | Open a Worker, guide it yourself, then return to the Coordinator. |
| Native DSH execution | Sessions, Agent Loop, tools, permissions, message delivery and Stop stay with DSH. |

## See it in action

A small CLI change makes the handoffs visible: Exporter implements title sorting and tests, Docs maintains the usage guide, and the Coordinator reviews their results. A human changes the ordering inside Exporter's conversation; a later task adds another note using the accepted contract.

[![Real workflow: dispatch Workers, update one directly, review the result and reuse shared context](docs/media/project-workflow.gif)](docs/media/project-workflow.mp4)

The edited recording shows a real CLI task: **dispatch Workers → human changes title sorting inside Exporter → Coordinator catches up → next turn reuses the same Workers and shared context**. Waiting is cut and labeled throughout; it is not a 60-second completion claim. The finished sample passed 9 real tests. [Try the task](docs/demo-workflow.md) or [inspect its actual result](docs/demo-result). [Open the MP4](docs/media/project-workflow.mp4) for playback controls, or [view the workspace screenshot](docs/media/project-workspace.png) at full size.
[![Actual result: the later task preserves the accepted order and passes nine tests](docs/media/workflow-result.png)](docs/media/workflow-result.png)

### Follow each Worker's work

Choose a Worker to see its turns from newest to oldest. Expand the original instruction and final AI response when you need the detail; open recorded artifacts or jump into the conversation to guide it yourself.

[![Worker timeline with two turns, expanded input and output, and links to recorded artifacts](docs/media/worker-timeline.png)](docs/media/worker-timeline.png)

### Keep the project ready for the next task

`notes.md` stays beside the conversation: goal, delivered work, current status and next steps. The Coordinator maintains it while reusable knowledge accumulates under the shared context index.

[![Project notes rendered in DSH with the goal, delivered files, current status and follow-up work](docs/media/project-notes.png)](docs/media/project-notes.png)

The workflow video uses the v0.1.23 isolated runtime and the public Note Bundle fixture. The earlier detail screenshots show the fictional **Project Atlas** workspace on v0.1.22. These are real DSH captures, not product mockups or speed benchmarks. [Capture details and reuse](docs/media/README.md).

## Quick start

The easiest first run is a separate **compatible DSH Web environment**. Requires Node **24.9+**, npm and Git:

```sh
git clone --branch v0.1.23 https://github.com/Burns1028/dsh-plugin-project-mode.git
cd dsh-plugin-project-mode
node scripts/project-mode.mjs setup
node scripts/project-mode.mjs start
```

Setup installs the locked rc.3 runtime and applies exactly the three reviewed extensions inside `~/.dsh-project-mode/rc3`. Your ordinary Desktop app, `~/.dsh`, global Agent configuration and workspaces are not reused. The native Web UI opens locally; configure your model, create a conversation and select **Project** before its first message.

Use `node scripts/project-mode.mjs doctor` to check the prepared environment. See the [first-run guide](docs/quickstart.md) for locations, restart and recovery, and try the [reproducible project task](docs/demo-workflow.md).

For an already prepared compatible Desktop/runtime, the plugin can still be installed through its native CLI:

```sh
dsh plugin --profile desktop add "git+https://github.com/Burns1028/dsh-plugin-project-mode.git#v0.1.23"
```

Stock rc.3 remains incompatible. The setup script is explicit, not an npm installation hook, and does not patch an existing Desktop app. [Compatibility](docs/compatibility.md) documents the three native extensions and manual route; tagged bundles are on [Releases](https://github.com/Burns1028/dsh-plugin-project-mode/releases).

## User guide

| Role | Responsibility |
| --- | --- |
| You | Set goals, make decisions and talk to the Coordinator. You can also open a Worker and guide it directly. |
| Coordinator | Choose and guide Workers, supply context, review results, maintain work records, organize shared knowledge and report progress. It can handle clarification, synthesis and small self-contained actions itself. |
| Worker | Carry an assigned investigation or execution through to a result, contribute reusable findings and return a self-contained final AI message. |

A usual workflow:

1. You bring a goal to the Coordinator. It checks Workers and relevant project memory, including direct user activity in child conversations.
2. It chooses an existing Worker or creates one, supplies the goal and context, then updates `notes.md`.
3. As work changes, it uses **steer** to guide the current work or **queue** to leave an instruction for after the current turn. Interrupt and delete remain separate actions.
4. Each Worker turn automatically returns its complete last committed AI message. A turn without an AI message still reports its identity and outcome with an empty AI result.
5. The Coordinator reviews the result, follows up or concludes, and updates work records and reusable context. Normal closure waits for relevant work and result consumption within the same native Coordinator turn.

When you operate a Worker directly, the Coordinator can inspect its current state and read the conversation as needed when you return.

## Project memory

```text
.dsh/project-mode/<project-id>/
├── notes.md                 Todos, assignments, progress, blockers, next steps
├── archived.md              Concluded work and its results
└── context/
    ├── context.md           Shared index: file paths and short descriptions
    ├── decisions.md         Reusable decisions and their reasons, created as needed
    └── ...                  Other reusable project knowledge
```

The Coordinator maintains `notes.md` and `archived.md` so it knows where the project stands and what needs attention.

Both the Coordinator and Workers maintain context. They read `context/context.md` first, then open the files needed for the current task. Workers contribute valuable reusable findings and update the index. The Coordinator primarily organizes, consolidates and prunes that knowledge. Routine progress stays in the work records.

These documents persist with the project; they are loaded progressively rather than copied into every request. [The MOA model](docs/moa-architecture.md) describes these responsibilities in more detail.

## Features in DSH

- Select **Project** for a new conversation before its first message. Its Project identity stays fixed after the first turn starts.
- Expand the Coordinator in the original workspace sidebar to open its Workers. Each has a stable identity icon and current status.
- Click a Worker capsule in the main conversation to open that child. Capsules stay with the conversation segment where work was dispatched, updated or received; later passive replies do not move them.
- Use the default **Workers** and **notes.md** tabs on the right. Workers shows a newest-first timeline of original input, final AI output and recorded artifacts. Each message shows up to two lines of text with an ellipsis for overflow; click the message to expand its original Markdown or collapse it. Both tabs are closable.
- Worker composers provide **Back** to the Coordinator and use native delegated permissions without an independent permission picker. Archiving the Project brings its managed Workers along.

Coordinator delegation/control tools are replaced only in that Agent's scope. Workers and ordinary conversations retain native composition. Native Stop remains available and does not automatically stop every Worker.

## Project structure

```text
packages/project-mode/
├── src/host/       Project lifecycle, Worker operations and result delivery
├── src/client/     Sidebar, capsules and project tabs
├── src/shared/     Shared types and contracts
└── lib/            Built plugin artifacts
compat/rc3/         Audited runtime compatibility patches
scripts/            Build, compatibility and verification helpers
tests/              Regression and native contract checks
docs/               Model, architecture, API and verification guides
```

## Development

Requires Node **24.9+**, npm and Git.

```sh
git clone https://github.com/Burns1028/dsh-plugin-project-mode.git
cd dsh-plugin-project-mode
npm ci
node scripts/apply-native-compat.mjs --dry-run
node scripts/apply-native-compat.mjs --backup "$PWD/.superpowers/native-backup"
npm test -- --maxWorkers=1
```

`npm test` builds the plugin first. Edit `packages/project-mode/src`; regenerate the committed `lib` artifacts through the build. See [Contributing](CONTRIBUTING.md) for typechecks, native contracts, package consumer verification and the test map.

## API and documentation

The Coordinator uses `control_workers` with `spawn`, `list`, `get`, `send`, `history`, `interrupt` and `delete`. `send` distinguishes current-work **steer** from next-turn **queue**. See the tool API for arguments, examples and result semantics.

| Read this | To understand |
| --- | --- |
| [MOA model](docs/moa-architecture.md) | Role responsibilities and progressive shared context |
| [Code architecture](docs/architecture.md) | Modules, functions, data structures and execution paths |
| [Tool API](docs/tool-api.md) | Worker control, message delivery and history windows |
| [Compatibility](docs/compatibility.md) | The explicit rc.3 runtime extensions |
| [Verification](docs/verification.md) / [Manual checks](docs/manual-verification.md) | What was tested and how to check a real application |

## Current limits

Delegation remains a model judgment. This preview does not guarantee ideal task ownership on every request, and does not use task keywords or command/time thresholds to force it.

Try Project Mode on a small project and share your workflow or installation feedback in [trial feedback](https://github.com/Burns1028/dsh-plugin-project-mode/issues/new?template=project-mode-trial.yml). If you would like to follow its development, a star helps others discover it.

## License

MIT. See [LICENSE](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md).
