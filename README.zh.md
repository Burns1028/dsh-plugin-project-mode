# DeepSeek Harness Project Mode

让一个持续负责项目的 Coordinator 管理 Workers、维护项目知识，并判断工作下一步该如何推进。

[English](README.md) · [MOA 模型](docs/moa-architecture.md) · [代码架构](docs/architecture.md) · [贡献指南](CONTRIBUTING.md)

**开发预览版：v0.1.21。** 需要 DSH **0.2.1-rc.3 及本仓库列出的三个兼容扩展**，原版 rc.3 无法启用插件。安装前请先阅读[兼容说明](docs/compatibility.md)。

## 它做什么

多个 Agent 一起工作时，通常需要人来决定如何分工、在对话之间传递上下文、追踪进度、审阅结果。Project Mode 将这份持续的协调职责交给项目主会话中的 Coordinator。

Coordinator 通过 `control_workers` 管理可持续交流的 Worker 会话。它可以派生或复用 Worker、引导当前工作、排队下发后续指令、查看对话、打断执行或从项目中删除 Worker。它审阅结果，再决定继续、调整分工还是收口。

执行使用 DSH 原生的 Session、Agent Loop、工具、权限和消息投递。插件提供项目协调能力，并增加少量界面入口。

## 人、Coordinator 和 Worker 如何协作

| 角色 | 职责 |
| --- | --- |
| 用户 | 提出目标、作出决定、与 Coordinator 沟通，也可以进入 Worker 会话直接引导工作。 |
| Coordinator | 选择和引导 Workers、供给上下文、审阅结果、维护工作记录、整理共享知识并汇报进展。澄清、汇总和简单独立操作也可以由它自己完成。 |
| Worker | 完成分配的调查或执行任务，补充可复用的发现，以一条自包含的最终 AI 消息返回结果。 |

常见流程：

1. 用户把目标交给 Coordinator。它查看 Workers 状态和相关项目记忆，了解用户对子会话的直接操作。
2. 它判断复用已有 Worker 还是派生新 Worker，下发目标和上下文，再更新 `notes.md`。
3. 工作发生变化时，用 **steer** 引导当前工作，用 **queue** 将指令留到当前 turn 结束后处理。打断和删除是另外的操作。
4. Worker 每轮结束自动返回最后一条完整 AI 消息。没有 AI 消息的轮次，也会通知 Worker 身份、轮次和结果状态，并返回空的 AI 结果。
5. Coordinator 审阅后继续下发或结束工作，更新工作记录和可复用上下文。正常情况下，相关工作和结果接收完成后，在同一个原生 Coordinator turn 内收口。

用户直接操作 Worker 后，再与 Coordinator 沟通时，它可以查看当前状态并按需回看对话。

## 项目记忆

```text
.dsh/project-mode/<project-id>/
├── notes.md                 待办、分工、进度、阻塞和下一步
├── archived.md              完成或告一段落的工作及其结果
└── context/
    ├── context.md           共享索引：文件路径和简短介绍
    ├── decisions.md         可复用的决定与依据，按需创建
    └── ...                  其他可复用的项目知识
```

`notes.md` 和 `archived.md` 由 Coordinator 维护，让它知道项目进行到了哪里、还有什么需要推进。

上下文由 Coordinator 和 Workers 共同维护。Agent 先读 `context/context.md`，再按当前任务需要读取具体文件。Workers 补充有价值、可复用的发现，并更新索引；Coordinator 更多负责整理、合并、删除过时或重复的内容。日常进度保留在工作记录中。

这些文件随项目持续积累，采用渐进式加载，不会在每次请求中全量展开。详细职责见 [MOA 模型](docs/moa-architecture.md)。

## 在 DSH 中使用

- 新建会话，在发送第一条消息前选择 **Project**。首次 turn 启动后，Project 身份固定。
- 在原生工作区侧栏展开 Coordinator，打开其 Workers。每个 Worker 都有稳定的身份图标和当前状态。
- 点击主会话里的 Worker 胶囊进入子会话。胶囊保留在派发、更新或接收结果所对应的对话段，后续普通回复不会搬动旧胶囊。
- 右侧默认打开 **Workers** 和 **notes.md**。Workers 按由近到远的顺序展示每轮原始输入、最终 AI 输出和记录的产物；输入、输出默认折叠，点击展开。两个 Tab 都允许关闭。
- Worker 输入框提供返回 Coordinator 的 **Back**，沿用原生派生权限，不提供独立权限选择器。归档主会话时，其管理的 Workers 一起归档。

原生派生和控制工具仅在 Coordinator 的 Agent 作用域中替换，Workers 与普通会话保留原生工具组合。Stop 保持可用，不会自动停止所有 Workers。

## 安装

先按[兼容说明](docs/compatibility.md)准备实际要使用的 DSH 运行时，再通过该运行时的 CLI 安装指定版本：

```sh
dsh plugin --profile desktop add "git+https://github.com/Burns1028/dsh-plugin-project-mode.git#v0.1.21"
```

也可以安装 [Releases](https://github.com/Burns1028/dsh-plugin-project-mode/releases/tag/v0.1.21) 中的 `dsh-plugin-project-mode-0.1.21-npm.tgz`。

在 DSH 插件页启用插件，打开工作区，新建会话，并在发送第一条消息前选择 **Project**。

仓库已包含 Git 安装所需的构建产物。没有自动修改应用的安装钩子，也没有发布到 npm。给本仓库开发依赖打补丁，不会同时修改已安装的 DSH 应用；打包后的 Desktop 需要单独准备兼容运行时。兼容文档说明了显式补丁脚本、版本校验以及备份和恢复方式。

## 开发

需要 Node **24.9+**、npm 和 Git。

```sh
git clone https://github.com/Burns1028/dsh-plugin-project-mode.git
cd dsh-plugin-project-mode
npm ci
node scripts/apply-native-compat.mjs --dry-run
node scripts/apply-native-compat.mjs --backup "$PWD/.superpowers/native-backup"
npm test -- --maxWorkers=1
```

`npm test` 会先构建插件。修改 `packages/project-mode/src`，通过构建重新生成并提交 `lib` 产物。类型检查、原生接口测试、安装包验证和测试地图见[贡献指南](CONTRIBUTING.md)。

| 文档 | 内容 |
| --- | --- |
| [MOA 模型](docs/moa-architecture.md) | 角色职责与渐进式共享上下文 |
| [代码架构](docs/architecture.md) | 模块、函数、数据结构和执行路径 |
| [工具 API](docs/tool-api.md) | Worker 控制、消息投递和历史窗口 |
| [兼容说明](docs/compatibility.md) | rc.3 所需的显式运行时扩展 |
| [验证记录](docs/verification.md)／[手工验收](docs/manual-verification.md) | 已验证内容与真实应用检查方法 |

## 当前限制

分工仍由模型判断，预览版不保证每次都作出理想选择，也不使用任务关键词、命令次数或时间阈值强迫派发。

目前仍有错误隔离和 Worker 列表一致性问题，详见[当前维护欠账](docs/architecture.md#current-maintenance-debt)。[验证记录](docs/verification.md)区分了已确认的问题和发行时通过的检查。

## 许可证

MIT。参见 [LICENSE](LICENSE) 和[第三方声明](THIRD_PARTY_NOTICES.md)。
