import { expect, it } from "vitest";
import { SessionId } from "@deepseek-ai/dsh-session";
import { defineTool } from "@deepseek-ai/dsh-tools";
import type {} from "@deepseek-ai/dsh-tool-present/types";
import { fixture, response } from "./fixture.ts";

it("streams native turns newest first with visible dialogue and recorded artifacts, including empty failures", async () => {
  const f = await fixture();
  try {
    expect(typeof (f.ctx.projectMode as any).timeline).toBe("function");
    f.ctx.tools.register(
      defineTool({
        name: "timeline_probe",
        description: "Record an artifact",
        parameters: {},
        output: {
          schema: { type: "string" },
          render: () => [{ type: "text", text: "INTERNAL_TOOL_RESULT" }],
          presentationMeta: () => ({
            path: "report.md",
            diffs: [{ path: "report.md", oldText: null, newText: "report" }],
          }),
        },
        execute: async (_args, exec) => {
          exec.agent!.session.append("deliverables/presented", {
            turn: 1,
            callId: exec.callId,
            files: [{ path: "final.pdf", description: "Final document" }],
          });
          return "ok";
        },
      }),
    );
    const { agent: parent } = await f.ctx.agents.create({
      sessionId: SessionId("timeline-parent"),
      meta: { cwd: f.root },
      agentOptions: { provider: "test", model: "test" },
    });
    await f.ctx.projectMode.setEnabled(parent.id, true, 0, "enable");
    let workerCalls = 0;
    f.adapter.handler = (request) => {
      if (request.sessionId === parent.id) return response("reviewed");
      if (workerCalls++ > 1) throw new Error("no AI reply");
      if (workerCalls === 2) return response("FIRST_FINAL");
      return [
        ...response("VISIBLE_INTERMEDIATE").slice(0, -1),
        { type: "block-start", index: 1, blockType: "tool-call" },
        {
          type: "tool-call-delta",
          index: 1,
          id: "probe",
          name: "timeline_probe",
          argumentsDelta: "{}",
        },
        {
          type: "block-end",
          index: 1,
          block: {
            type: "tool-call",
            id: "probe",
            name: "timeline_probe",
            arguments: "{}",
          },
        },
        { type: "finish", reason: { kind: "tool-calls" } },
      ];
    };
    const signal = new AbortController().signal;
    const receipt = (await f.ctx.projectMode.controlForAgent(
      parent,
      { action: "spawn", name: "writer", task: "FIRST_INPUT" },
      "spawn",
      signal,
    )) as { workerId: SessionId };
    const childId = receipt.workerId;
    await f.ctx.agents.get(childId)?.whenIdle();
    await f.ctx.projectMode.snapshot(parent.id);
    await parent.whenIdle();
    await f.ctx.projectMode.controlForAgent(
      parent,
      {
        action: "send",
        worker_id: childId,
        message: "SECOND_INPUT",
        delivery: "queue",
      },
      "second",
      signal,
    );
    await f.ctx.agents.get(childId)?.whenIdle();
    await f.ctx.projectMode.snapshot(parent.id);
    await parent.whenIdle();
    const before = f.adapter.requests.length;
    const controller = new AbortController();
    const stream = (f.ctx.projectMode as any)
      .timeline(parent.id, childId, 10, controller.signal)
      [Symbol.asyncIterator]();
    const page = (await stream.next()).value;
    expect(page).toMatchObject({
      workerId: childId,
      total: 2,
      hasMore: false,
    });
    expect(page.turns.map((turn: any) => turn.turn)).toEqual([2, 1]);
    expect(page.turns[0]).toMatchObject({
      outcome: "error",
      outputs: [],
      inputs: [{ text: "SECOND_INPUT", actor: "coordinator" }],
    });
    expect(page.turns[1]).toMatchObject({
      outcome: "completed",
      inputs: [{ text: "FIRST_INPUT", actor: "coordinator" }],
    });
    expect(page.turns[1].outputs.map((message: any) => message.text)).toEqual([
      "FIRST_FINAL",
    ]);
    expect(page.turns[1].artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "report.md", kind: "changed" }),
        expect.objectContaining({
          path: "final.pdf",
          kind: "presented",
          description: "Final document",
        }),
      ]),
    );
    expect(
      page.turns.every(
        (turn: any) => turn.startedAt > 0 && turn.finishedAt >= turn.startedAt,
      ),
    ).toBe(true);
    expect(JSON.stringify(page)).not.toContain("INTERNAL_TOOL_RESULT");
    expect(f.adapter.requests).toHaveLength(before);
    const updated = stream.next();
    f.adapter.handler = (request) =>
      response(request.sessionId === parent.id ? "reviewed" : "THIRD_FINAL");
    await f.ctx.projectMode.controlForAgent(
      parent,
      {
        action: "send",
        worker_id: childId,
        message: "THIRD_INPUT",
        delivery: "queue",
      },
      "third",
      signal,
    );
    await f.ctx.agents.get(childId)?.whenIdle();
    await f.ctx.projectMode.snapshot(parent.id);
    await parent.whenIdle();
    let latest = (await updated).value;
    for (let i = 0; i < 8 && latest.turns[0]?.outcome !== "completed"; i++)
      latest = (await stream.next()).value;
    expect(latest.turns[0]).toMatchObject({
      turn: 3,
      outcome: "completed",
      outputs: [{ text: "THIRD_FINAL" }],
    });
    const pending = stream.next();
    controller.abort();
    expect((await pending).done).toBe(true);
  } finally {
    await f.dispose();
  }
});
