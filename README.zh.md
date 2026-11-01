# DeepSeek Harness Project Mode

让一个持续负责项目的 Coordinator 管理 Workers、维护项目知识，并判断工作下一步该如何推进。

[English](README.md) | 简体中文

**开发预览版：v0.1.22。** 需要 DSH **0.2.1-rc.3 及本仓库列出的三个兼容扩展**，原版 rc.3 无法启用插件。安装前请先阅读[兼容说明](docs/compatibility.md)。

## 目录

- [核心能力](#核心能力)
- [快速开始](#快速开始)
- [使用指南](#使用指南)
- [项目记忆](#项目记忆)
- [DSH 界面功能](#dsh-界面功能)
- [项目结构](#项目结构)
- [开发](#开发)
- [API 与文档](#api-与文档)
- [当前限制](#当前限制)
- [许可证](#许可证)

## 核心能力

Project Mode 将多 Agent 项目中的协调工作交给主会话中持续负责项目的 Coordinator。用户提出目标，它选择 Workers、跟进进度、审阅结果，让项目知识在后续任务中继续发挥作用。

| 能力 | 带来的帮助 |
| --- | --- |
| 持续协调 | 同一个 Coordinator 会话维护项目工作记录，判断下一步。 |
| 完整的 Worker 控制 | 派生或复用 Worker、引导当前工作、排队下发后续指令、查看状态与历史、打断或删除。 |
| 共享项目知识 | Coordinator 与 Workers 共同维护索引，按需渐进加载上下文。 |
| 自动返回结果 | Worker 每轮结束后自动返回完整的最终 AI 消息，交给 Coordinator 审阅。 |
| 用户直接参与 | 进入 Worker 直接引导工作，再返回 Coordinator 继续协调。 |
| DSH 原生执行 | Session、Agent Loop、工具、权限、消息投递和 Stop 均由 DSH 承担。 |

## 快速开始

1. 按[兼容说明](docs/compatibility.md)准备 DSH **0.2.1-rc.3**，包含以下三个显式扩展：
   - Agent 作用域内可撤销的 `tools.suppress({ deny })`。
   - 会话级 `conversation.submission.register(sessionId, "steer")`。
   - 用于原生父子会话行的 `sidebar.workspaces.session.branch`。
2. 通过该运行时的 CLI 安装指定版本：

```sh
dsh plugin --profile desktop add "git+https://github.com/Burns1028/dsh-plugin-project-mode.git#v0.1.22"
```

各版本安装包见 [Releases](https://github.com/Burns1028/dsh-plugin-project-mode/releases)。

在 DSH 插件页启用插件，打开工作区，新建会话，并在发送第一条消息前选择 **Project**。

仓库已包含 Git 安装所需的构建产物。没有自动修改应用的安装钩子，也没有发布到 npm。给本仓库开发依赖打补丁，不会同时修改已安装的 DSH 应用；打包后的 Desktop 需要单独准备兼容运行时。兼容文档说明了显式补丁脚本、版本校验以及备份和恢复方式。

## 使用指南

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

## DSH 界面功能

- 新建会话，在发送第一条消息前选择 **Project**。首次 turn 启动后，Project 身份固定。
- 在原生工作区侧栏展开 Coordinator，打开其 Workers。每个 Worker 都有稳定的身份图标和当前状态。
- 点击主会话里的 Worker 胶囊进入子会话。胶囊保留在派发、更新或接收结果所对应的对话段，后续普通回复不会搬动旧胶囊。
- 右侧默认打开 **Workers** 和 **notes.md**。Workers 按由近到远的顺序展示每轮原始输入、最终 AI 输出和记录的产物；输入、输出默认折叠，点击展开。两个 Tab 都允许关闭。
- Worker 输入框提供返回 Coordinator 的 **Back**，沿用原生派生权限，不提供独立权限选择器。归档主会话时，其管理的 Workers 一起归档。

原生派生和控制工具仅在 Coordinator 的 Agent 作用域中替换，Workers 与普通会话保留原生工具组合。Stop 保持可用，不会自动停止所有 Workers。

## 项目结构

```text
packages/project-mode/
├── src/host/       项目生命周期、Worker 操作和结果投递
├── src/client/     侧栏、胶囊和项目页签
├── src/shared/     共享类型与接口契约
└── lib/            插件构建产物
compat/rc3/         经审计的运行时兼容补丁
scripts/            构建、兼容和验证脚本
tests/              回归与原生接口测试
docs/               模型、架构、API 和验证文档
```

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

## API 与文档

Coordinator 通过 `control_workers` 使用 `spawn`、`list`、`get`、`send`、`history`、`interrupt` 和 `delete`。`send` 区分引导当前工作的 **steer** 与留待下一轮处理的 **queue**。参数、示例和结果语义见工具 API。

| 文档 | 内容 |
| --- | --- |
| [MOA 模型](docs/moa-architecture.md) | 角色职责与渐进式共享上下文 |
| [代码架构](docs/architecture.md) | 模块、函数、数据结构和执行路径 |
| [工具 API](docs/tool-api.md) | Worker 控制、消息投递和历史窗口 |
| [兼容说明](docs/compatibility.md) | rc.3 所需的显式运行时扩展 |
| [验证记录](docs/verification.md)／[手工验收](docs/manual-verification.md) | 已验证内容与真实应用检查方法 |

## 当前限制

分工仍由模型判断，预览版不保证每次都作出理想选择，也不使用任务关键词、命令次数或时间阈值强迫派发。

## 许可证

MIT。参见 [LICENSE](LICENSE) 和[第三方声明](THIRD_PARTY_NOTICES.md)。
