import { defineConfig } from "vitest/config";
import ts from "typescript";
export default defineConfig({
  plugins: [
    {
      name: "standard-decorators",
      enforce: "pre",
      transform(code, id) {
        if (id.endsWith(".ts") && /^\s*@Remote/m.test(code))
          return ts.transpileModule(code, {
            fileName: id,
            compilerOptions: {
              target: ts.ScriptTarget.ES2024,
              module: ts.ModuleKind.ESNext,
              sourceMap: true,
            },
          }).outputText;
      },
    },
  ],
  test: {
    testTimeout: 15000,
    hookTimeout: 15000,
    server: { deps: { inline: ["@deepseek-ai/dsh-client-ui-primitives"] } },
  },
});
