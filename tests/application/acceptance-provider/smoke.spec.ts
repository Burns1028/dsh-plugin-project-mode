import { it, expect } from "vitest";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { SessionId } from "@deepseek-ai/dsh-session";
import { createUserMessage, BlockAssembler } from "@deepseek-ai/dsh-llm";
import { fixture } from "../../host/fixture.ts";
import * as Provider from "./index.mjs";

it.each(["normal", "queue"])(
  "scripted %s model runs native tools and verifies native canonical results",
  async (scenario) => {
    const f = await fixture();
    try {
      const controlRoot = join(f.root, "control");
      const logRoot = join(f.root, "logs");
      await mkdir(join(controlRoot, scenario), { recursive: true });
      if (scenario === "normal")
        await writeFile(join(controlRoot, scenario, "release"), "release");
      await f.ctx.plugin(Provider, { controlRoot, logRoot, chunkDelayMs: 0 });
      const { agent } = await f.ctx.agents.create({
        sessionId: SessionId(`acceptance-${scenario}`),
        meta: { cwd: f.root },
        agentOptions: { provider: Provider.PROVIDER, model: Provider.MODEL },
      });
      await f.ctx.projectMode.setEnabled(agent.id, true, 0, "enable");
      agent.followup(
        createUserMessage({
          source: { kind: "user" },
          content: [{ type: "text", text: `[PM ACCEPT ${scenario}]` }],
        }),
      );
      const eventualRelease =
        scenario === "queue"
          ? delay(200).then(() =>
              writeFile(join(controlRoot, scenario, "release"), "release"),
            )
          : Promise.resolve();
      await Promise.all([agent.whenIdle(), eventualRelease]);
      const events = agent.session.snapshotEvents();
      const results = events.filter(
        (event) =>
          event.type === "user/message" &&
          event.data.source.kind === "project-mode-result",
      );
      const endReasons = events
        .filter((event) => event.type === "turn/end")
        .map((event) => event.data.reason.kind);
      expect(
        results,
        `Native coordinator ended with ${JSON.stringify(endReasons)} before full results`,
      ).toHaveLength(2);
      expect(
        events.filter((event) => event.type === "turn/start"),
      ).toHaveLength(1);
      expect(events.filter((event) => event.type === "turn/end")).toHaveLength(
        1,
      );
      expect(JSON.stringify(events)).toContain(`PM_MAIN_FINAL ${scenario}`);
      const lines = (await readFile(join(logRoot, "trace.jsonl"), "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(
        lines.filter((line) => line.kind === "canonical-result"),
      ).toHaveLength(2);
      expect(
        lines
          .filter((line) => line.kind === "canonical-result")
          .every((line) => line.fullFinalPresent),
      ).toBe(true);
    } finally {
      await f.dispose();
    }
  },
);

it("emits only public tool StreamChunks accepted by the native assembler and aborts a closed gate promptly", async () => {
  const adapter = new Provider.AcceptanceAdapter(
    {},
    { controlRoot: "/nonexistent-pm-acceptance-control", chunkDelayMs: 0 },
    async () => {},
  );
  const assembler = new BlockAssembler();
  for await (const chunk of adapter.toolCalls([{ action: "list" }], {
    sessionId: "smoke",
    tools: [{ name: "control_workers" }],
  }))
    assembler.push(chunk);
  expect(assembler.blocks()).toMatchObject([
    {
      type: "tool-call",
      name: "control_workers",
      arguments: '{"action":"list"}',
    },
  ]);
  const controller = new AbortController();
  const gate = adapter.waitGate("normal", controller.signal);
  controller.abort();
  await expect(gate).rejects.toThrow();
});
