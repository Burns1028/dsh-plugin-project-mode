# DeepSeek Harness Project Mode

一个持续负责项目的 Coordinator，管理可继续交流的 Workers，并共同积累项目知识。基于 DSH 原生会话、投递和 Agent Loop 实现。

**开发预览版 v0.1.21。** 当前适配 DSH **0.2.1-rc.3 加本仓库列出的三个兼容扩展**，原版 rc.3 无法启用。没有自动修改应用的安装钩子，也没有发布到 npm。

## MOA 的职责

Coordinator 接管原本由人完成的分工、上下文供给、引导、排队、结果审阅和后续判断。它维护 `notes.md` 中的待办、分工、进度和阻塞，以及 `archived.md` 中完成或告一段落的工作及结果。

`context/context.md` 是共享知识索引，记录上下文文件的位置和简短介绍。Agents 先读索引，再按需读取正文。Workers 补充有价值、可复用的发现；Coordinator 更多负责整理、合并和删除过时、重复内容。双方都可以维护上下文。

新消息到来先查看 Workers 状态，了解用户对子会话的直接操作，再判断复用或派生。下发完整目标后更新工作记录。`steer` 引导当前工作，`queue` 留待当前 turn 结束，`interrupt` 停止执行，`delete` 移除 Worker。Worker 每轮结束自动回传最后一条完整 AI 消息；没有 AI 消息也返回空结果及完成信息，让 Coordinator 自行查看历史、恢复或重新下发。

## 界面与执行

- Coordinator 用 `control_workers` 替换原生派生与控制工具；其他会话保留原生工具。
- 相关 Worker 结果接收并处理后，Coordinator 在同一个原生 turn 内收口。Stop 保持原生语义，不自动停止所有 Workers。
- 胶囊归属于参与工作的 turn 和用户消息段。派生、下发更新、接收结果产生新的位置；旧位置保留，普通用户回复不搬动胶囊。已删除 Worker 不再出现在胶囊和 Project 列表中。
- 原生侧栏展开 Worker，标题对齐并显示状态与身份图标。Worker 输入框只显示 `Back`，不提供独立权限选择，使用 DSH 原生派生权限继承。
- 右侧默认打开 Workers 和 notes.md 两个原生 Tab，允许关闭。Workers 显示每轮时间轴，原始输入与最终 AI 输出默认折叠，点击展开 Markdown。
- Project 会话启动后身份固定。归档主会话会一起归档它管理的 Workers。

职责通过提示词表达，不增加关键词路由、时间阈值或执行拦截来强迫派发。模型的自然分工判断仍有波动，预览版不保证每次都作出理想选择。

## 开发与安装

完整命令见 [英文 README](README.md#development)。需要 Node 24.9+、npm 和 Git。先 `npm ci`，显式运行兼容补丁脚本，完成测试和打包。兼容脚本核对版本及 hash、保存备份、失败时回滚，没有安装钩子自动修改应用。

兼容运行时准备好后：

```sh
dsh plugin --profile desktop add "git+https://github.com/Burns1028/dsh-plugin-project-mode.git#v0.1.21"
```

也可以安装 [Releases](https://github.com/Burns1028/dsh-plugin-project-mode/releases) 中的 npm tgz。打包后的 Desktop 需要单独准备兼容运行时，本项目没有一键修改 Desktop 的安装器。

参见 [架构](docs/moa-architecture.md)、[兼容说明](docs/compatibility.md)、[工具 API](docs/tool-api.md)、[验证记录](docs/verification.md) 与 [手工验收](docs/manual-verification.md)。MIT 开源；本仓库不包含私人对话、截图、凭据或私人开发历史。
