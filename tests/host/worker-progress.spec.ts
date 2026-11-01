import { expect, it } from "vitest";
import { SessionId } from "@deepseek-ai/dsh-session";
import { fixture, response } from "./fixture.ts";

it("does not display the previous final answer as progress of a reused busy worker", async () => {
  const f = await fixture();
  const gate = Promise.withResolvers<void>();
  try {
    const { agent } = await f.ctx.agents.create({
      sessionId: SessionId("progress-parent"),
      meta: { cwd: f.root },
      agentOptions: { provider: "test", model: "test" },
    });
    await f.ctx.projectMode.setEnabled(agent.id, true, 0, "on");
    f.adapter.handler = () => response("first final");
    const { workerId } = (await f.ctx.projectMode.controlForAgent(
      agent,
      { action: "spawn", name: "worker", task: "first" },
      "spawn",
      new AbortController().signal,
    )) as { workerId: ReturnType<typeof SessionId> };
    await f.ctx.agents.get(workerId)?.whenIdle();
    await f.ctx.projectMode.snapshot(agent.id);
    await agent.whenIdle();
    f.adapter.handler = async (options) => {
      if (options.sessionId === workerId) await gate.promise;
      return response("second final");
    };
    await f.ctx.projectMode.controlForAgent(
      agent,
      {
        action: "send",
        worker_id: workerId,
        message: "second",
        delivery: "queue",
      },
      "send",
      new AbortController().signal,
    );
    const view = (await f.ctx.projectMode.snapshot(agent.id))!.workers[0];
    expect(view.phase).toBe("working");
    expect(view.progressText).toBeUndefined();
  } finally {
    gate.resolve();
    await f.dispose();
  }
});
