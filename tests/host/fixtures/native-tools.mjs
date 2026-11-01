export const name = "native-tools";
export const inject = ["tools"];
export function apply(ctx) {
  for (const name of [
    "subagent",
    "subagent_fork",
    "list_agents",
    "send_message",
    "interrupt_agent",
    "list_subagent_models",
  ])
    ctx.tools.register({
      name,
      description: "Preset tool fixture",
      parameters: { type: "object", properties: {} },
      output: {
        schema: { type: "string" },
        render: (_a, v) => [{ type: "text", text: v }],
      },
      execute: async () => name,
    });
}
