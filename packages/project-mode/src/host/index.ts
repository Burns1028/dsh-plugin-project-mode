import type {} from "@deepseek-ai/dsh-agent-preset-registry";
import { CompletionOutbox } from "./completion-outbox.ts";
import { WorkerOperations } from "./worker-operations.ts";
import { TurnCoordination } from "./turn-coordination.ts";
import { readHistory } from "./history.ts";
import { followWorkerTimeline } from "./worker-timeline.ts";
import { bindProjectArchives } from "./project-archive.ts";
import { repairCapsuleOwnership } from "./capsule-participation.ts";
import type { HostAccess } from "./host-access.ts";
import { Context, Service } from "@deepseek-ai/cordis";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { SessionId, type SessionEvent } from "@deepseek-ai/dsh-session";
import { freezeMessage } from "@deepseek-ai/dsh-llm";
import { controlSchema, historySchema } from "./control.ts";
import {
  ordinarySessionResolver,
  resolveOrdinaryAgent,
  toolOperationId,
  registerProjection,
  projected,
  abortableChange,
  waitForTurn,
  observeForTurn,
} from "./native.ts";
import type {} from "@deepseek-ai/dsh-api-session-controller";
import type { Agent } from "@deepseek-ai/dsh-agent";
import type { Domain } from "@deepseek-ai/dsh-storage-domain";
import type {} from "@deepseek-ai/dsh-fs";
import type {} from "@deepseek-ai/dsh-api-remote-access";
import type {} from "@deepseek-ai/dsh-working-directory";
import type {} from "@deepseek-ai/dsh-sandbox-policy";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { randomUUID } from "node:crypto";
import { resolve, relative, isAbsolute } from "node:path";
import { Config } from "./config.ts";
import { coordinatorPrompt } from "./coordinator-prompt.ts";
import { workerPrompt } from "./worker-prompt.ts";
import {
  contextIndexPath,
  contextIndexTemplate,
  ensureContextIndex,
} from "./project-memory.ts";
import { readWorkerActivity } from "./worker-activity.ts";
import {
  domainSpec,
  recordSchema,
  type RecordState,
  type Worker,
} from "./state.ts";
import type {
  ControlWorkersRequest,
  ControlResult,
  ProjectSnapshot,
  ProjectFrame,
  WorkerView,
  WorkerHistoryPage,
  WorkerTimelinePage,
  CoordinatorTurnView,
  SessionModeView,
} from "../shared/index.ts";
export { Config } from "./config.ts";
export * from "../shared/index.ts";

function hasOwnTurn(
  events: readonly SessionEvent[],
  inheritedEventCount: number,
) {
  return events.some(
    (event) => event.type === "turn/start" && event.seq >= inheritedEventCount,
  );
}

declare module "@deepseek-ai/dsh-llm" {
  interface MessageSourceMap {
    "project-mode-result": {
      kind: "project-mode-result";
      form: "relay";
      completionId: string;
      workerId: SessionId;
      workerTurn: number;
    };
    "project-mode-assignment": {
      kind: "project-mode-assignment";
      form: "relay";
      operationId: string;
      coordinatorSessionId: SessionId;
    };
    "project-mode-notice": {
      kind: "project-mode-notice";
      form: "notice";
      summary: string;
    };
  }
}
declare module "@deepseek-ai/cordis" {
  interface Context {
    projectMode: ProjectMode;
  }
}
/** Native Project coordination; no alternative Agent driver. */
export default class ProjectMode extends TypertRemoteService {
  static Config = Config;
  static inject = [
    "agents",
    "tools",
    "systemPrompt",
    "sessionProjections",
    "sessions",
    "subagents",
    "sessionQuery",
    "storage",
    "storageDomain",
    "workingDirectory",
    "fs",
  ];
  private domain!: Domain<typeof domainSpec>;
  private outbox!: CompletionOutbox;
  private workers!: WorkerOperations;
  private turns!: TurnCoordination;
  private get access(): HostAccess {
    return {
      ctx: this.ctx,
      config: this.config,
      closing: this.closing,
      errors: this.errors,
      listeners: this.listeners,
      record: (id) => this.record(id),
      owner: (id) => this.owner(id),
      worker: (r, id) => this.worker(r, id),
      update: (id, fn) => this.update(id, fn),
      requireCoordinator: (agent) => this.requireCoordinator(agent),
      view: (worker, signal) => this.view(worker, signal),
      inspect: (worker, signal, details) =>
        this.inspect(worker, signal, details),
      readHistory: (...args) => this.readHistory(...args),
      enqueue: (work) => this.enqueue(work),
      notify: () => this.notify(),
      ingest: (id) => this.ingest(id),
      settledJobs: () => this.jobs,
      pendingOperations: (id) =>
        [...this.workers.operations.keys()].filter(
          (key) => JSON.parse(key)[0] === id,
        ).length,
    };
  }

  private mounted = new Map<Agent, { key: string; dispose: () => void }>();
  private reconcilingTools = false;
  private toolsChangedDuringReconciliation = false;
  private controlTool!: ReturnType<typeof defineTool>;
  private jobs: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();
  private progress = new Map<SessionId, string>();
  private workerInputSnapshots = new Map<SessionId, string>();
  private epoch = randomUUID();
  private errors = new Map<string, string>();
  private available = false;
  private closing = new AbortController();
  constructor(
    ctx: Context,
    private config: Config,
  ) {
    super(ctx, "projectMode");
  }
  protected async [Service.init]() {
    if (typeof this.ctx.tools.suppress !== "function")
      throw new Error(
        "project-mode/native-compatibility-required: install the rc.3 Project Mode tool-suppression compatibility patch",
      );
    this.domain = await this.ctx.storage.domain.open(domainSpec);
    const archives = bindProjectArchives(this.ctx, this.domain, (id, fn) =>
      this.update(id, fn),
    );
    this.outbox = new CompletionOutbox(this.access);
    this.workers = new WorkerOperations(this.access);
    this.turns = new TurnCoordination(this.access);
    await registerProjection(this.ctx);
    // Tool guidance uses named sections. Preserve other providers' text and
    // native complete-prompt ownership; never rewrite arbitrary prompt strings.
    const hiddenToolSections = new Set(
      this.config.coordinatorHiddenTools.map((name) => `tool:${name}`),
    );
    this.ctx.on(
      "system-prompt/assemble",
      async (_assembly, { agent }, next) => {
        const prompt = await next();
        if (!agent || this.record(agent.id)?.project.mode !== "enabled")
          return prompt;
        return {
          ...prompt,
          sections: prompt.sections.filter(
            (s) => !hiddenToolSections.has(s.name),
          ),
        };
      },
    );
    this.ctx.systemPrompt.context({
      name: "project-mode:role",
      order: 650,
      required: true,
      interpolate: false,
      text: ({ agent }) => (agent ? this.roleText(agent) : ""),
    });
    this.ctx.systemPrompt.context({
      name: "project-mode:worker-state",
      order: 660,
      required: true,
      interpolate: false,
      text: ({ agent }) =>
        agent && this.record(agent.id)?.project.mode === "enabled"
          ? (this.workerInputSnapshots.get(agent.id) ?? "")
          : "",
    });
    // Role policy belongs in the system message. A runtime-context snapshot is
    // user-role data and does not replace the Standard preset's coding-agent
    // and native-subagent guidance. Keep the required context for live paths
    // and for presets that deliberately own their complete system prompt.
    this.ctx.systemPrompt.section({
      name: "project-mode:coordination",
      order: 11000,
      interpolate: false,
      text: ({ agent }) =>
        agent && this.record(agent.id)?.project.mode === "enabled"
          ? coordinatorPrompt
          : "",
    });
    this.controlTool = defineTool({
      name: "control_workers",
      description:
        "Delegate tasks to workers with the same native tools and skills. spawn starts independent execution; send continues it; list/get/history inspect; interrupt/delete manage lifecycle. When waiting for workers, yield your response; results resume this coordinator turn automatically.",
      parameters: {
        action: {
          type: "string",
          required: true,
          description:
            "Action: spawn, list, send, get, history, interrupt, delete",
        },
        name: { type: "string", description: "Worker name" },
        task: { type: "string", description: "Initial task" },
        worker_id: { type: "string", description: "Worker session id" },
        message: { type: "string", description: "Follow-up" },
        delivery: {
          type: "string",
          enum: ["steer", "queue"],
          description: "Immediate step or next turn",
        },
        offset: {
          type: "integer",
          description: "History index from newest (0 = latest visible message)",
        },
        limit: {
          type: "integer",
          description:
            "History window length; returns user/assistant messages newest first",
        },
        task_ref: { type: "string", description: "Task reference" },
      },
      output: {
        schema: { type: "string" },
        render: (_a, value) => [{ type: "text", text: value }],
      },
      execute: async (args, exec) => {
        if (!exec.agent) throw new Error("project-mode/not-coordinator");
        return JSON.stringify(
          await this.controlForAgent(
            exec.agent,
            controlSchema.parse(args),
            toolOperationId(exec),
            exec.signal,
          ),
        );
      },
    });
    this.ctx.on("agent/pre-step", async ({ agent, signal }, next) => {
      const decision = await next();
      const project = this.record(agent.id) ?? this.owner(agent.id);
      if (
        decision.kind !== "enter" ||
        project?.project.mode !== "enabled" ||
        !decision.messages.some((m) =>
          [
            "user",
            "project-mode-assignment",
            "project-mode-result",
            "subagent-settled",
            "agent-message",
          ].includes(m.source.kind),
        )
      )
        return decision;
      const control = AbortSignal.any([signal, this.closing.signal]);
      try {
        await ensureContextIndex(this.ctx, agent, project.project, control);
      } catch (error) {
        control.throwIfAborted();
        // Context migration is best effort; a native permission denial must
        // not prevent clarification or other otherwise-available work.
        this.ctx.logger.warn(`project-mode: context index: ${String(error)}`);
      }
      return decision;
    });
    this.ctx.on("tools/change", () => {
      if (this.closing.signal.aborted) return;
      if (this.reconcilingTools) {
        this.toolsChangedDuringReconciliation = true;
        return;
      }
      for (const agent of this.ctx.agents.list()) this.attach(agent);
    });
    this.ctx.on("agent/created", async ({ agent }) => {
      this.attach(agent);
      if (this.record(agent.id)) this.enqueue(() => this.recover(agent.id));
      this.notify();
      return undefined;
    });
    this.ctx.on("agent/status", () => this.notify());
    this.ctx.on("agent/assistant-stream", ({ agent, frame }) => {
      if (!this.owner(agent.id)) return;
      if (frame.type === "start") this.progress.delete(agent.id);
      if (frame.type === "chunk" && frame.chunk.type === "text-delta")
        this.progress.set(
          agent.id,
          ((this.progress.get(agent.id) ?? "") + frame.chunk.text).slice(
            -this.config.progressTextMaxChars,
          ),
        );
      this.notify();
    });
    this.ctx.on("agent/inbox/inserted", () => this.notify());
    this.ctx.on("session/event", (session, event) => {
      if (
        event.type === "turn/start" &&
        this.record(session.id)?.project.mode === "enabled"
      )
        this.enqueue(async () => {
          const r = this.record(session.id);
          if (r?.project.mode === "enabled" && !r.project.modeLocked)
            await this.update(session.id, (current) => ({
              ...current,
              project: { ...current.project, modeLocked: true },
            }));
        });
      if (this.owner(session.id) && event.type === "turn/start")
        this.progress.delete(session.id);
      if (this.owner(session.id) && event.type === "turn/end") {
        this.outbox.workerCuts.set(session.id, projected(this.ctx, session));
        this.enqueue(() => this.ingest(session.id));
      }
      if (this.record(session.id) && event.type === "user/message") {
        this.outbox.claimed.get(session.id)?.delete(event.data.id);
        this.enqueue(() => this.consume(session.id, event.data.id));
      }
      if (this.record(session.id) && event.type === "turn/end") {
        this.outbox.claimed.delete(session.id);
        this.enqueue(() =>
          this.freezeTurn(session.id, event.data.turn, event.data.reason.kind),
        );
      }
      this.notify();
    });
    this.ctx.on("agent/turn-stopping", async ({ agent, turn, signal }) => {
      if (this.record(agent.id)?.project.mode === "enabled")
        await this.guardTurn(agent, turn, signal);
    });
    this.ctx.on("agent/pre-step", async ({ agent, signal }, next) => {
      if (!this.record(agent.id)) return next();
      const control = AbortSignal.any([signal, this.closing.signal]);
      control.throwIfAborted();
      this.outbox.normalizing.add(agent.id);
      try {
        const decision = await next();
        control.throwIfAborted();
        if (decision.kind !== "enter" || !this.record(agent.id))
          return decision;
        if (
          this.record(agent.id)?.project.mode === "enabled" &&
          decision.messages.some((m) => m.source.kind === "user")
        ) {
          await this.refreshWorkersForInput(
            agent,
            decision.messages
              .filter((m) => m.source.kind === "user")
              .map((m) => m.id),
            control,
          );
        }
        const claimed = this.outbox.claimed.get(agent.id) ?? new Set<string>();
        this.outbox.claimed.set(agent.id, claimed);
        for (const message of decision.messages)
          if (message.source.kind === "project-mode-result")
            claimed.add(message.id);
        const managed = decision.messages.filter((m) => {
          const source = m.source;
          return (
            source.kind === "subagent-settled" &&
            this.record(agent.id)!.workers.some(
              (w) => w.id === source.senderSessionId,
            )
          );
        });

        // A cold worker can settle before the native send receipt is persisted.
        // Await only the already-running admission for that worker, without a
        // worker lock, before replacing its native settlement notice.
        for (const message of managed) {
          if (message.source.kind !== "subagent-settled") continue;
          for (const assignment of this.record(agent.id)!.assignments) {
            if (assignment.workerId !== message.source.senderSessionId)
              continue;
            const admission = this.workers.operations.get(
              JSON.stringify([agent.id, assignment.operationId]),
            );
            if (admission) await waitForTurn(admission, control);
            control.throwIfAborted();
          }
        }
        for (const message of managed) {
          if (message.source.kind === "subagent-settled")
            await waitForTurn(
              this.ingest(message.source.senderSessionId),
              control,
            );
          control.throwIfAborted();
        }
        control.throwIfAborted();
        const messages = decision.messages.filter((m) => !managed.includes(m));
        const r = this.record(agent.id)!;
        for (const d of r.deliveries) {
          if (
            d.state !== "consumed" &&
            d.state !== "suppressed" &&
            !messages.some((m) => m.id === d.message.id)
          ) {
            agent.inbox.remove(d.message.id);
            messages.push(freezeMessage(d.message));
            claimed.add(d.message.id);
          }
        }
        // Native tool-result continuation legitimately enters with no new
        // messages. Only reject an empty step caused by removing duplicate
        // managed settlements; otherwise preserve the native enter decision.
        return managed.length > 0 && messages.length === 0
          ? { kind: "reject" }
          : { ...decision, messages };
      } finally {
        this.outbox.normalizing.delete(agent.id);
      }
    });
    this.ctx.on("agent/disposed", ({ agent }) => {
      this.workerInputSnapshots.delete(agent.id);
      this.mounted.get(agent)?.dispose();
      this.mounted.delete(agent);
    });
    this.ctx.effect(
      () => async () => {
        this.available = false;
        this.closing.abort();
        this.notify();
        this.outbox.dispose();
        // The coordinator survives this plugin. drainDescendants permanently
        // closes its native admission scope until Agent disposal, so release
        // only our selected children after local in-flight admissions settle.
        await Promise.allSettled([...this.workers.operations.values()]);
        await Promise.all(
          this.ctx.agents.list().map(async (parent) => {
            const record = this.record(parent.id);
            if (record)
              await this.ctx.subagents.drainChildren(
                parent,
                record.workers.map((worker) => SessionId(worker.id)),
              );
          }),
        );
        await this.jobs;
        for (const value of this.mounted.values()) value.dispose();
        this.mounted.clear();
        await archives.dispose();
        await this.domain.close();
      },
      "project-mode.lifecycle",
    );
    this.available = true;
    for (const agent of this.ctx.agents.list()) this.attach(agent);
    for (const [id] of this.domain.table("projects").entries())
      this.enqueue(() => this.recover(SessionId(id)));
  }
  private async recover(parentId: SessionId) {
    {
      using observed = await this.ctx.sessionQuery.observeSession(parentId);
      const before = this.record(parentId)!;
      const modeLocked =
        before.project.modeLocked === true ||
        (before.project.mode === "enabled" &&
          hasOwnTurn(observed.events, observed.inheritedEventCount));
      if (before.project.modeLocked !== modeLocked)
        await this.update(parentId, (current) => ({
          ...current,
          project: { ...current.project, modeLocked },
        }));
      if (repairCapsuleOwnership(before, observed.events) !== before)
        await this.update(parentId, (current) =>
          repairCapsuleOwnership(current, observed.events),
        );
    }
    let parent = this.ctx.agents.get(parentId);
    const r = this.record(parentId)!;
    if (
      !parent &&
      r.assignments.some(
        (a) => a.admission === "prepared" || a.admission === "unknown",
      )
    ) {
      parent = await resolveOrdinaryAgent(this.ctx, parentId);
    }
    if (parent) {
      for (const a of r.assignments)
        if (a.admission === "prepared" || a.admission === "unknown")
          await this.reconcileAssignment(parent, a.id);
      for (const w of r.workers)
        if (w.lifecycle === "deleting") {
          await this.ctx.subagents.drainChildren(parent, [SessionId(w.id)]);
          await this.update(parentId, (state) => ({
            ...state,
            workers: state.workers.map((worker) =>
              worker.id === w.id
                ? { ...worker, lifecycle: "deleted", deletedAt: Date.now() }
                : worker,
            ),
          }));
        }
    }
    for (const w of this.record(parentId)!.workers)
      if (w.lifecycle === "active" || w.lifecycle === "deleted")
        await this.ingest(SessionId(w.id));
    await this.deliver(parentId);
  }
  private record(id: SessionId): RecordState | undefined {
    return this.domain.table("projects").get(id);
  }
  private owner(id: SessionId): RecordState | undefined {
    return [...this.domain.table("projects").entries()]
      .map(([, r]) => r)
      .find((r) => r.workers.some((w) => w.id === id));
  }
  private authorize(id: SessionId) {
    if (!this.available) throw new Error("project-mode/runtime-unavailable");
    if (
      this.ctx.invocation &&
      !this.ctx.get("remoteAccess")?.allows({ kind: "session", id })
    )
      throw new Error("project-mode/unauthorized: Session access denied");
  }
  private attach(agent: Agent) {
    const enabled = this.record(agent.id)?.project.mode === "enabled";
    if (this.reconcilingTools || this.closing.signal.aborted) return;
    const deny = enabled
      ? [...new Set(this.config.coordinatorHiddenTools)].sort()
      : [];
    const key = JSON.stringify([enabled, deny]);
    const old = this.mounted.get(agent);
    if (old?.key === key) return;
    this.reconcilingTools = true;
    try {
      this.mounted.delete(agent);
      old?.dispose();
      if (enabled) {
        const restrictions = deny.length
          ? agent.ctx.tools.suppress({ deny })
          : () => {};
        try {
          const tool = agent.ctx.tools.register(this.controlTool);
          this.mounted.set(agent, {
            key,
            dispose: () => {
              tool();
              restrictions();
            },
          });
        } catch (error) {
          restrictions();
          throw error;
        }
      }
    } finally {
      this.reconcilingTools = false;
    }
    // Other listeners may register tools synchronously during our own change
    // notifications. Revisit their final state; an unchanged deny key is inert.
    if (this.toolsChangedDuringReconciliation) {
      this.toolsChangedDuringReconciliation = false;
      for (const subject of this.ctx.agents.list()) this.attach(subject);
    }
  }

  private roleText(agent: Agent): string {
    const own = this.record(agent.id);
    if (own?.project.mode === "enabled")
      return `${coordinatorPrompt}\nPaths: ${JSON.stringify({ ...own.project.paths, contextIndex: contextIndexPath(own.project.paths) })}`;
    const parent = this.owner(agent.id);
    return parent
      ? `${workerPrompt}\nCoordinator: ${parent.project.coordinatorSessionId}\nPaths: ${JSON.stringify({ ...parent.project.paths, contextIndex: contextIndexPath(parent.project.paths) })}`
      : "";
  }
  private notify() {
    for (const fn of [...this.listeners]) fn();
  }
  private enqueue(work: () => Promise<void>) {
    this.jobs = this.jobs
      .then(work)
      .catch((error) => {
        this.errors.set("runtime", String(error));
        this.ctx.logger.warn(String(error));
      })
      .then(() => this.notify());
  }
  private async update(id: SessionId, fn: (r: RecordState) => RecordState) {
    await this.domain.table("projects").update(id, (r) => {
      const next = fn(r);
      return recordSchema.parse({
        ...next,
        project: {
          ...next.project,
          revision: r.project.revision + 1,
          updatedAt: Date.now(),
        },
      });
    });
    this.notify();
  }
  private worker(r: RecordState, id: SessionId) {
    const w = r.workers.find((w) => w.id === id);
    if (!w) throw new Error("project-mode/not-owned");
    return w;
  }
  private requireCoordinator(agent: Agent) {
    if (
      !this.available ||
      this.ctx.agents.get(agent.id) !== agent ||
      this.record(agent.id)?.project.mode !== "enabled"
    )
      throw new Error("project-mode/not-coordinator");
    return this.record(agent.id)!;
  }
  async controlForAgent(
    agent: Agent,
    request: ControlWorkersRequest,
    operationId: string,
    signal: AbortSignal,
  ): Promise<ControlResult> {
    return this.workers.controlForAgent(agent, request, operationId, signal);
  }
  private reconcileAssignment(agent: Agent, assignmentId: string) {
    return this.workers.reconcileAssignment(agent, assignmentId);
  }
  private async refreshWorkersForInput(
    agent: Agent,
    inputMessageIds: string[],
    signal: AbortSignal,
  ) {
    const superseded = new AbortController();
    const wake = () => {
      if (
        agent.inbox.nextStep.some((message) => message.source.kind === "user")
      )
        superseded.abort(new Error("project-mode/worker-refresh-superseded"));
    };
    this.listeners.add(wake);
    try {
      wake();
      let workers: WorkerView[] | null;
      try {
        workers = await this.workers.listWorkers(
          agent,
          AbortSignal.any([signal, superseded.signal]),
        );
      } catch (error) {
        signal.throwIfAborted();
        if (!superseded.signal.aborted) throw error;
        workers = null;
      }
      signal.throwIfAborted();
      this.workerInputSnapshots.set(
        agent.id,
        `Worker state sampled for this user input (null means unavailable).\n${JSON.stringify({ sampledAt: Date.now(), inputMessageIds, workers })}`,
      );
    } finally {
      this.listeners.delete(wake);
    }
  }
  private async inspect(
    worker: Worker,
    signal?: AbortSignal,
    details = false,
  ): Promise<WorkerView> {
    const view = await this.view(worker, signal);
    try {
      return {
        ...view,
        activity: await readWorkerActivity(
          this.access,
          SessionId(worker.id),
          signal,
          details ? Number.MAX_SAFE_INTEGER : this.config.progressTextMaxChars,
        ),
      };
    } catch {
      signal?.throwIfAborted();
      return { ...view, activity: null };
    }
  }
  private async view(
    worker: Worker,
    signal?: AbortSignal,
  ): Promise<WorkerView> {
    const id = SessionId(worker.id),
      agent = this.ctx.agents.get(id);
    let status: WorkerView["status"] = null,
      availability: WorkerView["availability"] = "unavailable",
      queueLength: number | null = null,
      pendingSteerCount: number | null = null;
    try {
      if (agent) {
        status = agent.status === "running" ? "busy" : "idle";
        availability = "live";
        queueLength = agent.inbox.nextTurn.length;
        pendingSteerCount = agent.inbox.nextStep.length;
      } else {
        using observed = await observeForTurn(this.ctx, id, signal);
        const inbox = observed.projections?.values.inbox;
        if (!inbox) throw new Error("inbox unavailable");
        status = "idle";
        availability = "cold";
        queueLength = inbox["next-turn"].length;
        pendingSteerCount = inbox["next-step"].length;
      }
    } catch {
      signal?.throwIfAborted();
      /* Unavailable stays unknown, never fabricated idle. */
    }
    const last = this.owner(id)
      ?.completions.filter((c) => c.workerId === id)
      .at(-1);
    const text =
      this.progress.get(id) ??
      (status !== "busy"
        ? last?.lastAssistant?.content
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("")
        : undefined);
    return {
      workerId: id,
      name: worker.name,
      lifecycle: worker.lifecycle,
      status,
      availability,
      queueLength,
      pendingSteerCount,
      phase:
        worker.lifecycle === "provision-failed"
          ? "failed"
          : worker.lifecycle === "provisioning"
            ? "starting"
            : availability === "unavailable"
              ? "disconnected"
              : status === "busy"
                ? "working"
                : last?.outcome === "aborted"
                  ? "stopped"
                  : last?.outcome === "error"
                    ? "failed"
                    : "idle",
      ...(text
        ? { progressText: text.slice(0, this.config.progressTextMaxChars) }
        : {}),
      updatedAt: Date.now(),
    };
  }
  private ingest(id: SessionId) {
    return this.outbox.ingest(id);
  }
  private consume(id: SessionId, messageId: string) {
    return this.outbox.consume(id, messageId);
  }
  private deliver(id: SessionId) {
    return this.outbox.deliver(id);
  }
  private guardTurn(agent: Agent, turn: number, signal: AbortSignal) {
    return this.turns.guardTurn(agent, turn, signal);
  }
  private freezeTurn(id: SessionId, turn: number, reason: string) {
    return this.turns.freezeTurn(id, turn, reason);
  }
  @Remote("snapshot")
  async snapshot(sessionId: SessionId): Promise<ProjectSnapshot | null> {
    this.authorize(sessionId);
    await this.jobs;
    const r = this.record(sessionId);
    if (!r) return null;
    const members = r.workers.filter((w) => w.lifecycle !== "deleted"),
      memberIds = new Set(members.map((w) => w.id)),
      workers = await Promise.all(members.map((w) => this.view(w))),
      agent = this.ctx.agents.get(sessionId),
      boundary = agent
        ? this.ctx.sessionProjections.stateOf(agent.session, "turnBoundary")!
        : undefined;
    const turn = boundary?.lastTurn ?? 0;
    const active =
      boundary?.openTurnStartSeq !== null && boundary !== undefined;
    const coordinatorTurn: CoordinatorTurnView | null = active
      ? {
          sessionId,
          turn,
          phase: this.turns.waiting.has(sessionId)
            ? "waiting-workers"
            : "working",
          workerIds: [
            ...new Set(
              r.memberships
                .filter(
                  (m) =>
                    m.coordinatorTurn === turn && memberIds.has(m.workerId),
                )
                .map((m) => SessionId(m.workerId)),
            ),
          ],
          unresolvedOperationIds: r.assignments
            .filter(
              (a) => a.admission === "unknown" || a.admission === "prepared",
            )
            .map((a) => a.operationId),
          pendingAssignmentIds: r.assignments
            .filter(
              (a) =>
                a.admission !== "rejected" &&
                !r.completions.some((c) => c.assignmentIds.includes(a.id)),
            )
            .map((a) => a.id),
          runningWorkerIds: workers
            .filter((w) => w.status === "busy")
            .map((w) => w.workerId),
          queuedWorkerIds: workers
            .filter((w) => w.queueLength)
            .map((w) => w.workerId),
          undeliveredCompletionIds: r.deliveries
            .filter((d) => d.state === "pending")
            .map((d) => d.completionId),
          unconsumedCompletionIds: r.deliveries
            .filter((d) => d.state !== "consumed" && d.state !== "suppressed")
            .map((d) => d.completionId),
          pendingSteerCount: agent?.inbox.nextStep.length ?? 0,
          revision: r.project.revision,
        }
      : null;
    return {
      project: {
        ...r.project,
        coordinatorSessionId: SessionId(r.project.coordinatorSessionId),
      },
      workers,
      turnMemberships: r.memberships
        .filter((m) => memberIds.has(m.workerId))
        .map((m) => ({
          ...m,
          coordinatorSessionId: SessionId(m.coordinatorSessionId),
          workerId: SessionId(m.workerId),
        })),
      closedTurnOutcomes: r.outcomes
        .filter((o) => memberIds.has(o.workerId))
        .map((o) => ({
          ...o,
          coordinatorSessionId: SessionId(o.coordinatorSessionId),
          workerId: SessionId(o.workerId),
        })),
      coordinatorTurn,
      streamEpoch: this.epoch,
      revision: r.project.revision,
    };
  }
  @Remote({ name: "follow", mode: "stream" })
  async *follow(
    sessionId: SessionId,
    signal: AbortSignal,
  ): AsyncIterable<ProjectFrame> {
    const control = AbortSignal.any([signal, this.closing.signal]);
    while (!control.aborted) {
      const iteration = new AbortController();
      const next = abortableChange(
        this.listeners,
        AbortSignal.any([control, iteration.signal]),
      );
      void next.catch(() => {});
      try {
        const value = await this.snapshot(sessionId);
        if (value) yield { type: "baseline", value };
        try {
          await next;
        } catch {
          return;
        }
      } finally {
        iteration.abort();
      }
    }
  }

  @Remote("catalog")
  async catalog(): Promise<ProjectSnapshot[]> {
    if (!this.available) throw new Error("project-mode/runtime-unavailable");
    const result: ProjectSnapshot[] = [];
    for (const [id] of this.domain.table("projects").entries())
      if (
        !this.ctx.invocation ||
        this.ctx
          .get("remoteAccess")
          ?.allows({ kind: "session", id: SessionId(id) })
      ) {
        const snapshot = await this.snapshot(SessionId(id));
        if (snapshot) result.push(snapshot);
      }
    return result;
  }
  @Remote("control")
  async control(
    sessionId: SessionId,
    request: ControlWorkersRequest,
    requestId: string,
    signal: AbortSignal,
  ): Promise<ControlResult> {
    this.authorize(sessionId);
    const agent = this.ctx.agents.get(sessionId);
    if (!agent) throw new Error("project-mode/coordinator-unavailable");
    return this.controlForAgent(agent, request, `remote:${requestId}`, signal);
  }
  @Remote("history")
  async history(
    sessionId: SessionId,
    workerId: SessionId,
    offset: number,
    limit: number,
    signal: AbortSignal,
  ): Promise<WorkerHistoryPage> {
    this.authorize(sessionId);
    const request = historySchema.parse({
      action: "history",
      worker_id: workerId,
      offset,
      limit,
    });
    return this.readHistory(
      sessionId,
      request.worker_id,
      request.offset,
      request.limit,
      signal,
    );
  }
  @Remote({ name: "timeline", mode: "stream" })
  async *timeline(
    sessionId: SessionId,
    workerId: SessionId,
    limit: number,
    signal: AbortSignal,
  ): AsyncIterable<WorkerTimelinePage> {
    this.authorize(sessionId);
    const request = historySchema.parse({
      action: "history",
      worker_id: workerId,
      offset: 0,
      limit,
    });
    yield* followWorkerTimeline(
      this.access,
      sessionId,
      request.worker_id,
      request.limit,
      signal,
    );
  }
  private readHistory(
    parentId: SessionId,
    workerId: SessionId,
    offset: number,
    limit: number,
    signal: AbortSignal,
  ) {
    return readHistory(this.access, parentId, workerId, offset, limit, signal);
  }
  @Remote("mode")
  mode(sessionId: SessionId): SessionModeView {
    this.authorize(sessionId);
    const worker = this.owner(sessionId),
      r = this.record(sessionId),
      agent = this.ctx.agents.get(sessionId);
    const modeLocked = this.modeLocked(r, agent);
    const blocked = worker
      ? "worker-session"
      : modeLocked
        ? "session-mode-locked"
        : !agent && !ordinarySessionResolver(this.ctx)
          ? "runtime-unavailable"
          : agent?.status === "running"
            ? "agent-running"
            : undefined;
    return {
      sessionId,
      role: worker ? "worker" : r ? "coordinator" : "ordinary",
      enabled: r?.project.mode === "enabled",
      modeLocked,
      revision: r?.project.revision ?? 0,
      canToggle: !blocked,
      ...(blocked ? { toggleBlockedReason: blocked } : {}),
      ...(r ? { projectId: r.project.id, paths: r.project.paths } : {}),
      ...(worker
        ? {
            projectId: worker.project.id,
            coordinatorSessionId: SessionId(
              worker.project.coordinatorSessionId,
            ),
          }
        : {}),
    };
  }
  private modeLocked(r: RecordState | undefined, agent?: Agent): boolean {
    return (
      r?.project.mode === "enabled" &&
      // Treat an unmigrated enabled record as fixed until recovery proves it
      // is a draft. Live history closes the gap before turn/start is persisted.
      (r.project.modeLocked !== false ||
        (!!agent &&
          hasOwnTurn(
            agent.session.snapshotEvents(),
            agent.session.inheritedEventCount,
          )))
    );
  }
  @Remote("setEnabled")
  async setEnabled(
    sessionId: SessionId,
    enabled: boolean,
    expectedRevision: number,
    requestId: string,
  ): Promise<SessionModeView> {
    this.authorize(sessionId);
    if (!requestId) throw new Error("requestId required");
    const old = this.record(sessionId);
    if (old?.toggles[requestId] !== undefined) return this.mode(sessionId);
    if (this.owner(sessionId)) throw new Error("project-mode/worker-session");
    if (!enabled && this.modeLocked(old, this.ctx.agents.get(sessionId)))
      throw new Error("project-mode/session-mode-locked");
    if ((old?.project.revision ?? 0) !== expectedRevision)
      throw new Error("project-mode/revision-conflict");
    const agent = await resolveOrdinaryAgent(this.ctx, sessionId);
    if (!agent) throw new Error("project-mode/runtime-unavailable");
    if (this.owner(sessionId)) throw new Error("project-mode/worker-session");
    if (!enabled && this.modeLocked(this.record(sessionId), agent))
      throw new Error("project-mode/session-mode-locked");
    if (agent.status !== "idle") throw new Error("project-mode/agent-running");
    await agent.runMaintenance(async (signal) => {
      let r = this.record(sessionId);
      if (!enabled && this.modeLocked(r, agent))
        throw new Error("project-mode/session-mode-locked");
      if ((r?.project.revision ?? 0) !== expectedRevision)
        throw new Error("project-mode/revision-conflict");
      if (!enabled && r) {
        if (
          r.deliveries.some(
            (d) => d.state !== "consumed" && d.state !== "suppressed",
          )
        )
          throw new Error("project-mode/results-pending");
        const views = await Promise.all(
          r.workers
            .filter(
              (w) =>
                w.lifecycle !== "deleted" && w.lifecycle !== "provision-failed",
            )
            .map((w) => this.view(w)),
        );
        if (
          views.some(
            (v) => v.status !== "idle" || v.queueLength || v.pendingSteerCount,
          ) ||
          r.assignments.some(
            (a) => a.admission === "prepared" || a.admission === "unknown",
          )
        )
          throw new Error("project-mode/workers-active");
      }
      if (!r) {
        if (!enabled) return;
        const cwd = await this.ctx.workingDirectory.ensure(agent, signal),
          id = randomUUID(),
          base = this.config.dataDirectory;
        if (
          isAbsolute(base) ||
          relative(".", base).split(/[\\/]/).includes("..")
        )
          throw new Error("project-mode/invalid-directory");
        const root = resolve(cwd, base, id),
          paths = {
            root,
            context: resolve(root, "context"),
            notes: resolve(root, "notes.md"),
            archived: resolve(root, "archived.md"),
          };
        const presets = this.ctx.get("agentPresets");
        const fs = presets?.serviceFor(agent, "fs") ?? agent.ctx.get("fs");
        if (!fs) throw new Error("project-mode/filesystem-unavailable");
        const cwdTarget = await fs.resolve(cwd);
        const policy = (
          presets?.serviceFor(agent, "sandboxPolicy") ??
          agent.ctx.get("sandboxPolicy")
        )?.resolve({ session: agent.session });
        if (fs.sandboxMode && !policy)
          throw new Error("project-mode/missing-filesystem-policy");
        for (const [path, content] of [
          [paths.notes, "# Active tasks\n"],
          [paths.archived, "# Archived tasks\n"],
          [contextIndexPath(paths), contextIndexTemplate],
        ] as const) {
          const target = await fs.resolve(path, { cwd, signal });
          if (!fs.contains(cwdTarget, target))
            throw new Error("project-mode/path-escape");
          if ((await fs.stat(target, signal)) === undefined)
            await fs.writeText(
              target,
              content,
              { kind: "createIfAbsent" },
              signal,
              policy,
            );
        }
        const now = Date.now();
        r = {
          project: {
            version: 1,
            id,
            coordinatorSessionId: sessionId,
            workspacePath: cwd,
            paths,
            mode: "disabled",
            modeLocked: false,
            revision: 0,
            createdAt: now,
            updatedAt: now,
          },
          workers: [],
          assignments: [],
          completions: [],
          deliveries: [],
          memberships: [],
          outcomes: [],
          operations: {},
          toggles: {},
          reminders: {},
        };
      }
      r = {
        ...r,
        project: {
          ...r.project,
          mode: enabled ? "enabled" : "disabled",
          modeLocked:
            r.project.modeLocked === true ||
            (enabled &&
              hasOwnTurn(
                agent.session.snapshotEvents(),
                agent.session.inheritedEventCount,
              )),
          revision: r.project.revision + 1,
          updatedAt: Date.now(),
        },
        toggles: { ...r.toggles, [requestId]: r.project.revision + 1 },
      };
      await this.domain.table("projects").put(sessionId, recordSchema.parse(r));
      this.attach(agent);
      if (this.record(agent.id)) this.enqueue(() => this.recover(agent.id));
      this.notify();
    });
    return this.mode(sessionId);
  }
}
