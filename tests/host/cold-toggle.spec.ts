import { expect, it } from "vitest";
import { SessionId } from "@deepseek-ai/dsh-session";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { RemoteError } from "@deepseek-ai/dsh-typert-protocol";
import type { SessionController } from "@deepseek-ai/dsh-api-session-controller";
import { fixture, response } from "./fixture.ts";

type Fixture = Awaited<ReturnType<typeof fixture>>;
// Explicit public API boundary: restoration itself uses the real native registry
// and JSONL persistence. Full SessionController composition is not mounted here.
async function provideResolver(
  f: Fixture,
  resolveAgent: SessionController["resolveAgent"],
) {
  const boundary: Pick<SessionController, "resolveAgent"> = { resolveAgent };
  await f.ctx.provide("sessionController", boundary as SessionController);
}

it("offers cold ordinary enable and waits for native restoration of the same Session without a model request", async () => {
  const f = await fixture();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  try {
    const handle = await f.ctx.agents.create({
      sessionId: SessionId("cold-toggle"),
      meta: { cwd: f.root },
      agentOptions: { provider: "test", model: "test" },
    });
    handle.agent.followup(
      createUserMessage({
        source: { kind: "user" },
        content: [{ type: "text", text: "saved history" }],
      }),
    );
    await handle.agent.whenIdle();
    await handle.dispose();
    using observed = await f.ctx.sessionQuery.observeSession(handle.agent.id);
    expect(
      observed.events.some((event) => event.type === "assistant/message"),
    ).toBe(true);
    f.adapter.requests.length = 0;
    let calls = 0;
    let entered!: () => void;
    const entering = new Promise<void>((resolve) => (entered = resolve));
    await provideResolver(f, async (sessionId) => {
      calls++;
      entered();
      await gate;
      return f.ctx.agents.resume({
        resumeSessionId: sessionId,
        agentOptions: { provider: "test", model: "test" },
      });
    });
    expect(f.ctx.agents.get(handle.agent.id)).toBeUndefined();
    expect(f.ctx.projectMode.mode(handle.agent.id)).toMatchObject({
      role: "ordinary",
      canToggle: true,
      enabled: false,
    });
    expect(calls).toBe(0);
    const pending = f.ctx.projectMode.setEnabled(
      handle.agent.id,
      true,
      0,
      "enable",
    );
    await entering;
    expect(f.ctx.agents.get(handle.agent.id)).toBeUndefined();
    expect(f.adapter.requests).toHaveLength(0);
    release();
    expect(await pending).toMatchObject({
      enabled: true,
      role: "coordinator",
      sessionId: handle.agent.id,
    });
    const restored = f.ctx.agents.get(handle.agent.id)!;
    expect(restored.session.header.id).toBe(observed.header.id);
    expect(
      restored.session.snapshotEvents().slice(0, observed.events.length),
    ).toEqual(observed.events);
    expect(restored.status).toBe("idle");
    expect(f.adapter.requests).toHaveLength(0);
    expect(calls).toBe(1);
  } finally {
    release();
    await f.dispose();
  }
});

it("keeps a cold toggle unavailable without the native resolver", async () => {
  const f = await fixture();
  try {
    const id = SessionId("unavailable");
    expect(f.ctx.projectMode.mode(id)).toMatchObject({
      canToggle: false,
      toggleBlockedReason: "runtime-unavailable",
    });
    await expect(
      f.ctx.projectMode.setEnabled(id, true, 0, "enable"),
    ).rejects.toThrow("project-mode/runtime-unavailable");
    expect(f.adapter.requests).toHaveLength(0);
  } finally {
    await f.dispose();
  }
});

for (const kind of ["missing", "owned"] as const) {
  it(`preserves native ${kind} Session rejection from explicit cold resolution`, async () => {
    const f = await fixture();
    try {
      const id = SessionId(`cold-${kind}`);
      const error =
        kind === "missing"
          ? new RemoteError("session/not-found", "Session does not exist", {
              sessionId: id,
            })
          : new RemoteError(
              "session/agent-busy",
              "Session is owned by subagent routing",
              { reason: "use subagent delivery for this child session" },
            );
      await provideResolver(f, async () => ({ error }));
      await expect(
        f.ctx.projectMode.setEnabled(id, true, 0, "enable"),
      ).rejects.toBe(error);
      expect(await f.ctx.projectMode.snapshot(id)).toBeNull();
      expect(f.ctx.agents.get(id)).toBeUndefined();
      expect(f.adapter.requests).toHaveLength(0);
    } finally {
      await f.dispose();
    }
  });
}

it("automatically restores a cold coordinator through sessionController and consumes a worker result exactly once", async () => {
  const f = await fixture();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  try {
    const handle = await f.ctx.agents.create({
      sessionId: SessionId("cold-result-parent"),
      meta: { cwd: f.root },
      agentOptions: { provider: "test", model: "test" },
    });
    const parentId = handle.agent.id;
    await f.ctx.projectMode.setEnabled(parentId, true, 0, "enable");
    const resolved: string[] = [];
    await provideResolver(f, async (sessionId) => {
      resolved.push(sessionId);
      return f.ctx.agents.resume({
        resumeSessionId: sessionId,
        agentOptions: { provider: "test", model: "test" },
      });
    });
    f.adapter.handler = async (options) => {
      if (options.sessionId !== parentId) await gate;
      return response(
        options.sessionId === parentId
          ? "result reviewed"
          : "complete worker result",
      );
    };
    const receipt = (await f.ctx.projectMode.controlForAgent(
      handle.agent,
      { action: "spawn", name: "worker", task: "work" },
      "spawn",
      new AbortController().signal,
    )) as { workerId: ReturnType<typeof SessionId> };
    const worker = f.ctx.agents.get(receipt.workerId)!;
    await handle.dispose();
    expect(f.ctx.agents.get(parentId)).toBeUndefined();
    expect(worker.status).toBe("running");
    release();
    await worker.whenIdle();
    await f.ctx.projectMode.snapshot(parentId);
    const restored = f.ctx.agents.get(parentId);
    expect(restored).toBeDefined();
    await restored!.whenIdle();
    await f.ctx.projectMode.snapshot(parentId);
    expect(resolved).toEqual([parentId]);
    expect(
      restored!.session
        .snapshotEvents()
        .filter(
          (event) =>
            event.type === "user/message" &&
            event.data.source.kind === "project-mode-result",
        ),
    ).toHaveLength(1);
    expect(
      f.adapter.requests.filter((request) => request.sessionId === parentId),
    ).toHaveLength(1);
    expect(
      (f.ctx.projectMode as any).record(parentId).deliveries,
    ).toMatchObject([{ state: "consumed" }]);
    await f.ctx.projectMode.snapshot(parentId);
    expect(
      f.adapter.requests.filter((request) => request.sessionId === parentId),
    ).toHaveLength(1);
  } finally {
    release();
    await f.dispose();
  }
});

it("rejects a restored Agent that starts running before enable reaches maintenance", async () => {
  const f = await fixture();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  try {
    const handle = await f.ctx.agents.create({
      sessionId: SessionId("cold-became-running"),
      meta: { cwd: f.root },
      agentOptions: { provider: "test", model: "test" },
    });
    await f.ctx.sessions.flush(handle.agent.session);
    await handle.dispose();
    f.adapter.handler = async () => {
      await gate;
      return response("done");
    };
    await provideResolver(f, async (sessionId) => {
      const restored = await f.ctx.agents.resume({
        resumeSessionId: sessionId,
        agentOptions: { provider: "test", model: "test" },
      });
      // A concurrent ordinary user request wins the race with this toggle.
      restored.agent.followup(
        createUserMessage({
          source: { kind: "user" },
          content: [{ type: "text", text: "concurrent input" }],
        }),
      );
      return restored;
    });
    await expect(
      f.ctx.projectMode.setEnabled(handle.agent.id, true, 0, "enable"),
    ).rejects.toThrow("project-mode/agent-running");
    expect(await f.ctx.projectMode.snapshot(handle.agent.id)).toBeNull();
    release();
    await f.ctx.agents.get(handle.agent.id)?.whenIdle();
  } finally {
    release();
    await f.dispose();
  }
});
