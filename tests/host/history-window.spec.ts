import { expect, it } from "vitest";
import { SessionId } from "@deepseek-ai/dsh-session";
import { createUserMessage, type StreamChunk } from "@deepseek-ai/dsh-llm";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { fixture, response } from "./fixture.ts";

async function start() {
  const f = await fixture();
  const entered = Promise.withResolvers<void>();
  const gate = Promise.withResolvers<void>();
  const fullReply = "完整回复。".repeat(15000) + "END_OF_REPLY";
  f.ctx.systemPrompt.context({
    name: "history-internal",
    order: 100,
    required: true,
    text: "INTERNAL_CONTEXT_MUST_NOT_APPEAR",
  });
  f.ctx.tools.register(
    defineTool({
      name: "history_gate",
      description: "Controlled native tool for history observation",
      parameters: {},
      output: {
        schema: { type: "string" },
        render: (_args, value) => [{ type: "text", text: value }],
      },
      execute: async () => {
        entered.resolve();
        await gate.promise;
        return "INTERNAL_TOOL_RESULT_MUST_NOT_APPEAR";
      },
    }),
  );
  const { agent: parent } = await f.ctx.agents.create({
    sessionId: SessionId("history-window-parent"),
    meta: { cwd: f.root },
    agentOptions: { provider: "test", model: "test" },
  });
  await f.ctx.projectMode.setEnabled(parent.id, true, 0, "enable");
  let calls = 0;
  f.adapter.handler = (request): StreamChunk[] => {
    if (request.sessionId === parent.id) return response("reviewed");
    if (calls++ > 0) return response(fullReply);
    return [
      ...response("VISIBLE_INTERMEDIATE_REPLY").slice(0, -1),
      { type: "block-start", index: 1, blockType: "tool-call" },
      {
        type: "tool-call-delta",
        index: 1,
        id: "gate",
        name: "history_gate",
        argumentsDelta: "{}",
      },
      {
        type: "block-end",
        index: 1,
        block: {
          type: "tool-call",
          id: "gate",
          name: "history_gate",
          arguments: "{}",
        },
      },
      { type: "finish", reason: { kind: "tool-calls" } },
    ];
  };
  const receipt = (await f.ctx.projectMode.controlForAgent(
    parent,
    { action: "spawn", name: "history-window", task: "ORIGINAL_TASK" },
    "spawn",
    new AbortController().signal,
  )) as { workerId: SessionId };
  const child = f.ctx.agents.get(receipt.workerId)!;
  await entered.promise;
  return { ...f, parent, child, gate, fullReply };
}

it("reads visible human/AI windows from the newest message while a worker is active", async () => {
  const f = await start();
  try {
    const membership = (await f.ctx.projectMode.snapshot(f.parent.id))!
      .turnMemberships;
    const requests = f.adapter.requests.length;
    const page = await f.ctx.projectMode.history(
      f.parent.id,
      f.child.id,
      0,
      2,
      new AbortController().signal,
    );
    expect(page).toMatchObject({
      workerId: f.child.id,
      status: "busy",
      offset: 0,
      limit: 2,
      total: 2,
    });
    expect(page.messages.map((m) => [m.index, m.role, m.text])).toEqual([
      [0, "assistant", "VISIBLE_INTERMEDIATE_REPLY"],
      [1, "user", "ORIGINAL_TASK"],
    ]);
    const older = await f.ctx.projectMode.history(
      f.parent.id,
      f.child.id,
      1,
      1,
      new AbortController().signal,
    );
    expect(older.messages.map((m) => m.text)).toEqual(["ORIGINAL_TASK"]);
    expect(f.adapter.requests).toHaveLength(requests);
    expect(
      (await f.ctx.projectMode.snapshot(f.parent.id))!.turnMemberships,
    ).toEqual(membership);
  } finally {
    f.gate.resolve();
    await f.dispose();
  }
});

it("returns more than 100 messages and full text, with ordinary empty out-of-range windows", async () => {
  const f = await start();
  try {
    f.child.steer(
      createUserMessage({
        source: {
          kind: "project-mode-notice",
          form: "notice",
          summary: "internal",
        },
        content: [{ type: "text", text: "INTERNAL_NOTICE_MUST_NOT_APPEAR" }],
      }),
    );
    for (let i = 0; i < 110; i++)
      f.child.steer(
        createUserMessage({
          source: { kind: "user" },
          content: [{ type: "text", text: `HUMAN_${i}` }],
        }),
      );
    f.gate.resolve();
    await f.child.whenIdle();
    await f.ctx.projectMode.snapshot(f.parent.id);
    await f.parent.whenIdle();
    const signal = new AbortController().signal;
    const page = await f.ctx.projectMode.history(
      f.parent.id,
      f.child.id,
      0,
      200,
      signal,
    );
    expect(page.status).toBe("idle");
    expect(page.total).toBe(113);
    expect(page.messages).toHaveLength(113);
    expect(page.messages[0].text).toBe(f.fullReply);
    expect(page.messages.at(-1)?.text).toBe("ORIGINAL_TASK");
    expect(JSON.stringify(page.messages)).not.toContain("MUST_NOT_APPEAR");
    const window = await f.ctx.projectMode.history(
      f.parent.id,
      f.child.id,
      1,
      3,
      signal,
    );
    expect(window.messages.map((m) => [m.index, m.text])).toEqual([
      [1, "HUMAN_109"],
      [2, "HUMAN_108"],
      [3, "HUMAN_107"],
    ]);
    expect(
      (await f.ctx.projectMode.history(f.parent.id, f.child.id, 999, 5, signal))
        .messages,
    ).toEqual([]);
    expect(
      (await f.ctx.projectMode.history(f.parent.id, f.child.id, 0, 0, signal))
        .messages,
    ).toEqual([]);
  } finally {
    f.gate.resolve();
    await f.dispose();
  }
});
