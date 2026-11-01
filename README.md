# Project Mode for DeepSeek Harness

Give a project a persistent Coordinator that manages Workers, maintains project knowledge and decides how to move the work forward.

[中文](README.zh.md) · [MOA model](docs/moa-architecture.md) · [Code architecture](docs/architecture.md) · [Contributing](CONTRIBUTING.md)

**Developer preview: v0.1.21.** Requires DSH **0.2.1-rc.3 with the three compatibility extensions documented in this repository**. Stock rc.3 cannot enable the plugin. Read [Compatibility](docs/compatibility.md) before installing.

## What Project Mode does

Working with several Agents usually means someone has to choose who does what, carry context between conversations, follow up on progress and reconcile the results. Project Mode gives that continuing responsibility to a Coordinator in the project's main conversation.

The Coordinator manages persistent Worker conversations through `control_workers`. It can create or reuse a Worker, guide current work, queue a later instruction, inspect its conversation, interrupt it or remove it from the project. It reviews results and decides whether to continue, reassign or conclude.

Execution uses native DSH Sessions, Agent Loop, tools, permissions and message delivery. Project Mode adds project coordination and a small set of interface extensions.

## People, Coordinator and Workers

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

## In DSH

- Select **Project** for a new conversation before its first message. Its Project identity stays fixed after the first turn starts.
- Expand the Coordinator in the original workspace sidebar to open its Workers. Each has a stable identity icon and current status.
- Click a Worker capsule in the main conversation to open that child. Capsules stay with the conversation segment where work was dispatched, updated or received; later passive replies do not move them.
- Use the default **Workers** and **notes.md** tabs on the right. Workers shows a newest-first timeline of original input, final AI output and recorded artifacts. Input/output are collapsed until opened. Both tabs are closable.
- Worker composers provide **Back** to the Coordinator and use native delegated permissions without an independent permission picker. Archiving the Project brings its managed Workers along.

Coordinator delegation/control tools are replaced only in that Agent's scope. Workers and ordinary conversations retain native composition. Native Stop remains available and does not automatically stop every Worker.

## Installation

Prepare the DSH runtime you intend to use according to [Compatibility](docs/compatibility.md), then install the tagged bundle through that runtime's CLI:

```sh
dsh plugin --profile desktop add "git+https://github.com/Burns1028/dsh-plugin-project-mode.git#v0.1.21"
```

You can also install `dsh-plugin-project-mode-0.1.21-npm.tgz` from [Releases](https://github.com/Burns1028/dsh-plugin-project-mode/releases/tag/v0.1.21).

Enable the plugin in DSH's Plugins page, open a workspace, create a conversation and select **Project** before sending the first message.

The repository includes built artifacts for Git installation. There is no automatic application patching or npm publication. Patching this checkout's development dependencies does not patch your installed DSH application; a packaged Desktop needs a separately prepared compatible runtime. The compatibility guide documents the explicit helper, exact-version checks and backup/restore requirements.

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

| Read this | To understand |
| --- | --- |
| [MOA model](docs/moa-architecture.md) | Role responsibilities and progressive shared context |
| [Code architecture](docs/architecture.md) | Modules, functions, data structures and execution paths |
| [Tool API](docs/tool-api.md) | Worker control, message delivery and history windows |
| [Compatibility](docs/compatibility.md) | The explicit rc.3 runtime extensions |
| [Verification](docs/verification.md) / [Manual checks](docs/manual-verification.md) | What was tested and how to check a real application |

## Current limits

Delegation remains a model judgment. This preview does not guarantee ideal task ownership on every request, and does not use task keywords or command/time thresholds to force it.

Known issues include error isolation and Worker-list consistency. They are documented under [maintenance debt](docs/architecture.md#current-maintenance-debt), with the [verification record](docs/verification.md) distinguishing confirmed issues from passing release checks.

## License

MIT. See [LICENSE](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md).
