import { expect, it, vi } from "vitest";
import { SessionId } from "@deepseek-ai/dsh-session";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { fixture, response } from "./fixture.ts";

const human = (text: string) =>
  createUserMessage({
    source: { kind: "user" },
    content: [{ type: "text", text }],
  });
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function start(f: Fixture, gate: Promise<void>) {
  const { agent: parent } = await f.ctx.agents.create({
    sessionId: SessionId("sync-parent"),
    meta: { cwd: f.root },
    agentOptions: { provider: "test", model: "test" },
  });
  await f.ctx.projectMode.setEnabled(parent.id, true, 0, "on");
  f.adapter.handler = async (request) => {
    if (request.sessionId !== parent.id) await gate;
    return response("done");
  };
  const receipt = (await f.ctx.projectMode.controlForAgent(
    parent,
    { action: "spawn", name: "worker", task: "original assignment" },
    "spawn",
    new AbortController().signal,
  )) as { workerId: ReturnType<typeof SessionId> };
  const child = f.ctx.agents.get(receipt.workerId)!;
  await vi.waitFor(() =>
    expect(f.adapter.requests.some((r) => r.sessionId === child.id)).toBe(true),
  );
  return { parent, child };
}
async function list(f: Fixture, id: ReturnType<typeof SessionId>) {
  return (await f.ctx.projectMode.controlForAgent(
    f.ctx.agents.get(id)!,
    { action: "list" },
    "list",
    new AbortController().signal,
  )) as any[];
}

it("lists human changes before completion, distinguishes queue/steer, and never wakes the coordinator", async () => {
  const f = await fixture();
  const gate = Promise.withResolvers<void>();
  try {
    const { parent, child } = await start(f, gate.promise);
    const queued = human("after this turn, inspect the new requirements");
    const steered = human("user changed the current scope");
    child.followup(queued);
    child.steer(steered);
    const before = (await f.ctx.projectMode.snapshot(parent.id))!
      .turnMemberships;
    const [view] = await list(f, parent.id);
    expect(view.status).toBe("busy");
    expect(view.activity.lastUserInput).toMatchObject({
      messageId: steered.id,
      actor: "user",
      text: "user changed the current scope",
      state: "pending-steer",
    });
    expect(view.activity.pendingUserInputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          messageId: queued.id,
          state: "pending-queue",
        }),
        expect.objectContaining({
          messageId: steered.id,
          state: "pending-steer",
        }),
      ]),
    );
    expect(view.activity.latestInput.actor).toBe("coordinator");
    expect(
      f.adapter.requests.filter((r) => r.sessionId === parent.id),
    ).toHaveLength(0);
    expect(
      (await f.ctx.projectMode.snapshot(parent.id))!.turnMemberships,
    ).toEqual(before);
  } finally {
    gate.resolve();
    await f.dispose();
  }
});

it("reflects edited pending human input and stops presenting removed queue items", async () => {
  const f = await fixture();
  const gate = Promise.withResolvers<void>();
  try {
    const { parent, child } = await start(f, gate.promise);
    const input = human("old user scope");
    child.followup(input);
    child.inbox.replace(input.id, {
      ...input,
      content: [{ type: "text", text: "corrected user scope" }],
    });
    expect((await list(f, parent.id))[0].activity.lastUserInput).toMatchObject({
      text: "corrected user scope",
      state: "pending-queue",
    });
    child.inbox.remove(input.id);
    const activity = (await list(f, parent.id))[0].activity;
    expect(activity.pendingUserInputs).toEqual([]);
    expect(activity.lastUserInput).toBeUndefined();
  } finally {
    gate.resolve();
    await f.dispose();
  }
});

it("keeps list previews bounded and returns full pending user text through get before it enters history", async () => {
  const f = await fixture();
  const gate = Promise.withResolvers<void>();
  try {
    const { parent, child } = await start(f, gate.promise);
    const text = "complete user direction: " + "detail ".repeat(80);
    child.followup(human(text));
    expect((await list(f, parent.id))[0].activity.lastUserInput).toMatchObject({
      truncated: true,
      state: "pending-queue",
    });
    const details = (await f.ctx.projectMode.controlForAgent(
      parent,
      { action: "get", worker_id: child.id },
      "get",
      new AbortController().signal,
    )) as any;
    expect(details.activity.lastUserInput).toMatchObject({
      text,
      truncated: false,
      state: "pending-queue",
    });
    expect(details.activity.pendingUserInputs[0].text).toBe(text);
  } finally {
    gate.resolve();
    await f.dispose();
  }
});

it("refreshes required worker context for every human input, including steer in the same native turn", async () => {
  const f = await fixture();
  const gate = Promise.withResolvers<void>();
  try {
    const { parent, child } = await start(f, gate.promise);
    child.steer(human("user now wants a different output"));
    const memberships = (await f.ctx.projectMode.snapshot(parent.id))!
      .turnMemberships;
    parent.followup(human("what is the worker doing now?"));
    const requests = () =>
      f.adapter.requests.filter((r) => r.sessionId === parent.id);
    await vi.waitFor(() => expect(requests().length).toBe(1));
    const runtime = (r: any) =>
      JSON.stringify(
        r.messages.filter((m: any) => m.source.kind === "runtime-context"),
      );
    expect(runtime(requests()[0])).toContain(
      "user now wants a different output",
    );
    expect(runtime(requests()[0])).toContain("pending-steer");
    child.steer(human("newer user instruction while still busy"));
    parent.steer(human("check again"));
    await vi.waitFor(() => expect(requests().length).toBe(2));
    expect(runtime(requests()[1])).toContain(
      "newer user instruction while still busy",
    );
    expect(
      (await f.ctx.projectMode.snapshot(parent.id))!.turnMemberships,
    ).toEqual(memberships);
    expect(
      parent.session.snapshotEvents().filter((e) => e.type === "turn/start"),
    ).toHaveLength(1);
  } finally {
    gate.resolve();
    await f.dispose();
  }
});

it("recovers user involvement from a cold native Session without waking or restoring its worker", async () => {
  let f = await fixture(undefined, { keepFiles: true });
  const gate = Promise.withResolvers<void>();
  try {
    const { parent, child } = await start(f, gate.promise);
    child.steer(human("user changed this assignment directly"));
    gate.resolve();
    await child.whenIdle();
    await f.ctx.projectMode.snapshot(parent.id);
    await parent.whenIdle();
    const id = parent.id,
      childId = child.id,
      root = f.root;
    await f.dispose();
    f = await fixture(undefined, { root });
    await f.ctx.agents.resume({
      resumeSessionId: id,
      agentOptions: { provider: "test", model: "test" },
    });
    const [view] = await list(f, id);
    expect(view).toMatchObject({
      availability: "cold",
      activity: {
        lastUserInput: {
          actor: "user",
          text: "user changed this assignment directly",
          state: "committed",
        },
      },
    });
    expect(f.ctx.agents.get(childId)).toBeUndefined();
    expect(f.adapter.requests).toHaveLength(0);
  } finally {
    gate.resolve();
    await f.dispose();
  }
});
